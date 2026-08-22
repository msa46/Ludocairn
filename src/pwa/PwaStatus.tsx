import { useEffect, useRef, useState } from 'react'

import {
  startPwaRegistration,
  type PwaController,
  type PwaState,
  type RegisterWorker,
} from './register'

interface PwaStatusProps {
  readonly prepareForReload: () => boolean
  readonly registerWorker: RegisterWorker
}

type Notice = PwaState | 'save-required' | 'activation-error'

export function PwaStatus({
  prepareForReload,
  registerWorker,
}: PwaStatusProps) {
  const [notice, setNotice] = useState<Notice>('current')
  const controller = useRef<PwaController | undefined>(undefined)

  useEffect(() => {
    const nextController = startPwaRegistration({
      registerWorker,
      onStateChange: setNotice,
    })
    controller.current = nextController

    return () => {
      if (controller.current === nextController) controller.current = undefined
      nextController.dispose()
    }
  }, [registerWorker])

  if (notice === 'current') return null

  function dismiss() {
    setNotice('current')
  }

  function applyUpdate() {
    if (!prepareForReload()) {
      setNotice('save-required')
      return
    }

    void controller.current?.update().catch(() => {
      setNotice('activation-error')
    })
  }

  if (notice === 'offline-ready') {
    return (
      <section className="pwa-status print-hidden" role="status">
        <p>Ludocairn is ready to use offline.</p>
        <div className="pwa-status-actions">
          <button type="button" onClick={dismiss}>
            Dismiss PWA status
          </button>
        </div>
      </section>
    )
  }

  if (notice === 'update-available') {
    return (
      <section className="pwa-status print-hidden" role="alert">
        <p>A new version of Ludocairn is available.</p>
        <div className="pwa-status-actions">
          <button type="button" onClick={applyUpdate}>
            Update and reload
          </button>
          <button type="button" onClick={dismiss}>
            Not now
          </button>
        </div>
      </section>
    )
  }

  const message =
    notice === 'save-required'
      ? 'Save the session or export it before updating.'
      : notice === 'activation-error'
        ? 'The update could not be applied. You can keep using this version.'
        : 'Offline support could not be started. You can keep using the app.'

  return (
    <section className="pwa-status print-hidden" role="alert">
      <p>{message}</p>
      <div className="pwa-status-actions">
        <button type="button" onClick={dismiss}>
          Dismiss PWA status
        </button>
      </div>
    </section>
  )
}
