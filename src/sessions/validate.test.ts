import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import type { Session } from './model'
import { validateSession } from './validate'

type MutablePartialSession = {
  -readonly [Key in keyof Session]?: Session[Key]
}

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Validation fixture.',
  deck: 'standard-52',
  players: { min: 2, max: 4 },
  phases: [
    { id: 'night', label: 'Night' },
    { id: 'day', label: 'Day' },
  ],
  initialPhase: 'night',
  round: { enabled: true, initial: 1 },
  fields: [
    { id: 'active', label: 'Active', type: 'boolean', default: true },
    {
      id: 'role',
      label: 'Role',
      type: 'choice',
      choices: ['guide', 'guest'],
      default: 'guide',
    },
    {
      id: 'score',
      label: 'Score',
      type: 'number',
      default: 0,
      min: 0,
      max: 10,
      step: 2,
    },
    {
      id: 'clue',
      label: 'Clue',
      type: 'text',
      default: '',
      multiline: true,
    },
  ],
  rulesMarkdown: '# Test Game\n',
  source: 'test/game.md',
}

const validSession: Session = {
  storageVersion: 1,
  id: 'session-1',
  name: 'Friday table',
  gameId: 'test-game',
  gameSchemaVersion: 1,
  players: [
    {
      id: 'player-1',
      name: 'Ari',
      fields: { active: true, role: 'guide', score: 2, clue: '' },
    },
    {
      id: 'player-2',
      name: 'Bea',
      fields: { active: false, role: 'guest', score: 4, clue: 'Note' },
    },
  ],
  currentPhase: 'day',
  round: 3,
  notes: 'Shared note',
  createdAt: '2026-08-21T18:00:00.000Z',
  updatedAt: '2026-08-21T18:05:00.000Z',
}

describe('validateSession', () => {
  it('accepts a complete compatible session', () => {
    expect(validateSession(validSession, game)).toEqual({
      ok: true,
      session: validSession,
    })
  })

  it.each([null, [], 'session', 42])(
    'rejects non-object record %j',
    (value) => {
      expect(validateSession(value, game)).toMatchObject({
        ok: false,
        diagnostic: { code: 'session.invalid-record' },
      })
    },
  )

  it('rejects missing required properties', () => {
    const missingName: MutablePartialSession = { ...validSession }
    delete missingName.name

    expect(validateSession(missingName, game)).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-record', path: 'name' },
    })
  })

  it.each([
    {
      label: 'session',
      candidate: { ...validSession, id: 'session&admin=true' },
      path: 'id',
    },
    {
      label: 'player',
      candidate: {
        ...validSession,
        players: [{ ...validSession.players[0]!, id: 'player/../../record' }],
      },
      path: 'players.0.id',
    },
  ])('rejects a URL-unsafe $label ID', ({ candidate, path }) => {
    expect(validateSession(candidate, game)).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-record', path },
    })
  })

  it('rejects unsupported storage and incompatible game versions', () => {
    expect(
      validateSession({ ...validSession, storageVersion: 2 }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.unsupported-storage-version' },
    })
    expect(
      validateSession({ ...validSession, gameSchemaVersion: 2 }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.incompatible-game-version' },
    })
  })

  it('rejects a session associated with another game', () => {
    expect(
      validateSession({ ...validSession, gameId: 'another-game' }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.game-mismatch', path: 'gameId' },
    })
  })

  it('rejects invalid timestamps', () => {
    expect(
      validateSession({ ...validSession, updatedAt: 'yesterday' }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-date', path: 'updatedAt' },
    })
  })

  it('rejects duplicate player IDs', () => {
    expect(
      validateSession(
        {
          ...validSession,
          players: [validSession.players[0], validSession.players[0]],
        },
        game,
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'session.duplicate-player-id',
        path: 'players.1.id',
      },
    })
  })

  it('rejects unknown, missing, and incompatible player fields', () => {
    const basePlayer = validSession.players[0]!
    const cases = [
      {
        fields: { ...basePlayer.fields, extra: true },
        code: 'session.unknown-field',
      },
      {
        fields: { active: true, role: 'guide', score: 2 },
        code: 'session.invalid-record',
      },
      {
        fields: { ...basePlayer.fields, role: 'outsider' },
        code: 'session.invalid-field-value',
      },
      {
        fields: { ...basePlayer.fields, score: 3 },
        code: 'session.invalid-field-value',
      },
    ]

    for (const candidate of cases) {
      const result = validateSession(
        {
          ...validSession,
          players: [{ ...basePlayer, fields: candidate.fields }],
        },
        game,
      )
      expect(result).toMatchObject({
        ok: false,
        diagnostic: { code: candidate.code },
      })
    }
  })

  it('rejects invalid phase and round state', () => {
    expect(
      validateSession({ ...validSession, currentPhase: 'dusk' }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-phase' },
    })
    expect(validateSession({ ...validSession, round: 0 }, game)).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-round' },
    })
  })

  it('accepts games that do not track phases or rounds', () => {
    const session: MutablePartialSession = { ...validSession }
    delete session.currentPhase
    delete session.round
    const gameWithoutTrackers: GameDefinition = {
      ...game,
      phases: [],
      initialPhase: undefined,
      round: { enabled: false },
    }

    expect(validateSession(session, gameWithoutTrackers)).toMatchObject({
      ok: true,
    })
  })

  it('allows player counts outside recommendations', () => {
    expect(
      validateSession({ ...validSession, players: [] }, game),
    ).toMatchObject({ ok: true })
  })
})
