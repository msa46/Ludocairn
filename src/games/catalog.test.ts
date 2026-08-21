import { describe, expect, it } from 'vitest'

import { buildCatalog, loadBundledGames } from './catalog'

function gameSource(id: string, name: string): string {
  return `---
schema_version: 1
id: ${id}
name: ${name}
summary: A complete fixture game.
deck: standard-52
players:
  min: 2
session:
  round:
    enabled: false
  player_fields: []
---
# ${name}
`
}

describe('buildCatalog', () => {
  it('parses valid sources in stable path order', () => {
    const result = buildCatalog({
      '/games/zeta-trail/game.md': gameSource('zeta-trail', 'Zeta Trail'),
      '/games/alpha-cairn/game.md': gameSource('alpha-cairn', 'Alpha Cairn'),
    })

    expect(result.ok && result.games.map((game) => game.id)).toEqual([
      'alpha-cairn',
      'zeta-trail',
    ])
  })

  it('returns parser diagnostics instead of a partial catalog', () => {
    const result = buildCatalog({
      '/games/broken/game.md': '# Missing frontmatter\n',
      '/games/valid/game.md': gameSource('valid', 'Valid'),
    })

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'frontmatter.invalid' }],
    })
  })

  it('rejects duplicate game IDs', () => {
    const result = buildCatalog({
      '/games/first/game.md': gameSource('shared-id', 'First'),
      '/games/second/game.md': gameSource('shared-id', 'Second'),
    })

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'catalog.duplicate-id', path: 'id' }],
    })
  })

  it('requires the directory and game ID to match', () => {
    const result = buildCatalog({
      '/games/directory-id/game.md': gameSource('different-id', 'Different'),
    })

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'catalog.path-id-mismatch', path: 'id' }],
    })
  })
})

describe('loadBundledGames', () => {
  it('loads Veilquorum with its structured role guide', () => {
    const result = loadBundledGames()
    if (!result.ok) throw new Error('Bundled catalog failed to load')

    const veilquorum = result.games.find(({ id }) => id === 'veilquorum')
    if (!veilquorum) throw new Error('Veilquorum was not found')

    expect(veilquorum.roles.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'echo', label: 'Echo' },
      { id: 'drifter', label: 'Drifter' },
      { id: 'wayfinder', label: 'Wayfinder' },
    ])
    expect(veilquorum.roles.find(({ id }) => id === 'echo')?.card).toEqual({
      label: 'Heart',
      selector: { suits: ['hearts'] },
    })
    expect(veilquorum.roles.find(({ id }) => id === 'drifter')?.card).toEqual({
      label: 'Any spade',
      selector: { suits: ['spades'] },
    })
    expect(
      veilquorum.roles.find(({ id }) => id === 'wayfinder')?.card,
    ).toEqual({
      label: 'Any club or diamond',
      selector: { suits: ['clubs', 'diamonds'] },
    })
    expect(veilquorum.roleDistributions).toEqual([
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
    ])
    expect(veilquorum.fields.find(({ id }) => id === 'role')).toMatchObject({
      type: 'role',
      default: 'wayfinder',
    })
  })

  it('normalizes bundled games without structured roles to empty arrays', () => {
    const result = loadBundledGames()
    if (!result.ok) throw new Error('Bundled catalog failed to load')

    for (const id of ['rillward-gambit', 'sereinfolio']) {
      const game = result.games.find((candidate) => candidate.id === id)
      if (!game) throw new Error(`${id} was not found`)

      expect(game.roles).toEqual([])
      expect(game.roleDistributions).toEqual([])
    }
  })
})
