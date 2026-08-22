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
      onStateChange: (state) => states.push(state),
    })

    callbacks?.onNeedRefresh()

    expect(states).toEqual(['update-available'])
    expect(updateSW).not.toHaveBeenCalled()

    await controller.update()

    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(updateSW).toHaveBeenCalledWith(true)
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

  it('reports rejected registration update checks as errors', async () => {
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

    expect(states).toEqual(['error'])
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
