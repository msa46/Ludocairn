import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import type { Session } from '../sessions/model'
import { LocalStorageSessionRepository } from './local-storage'
import { MemorySessionRepository } from './memory'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Storage fixture.',
  deck: 'standard-52',
  players: { min: 1 },
  roles: [],
  roleDistributions: [],
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Test Game\n',
  source: 'test/game.md',
}

const session: Session = {
  storageVersion: 1,
  id: 'session-1',
  name: 'Friday table',
  gameId: game.id,
  gameSchemaVersion: 1,
  players: [],
  notes: '',
  createdAt: '2026-08-21T18:00:00.000Z',
  updatedAt: '2026-08-21T18:00:00.000Z',
}

const resolveGame = (id: string) => (id === game.id ? game : undefined)

describe('MemorySessionRepository', () => {
  it('round-trips, lists, exposes raw data, and removes sessions', () => {
    const repository = new MemorySessionRepository(resolveGame)

    expect(repository.save(session)).toEqual({ ok: true })
    expect(repository.load(session.id)).toEqual({ ok: true, session })
    expect(repository.list()).toEqual([{ id: session.id, ok: true, session }])
    expect(repository.raw(session.id)).toBe(JSON.stringify(session))
    expect(repository.remove(session.id)).toEqual({ ok: true })
    expect(repository.load(session.id)).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.not-found' },
    })
  })

  it('retains corrupt and unsupported raw records for recovery', () => {
    const corrupt = '{broken'
    const unsupported = JSON.stringify({ ...session, storageVersion: 2 })
    const repository = new MemorySessionRepository(resolveGame, {
      initial: {
        'ludocairn.session.v1.corrupt': corrupt,
        'ludocairn.session.v1.unsupported': unsupported,
        unrelated: 'ignore me',
      },
    })

    expect(repository.load('corrupt')).toMatchObject({
      ok: false,
      raw: corrupt,
      diagnostic: { code: 'storage.invalid-json' },
    })
    expect(repository.load('unsupported')).toMatchObject({
      ok: false,
      raw: unsupported,
      diagnostic: {
        code: 'storage.invalid-session',
        cause: { code: 'session.unsupported-storage-version' },
      },
    })
    expect(repository.list().map((record) => record.id)).toEqual([
      'corrupt',
      'unsupported',
    ])
    expect(repository.raw('corrupt')).toBe(corrupt)
  })

  it('reports an unknown game without discarding the record', () => {
    const raw = JSON.stringify({ ...session, gameId: 'missing-game' })
    const repository = new MemorySessionRepository(resolveGame, {
      initial: { 'ludocairn.session.v1.session-1': raw },
    })

    expect(repository.load(session.id)).toMatchObject({
      ok: false,
      raw,
      diagnostic: { code: 'storage.missing-game' },
    })
  })

  it('reports a key and embedded session ID mismatch with raw recovery data', () => {
    const raw = JSON.stringify({ ...session, id: 'embedded-session' })
    const repository = new MemorySessionRepository(resolveGame, {
      initial: { 'ludocairn.session.v1.storage-key-session': raw },
    })

    expect(repository.load('storage-key-session')).toMatchObject({
      ok: false,
      raw,
      diagnostic: {
        code: 'storage.invalid-session',
        cause: { code: 'session.invalid-record', path: 'id' },
      },
    })
    expect(repository.list()).toEqual([
      expect.objectContaining({
        id: 'storage-key-session',
        ok: false,
        raw,
      }),
    ])
  })

  it('converts injected write failures into diagnostics', () => {
    const repository = new MemorySessionRepository(resolveGame, {
      failWrites: true,
    })

    expect(repository.save(session)).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.write-failed' },
    })
    expect(repository.remove(session.id)).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.write-failed' },
    })
  })
})

describe('LocalStorageSessionRepository', () => {
  it('enumerates only Ludocairn keys', () => {
    const storage = window.localStorage
    storage.clear()
    storage.setItem('unrelated', 'ignore me')
    const repository = new LocalStorageSessionRepository(storage, resolveGame)

    repository.save(session)

    expect(repository.list()).toEqual([{ id: session.id, ok: true, session }])
  })

  it('converts browser read and write exceptions into diagnostics', () => {
    const readFailure = new LocalStorageSessionRepository(
      {
        get length() {
          throw new DOMException('blocked')
        },
      } as unknown as Storage,
      resolveGame,
    )
    const writeFailure = new LocalStorageSessionRepository(
      {
        setItem() {
          throw new DOMException('quota')
        },
      } as unknown as Storage,
      resolveGame,
    )

    expect(readFailure.list()).toEqual([
      {
        id: '',
        ok: false,
        diagnostic: { code: 'storage.read-failed', message: 'blocked' },
      },
    ])
    expect(writeFailure.save(session)).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.write-failed', message: 'quota' },
    })
  })
})
