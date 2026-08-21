import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildCatalog } from '../src/games/catalog'

function gameDirectories(): string[] {
  return readdirSync('games', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe('bundled games', () => {
  it('validates every definition and its adjacent rights record', () => {
    const directories = gameDirectories()
    const sources: Record<string, string> = {}

    for (const directory of directories) {
      const gamePath = join('games', directory, 'game.md')
      const rightsPath = join('games', directory, 'RIGHTS.md')
      expect(existsSync(gamePath), gamePath).toBe(true)
      expect(existsSync(rightsPath), rightsPath).toBe(true)

      const rights = readFileSync(rightsPath, 'utf8')
      expect(rights).toMatch(/^# .+ Rights Record/m)
      expect(rights).toMatch(/^## Authorship$/m)
      expect(rights).toMatch(/^## License$/m)
      expect(rights).toMatch(/^## Provenance$/m)
      expect(rights).toMatch(/^## Name clearance$/m)
      expect(rights).toMatch(/\bMIT License\b/)
      expect(rights).toMatch(/\b\d{4}-\d{2}-\d{2}\b/)

      sources[`/games/${directory}/game.md`] = readFileSync(gamePath, 'utf8')
    }

    const result = buildCatalog(sources)
    expect(
      result,
      result.ok ? undefined : JSON.stringify(result.diagnostics, null, 2),
    ).toMatchObject({ ok: true })
    const ids = result.ok ? result.games.map((game) => game.id) : []

    expect(ids).toEqual(['rillward-gambit', 'sereinfolio', 'veilquorum'])
    expect(new Set(ids)).toHaveProperty('size', 3)
  })
})
