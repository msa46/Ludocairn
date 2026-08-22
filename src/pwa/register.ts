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
}

const updateIntervalMs = 60 * 60 * 1000

export function startPwaRegistration({
  registerWorker,
  onStateChange,
  visibility = document,
  timers = window,
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
      void Promise.resolve(registration.update()).catch(() => {
        reportState('error')
      })
    } catch {
      reportState('error')
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
    update: () => {
      if (disposed || !updateServiceWorker) return Promise.resolve()
      return updateServiceWorker(true)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      timers.clearInterval(intervalId)
      visibility.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
