import { useCallback, useEffect, useRef, useState } from 'react'

import type { Session, SessionResult } from '../sessions/model'
import type { SessionRepository } from '../storage/repository'

export function useSessionStore(repository: SessionRepository) {
  const [session, setSession] = useState<Session>()
  const [saveStatus, setSaveStatus] = useState('Saved')
  const [error, setError] = useState<string>()
  const saveTimer = useRef<number | undefined>(undefined)
  const pendingSession = useRef<Session | undefined>(undefined)

  const save = useCallback(
    (nextSession: Session) => {
      pendingSession.current = undefined
      const saved = repository.save(nextSession)
      setSaveStatus(
        saved.ok ? 'Saved' : 'Not saved — ' + saved.diagnostic.message,
      )
      return saved.ok
    },
    [repository],
  )

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current)
      if (pendingSession.current) repository.save(pendingSession.current)
    },
    [repository],
  )

  const open = useCallback(
    (id: string) => {
      const result = repository.load(id)
      if (result.ok) {
        setSession(result.session)
        setSaveStatus('Saved')
        setError(undefined)
      } else {
        setSession(undefined)
        setError(result.diagnostic.message)
      }
      return result
    },
    [repository],
  )

  const accept = useCallback(
    (result: SessionResult, debounce = false) => {
      if (!result.ok) {
        setError(result.diagnostic.message)
        return false
      }
      window.clearTimeout(saveTimer.current)
      setSession(result.session)
      setSaveStatus('Saving')
      setError(undefined)
      if (debounce) {
        pendingSession.current = result.session
        saveTimer.current = window.setTimeout(() => save(result.session), 300)
        return true
      }
      return save(result.session)
    },
    [save],
  )

  const cancelPendingSave = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    pendingSession.current = undefined
  }, [])

  return { session, saveStatus, error, open, accept, cancelPendingSave }
}
