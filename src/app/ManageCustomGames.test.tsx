import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { serializeSession } from '../files/session-files'
import type { Session } from '../sessions/model'
import { GAME_KEY_PREFIX, keyForGame } from '../storage/game-repository'
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

const customSession: Session = {
  storageVersion: 1,
  id: 'custom-session',
  name: 'Friday Table',
  gameId: 'custom-game',
  gameSchemaVersion: 1,
  players: [],
  notes: '',
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
}

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
)

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

function customRepositories(source = customSource) {
  const games = new MemoryGameRepository({
    initial: { [keyForGame('custom-game')]: source },
  })
  const sessions = new MemorySessionRepository((id) => {
    const loaded = games.load(id)
    return loaded.ok ? loaded.game : undefined
  })
  return { games, sessions }
}

function renderCatalog(source = customSource) {
  const repositories = customRepositories(source)
  render(
    <App
      games={[]}
      gameRepository={repositories.games}
      repository={repositories.sessions}
    />,
  )
  return repositories
}

function confirmCustomGameDeletion() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete Custom Game' }))
  fireEvent.change(screen.getByLabelText('Confirm game name'), {
    target: { value: 'Custom Game' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Permanently delete Custom Game' }),
  )
}

function uploadSession(session: Session) {
  const file = new File([serializeSession(session)], 'custom-session.json', {
    type: 'application/json',
  })
  fireEvent.change(screen.getByLabelText('Session JSON file'), {
    target: { files: [file] },
  })
}

function incompressibleRules(length: number): string {
  let state = 0x12345678
  let value = ''
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    value += String.fromCharCode(33 + (state % 90))
  }
  return value
}

describe('custom game catalog management', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard)
    } else {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('exports the exact saved source and creates a copyable share link', async () => {
    let copied = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => void (copied = value) },
    })
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:custom-game-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    renderCatalog()

    expect(
      screen.getByRole('button', { name: 'Edit Custom Game' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Export Custom Game' }))

    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    if (!(blob instanceof Blob)) throw new Error('Export did not create a Blob')
    expect(blob).toHaveProperty('type', 'text/markdown;charset=utf-8')
    await expect(readBlob(blob)).resolves.toBe(customSource)
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('custom-game.ludocairn-game.md')
    expect(anchor.href).toBe('blob:custom-game-export')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:custom-game-export')

    fireEvent.click(screen.getByRole('button', { name: 'Share Custom Game' }))
    const shareLink = screen.getByLabelText('Share link')
    expect((shareLink as HTMLInputElement).value).toContain('#share-game=v1.')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Share link copied'),
    )
    expect(copied).toBe((shareLink as HTMLInputElement).value)
  })

  it('keeps the share URL selectable when clipboard writing fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Clipboard permission denied.')
        },
      },
    })
    renderCatalog()

    fireEvent.click(screen.getByRole('button', { name: 'Share Custom Game' }))
    const shareLink = screen.getByLabelText('Share link')
    const url = (shareLink as HTMLInputElement).value
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /select the share link and copy it manually/i,
    )
    expect(shareLink).toHaveValue(url)
    expect(shareLink).toHaveAttribute('readonly')
  })

  it('directs overlong shares to the Markdown export fallback', () => {
    const source = customSource.replace(
      'Original rules.',
      incompressibleRules(30_000),
    )
    renderCatalog(source)

    fireEvent.click(screen.getByRole('button', { name: 'Share Custom Game' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This game is too large for a share link. Export its Markdown file instead.',
    )
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Export Custom Game' }),
    ).toBeInTheDocument()
  })

  it('blocks confirmed deletion while a named saved session uses the game', () => {
    const { games, sessions } = customRepositories()
    expect(sessions.save(customSession)).toMatchObject({ ok: true })
    render(<App games={[]} gameRepository={games} repository={sessions} />)

    confirmCustomGameDeletion()

    expect(screen.getByRole('alert')).toHaveTextContent('Friday Table')
    expect(games.load('custom-game')).toMatchObject({ ok: true })
  })

  it('requires the exact game name, then deletes and refreshes the catalog', () => {
    const { games } = renderCatalog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Custom Game' }))
    const confirm = screen.getByRole('button', {
      name: 'Permanently delete Custom Game',
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Confirm game name'), {
      target: { value: 'custom game' },
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Confirm game name'), {
      target: { value: 'Custom Game' },
    })
    fireEvent.click(confirm)

    expect(games.load('custom-game')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.not-found' },
    })
    expect(
      screen.queryByRole('heading', { name: 'Custom Game' }),
    ).not.toBeInTheDocument()
  })
})

describe('custom game recovery and session portability', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => vi.restoreAllMocks())

  it('downloads and then deletes recoverable raw custom source', async () => {
    const brokenRaw = '---\nid: broken-game\n'
    const games = new MemoryGameRepository({
      initial: { [`${GAME_KEY_PREFIX}broken-game`]: brokenRaw },
    })
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:broken-game-recovery')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )
    render(
      <App
        games={[]}
        gameRepository={games}
        repository={new MemorySessionRepository(() => undefined)}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Custom games needing attention' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download raw source' }))
    const blob = createObjectURL.mock.calls[0]?.[0]
    if (!(blob instanceof Blob))
      throw new Error('Recovery did not create a Blob')
    await expect(readBlob(blob)).resolves.toBe(brokenRaw)

    fireEvent.click(
      screen.getByRole('button', { name: 'Review delete broken-game' }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('broken-game')
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete stored game broken-game' }),
    )
    expect(games.load('broken-game')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.not-found' },
    })
  })

  it('does not offer deletion for a read-failure sentinel with no target ID', () => {
    const games = new MemoryGameRepository({ failReads: true })
    render(
      <App
        games={[]}
        gameRepository={games}
        repository={new MemorySessionRepository(() => undefined)}
      />,
    )

    expect(
      screen.getByText('Injected memory storage failure.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'No stored game can be targeted for deletion because browser storage could not be read.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument()
  })

  it('warns that a custom game must accompany a session export', async () => {
    const { games, sessions } = customRepositories()
    expect(sessions.save(customSession)).toMatchObject({ ok: true })
    window.history.replaceState({}, '', '/?session=custom-session')
    render(<App games={[]} gameRepository={games} repository={sessions} />)

    expect(
      await screen.findByText(/export the custom game too/i),
    ).toBeInTheDocument()
  })

  it('guides missing-game session imports without embedding a game', async () => {
    const sessions = new MemorySessionRepository(() => undefined)
    render(
      <App
        games={[]}
        gameRepository={new MemoryGameRepository()}
        repository={sessions}
      />,
    )

    uploadSession(customSession)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'If this is a custom game, import the custom game first, then retry the session.',
    )
    expect(sessions.list()).toHaveLength(0)
    expect(serializeSession(customSession)).not.toContain('schema_version')
    expect(serializeSession(customSession)).not.toContain('Original rules')
  })
})
