import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import { dealPlayerAssignments, validatePlayerAssignments } from './deal'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Tests digital role dealing.',
  deck: 'standard-52',
  players: { min: 4, max: 4 },
  roles: [
    { id: 'echo', label: 'Echo', summary: 'Tests one player.' },
    { id: 'drifter', label: 'Drifter', summary: 'Opposes the group.' },
    { id: 'wayfinder', label: 'Wayfinder', summary: 'Supports the group.' },
  ],
  roleDistributions: [
    {
      players: { min: 4, max: 4 },
      counts: { echo: 1, drifter: 1, wayfinder: 'remaining' },
    },
  ],
  assignments: {
    method: 'shuffle',
    visibility: { players: 'own', gameMaster: 'all' },
  },
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Test Game\n',
  source: 'test/game.md',
}

const playerIds = ['player-1', 'player-2', 'player-3', 'player-4']
const validAssignments = [
  { playerId: 'player-1', roleId: 'drifter' },
  { playerId: 'player-2', roleId: 'wayfinder' },
  { playerId: 'player-3', roleId: 'wayfinder' },
  { playerId: 'player-4', roleId: 'echo' },
]

describe('dealPlayerAssignments', () => {
  it('expands remaining roles and applies deterministic Fisher-Yates swaps', () => {
    expect(dealPlayerAssignments(game, playerIds, () => 0)).toEqual({
      ok: true,
      assignments: validAssignments,
    })
  })

  it('rejects a player count without a role distribution', () => {
    expect(dealPlayerAssignments(game, ['player-1'], () => 0)).toMatchObject({
      ok: false,
      diagnostic: { code: 'assignment.unsupported-player-count' },
    })
  })

  it.each([1, -0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the invalid random sample %s',
    (sample) => {
      expect(
        dealPlayerAssignments(game, playerIds, () => sample),
      ).toMatchObject({
        ok: false,
        diagnostic: { code: 'assignment.invalid-random' },
      })
    },
  )
})

describe('validatePlayerAssignments', () => {
  it('accepts one known role with the exact distribution for every player', () => {
    expect(
      validatePlayerAssignments(game, playerIds, validAssignments),
    ).toEqual({ ok: true, assignments: validAssignments })
  })

  it.each([
    {
      name: 'a non-array record',
      value: {},
      code: 'assignment.invalid-record',
      path: 'assignments',
    },
    {
      name: 'a missing player',
      value: validAssignments.slice(0, 3),
      code: 'assignment.incorrect-distribution',
      path: 'assignments',
    },
    {
      name: 'a duplicate player',
      value: [
        validAssignments[0],
        validAssignments[0],
        ...validAssignments.slice(2),
      ],
      code: 'assignment.duplicate-player',
      path: 'assignments.1.playerId',
    },
    {
      name: 'an unknown player',
      value: [
        { ...validAssignments[0], playerId: 'stranger' },
        ...validAssignments.slice(1),
      ],
      code: 'assignment.unknown-player',
      path: 'assignments.0.playerId',
    },
    {
      name: 'an unknown role',
      value: [
        { ...validAssignments[0], roleId: 'stranger' },
        ...validAssignments.slice(1),
      ],
      code: 'assignment.unknown-role',
      path: 'assignments.0.roleId',
    },
    {
      name: 'the wrong role multiset',
      value: [
        { ...validAssignments[0], roleId: 'wayfinder' },
        ...validAssignments.slice(1),
      ],
      code: 'assignment.incorrect-distribution',
      path: 'assignments',
    },
  ])('rejects $name', ({ value, code, path }) => {
    expect(validatePlayerAssignments(game, playerIds, value)).toMatchObject({
      ok: false,
      diagnostic: { code, path },
    })
  })
})
