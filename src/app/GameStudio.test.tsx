import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'

import { loadBundledGames } from '../games/catalog'
import * as gameParser from '../games/parse'
import { MAX_GAME_SOURCE_BYTES } from '../games/source'
import { createGameShareUrl } from '../files/game-files'
import type { Session } from '../sessions/model'
import { keyForGame } from '../storage/game-repository'
import { MemoryGameRepository } from '../storage/memory-game-storage'
import { MemorySessionRepository } from '../storage/memory'
import { App } from './App'
import { GameStudio } from './components/GameStudio'

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

function dirtyNewStudio() {
  openNewStudio()
  fireEvent.change(openSource(), {
    target: { value: customSource.replaceAll('custom-game', 'new-game') },
  })
}

function sharedGameHash() {
  const shared = createGameShareUrl(customSource, window.location.href)
  expect(shared.ok).toBe(true)
  if (!shared.ok) throw new Error('Shared game fixture failed to encode')
  return new URL(shared.url).hash
}

function renderStudio(initialSource: string) {
  return render(
    <GameStudio
      initialSource={initialSource}
      bundledIds={new Set()}
      customRecords={[]}
      sessionRecords={[]}
      onSave={() => {
        throw new Error('Save is not part of this test.')
      }}
      onSaved={() => undefined}
      onCancel={() => undefined}
      onDirtyChange={() => undefined}
    />,
  )
}

function mockStudioViewport(initialWide: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  let wide = initialWide
  const addEventListener = vi.fn(
    (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
  )
  const removeEventListener = vi.fn(
    (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
  )
  const mediaQueryList = {
    get matches() {
      return wide
    },
    media: '(min-width: 64rem)',
    onchange: null,
    addEventListener,
    removeEventListener,
    dispatchEvent: () => true,
  } as unknown as MediaQueryList

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQueryList),
  )

  return {
    removeEventListener,
    setWide(nextWide: boolean) {
      wide = nextWide
      act(() => {
        for (const listener of listeners) {
          listener({
            matches: nextWide,
            media: mediaQueryList.media,
          } as MediaQueryListEvent)
        }
      })
    },
  }
}

describe('Game Studio', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('renders a synchronized editor and complementary preview on wide screens', () => {
    mockStudioViewport(true)
    renderStudio(customSource)

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Guided',
      'Source',
    ])
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    const preview = screen.getByRole('complementary', {
      name: 'Live game preview',
    })
    expect(
      within(preview).getByRole('heading', { level: 1, name: 'Custom Game' }),
    ).toBeInTheDocument()

    expect(screen.getByLabelText('Game name')).toHaveValue('Custom Game')
    fireEvent.change(screen.getByLabelText('Rules Markdown'), {
      target: { value: '# Revised Rules\n\nThe rules changed.' },
    })
    expect(screen.getByLabelText('Game name')).toHaveValue('Custom Game')
    expect(
      within(preview).getByRole('heading', {
        level: 1,
        name: 'Revised Rules',
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    const editor = screen.getByLabelText('Complete game source')
    const revisedSource = customSource
      .replace('name: Custom Game', 'name: Revised Game')
      .replace('# Custom Game', '# Revised Game')
    fireEvent.change(editor, { target: { value: revisedSource } })
    expect(
      within(preview).getByRole('heading', { level: 1, name: 'Revised Game' }),
    ).toBeInTheDocument()

    fireEvent.change(editor, { target: { value: '---\nid: Broken' } })
    expect(
      within(preview).getByText('Preview shows the last valid draft'),
    ).toBeInTheDocument()
    expect(
      within(preview).getByRole('heading', { level: 1, name: 'Revised Game' }),
    ).toBeInTheDocument()
  })

  it('moves focus between replacement preview regions across the breakpoint and cleans up its listener', () => {
    const viewport = mockStudioViewport(false)
    const linkedSource = customSource.replace(
      'Original rules.',
      '[Rules reference](https://example.com/rules)',
    )
    const { unmount } = renderStudio(linkedSource)

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Guided',
      'Source',
      'Preview',
    ])
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    const mobilePreview = screen.getByRole('tabpanel')
    within(mobilePreview).getByRole('link', { name: 'Rules reference' }).focus()
    expect(
      within(mobilePreview).getByRole('link', { name: 'Rules reference' }),
    ).toHaveFocus()

    viewport.setWide(true)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Guided',
      'Source',
    ])
    expect(screen.getByLabelText('Game name')).toBeInTheDocument()
    const widePreview = screen.getByRole('complementary', {
      name: 'Live game preview',
    })
    expect(widePreview).toHaveFocus()

    within(widePreview).getByRole('link', { name: 'Rules reference' }).focus()
    viewport.setWide(false)
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel')).toHaveFocus()
    expect(
      screen.queryByRole('complementary', { name: 'Live game preview' }),
    ).not.toBeInTheDocument()

    screen.getByRole('tab', { name: 'Preview' }).focus()
    viewport.setWide(true)
    expect(
      screen.getByRole('complementary', { name: 'Live game preview' }),
    ).toHaveFocus()

    unmount()
    expect(viewport.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })

  it('does not steal focus from an editor that remains across breakpoint changes', () => {
    const viewport = mockStudioViewport(false)
    renderStudio(customSource)

    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    const source = screen.getByLabelText('Complete game source')
    source.focus()

    viewport.setWide(true)
    expect(screen.getByLabelText('Complete game source')).toHaveFocus()

    viewport.setWide(false)
    expect(screen.getByLabelText('Complete game source')).toHaveFocus()
  })

  it('opens a new Studio from the catalog authoring entry point', () => {
    renderApp()

    fireEvent.click(screen.getByRole('link', { name: 'Create a game' }))

    expect(window.location.search).toBe('?studio=new')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create custom game' }),
    ).toBeInTheDocument()
  })

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

  it('rejects oversized initial repair source before invoking the parser', () => {
    const parse = vi.spyOn(gameParser, 'parseGameSource')
    const oversizedSource = 'x'.repeat(MAX_GAME_SOURCE_BYTES + 1)

    renderStudio(oversizedSource)

    expect(parse).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      oversizedSource,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Game source exceeds the 1 MiB limit.',
    )
  })

  it('rejects an oversized source edit before parsing and keeps the last valid preview', () => {
    const parse = vi.spyOn(gameParser, 'parseGameSource')
    renderStudio(customSource)
    parse.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: 'x'.repeat(MAX_GAME_SOURCE_BYTES + 1) },
    })

    expect(parse).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Game source exceeds the 1 MiB limit.',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(
      screen.getByText('Preview shows the last valid draft'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Custom Game' }),
    ).toBeInTheDocument()
  })

  it('guards an oversized imported repair draft in Studio', () => {
    const oversizedSource = 'x'.repeat(MAX_GAME_SOURCE_BYTES + 1)
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
    fireEvent.change(screen.getByLabelText('Complete game source'), {
      target: { value: oversizedSource },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Repair in Game Studio' }),
    )

    expect(window.location.search).toBe('?studio=repair')
    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      oversizedSource,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Game source exceeds the 1 MiB limit.',
    )
  })

  it('warns before the first guided edit would normalize YAML comments', () => {
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    renderStudio(commentedSource)

    fireEvent.click(screen.getByRole('tab', { name: 'Guided' }))
    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'Changed' },
    })

    expect(
      screen.getByRole('dialog', { name: 'Normalize source formatting?' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with guided editing' }),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    expect(screen.getByLabelText('Complete game source')).not.toHaveValue(
      expect.stringContaining('# keep this note'),
    )
  })

  it('warns before a guided edit would normalize an inline YAML comment', () => {
    const commentedSource = customSource.replace(
      'name: Custom Game',
      'name: Custom Game # keep this rationale',
    )
    renderStudio(commentedSource)

    fireEvent.change(screen.getByLabelText('Summary'), {
      target: { value: 'Changed summary' },
    })

    expect(
      screen.getByRole('dialog', { name: 'Normalize source formatting?' }),
    ).toBeInTheDocument()
  })

  it('keeps the first guided edit pending while normalization is confirmed', () => {
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    renderStudio(commentedSource)

    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'First change' },
    })
    expect(
      screen.getByRole('dialog', { name: 'Normalize source formatting?' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Summary'), {
      target: { value: 'Second change' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with guided editing' }),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))

    const source = screen.getByLabelText(
      'Complete game source',
    ) as HTMLTextAreaElement
    expect(source.value).toContain('name: First change')
    expect(source.value).not.toContain('Second change')
  })

  it('leaves source unchanged when normalization is canceled', () => {
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    renderStudio(commentedSource)

    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'Changed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel guided edit' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))

    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      commentedSource,
    )
  })

  it('treats pending normalization as dirty and blocks underlying Studio actions', () => {
    const onSave = vi.fn(() => ({ ok: true }) as const)
    const onCancel = vi.fn()
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    render(
      <GameStudio
        initialSource={commentedSource}
        bundledIds={new Set()}
        customRecords={[]}
        sessionRecords={[]}
        onSave={onSave}
        onSaved={() => undefined}
        onCancel={onCancel}
        onDirtyChange={() => undefined}
      />,
    )

    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'Pending change' },
    })

    expect(document.querySelector('.game-studio')).toHaveAttribute('inert')
    const unload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(unload)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    fireEvent.click(screen.getByRole('link', { name: 'All games' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText('Complete game source'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel guided edit' }))
    expect(document.querySelector('.game-studio')).not.toHaveAttribute('inert')
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
    expect(screen.getByLabelText('Complete game source')).toHaveValue(
      commentedSource,
    )
  })

  it('traps normalization focus, cancels on Escape, and restores its trigger', () => {
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    renderStudio(commentedSource)
    const trigger = screen.getByLabelText('Game name')
    trigger.focus()
    fireEvent.change(trigger, { target: { value: 'Pending change' } })

    const dialog = screen.getByRole('dialog', {
      name: 'Normalize source formatting?',
    })
    const continueButton = screen.getByRole('button', {
      name: 'Continue with guided editing',
    })
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel guided edit',
    })
    expect(continueButton).toHaveFocus()
    cancelButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(continueButton).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(
      screen.queryByRole('dialog', { name: 'Normalize source formatting?' }),
    ).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('makes the application shell inert and blocks app navigation while normalization is pending', () => {
    const commentedSource = customSource.replace(
      'schema_version: 1',
      'schema_version: 1\n# keep this note',
    )
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: commentedSource },
    })
    window.history.replaceState({}, '', '/?studio=edit&game=custom-game')
    renderApp(gameRepository)

    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'Pending change' },
    })

    expect(document.querySelector('.app-shell')).toHaveAttribute('inert')
    fireEvent.click(screen.getByRole('link', { name: 'Ludocairn' }))
    expect(window.location.search).toBe('?studio=edit&game=custom-game')
    expect(
      screen.queryByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Normalize source formatting?' }),
    ).toBeInTheDocument()
  })

  it('blocks Studio save when custom-game storage enumeration failed', () => {
    const onSave = vi.fn(() => ({ ok: true }) as const)
    render(
      <GameStudio
        initialSource={customSource}
        originalId="custom-game"
        bundledIds={new Set()}
        customRecords={[
          {
            id: '',
            ok: false,
            diagnostic: {
              code: 'game-storage.read-failed',
              message: 'Browser game storage is blocked.',
            },
          },
        ]}
        sessionRecords={[]}
        onSave={onSave}
        onSaved={() => undefined}
        onCancel={() => undefined}
        onDirtyChange={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Custom games could not be read',
    )
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
    window.history.replaceState({}, '', '/?studio=edit&game=custom-game')
    renderApp(gameRepository, sessionRepository)

    expect(screen.getByLabelText('Game ID')).toBeDisabled()
    fireEvent.change(openSource(), { target: { value: incompatibleSource } })
    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    expect(screen.getByRole('alert')).toHaveTextContent('saved session')
    expect(screen.getByRole('alert')).toHaveTextContent('Saved table')
    expect(screen.getByRole('alert')).toHaveTextContent('custom-session')
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

  it('guards wordmark navigation with the same dirty confirmation', () => {
    dirtyNewStudio()

    fireEvent.click(screen.getByRole('link', { name: 'Ludocairn' }))

    expect(window.location.search).toBe('?studio=new')
    expect(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Complete game source')).toBeInTheDocument()
  })

  it('guards browser back navigation while the Studio is dirty', () => {
    dirtyNewStudio()
    window.history.replaceState({}, '', '/')

    fireEvent.popState(window)

    expect(window.location.search).toBe('?studio=new')
    expect(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(window.location.search).toBe('')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a game' }),
    ).toBeInTheDocument()
  })

  it('traps modal focus and restores the trigger when Escape keeps editing', () => {
    dirtyNewStudio()
    const trigger = screen.getByRole('link', { name: 'All games' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', {
      name: 'Discard unsaved changes?',
    })
    const keepEditing = screen.getByRole('button', { name: 'Keep editing' })
    const discard = screen.getByRole('button', { name: 'Discard changes' })
    expect(keepEditing).toHaveFocus()
    expect(document.querySelector('.app-shell')).toHaveAttribute('inert')

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(discard).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(
      screen.queryByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.querySelector('.app-shell')).not.toHaveAttribute('inert')
    expect(window.location.search).toBe('?studio=new')
  })

  it('restores a dirty Studio when shared-hash navigation is canceled', () => {
    dirtyNewStudio()
    const editor = screen.getByLabelText('Complete game source')
    const draft = (editor as HTMLTextAreaElement).value
    editor.focus()
    const hash = sharedGameHash()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + window.location.search + hash,
    )

    fireEvent(window, new Event('hashchange'))

    expect(window.location.search).toBe('?studio=new')
    expect(window.location.hash).toBe('')
    expect(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument()
    fireEvent.keyDown(
      screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
      { key: 'Escape' },
    )
    expect(screen.getByLabelText('Complete game source')).toHaveValue(draft)
    expect(editor).toHaveFocus()
    expect(window.location.search).toBe('?studio=new')
    expect(window.location.hash).toBe('')
  })

  it('opens shared review only after discarding a dirty Studio hash navigation', () => {
    dirtyNewStudio()
    const draft = (
      screen.getByLabelText('Complete game source') as HTMLTextAreaElement
    ).value
    const hash = sharedGameHash()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + window.location.search + hash,
    )

    fireEvent(window, new Event('hashchange'))

    expect(window.location.hash).toBe('')
    expect(screen.getByLabelText('Complete game source')).toHaveValue(draft)
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(window.location.search).toBe('?studio=new')
    expect(window.location.hash).toBe(hash)
    expect(
      screen.getByRole('region', { name: 'Review shared game' }),
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
    expect(window.location.search).toBe('?studio=edit&game=custom-game')
    expect(screen.getByLabelText('Game ID')).toBeDisabled()
  })

  it.each(['new', 'repair'])(
    'edits the valid custom ID %s explicitly',
    (id) => {
      const source = customSource.replace('id: custom-game', `id: ${id}`)
      const gameRepository = new MemoryGameRepository({
        initial: { [keyForGame(id)]: source },
      })
      window.history.replaceState({}, '', `/?studio=edit&game=${id}`)

      renderApp(gameRepository)

      expect(screen.getByLabelText('Game ID')).toBeDisabled()
      expect(screen.getByLabelText('Game ID')).toHaveValue(id)
    },
  )

  it('does not interpret an unknown Studio mode as a custom-game ID', () => {
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame('custom-game')]: customSource },
    })
    window.history.replaceState({}, '', '/?studio=custom-game')

    renderApp(gameRepository)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Game unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Game ID')).not.toBeInTheDocument()
  })

  it('rejects a custom recovery record that collides with a bundled ID', () => {
    const catalog = loadBundledGames()
    expect(catalog.ok).toBe(true)
    if (!catalog.ok) return
    const bundled = catalog.games[0]
    expect(bundled).toBeDefined()
    if (!bundled) return
    const collisionSource = customSource.replace(
      'id: custom-game',
      `id: ${bundled.id}`,
    )
    const gameRepository = new MemoryGameRepository({
      initial: { [keyForGame(bundled.id)]: collisionSource },
    })
    window.history.replaceState(
      {},
      '',
      `/?studio=edit&game=${encodeURIComponent(bundled.id)}`,
    )

    render(
      <App
        games={[bundled]}
        gameRepository={gameRepository}
        repository={new MemorySessionRepository(() => undefined)}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Game unavailable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bundled games cannot be edited in Game Studio',
    )
    expect(screen.queryByLabelText('Game ID')).not.toBeInTheDocument()
  })
})
