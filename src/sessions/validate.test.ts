import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import type { Session } from './model'
import { validateSession } from './validate'

type MutablePartialSession = {
  -readonly [Key in keyof Session]?: Session[Key]
}

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'veilquorum',
  name: 'Veilquorum',
  summary: 'Validation fixture.',
  deck: 'standard-52',
  players: { min: 2, max: 4 },
  roles: [
    {
      id: 'wayfinder',
      label: 'Wayfinder',
      summary: 'Finds the safest path forward.',
    },
    {
      id: 'drifter',
      label: 'Drifter',
      summary: 'Moves between the group and the unknown.',
    },
    {
      id: 'echo',
      label: 'Echo',
      summary: 'Repeats what the table needs to hear.',
    },
  ],
  roleDistributions: [],
  phases: [
    { id: 'night', label: 'Night' },
    { id: 'day', label: 'Day' },
  ],
  initialPhase: 'night',
  round: { enabled: true, initial: 1 },
  fields: [
    { id: 'active', label: 'Active', type: 'boolean', default: true },
    {
      id: 'stance',
      label: 'Stance',
      type: 'choice',
      choices: ['guide', 'guest'],
      default: 'guide',
    },
    { id: 'role', label: 'Role', type: 'role', default: 'wayfinder' },
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
  gameId: 'veilquorum',
  gameSchemaVersion: 1,
  players: [
    {
      id: 'player-1',
      name: 'Ari',
      fields: {
        active: true,
        stance: 'guide',
        role: 'wayfinder',
        score: 2,
        clue: '',
      },
    },
    {
      id: 'player-2',
      name: 'Bea',
      fields: {
        active: false,
        stance: 'guest',
        role: 'drifter',
        score: 4,
        clue: 'Note',
      },
    },
  ],
  currentPhase: 'day',
  round: 3,
  notes: 'Shared note',
  createdAt: '2026-08-21T18:00:00.000Z',
  updatedAt: '2026-08-21T18:05:00.000Z',
}

const assignmentGame: GameDefinition = {
  ...game,
  players: { min: 2, max: 2 },
  roleDistributions: [
    {
      players: { min: 2, max: 2 },
      counts: { wayfinder: 1, drifter: 1, echo: 0 },
    },
  ],
  assignments: {
    method: 'shuffle',
    visibility: { players: 'own', gameMaster: 'all' },
  },
}

const validAssignments = [
  { playerId: 'player-1', roleId: 'wayfinder' },
  { playerId: 'player-2', roleId: 'drifter' },
]

describe('validateSession', () => {
  it('accepts a complete compatible session', () => {
    expect(validateSession(validSession, game)).toEqual({
      ok: true,
      session: validSession,
    })
  })

  it('accepts valid assignments and remains compatible with an older missing list', () => {
    const assigned = { ...validSession, assignments: validAssignments }

    expect(validateSession(assigned, assignmentGame)).toEqual({
      ok: true,
      session: assigned,
    })
    expect(validateSession(validSession, assignmentGame)).toEqual({
      ok: true,
      session: validSession,
    })
  })

  it.each([
    {
      name: 'a non-array assignment record',
      assignments: {},
      path: 'assignments',
    },
    {
      name: 'a missing player assignment',
      assignments: validAssignments.slice(0, 1),
      path: 'assignments',
    },
    {
      name: 'a duplicate assigned player',
      assignments: [validAssignments[0], validAssignments[0]],
      path: 'assignments.1.playerId',
    },
    {
      name: 'an unknown assigned player',
      assignments: [
        { playerId: 'stranger', roleId: 'wayfinder' },
        validAssignments[1],
      ],
      path: 'assignments.0.playerId',
    },
    {
      name: 'an unknown assigned role',
      assignments: [
        { playerId: 'player-1', roleId: 'stranger' },
        validAssignments[1],
      ],
      path: 'assignments.0.roleId',
    },
    {
      name: 'an incorrect role distribution',
      assignments: [
        { playerId: 'player-1', roleId: 'drifter' },
        validAssignments[1],
      ],
      path: 'assignments',
    },
  ])('rejects $name', ({ assignments, path }) => {
    expect(
      validateSession({ ...validSession, assignments }, assignmentGame),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-assignments', path },
    })
  })

  it('rejects assignments for a game without a policy', () => {
    expect(
      validateSession({ ...validSession, assignments: validAssignments }, game),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'session.invalid-assignments',
        path: 'assignments',
      },
    })
  })

  it('rejects an assigned role that differs from its mirrored role field', () => {
    const players = validSession.players.map((player, index) =>
      index === 0
        ? { ...player, fields: { ...player.fields, role: 'echo' } }
        : player,
    )

    expect(
      validateSession(
        { ...validSession, players, assignments: validAssignments },
        assignmentGame,
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'session.invalid-assignments',
        path: 'players.0.fields.role',
      },
    })
  })

  it('accepts a storage-version-1 session with a declared semantic role', () => {
    const raw = {
      ...validSession,
      players: [
        {
          ...validSession.players[0]!,
          fields: { ...validSession.players[0]!.fields, role: 'echo' },
        },
        validSession.players[1]!,
      ],
    }

    expect(validateSession(raw, game)).toMatchObject({ ok: true })
  })

  it('rejects a storage-version-1 session with an undeclared semantic role', () => {
    const raw = {
      ...validSession,
      players: [
        {
          ...validSession.players[0]!,
          fields: { ...validSession.players[0]!.fields, role: 'stranger' },
        },
        validSession.players[1]!,
      ],
    }

    expect(validateSession(raw, game)).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'session.invalid-field-value',
        path: 'players.0.fields.role',
      },
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
        fields: { active: true, stance: 'guide', role: 'wayfinder', score: 2 },
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
