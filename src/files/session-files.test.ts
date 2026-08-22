import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import type { IdProvider, Session } from '../sessions/model'
import {
  parseSessionFile,
  prepareImportedSession,
  serializeSession,
} from './session-files'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Import fixture.',
  deck: 'standard-52',
  players: { min: 1 },
  roles: [],
  roleDistributions: [],
  phases: [],
  round: { enabled: false },
  fields: [
    {
      id: 'note',
      label: 'Note',
      type: 'text',
      default: '',
      multiline: true,
    },
  ],
  rulesMarkdown: '# Test Game\n',
  source: 'test/game.md',
}

const session: Session = {
  storageVersion: 1,
  id: 'session-1',
  name: 'Søren and 星',
  gameId: game.id,
  gameSchemaVersion: 1,
  players: [{ id: 'player-1', name: 'Zoë', fields: { note: 'Café ☕' } }],
  notes: 'Facilitator note: déjà vu',
  createdAt: '2026-08-21T18:00:00.000Z',
  updatedAt: '2026-08-21T18:05:00.000Z',
}

const assignedGame: GameDefinition = {
  ...game,
  id: 'assigned-game',
  players: { min: 2, max: 2 },
  roles: [
    { id: 'echo', label: 'Echo', summary: 'Tests one player.' },
    { id: 'drifter', label: 'Drifter', summary: 'Opposes the group.' },
  ],
  roleDistributions: [
    {
      players: { min: 2, max: 2 },
      counts: { echo: 1, drifter: 1 },
    },
  ],
  assignments: {
    method: 'shuffle',
    visibility: { players: 'own', gameMaster: 'all' },
  },
  fields: [{ id: 'role', label: 'Role', type: 'role', default: 'echo' }],
}

const assignedSession: Session = {
  ...session,
  id: 'assigned-session',
  gameId: assignedGame.id,
  players: [
    { id: 'player-1', name: 'Ari', fields: { role: 'echo' } },
    { id: 'player-2', name: 'Bea', fields: { role: 'drifter' } },
  ],
  assignments: [
    { playerId: 'player-1', roleId: 'echo' },
    { playerId: 'player-2', roleId: 'drifter' },
  ],
}

const resolveGame = (id: string) =>
  id === game.id ? game : id === assignedGame.id ? assignedGame : undefined

describe('session files', () => {
  it('serializes stable, pretty, UTF-8-safe JSON with a trailing newline', () => {
    const serialized = serializeSession(session)

    expect(serialized).toBe(JSON.stringify(session, null, 2) + '\n')
    expect(serialized).toContain('Søren and 星')
    expect(serialized.endsWith('\n')).toBe(true)
  })

  it('returns a non-sensitive preview for a valid session', () => {
    const result = parseSessionFile(serializeSession(session), resolveGame)

    expect(result).toEqual({
      ok: true,
      session,
      preview: {
        sessionName: 'Søren and 星',
        gameName: 'Test Game',
        playerCount: 1,
        updatedAt: '2026-08-21T18:05:00.000Z',
      },
    })
    if (result.ok) {
      expect(Object.keys(result.preview)).toEqual([
        'sessionName',
        'gameName',
        'playerCount',
        'updatedAt',
      ])
    }
  })

  it('round-trips assignments without including them in the import preview', () => {
    const result = parseSessionFile(
      serializeSession(assignedSession),
      resolveGame,
    )

    expect(result).toMatchObject({
      ok: true,
      session: { assignments: assignedSession.assignments },
      preview: {
        sessionName: assignedSession.name,
        gameName: assignedGame.name,
        playerCount: 2,
      },
    })
    if (!result.ok) return
    expect(Object.values(result.preview)).not.toContain('Echo')
    expect(Object.values(result.preview)).not.toContain('echo')
    expect(Object.values(result.preview)).not.toContain('Drifter')
    expect(Object.values(result.preview)).not.toContain('drifter')
  })

  it('diagnoses malformed JSON and unavailable games', () => {
    expect(parseSessionFile('{broken', resolveGame)).toMatchObject({
      ok: false,
      diagnostic: { code: 'import.invalid-json' },
    })
    expect(
      parseSessionFile(
        JSON.stringify({ ...session, gameId: 'missing-game' }),
        resolveGame,
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'import.missing-game' },
    })
    expect(
      parseSessionFile(JSON.stringify({ notes: '' }), resolveGame),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'import.missing-game' },
    })
  })

  it('preserves validator diagnostics for unsupported versions and invalid fields', () => {
    const candidates = [
      {
        value: { ...session, storageVersion: 2 },
        code: 'session.unsupported-storage-version',
      },
      {
        value: { ...session, gameSchemaVersion: 2 },
        code: 'session.incompatible-game-version',
      },
      {
        value: {
          ...session,
          players: [{ ...session.players[0], fields: { note: false } }],
        },
        code: 'session.invalid-field-value',
      },
    ]

    for (const candidate of candidates) {
      expect(
        parseSessionFile(JSON.stringify(candidate.value), resolveGame),
      ).toMatchObject({
        ok: false,
        diagnostic: {
          code: 'import.invalid-session',
          cause: { code: candidate.code },
        },
      })
    }
  })

  it('reassigns colliding IDs without mutating the imported session', () => {
    const original = structuredClone(session)
    const generated: string[] = ['session-1', 'session-2']
    const ids: IdProvider = {
      next: () => generated.shift() ?? 'session-fallback',
    }

    const prepared = prepareImportedSession(
      session,
      new Set(['session-1']),
      ids,
    )

    expect(prepared.id).toBe('session-2')
    expect(prepared).not.toBe(session)
    expect(session).toEqual(original)
  })

  it('keeps a non-colliding session unchanged without consuming an ID', () => {
    let calls = 0
    const ids: IdProvider = {
      next: () => {
        calls += 1
        return 'unused'
      },
    }

    expect(prepareImportedSession(session, new Set(), ids)).toBe(session)
    expect(calls).toBe(0)
  })
})
