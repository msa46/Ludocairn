import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import {
  addPlayer,
  adjustRound,
  createSession,
  getPlayerCountWarning,
  removePlayer,
  renamePlayer,
  renameSession,
  setPhase,
  setRound,
  updateNotes,
  updatePlayerField,
} from './operations'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Exercises every session field.',
  deck: 'standard-52',
  players: { min: 2, max: 3 },
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

function clock(...times: string[]) {
  let index = 0
  return () => times[Math.min(index++, times.length - 1)] ?? ''
}

function ids(...values: string[]) {
  let index = 0
  return {
    next: () => values[index++] ?? `generated-${index}`,
  }
}

function createdSession() {
  const result = createSession(
    game,
    { name: 'Friday table', playerNames: ['Ari', 'Ari'] },
    clock('2026-08-21T18:00:00.000Z'),
    ids('session-1', 'player-1', 'player-2'),
  )
  if (!result.ok) throw new Error(result.diagnostic.message)
  return result.session
}

describe('session creation', () => {
  it('copies game defaults and allows duplicate display names', () => {
    const result = createSession(
      game,
      { name: ' Friday table ', playerNames: [' Ari ', 'Ari'] },
      clock('2026-08-21T18:00:00.000Z'),
      ids('session-1', 'player-1', 'player-2'),
    )

    expect(result).toEqual({
      ok: true,
      session: {
        storageVersion: 1,
        id: 'session-1',
        name: 'Friday table',
        gameId: 'test-game',
        gameSchemaVersion: 1,
        players: [
          {
            id: 'player-1',
            name: 'Ari',
            fields: { active: true, role: 'guide', score: 0, clue: '' },
          },
          {
            id: 'player-2',
            name: 'Ari',
            fields: { active: true, role: 'guide', score: 0, clue: '' },
          },
        ],
        currentPhase: 'night',
        round: 1,
        notes: '',
        createdAt: '2026-08-21T18:00:00.000Z',
        updatedAt: '2026-08-21T18:00:00.000Z',
      },
    })
  })

  it('rejects blank session and player names', () => {
    expect(
      createSession(
        game,
        { name: ' ', playerNames: ['Ari'] },
        clock('2026-08-21T18:00:00.000Z'),
        ids('session-1', 'player-1'),
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-name', path: 'name' },
    })
    expect(
      createSession(
        game,
        { name: 'Table', playerNames: [' '] },
        clock('2026-08-21T18:00:00.000Z'),
        ids('session-1', 'player-1'),
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-name', path: 'players.0.name' },
    })
  })
})

describe('player operations', () => {
  it('adds, renames, and removes players without mutating earlier state', () => {
    const original = createdSession()
    const added = addPlayer(
      original,
      game,
      ' Ari ',
      clock('2026-08-21T18:01:00.000Z'),
      ids('player-3'),
    )
    expect(added).toMatchObject({
      ok: true,
      session: {
        updatedAt: '2026-08-21T18:01:00.000Z',
        players: [
          { id: 'player-1' },
          { id: 'player-2' },
          {
            id: 'player-3',
            name: 'Ari',
            fields: { active: true, role: 'guide', score: 0, clue: '' },
          },
        ],
      },
    })
    expect(original.players).toHaveLength(2)
    if (!added.ok) return

    const renamed = renamePlayer(
      added.session,
      'player-3',
      ' Bea ',
      clock('2026-08-21T18:02:00.000Z'),
    )
    expect(renamed).toMatchObject({
      ok: true,
      session: { players: [{}, {}, { id: 'player-3', name: 'Bea' }] },
    })
    if (!renamed.ok) return

    const removed = removePlayer(
      renamed.session,
      'player-2',
      clock('2026-08-21T18:03:00.000Z'),
    )
    expect(
      removed.ok && removed.session.players.map((player) => player.id),
    ).toEqual(['player-1', 'player-3'])
    expect(renamed.session.players).toHaveLength(3)
  })

  it('rejects an unknown player and blank rename', () => {
    const session = createdSession()

    expect(
      removePlayer(session, 'missing', clock('2026-08-21T18:01:00.000Z')),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.unknown-player' },
    })
    expect(
      renamePlayer(session, 'player-1', ' ', clock('2026-08-21T18:01:00.000Z')),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-name' },
    })
  })
})

describe('tracker operations', () => {
  it('updates every field type through its game definition', () => {
    const original = createdSession()
    const active = updatePlayerField(
      original,
      game,
      'player-1',
      'active',
      false,
      clock('2026-08-21T18:01:00.000Z'),
    )
    expect(active.ok).toBe(true)
    if (!active.ok) return
    expect(active.session.players[0]?.fields.active).toBe(false)
    expect(active.session.players[1]?.fields.active).toBe(true)
    const role = updatePlayerField(
      active.session,
      game,
      'player-1',
      'role',
      'guest',
      clock('2026-08-21T18:02:00.000Z'),
    )
    if (!role.ok) return
    const score = updatePlayerField(
      role.session,
      game,
      'player-1',
      'score',
      4,
      clock('2026-08-21T18:03:00.000Z'),
    )
    if (!score.ok) return
    const clue = updatePlayerField(
      score.session,
      game,
      'player-1',
      'clue',
      'Quiet vote',
      clock('2026-08-21T18:04:00.000Z'),
    )

    expect(clue.ok).toBe(true)
    if (!clue.ok) return
    expect(clue.session.players[0]?.fields).toEqual({
      active: false,
      role: 'guest',
      score: 4,
      clue: 'Quiet vote',
    })
    expect(clue.session.players[1]?.fields).toEqual({
      active: true,
      role: 'guide',
      score: 0,
      clue: '',
    })
    expect(clue.session.updatedAt).toBe('2026-08-21T18:04:00.000Z')
    expect(original.players[0]?.fields).toEqual({
      active: true,
      role: 'guide',
      score: 0,
      clue: '',
    })
  })

  it.each([
    ['role', 'outsider', 'session.invalid-field-value'],
    ['score', 3, 'session.invalid-field-value'],
    ['score', 12, 'session.invalid-field-value'],
    ['unknown', 'value', 'session.unknown-field'],
  ] as const)('rejects invalid %s updates', (fieldId, value, expectedCode) => {
    expect(
      updatePlayerField(
        createdSession(),
        game,
        'player-1',
        fieldId,
        value,
        clock('2026-08-21T18:01:00.000Z'),
      ),
    ).toMatchObject({ ok: false, diagnostic: { code: expectedCode } })
  })

  it('changes phase, round, notes, and session name immutably', () => {
    const original = createdSession()
    const phase = setPhase(
      original,
      game,
      'day',
      clock('2026-08-21T18:01:00.000Z'),
    )
    if (!phase.ok) return
    const round = setRound(
      phase.session,
      game,
      3,
      clock('2026-08-21T18:02:00.000Z'),
    )
    if (!round.ok) return
    const adjusted = adjustRound(
      round.session,
      game,
      -1,
      clock('2026-08-21T18:03:00.000Z'),
    )
    if (!adjusted.ok) return
    const noted = updateNotes(
      adjusted.session,
      'Shared note',
      clock('2026-08-21T18:04:00.000Z'),
    )
    if (!noted.ok) return
    const renamed = renameSession(
      noted.session,
      ' Sunday table ',
      clock('2026-08-21T18:05:00.000Z'),
    )

    expect(renamed).toMatchObject({
      ok: true,
      session: {
        name: 'Sunday table',
        currentPhase: 'day',
        round: 2,
        notes: 'Shared note',
        updatedAt: '2026-08-21T18:05:00.000Z',
      },
    })
    expect(original).toMatchObject({
      name: 'Friday table',
      currentPhase: 'night',
      round: 1,
      notes: '',
    })
  })

  it('rejects unknown phases and invalid rounds', () => {
    expect(
      setPhase(
        createdSession(),
        game,
        'dusk',
        clock('2026-08-21T18:01:00.000Z'),
      ),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-phase' },
    })
    expect(
      setRound(createdSession(), game, 0, clock('2026-08-21T18:01:00.000Z')),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'session.invalid-round' },
    })
  })
})

describe('player count guidance', () => {
  it('warns outside the recommended range without rejecting state', () => {
    const onePlayer = {
      ...createdSession(),
      players: createdSession().players.slice(0, 1),
    }
    const fourPlayers = {
      ...createdSession(),
      players: [
        ...createdSession().players,
        { ...createdSession().players[0]!, id: 'player-3' },
        { ...createdSession().players[0]!, id: 'player-4' },
      ],
    }

    expect(getPlayerCountWarning(onePlayer, game)).toBe(
      'Test Game recommends at least 2 players; this session has 1.',
    )
    expect(getPlayerCountWarning(fourPlayers, game)).toBe(
      'Test Game recommends at most 3 players; this session has 4.',
    )
    expect(getPlayerCountWarning(createdSession(), game)).toBeUndefined()
  })
})
