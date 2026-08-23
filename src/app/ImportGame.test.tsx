import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadBundledGames } from '../games/catalog'
import { createGameShareUrl } from '../files/game-files'
import { keyForGame } from '../storage/game-repository'
import { MemoryGameRepository } from '../storage/memory-game-storage'
import { MemorySessionRepository } from '../storage/memory'
import { App } from './App'

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

const bundledSource = customSource
  .replace('id: custom-game', 'id: bundled-game')
  .replace('name: Custom Game', 'name: Bundled Game')

const bundledCatalog = loadBundledGames()
if (!bundledCatalog.ok) throw new Error('Bundled game fixture failed to load')
const bundledGame = bundledCatalog.games[0]
if (!bundledGame) throw new Error('Bundled game fixture was not found')

function renderApp(gameRepository = new MemoryGameRepository()) {
  return render(
    <App
      games={[]}
      gameRepository={gameRepository}
      repository={new MemorySessionRepository(() => undefined)}
    />,
  )
}

function uploadGame(value: string, name = 'game.ludocairn-game.md') {
  const input = screen.getByLabelText('Game Markdown file')
  fireEvent.change(input, {
    target: { files: [new File([value], name, { type: 'text/markdown' })] },
  })
}

describe('ImportGame', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('reviews pasted source before saving and then opens its rules', async () => {
    const gameRepository = new MemoryGameRepository()
    renderApp(gameRepository)

    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: customSource },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))

    const review = screen.getByRole('region', { name: 'Review game import' })
    expect(within(review).getByText('Custom Game')).toBeInTheDocument()
    expect(gameRepository.list()).toHaveLength(0)

    fireEvent.click(
      within(review).getByRole('button', { name: 'Save custom game' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Custom Game' }),
    ).toBeInTheDocument()
    expect(gameRepository.load('custom-game')).toMatchObject({ ok: true })
  })

  it('accepts one Markdown file and rejects other extensions or oversized input', async () => {
    renderApp()

    expect(screen.getByLabelText('Game Markdown file')).toHaveAttribute(
      'accept',
      '.md,.ludocairn-game.md,text/markdown',
    )
    uploadGame(customSource, 'game.json')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a Markdown game file',
    )

    uploadGame('x'.repeat(1_048_577))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Game source exceeds the 1 MiB limit.',
      ),
    )
  })

  it('reviews a valid uploaded Markdown file before saving it', async () => {
    const gameRepository = new MemoryGameRepository()
    renderApp(gameRepository)

    uploadGame(customSource)

    expect(
      await screen.findByRole('region', { name: 'Review game import' }),
    ).toHaveTextContent('Custom Game')
    expect(gameRepository.list()).toHaveLength(0)
  })

  it('reviews a shared game and clears the fragment only after a successful save', async () => {
    const shared = createGameShareUrl(customSource, window.location.href)
    expect(shared.ok).toBe(true)
    if (!shared.ok) return
    window.history.replaceState(
      {},
      '',
      new URL(shared.url).pathname + new URL(shared.url).hash,
    )

    renderApp()

    expect(
      await screen.findByRole('region', { name: 'Review shared game' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(window.location.hash).toBe('')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Custom Game' }),
    ).toBeInTheDocument()
  })

  it('reviews a shared game before a game query route', async () => {
    const shared = createGameShareUrl(
      customSource,
      window.location.origin + '/?game=custom-game',
    )
    expect(shared.ok).toBe(true)
    if (!shared.ok) return
    const url = new URL(shared.url)
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)

    renderApp()

    expect(
      await screen.findByRole('region', { name: 'Review shared game' }),
    ).toBeInTheDocument()
  })

  it('reviews a shared game before a session query route after hashchange', async () => {
    window.history.replaceState({}, '', '/?session=missing-session')
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Session unavailable' }),
    ).toBeInTheDocument()

    const shared = createGameShareUrl(customSource, window.location.href)
    expect(shared.ok).toBe(true)
    if (!shared.ok) return
    const url = new URL(shared.url)
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    window.dispatchEvent(new Event('hashchange'))

    expect(
      await screen.findByRole('region', { name: 'Review shared game' }),
    ).toBeInTheDocument()
  })

  it('retains a shared fragment when browser storage rejects the save', async () => {
    const shared = createGameShareUrl(customSource, window.location.href)
    expect(shared.ok).toBe(true)
    if (!shared.ok) return
    const hash = new URL(shared.url).hash
    window.history.replaceState({}, '', new URL(shared.url).pathname + hash)

    renderApp(new MemoryGameRepository({ failWrites: true }))

    await screen.findByRole('region', { name: 'Review shared game' })
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(window.location.hash).toBe(hash)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Injected memory storage failure.',
    )
  })

  it('keeps invalid pasted source out of storage and routes it to repair', () => {
    const gameRepository = new MemoryGameRepository()
    renderApp(gameRepository)

    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: 'not a game' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Repair in Game Studio' }),
    )

    expect(window.location.search).toBe('?studio=repair')
    expect(gameRepository.list()).toHaveLength(0)
  })

  it('treats a matching saved custom ID as an update', async () => {
    const originalSource = customSource.replace(
      'A browser-authored fixture.',
      'Original summary.',
    )
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: originalSource },
    })
    renderApp(gameRepository)

    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: customSource },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(gameRepository.raw('custom-game')).toBe(customSource)
  })

  it('keeps a bundled-ID collision in review without writing it', async () => {
    const gameRepository = new MemoryGameRepository()
    render(
      <App
        games={[{ ...bundledGame, id: 'bundled-game', name: 'Bundled Game' }]}
        gameRepository={gameRepository}
        repository={new MemorySessionRepository(() => undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: bundledSource },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(
      screen.getByRole('region', { name: 'Review game import' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Game ID "bundled-game" belongs to a bundled game.',
    )
    expect(gameRepository.list()).toHaveLength(0)
  })

  it('keeps the source in review when browser storage rejects the save', async () => {
    const gameRepository = new MemoryGameRepository({ failWrites: true })
    renderApp(gameRepository)

    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: customSource },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(
      screen.getByRole('region', { name: 'Review game import' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Injected memory storage failure.',
    )
  })
})
