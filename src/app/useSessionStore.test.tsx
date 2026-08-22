import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Session } from '../sessions/model'
import { MemorySessionRepository } from '../storage/memory'
import { useSessionStore } from './useSessionStore'

const session: Session = {
  storageVersion: 1,
  id: 'flush-session',
  name: 'Flush test',
  gameId: 'test-game',
  gameSchemaVersion: 1,
  players: [],
  notes: '',
  createdAt: '2026-08-22T00:00:00.000Z',
  updatedAt: '2026-08-22T00:00:00.000Z',
}

const newerSession: Session = {
  ...session,
  id: 'flush-session-newer',
  name: 'Newer flush test',
}

function makeRepository() {
  return new MemorySessionRepository(() => undefined)
}

describe('useSessionStore reload preparation', () => {
  it('succeeds without writing when no save is pending', () => {
    const repository = makeRepository()
    const save = vi.spyOn(repository, 'save')
    const { result } = renderHook(() => useSessionStore(repository))

    let flushed = false
    act(() => {
      flushed = result.current.flushPendingSave()
    })
    expect(flushed).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('writes the latest pending session synchronously', () => {
    const repository = makeRepository()
    const { result } = renderHook(() => useSessionStore(repository))

    act(() => result.current.accept({ ok: true, session }, true))
    act(() => result.current.accept({ ok: true, session: newerSession }, true))
    let flushed = false
    act(() => {
      flushed = result.current.flushPendingSave()
    })

    expect(flushed).toBe(true)
    expect(repository.raw(newerSession.id)).toBe(JSON.stringify(newerSession))
    expect(result.current.saveStatus).toBe('Saved')
  })

  it('preserves a failed pending save for retry', () => {
    const repository = makeRepository()
    vi.spyOn(repository, 'save')
      .mockReturnValueOnce({
        ok: false,
        diagnostic: {
          code: 'storage.write-failed',
          message: 'Storage is full.',
        },
      })
      .mockReturnValueOnce({ ok: true })
    const { result } = renderHook(() => useSessionStore(repository))

    act(() => result.current.accept({ ok: true, session }, true))
    let firstFlush = true
    act(() => {
      firstFlush = result.current.flushPendingSave()
    })
    expect(firstFlush).toBe(false)
    expect(result.current.saveStatus).toBe('Not saved — Storage is full.')
    let secondFlush = false
    act(() => {
      secondFlush = result.current.flushPendingSave()
    })
    expect(secondFlush).toBe(true)
  })

  it('retries the latest session after an immediate save failure', () => {
    const repository = makeRepository()
    const save = vi.spyOn(repository, 'save')
      .mockReturnValueOnce({
        ok: false,
        diagnostic: {
          code: 'storage.write-failed',
          message: 'Storage is full.',
        },
      })
      .mockReturnValueOnce({ ok: true })
    const { result } = renderHook(() => useSessionStore(repository))

    act(() => result.current.accept({ ok: true, session }, true))
    act(() => result.current.accept({ ok: true, session: newerSession }))
    let flushed = false
    act(() => {
      flushed = result.current.flushPendingSave()
    })

    expect(flushed).toBe(true)
    expect(save).toHaveBeenNthCalledWith(2, newerSession)
  })
})
