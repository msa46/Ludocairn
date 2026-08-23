import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StrictMode } from 'react'

import type { Session } from '../sessions/model'
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

Original rules.
`

const incompatibleSource = customSource.replace(
  '  player_fields: []',
  `  player_fields:
    - id: ready
      label: Ready
      type: boolean
      default: false`,
)

const savedSession: Session = {
  storageVersion: 1,
  id: 'custom-session',
  name: 'Saved table',
  gameId: 'custom-game',
  gameSchemaVersion: 1,
  players: [{ id: 'player-1', name: 'Ari', fields: {} }],
  notes: '',
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
}

function renderApp(
  gameRepository = new MemoryGameRepository(),
  sessionRepository = new MemorySessionRepository(() => undefined),
) {
  return render(
    <App
      games={[]}
      gameRepository={gameRepository}
      repository={sessionRepository}
    />,
  )
}

function openNewStudio() {
  window.history.replaceState({}, '', '/?studio=new')
  renderApp()
}

function openSource() {
  fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
  return screen.getByLabelText('Complete game source')
}

describe('Game Studio', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('opens a valid template, retains invalid source, and shows the last valid preview', () => {
    openNewStudio()

    const editor = openSource()
    fireEvent.change(editor, { target: { value: '---\nid: Broken' } })

    expect(editor).toHaveValue('---\nid: Broken')
    expect(screen.getByRole('alert')).toHaveTextContent('frontmatter')
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(
      screen.getByText('Preview shows the last valid draft'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'New Game' }),
    ).toBeInTheDocument()
  })

  it('keeps a saved ID read-only and rejects an incompatible session revision', () => {
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: customSource },
    })
    const sessionRepository = new MemorySessionRepository((id) => {
      const loaded = gameRepository.load(id)
      return loaded.ok ? loaded.game : undefined
    })
    expect(sessionRepository.save(savedSession)).toMatchObject({ ok: true })
    window.history.replaceState({}, '', '/?studio=custom-game')
    renderApp(gameRepository, sessionRepository)

    expect(screen.getByLabelText('Game ID')).toBeDisabled()
    fireEvent.change(openSource(), { target: { value: incompatibleSource } })
    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    expect(screen.getByRole('alert')).toHaveTextContent('saved session')
    expect(gameRepository.load('custom-game')).toMatchObject({
      ok: true,
      source: customSource,
    })
  })

  it('confirms in-app navigation and protects browser unload while dirty', () => {
    openNewStudio()
    const editor = openSource()
    const changedSource = customSource.replaceAll('custom-game', 'new-game')
    fireEvent.change(editor, { target: { value: changedSource } })

    const unload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(unload)).toBe(false)
    fireEvent.click(screen.getByRole('link', { name: 'All games' }))

    expect(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('?studio=new')

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(
      screen.queryByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      changedSource,
    )

    fireEvent.click(screen.getByRole('link', { name: 'All games' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(window.location.search).toBe('')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a game' }),
    ).toBeInTheDocument()
  })

  it('saves a valid current draft before opening its rules', () => {
    const gameRepository = new MemoryGameRepository()
    window.history.replaceState({}, '', '/?studio=new')
    renderApp(gameRepository)
    fireEvent.change(openSource(), {
      target: { value: customSource.replaceAll('custom-game', 'new-game') },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    expect(gameRepository.load('new-game')).toMatchObject({ ok: true })
    expect(window.location.search).toBe('?game=new-game')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Custom Game' }),
    ).toBeInTheDocument()
  })

  it('keeps a valid draft in the Studio when browser storage rejects the save', () => {
    const gameRepository = new MemoryGameRepository({ failWrites: true })
    window.history.replaceState({}, '', '/?studio=new')
    renderApp(gameRepository)
    const source = customSource.replaceAll('custom-game', 'new-game')
    fireEvent.change(openSource(), { target: { value: source } })

    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Injected memory storage failure.',
    )
    expect(screen.getByLabelText('Complete game source')).toHaveValue(source)
    expect(window.location.search).toBe('?studio=new')
  })

  it('opens invalid imported source for repair without persisting it', () => {
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
    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      'not a game',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('frontmatter')
    expect(gameRepository.list()).toHaveLength(0)
  })

  it('protects an empty imported repair draft even before it is edited', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Repair in Game Studio' }),
    )

    const unload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(unload)).toBe(false)
  })

  it('returns a refreshed repair-only route to the catalog with recovery guidance', () => {
    window.history.replaceState({}, '', '/?studio=repair')
    render(
      <StrictMode>
        <App
          games={[]}
          gameRepository={new MemoryGameRepository()}
          repository={new MemorySessionRepository(() => undefined)}
        />
      </StrictMode>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a game' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'repair draft is no longer available',
    )
    expect(window.location.search).toBe('')
  })

  it('offers Studio editing only from saved custom-game rules', () => {
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: customSource },
    })
    window.history.replaceState({}, '', '/?game=custom-game')
    renderApp(gameRepository)

    fireEvent.click(screen.getByRole('button', { name: 'Edit custom game' }))
    expect(window.location.search).toBe('?studio=custom-game')
    expect(screen.getByLabelText('Game ID')).toBeDisabled()
  })
})
