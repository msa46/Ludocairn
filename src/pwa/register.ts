export type PwaState =
  'current' | 'offline-ready' | 'update-available' | 'error'

export interface RegisterWorkerCallbacks {
  readonly onNeedRefresh: () => void
  readonly onOfflineReady: () => void
  readonly onRegistered: (registration?: ServiceWorkerRegistration) => void
  readonly onRegisterError: (error: unknown) => void
}

export interface PwaController {
  readonly update: () => Promise<void>
  readonly dispose: () => void
}

export interface PwaVisibilityBoundary {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface PwaTimerBoundary {
  setInterval(callback: () => void, delay: number): number
  clearInterval(intervalId: number): void
  setTimeout(callback: () => void, delay: number): number
  clearTimeout(timeoutId: number): void
}

export interface PwaServiceWorkerBoundary {
  readonly controller: ServiceWorker | null
  addEventListener(type: 'controllerchange', listener: () => void): void
  removeEventListener(type: 'controllerchange', listener: () => void): void
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

export type RegisterWorker = (
  callbacks: RegisterWorkerCallbacks,
) => UpdateServiceWorker

export interface StartPwaRegistrationOptions {
  readonly registerWorker: RegisterWorker
  readonly onStateChange: (state: PwaState) => void
  readonly visibility?: PwaVisibilityBoundary
  readonly timers?: PwaTimerBoundary
  readonly serviceWorkers?: PwaServiceWorkerBoundary
}

const updateIntervalMs = 60 * 60 * 1000
const activationTimeoutMs = 30 * 1000

export function startPwaRegistration({
  registerWorker,
  onStateChange,
  visibility = document,
  timers = window,
  serviceWorkers = typeof navigator === 'undefined'
    ? undefined
    : navigator.serviceWorker,
}: StartPwaRegistrationOptions): PwaController {
  let disposed = false
  let registration: ServiceWorkerRegistration | undefined
  let updateServiceWorker: UpdateServiceWorker | undefined

  const reportState = (state: PwaState) => {
    if (!disposed) onStateChange(state)
  }

  const checkForUpdate = () => {
    if (disposed || !registration) return

    try {
      void Promise.resolve(registration.update()).catch(() => undefined)
    } catch {
      // A foreground version check is opportunistic; the installed app remains usable.
    }
  }

  const checkForUpdateWhileVisible = () => {
    if (visibility.visibilityState === 'visible') checkForUpdate()
  }

  const onVisibilityChange = () => {
    checkForUpdateWhileVisible()
  }

  const intervalId = timers.setInterval(
    checkForUpdateWhileVisible,
    updateIntervalMs,
  )
  visibility.addEventListener('visibilitychange', onVisibilityChange)

  try {
    updateServiceWorker = registerWorker({
      onNeedRefresh: () => reportState('update-available'),
      onOfflineReady: () => reportState('offline-ready'),
      onRegistered: (nextRegistration) => {
        if (disposed || !nextRegistration) return
        registration = nextRegistration
        checkForUpdate()
      },
      onRegisterError: () => reportState('error'),
    })
  } catch {
    reportState('error')
  }

  return {
    update: async () => {
      if (disposed || !updateServiceWorker) return Promise.resolve()

      const initialController = serviceWorkers?.controller
      const waitingWorker = registration?.waiting
      let rejectActivation: ((error: Error) => void) | undefined
      let timeoutId: number | undefined

      const cleanupActivationListeners = () => {
        if (timeoutId !== undefined) timers.clearTimeout(timeoutId)
        serviceWorkers?.removeEventListener(
          'controllerchange',
          onControllerChange,
        )
        waitingWorker?.removeEventListener('statechange', onWorkerStateChange)
      }
      const onControllerChange = () => {
        if (serviceWorkers?.controller === initialController) return
        cleanupActivationListeners()
        resolveActivation?.()
      }
      const onWorkerStateChange = () => {
        if (waitingWorker?.state !== 'redundant') return
        cleanupActivationListeners()
        rejectActivation?.(
          new Error('The waiting service worker became redundant.'),
        )
      }
      let resolveActivation: (() => void) | undefined
      const activation = serviceWorkers
        ? new Promise<void>((resolve, reject) => {
            resolveActivation = resolve
            rejectActivation = reject
            serviceWorkers.addEventListener(
              'controllerchange',
              onControllerChange,
            )
            waitingWorker?.addEventListener('statechange', onWorkerStateChange)
            timeoutId = timers.setTimeout(() => {
              cleanupActivationListeners()
              reject(
                new Error('Timed out while activating the service worker.'),
              )
            }, activationTimeoutMs)
          })
        : Promise.resolve()

      try {
        await Promise.resolve(updateServiceWorker(true))
        await activation
      } catch (error) {
        cleanupActivationListeners()
        reportState('error')
        throw error
      }
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      timers.clearInterval(intervalId)
      visibility.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
