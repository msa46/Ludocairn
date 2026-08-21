import { describe, expect, it } from 'vitest'

import { buildCatalog } from './catalog'

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
