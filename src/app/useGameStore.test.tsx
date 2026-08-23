import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { loadBundledGames } from '../games/catalog'
import { keyForGame } from '../storage/game-repository'
import { MemoryGameRepository } from '../storage/memory-game-storage'
import { useGameStore } from './useGameStore'

const catalog = loadBundledGames()
if (!catalog.ok) throw new Error('Bundled catalog fixture failed to load')

const customSource = `---
schema_version: 1
id: custom-game
name: Custom Game
summary: A browser-authored fixture.
deck: standard-52
players:
  min: 1
session:
  round:
    enabled: false
  player_fields: []
---

# Custom Game
`

describe('useGameStore', () => {
  it('loads stored custom games after the bundled catalog', () => {
    const repository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: customSource },
    })
    const { result } = renderHook(() => useGameStore(repository, catalog.games))

    expect(result.current.games.at(-1)).toMatchObject({
      id: 'custom-game',
      name: 'Custom Game',
    })
    expect(result.current.customIds).toEqual(new Set(['custom-game']))
  })

  it('refreshes the catalog after a custom game is saved', () => {
    const repository = new MemoryGameRepository()
    const { result } = renderHook(() => useGameStore(repository, catalog.games))

    repository.save(customSource)
    act(() => result.current.refresh())

    expect(result.current.games.map((game) => game.id)).toContain('custom-game')
  })
})
