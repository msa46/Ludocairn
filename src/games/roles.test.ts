import { describe, expect, it } from 'vitest'

import type { GameDefinition } from './model'
import { resolveRoleCounts } from './roles'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'veilquorum',
  name: 'Veilquorum',
  summary: 'Fixture',
  deck: 'standard-52',
  players: { min: 5, max: 12 },
  roles: [
    { id: 'echo', label: 'Echo', team: 'Quorum', summary: 'Tests one player.' },
    { id: 'drifter', label: 'Drifter', team: 'Drifters', summary: 'Thins the quorum.' },
    { id: 'wayfinder', label: 'Wayfinder', team: 'Quorum', summary: 'Finds Drifters.' },
  ],
  roleDistributions: [
    {
      players: { min: 5, max: 6 },
      counts: { echo: 1, drifter: 1, wayfinder: 'remaining' },
    },
    {
      players: { min: 7, max: 9 },
      counts: { echo: 1, drifter: 2, wayfinder: 'remaining' },
    },
    {
      players: { min: 10, max: 12 },
      counts: { echo: 1, drifter: 3, wayfinder: 'remaining' },
    },
  ],
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Rules\n',
  source: 'fixture/game.md',
}

describe('resolveRoleCounts', () => {
  it('derives the remaining role count for the matching player band', () => {
    expect(resolveRoleCounts(game, 8)).toEqual([
      { role: game.roles[0], count: 1 },
      { role: game.roles[1], count: 2 },
      { role: game.roles[2], count: 5 },
    ])
  })

  it('returns undefined outside the supported distributions', () => {
    expect(resolveRoleCounts(game, 4)).toBeUndefined()
    expect(resolveRoleCounts(game, 13)).toBeUndefined()
  })
})
