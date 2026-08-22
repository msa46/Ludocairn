import { describe, expect, it, vi } from 'vitest'

import {
  startPwaRegistration,
  type PwaState,
  type RegisterWorkerCallbacks,
} from './register'

type IntervalCallback = () => void

function createVisibility(
  visibilityState: DocumentVisibilityState = 'visible',
) {
  let listener: (() => void) | undefined

  return {
    visibility: {
      get visibilityState() {
        return visibilityState
      },
      addEventListener: vi.fn((type: 'visibilitychange', next: () => void) => {
        if (type === 'visibilitychange') listener = next
      }),
      removeEventListener: vi.fn(
        (type: 'visibilitychange', next: () => void) => {
          if (type === 'visibilitychange' && listener === next)
            listener = undefined
        },
      ),
    },
    setVisibility(next: DocumentVisibilityState) {
      visibilityState = next
    },
    notifyVisibilityChange() {
      listener?.()
    },
  }
}

function createTimers() {
  let nextId = 1
  const callbacks = new Map<number, IntervalCallback>()
  const timeoutCallbacks = new Map<number, IntervalCallback>()

  return {
    callbacks,
    setInterval: vi.fn((callback: IntervalCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    clearInterval: vi.fn((id: number) => {
      callbacks.delete(id)
    }),
    setTimeout: vi.fn((callback: IntervalCallback) => {
      const id = nextId++
      timeoutCallbacks.set(id, callback)
      return id
    }),
    clearTimeout: vi.fn((id: number) => {
      timeoutCallbacks.delete(id)
    }),
    timeoutCallbacks,
  }
}

function createServiceWorkers() {
  let controller = {} as ServiceWorker
  let listener: (() => void) | undefined

  return {
    boundary: {
      get controller() {
        return controller
      },
      addEventListener: vi.fn((type: 'controllerchange', next: () => void) => {
        if (type === 'controllerchange') listener = next
      }),
      removeEventListener: vi.fn(
        (type: 'controllerchange', next: () => void) => {
          if (type === 'controllerchange' && listener === next)
            listener = undefined
        },
      ),
    },
    changeController() {
      controller = {} as ServiceWorker
      listener?.()
    },
  }
}

function createRegistration() {
  return {
    update: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration
}

describe('startPwaRegistration', () => {
  it('reports offline readiness without blocking registration', () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    const registration = createRegistration()
    let callbacks: RegisterWorkerCallbacks | undefined
    const registerWorker = vi.fn((next: RegisterWorkerCallbacks) => {
      callbacks = next
      return vi.fn().mockResolvedValue(undefined)
    })

    startPwaRegistration({
      registerWorker,
      visibility: visibility.visibility,
      timers,
      onStateChange: (state) => states.push(state),
    })

    callbacks?.onOfflineReady()
    callbacks?.onRegistered(registration)

    expect(registerWorker).toHaveBeenCalledOnce()
    expect(states).toEqual(['offline-ready'])
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('reports a waiting update and activates only through update()', async () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    const serviceWorkers = createServiceWorkers()
    let callbacks: RegisterWorkerCallbacks | undefined
    const updateSW = vi
      .fn<(reloadPage?: boolean) => Promise<void>>()
      .mockResolvedValue(undefined)
    const controller = startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return updateSW
      },
      visibility: visibility.visibility,
      timers,
      serviceWorkers: serviceWorkers.boundary,
      onStateChange: (state) => states.push(state),
    })

    callbacks?.onNeedRefresh()

    expect(states).toEqual(['update-available'])
    expect(updateSW).not.toHaveBeenCalled()

    const activation = controller.update()
    await Promise.resolve()

    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(updateSW).toHaveBeenCalledWith(true)
    let completed = false
    void activation.then(() => {
      completed = true
    })
    await Promise.resolve()
    expect(completed).toBe(false)

    serviceWorkers.changeController()
    await activation
    expect(completed).toBe(true)
  })

  it('rejects when the waiting worker becomes redundant before control changes', async () => {
    const visibility = createVisibility()
    const timers = createTimers()
    const serviceWorkers = createServiceWorkers()
    let stateListener: (() => void) | undefined
    const waiting = {
      state: 'installed',
      addEventListener: vi.fn((_type: 'statechange', listener: () => void) => {
        stateListener = listener
      }),
      removeEventListener: vi.fn(),
    }
    const registration = {
      waiting,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration
    let callbacks: RegisterWorkerCallbacks | undefined
    const controller = startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return vi.fn().mockResolvedValue(undefined)
      },
      visibility: visibility.visibility,
      timers,
      serviceWorkers: serviceWorkers.boundary,
      onStateChange: vi.fn(),
    })
    callbacks?.onRegistered(registration)

    const activation = controller.update()
    ;(waiting as { state: string }).state = 'redundant'
    stateListener?.()

    await expect(activation).rejects.toThrow(
      'The waiting service worker became redundant.',
    )
  })

  it('rejects activation after the lifecycle timeout', async () => {
    const visibility = createVisibility()
    const timers = createTimers()
    const serviceWorkers = createServiceWorkers()
    const controller = startPwaRegistration({
      registerWorker: () => vi.fn().mockResolvedValue(undefined),
      visibility: visibility.visibility,
      timers,
      serviceWorkers: serviceWorkers.boundary,
      onStateChange: vi.fn(),
    })

    const activation = controller.update()
    await Promise.resolve()
    timers.timeoutCallbacks.forEach((callback) => callback())

    await expect(activation).rejects.toThrow(
      'Timed out while activating the service worker.',
    )
  })

  it('reports a rejected activation while preserving the rejection for the caller', async () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    const failure = new Error('activation failed')
    const controller = startPwaRegistration({
      registerWorker: () =>
        vi
          .fn<(reloadPage?: boolean) => Promise<void>>()
          .mockRejectedValue(failure),
      visibility: visibility.visibility,
      timers,
      onStateChange: (state) => states.push(state),
    })

    await expect(controller.update()).rejects.toBe(failure)

    expect(states).toEqual(['error'])
  })

  it('normalizes a synchronous activation throw into a reported rejection', async () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    const failure = new Error('activation failed synchronously')
    const controller = startPwaRegistration({
      registerWorker: () => () => {
        throw failure
      },
      visibility: visibility.visibility,
      timers,
      onStateChange: (state) => states.push(state),
    })

    await expect(controller.update()).rejects.toBe(failure)

    expect(states).toEqual(['error'])
  })

  it('reports registration errors without throwing', () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    let callbacks: RegisterWorkerCallbacks | undefined
    startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return vi.fn().mockResolvedValue(undefined)
      },
      visibility: visibility.visibility,
      timers,
      onStateChange: (state) => states.push(state),
    })

    expect(() =>
      callbacks?.onRegisterError(new Error('registration failed')),
    ).not.toThrow()
    expect(states).toEqual(['error'])
  })

  it('ignores rejected routine update checks', async () => {
    const states: PwaState[] = []
    const visibility = createVisibility()
    const timers = createTimers()
    const registration = createRegistration()
    vi.mocked(registration.update).mockRejectedValueOnce(
      new Error('network unavailable'),
    )
    let callbacks: RegisterWorkerCallbacks | undefined

    startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return vi.fn().mockResolvedValue(undefined)
      },
      visibility: visibility.visibility,
      timers,
      onStateChange: (state) => states.push(state),
    })

    callbacks?.onRegistered(registration)
    await Promise.resolve()

    expect(states).toEqual([])
  })

  it('checks immediately, hourly while visible, and on foreground return', () => {
    const visibility = createVisibility()
    const timers = createTimers()
    const registration = createRegistration()
    let callbacks: RegisterWorkerCallbacks | undefined
    startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return vi.fn().mockResolvedValue(undefined)
      },
      visibility: visibility.visibility,
      timers,
      onStateChange: vi.fn(),
    })

    callbacks?.onRegistered(registration)
    timers.callbacks.forEach((callback) => callback())
    visibility.setVisibility('hidden')
    visibility.setVisibility('visible')
    visibility.notifyVisibilityChange()

    expect(registration.update).toHaveBeenCalledTimes(3)
    expect(timers.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000,
    )
  })

  it('does not check while hidden', () => {
    const visibility = createVisibility('hidden')
    const timers = createTimers()
    const registration = createRegistration()
    let callbacks: RegisterWorkerCallbacks | undefined
    startPwaRegistration({
      registerWorker: (next) => {
        callbacks = next
        return vi.fn().mockResolvedValue(undefined)
      },
      visibility: visibility.visibility,
      timers,
      onStateChange: vi.fn(),
    })

    callbacks?.onRegistered(registration)
    timers.callbacks.forEach((callback) => callback())
    visibility.notifyVisibilityChange()

    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('removes interval and visibility listener on dispose', () => {
    const visibility = createVisibility()
    const timers = createTimers()
    const controller = startPwaRegistration({
      registerWorker: () => vi.fn().mockResolvedValue(undefined),
      visibility: visibility.visibility,
      timers,
      onStateChange: vi.fn(),
    })

    controller.dispose()
    controller.dispose()

    expect(timers.clearInterval).toHaveBeenCalledTimes(1)
    expect(timers.clearInterval).toHaveBeenCalledWith(1)
    expect(visibility.visibility.removeEventListener).toHaveBeenCalledTimes(1)
    expect(visibility.visibility.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
  })
})
