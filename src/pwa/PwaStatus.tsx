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
  const [noticeState, setNoticeState] = useState<{
    readonly owner: RegisterWorker
    readonly notice: Notice
  }>({ owner: registerWorker, notice: 'current' })
  const notice =
    noticeState.owner === registerWorker ? noticeState.notice : 'current'
  const controller = useRef<PwaController | undefined>(undefined)
  const registrationGeneration = useRef(0)

  useEffect(() => {
    const generation = registrationGeneration.current + 1
    registrationGeneration.current = generation
    const nextController = startPwaRegistration({
      registerWorker,
      onStateChange: (state) => {
        if (registrationGeneration.current === generation) {
          setNoticeState({ owner: registerWorker, notice: state })
        }
      },
    })
    controller.current = nextController

    return () => {
      if (registrationGeneration.current === generation) {
        registrationGeneration.current += 1
      }
      if (controller.current === nextController) controller.current = undefined
      nextController.dispose()
    }
  }, [registerWorker])

  if (notice === 'current') return null

  function dismiss() {
    setNoticeState({ owner: registerWorker, notice: 'current' })
  }

  function applyUpdate() {
    if (!prepareForReload()) {
      setNoticeState({ owner: registerWorker, notice: 'save-required' })
      return
    }

    const activeController = controller.current
    const generation = registrationGeneration.current
    void activeController?.update().catch(() => {
      if (
        controller.current === activeController &&
        registrationGeneration.current === generation
      ) {
        setNoticeState({ owner: registerWorker, notice: 'activation-error' })
      }
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
        {notice === 'save-required' ? (
          <button type="button" onClick={applyUpdate}>
            Update and reload
          </button>
        ) : null}
        <button type="button" onClick={dismiss}>
          Dismiss PWA status
        </button>
      </div>
    </section>
  )
}
