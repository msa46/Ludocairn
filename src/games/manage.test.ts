import { describe, expect, it } from 'vitest'

import type { GameDefinition } from './model'
import {
  findGameUsage,
  mergeGameCatalog,
  reviewGameDeletion,
  reviewGameSave,
} from './manage'
import { parseGameSource } from './parse'
import type { GameRepositoryRecord } from '../storage/game-repository'
import type { RepositoryRecord } from '../storage/repository'

function gameSource(id: string, fields = ''): string {
  return `---
schema_version: 1
id: ${id}
name: ${id} game
summary: Lifecycle fixture.
deck: standard-52
players:
  min: 1
session:
  round:
    enabled: false
  player_fields: [${fields}]
---
# ${id} game
`
}

function parseGame(id: string, fields = ''): GameDefinition {
  const parsed = parseGameSource(gameSource(id, fields), `test/${id}.md`)
  if (!parsed.ok) throw new Error(`Fixture ${id} did not parse.`)
  return parsed.game
}

function customRecord(id: string): GameRepositoryRecord {
  return { id, ok: true, game: parseGame(id), source: gameSource(id) }
}

function sessionRecord(
  gameId: string,
  id = 'session-1',
): Extract<RepositoryRecord, { ok: true }> {
  return {
    id,
    ok: true,
    session: {
      storageVersion: 1,
      id,
      name: 'Friday table',
      gameId,
      gameSchemaVersion: 1,
      players: [],
      notes: '',
      createdAt: '2026-08-21T18:00:00.000Z',
      updatedAt: '2026-08-21T18:00:00.000Z',
    },
  }
}

const bundled = parseGame('bundled')
const alphaSource = gameSource('alpha')
const context = {
  bundledIds: new Set([bundled.id]),
  customRecords: [customRecord('alpha')],
  sessionRecords: [],
}

describe('mergeGameCatalog', () => {
  it('keeps bundled order and appends valid custom games by repository order', () => {
    const customRecords = [customRecord('alpha'), customRecord('zulu')]

    expect(mergeGameCatalog([bundled], customRecords).games.map((game) => game.id)).toEqual([
      'bundled',
      'alpha',
      'zulu',
    ])
  })

  it('keeps invalid and bundled-colliding custom records available for recovery', () => {
    const corrupt: GameRepositoryRecord = {
      id: 'corrupt',
      ok: false,
      raw: '{broken',
      diagnostic: {
        code: 'game-storage.invalid-source',
        message: 'Saved game source is invalid.',
      },
    }

    const catalog = mergeGameCatalog(
      [bundled],
      [customRecord('alpha'), customRecord('bundled'), corrupt],
    )

    expect(catalog.games.map((game) => game.id)).toEqual(['bundled', 'alpha'])
    expect(catalog.customIds).toEqual(new Set(['alpha']))
    expect(catalog.recovery.map((record) => record.id)).toEqual([
      'bundled',
      'corrupt',
    ])
  })
})

describe('reviewGameSave', () => {
  it('rejects invalid and oversized source before catalog checks', () => {
    expect(reviewGameSave('{not yaml', context)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.invalid-source' },
    })
    expect(reviewGameSave('é'.repeat(524_289), context)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.oversized-source' },
    })
  })

  it('rejects bundled collisions and changing an existing custom ID', () => {
    expect(reviewGameSave(gameSource('bundled'), context)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.bundled-collision' },
    })
    expect(
      reviewGameSave(gameSource('renamed'), { ...context, originalId: 'alpha' }),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.id-changed' },
    })
  })

  it('rejects a genuinely new save that collides with a custom record', () => {
    expect(reviewGameSave(alphaSource, context)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.custom-collision' },
    })
  })

  it('accepts an existing custom ID when its readable sessions remain compatible', () => {
    expect(
      reviewGameSave(alphaSource, {
        ...context,
        originalId: 'alpha',
        sessionRecords: [sessionRecord('alpha')],
      }),
    ).toMatchObject({ ok: true, game: { id: 'alpha' }, source: alphaSource })
  })

  it('rejects revisions when a readable session would become invalid', () => {
    const incompatibleAlphaSource = gameSource(
      'alpha',
      '{ id: ready, label: Ready, type: boolean, default: false }',
    )
    const existingSession = sessionRecord('alpha')

    expect(
      reviewGameSave(incompatibleAlphaSource, {
        ...context,
        originalId: 'alpha',
        sessionRecords: [
          {
            ...existingSession,
            session: {
              ...existingSession.session,
              players: [{ id: 'player-1', name: 'Ari', fields: {} }],
            },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'game-save.incompatible-sessions',
        sessionIds: ['session-1'],
      },
    })
  })

  it('does not let an unreadable session enumeration permit a save', () => {
    const unreadable: RepositoryRecord = {
      id: '',
      ok: false,
      diagnostic: { code: 'storage.read-failed', message: 'blocked' },
    }

    expect(
      reviewGameSave(alphaSource, {
        ...context,
        originalId: 'alpha',
        sessionRecords: [unreadable],
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-save.session-enumeration-failed' },
    })
  })
})

describe('session lifecycle usage', () => {
  const corruptAlphaSession: RepositoryRecord = {
    id: 'corrupt-session',
    ok: false,
    raw: '{"gameId":"alpha","players":"broken"}',
    diagnostic: { code: 'storage.invalid-session', message: 'Session is broken.' },
  }

  it('finds readable sessions and corrupt raw records only when their JSON identifies the game', () => {
    expect(
      findGameUsage('alpha', [
        sessionRecord('alpha'),
        corruptAlphaSession,
        {
          ...corruptAlphaSession,
          id: 'opaque-corrupt-session',
          raw: '{broken',
        },
      ]).map((record) => record.id),
    ).toEqual(['session-1', 'corrupt-session'])
  })

  it('rejects revisions and deletion when readable or identifiable raw sessions use the game', () => {
    expect(
      reviewGameSave(alphaSource, {
        ...context,
        originalId: 'alpha',
        sessionRecords: [corruptAlphaSession],
      }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'game-save.incompatible-sessions',
        sessionIds: ['corrupt-session'],
      },
    })
    expect(
      reviewGameDeletion('alpha', [corruptAlphaSession]),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'game-delete.sessions-use-game',
        sessionIds: ['corrupt-session'],
      },
    })
  })

  it('does not let an unreadable session enumeration permit deletion', () => {
    const unreadable: RepositoryRecord = {
      id: '',
      ok: false,
      diagnostic: { code: 'storage.read-failed', message: 'blocked' },
    }

    expect(reviewGameDeletion('alpha', [unreadable])).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-delete.session-enumeration-failed' },
    })
  })
})
