import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBundledGames } from '../games/catalog'
import { createGameShareUrl } from '../files/game-files'
import { keyForGame } from '../storage/game-repository'
import { MemoryGameRepository } from '../storage/memory-game-storage'
import { MemorySessionRepository } from '../storage/memory'
import type { SessionRepository } from '../storage/repository'
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

function renderApp(
  gameRepository = new MemoryGameRepository(),
  sessionRepository: SessionRepository = new MemorySessionRepository(
    () => undefined,
  ),
) {
  return render(
    <App
      games={[]}
      gameRepository={gameRepository}
      repository={sessionRepository}
    />,
  )
}

function reviewPastedSource(source = customSource) {
  fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
  fireEvent.change(screen.getByLabelText('Complete game source'), {
    target: { value: source },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
  return screen.getByRole('region', { name: 'Review game import' })
}

function unreadableSessions(id = '', raw?: string): SessionRepository {
  const fallback = new MemorySessionRepository(() => undefined)
  return {
    list: () => [
      {
        id,
        ok: false,
        ...(raw === undefined ? {} : { raw }),
        diagnostic: {
          code: id ? 'storage.invalid-session' : 'storage.read-failed',
          message: id
            ? 'Saved session is damaged.'
            : 'Browser session storage is blocked.',
        },
      },
    ],
    load: (sessionId) => fallback.load(sessionId),
    save: (session) => fallback.save(session),
    remove: (sessionId) => fallback.remove(sessionId),
    raw: (sessionId) => fallback.raw(sessionId),
  }
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
    expect(review).toHaveTextContent('Schema version1')
    expect(review).toHaveTextContent('Roles0')
    expect(review).toHaveTextContent('Tracker fields0')
    expect(review).toHaveTextContent('ValidationValid')
    expect(review).toHaveTextContent('Import actionNew custom game')
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
    expect(
      screen.getByText('Injected memory storage failure.'),
    ).toHaveTextContent('Injected memory storage failure.')
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

    const review = reviewPastedSource()

    expect(review).toHaveTextContent('Import actionUpdate existing custom game')
    fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))

    expect(gameRepository.raw('custom-game')).toBe(customSource)
  })

  it('requires explicit confirmation before replacing a recoverable corrupt record', () => {
    const raw = '---\nid: custom-game\n'
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: raw },
    })
    renderApp(gameRepository)

    const review = reviewPastedSource()
    const save = within(review).getByRole('button', {
      name: 'Save custom game',
    })

    expect(review).toHaveTextContent(
      'Import actionReplace recoverable stored record',
    )
    expect(review).toHaveTextContent('recoverable raw source')
    expect(save).toBeDisabled()
    fireEvent.click(
      within(review).getByRole('button', { name: 'Cancel import' }),
    )
    expect(gameRepository.raw('custom-game')).toBe(raw)
  })

  it('preserves corrupt raw source when confirmed replacement cannot be written', () => {
    const raw = '---\nid: custom-game\n'
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: raw },
      failWrites: true,
    })
    renderApp(gameRepository)
    const review = reviewPastedSource()

    fireEvent.click(
      within(review).getByLabelText(
        'I understand this replaces the recoverable raw source',
      ),
    )
    fireEvent.click(
      within(review).getByRole('button', { name: 'Save custom game' }),
    )

    expect(
      screen.getByText('Injected memory storage failure.'),
    ).toBeInTheDocument()
    expect(gameRepository.raw('custom-game')).toBe(raw)
  })

  it('preserves corrupt raw source when replacement preflight cannot enumerate sessions', () => {
    const raw = '---\nid: custom-game\n'
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: raw },
    })
    renderApp(gameRepository, unreadableSessions())
    const review = reviewPastedSource()

    fireEvent.click(
      within(review).getByLabelText(
        'I understand this replaces the recoverable raw source',
      ),
    )
    fireEvent.click(
      within(review).getByRole('button', { name: 'Save custom game' }),
    )

    expect(
      screen.getByText(
        'Saved sessions could not be read, so this game cannot be updated safely.',
      ),
    ).toHaveTextContent('Saved sessions could not be read')
    expect(gameRepository.raw('custom-game')).toBe(raw)
  })

  it('identifies corrupt saved sessions that block an imported update', () => {
    const originalSource = customSource.replace(
      'A browser-authored fixture.',
      'Original summary.',
    )
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: originalSource },
    })
    renderApp(
      gameRepository,
      unreadableSessions(
        'damaged-session',
        '{"gameId":"custom-game","players":"broken"}',
      ),
    )
    const review = reviewPastedSource()

    fireEvent.click(
      within(review).getByRole('button', { name: 'Save custom game' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent('damaged-session')
    expect(gameRepository.raw('custom-game')).toBe(originalSource)
  })

  it('blocks import before repository.save when custom-game enumeration failed', () => {
    const gameRepository = new MemoryGameRepository({ failReads: true })
    const save = vi.spyOn(gameRepository, 'save')
    renderApp(gameRepository)
    const review = reviewPastedSource()

    fireEvent.click(
      within(review).getByRole('button', { name: 'Save custom game' }),
    )

    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Custom games could not be read',
    )
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
