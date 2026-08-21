import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { serializeSession } from '../files/session-files'
import { loadBundledGames } from '../games/catalog'
import type { IdProvider, Session } from '../sessions/model'
import { MemorySessionRepository } from '../storage/memory'
import { App } from './App'

const catalog = loadBundledGames()
if (!catalog.ok) throw new Error('Bundled catalog fixture failed to load')
const veilquorum = catalog.games.find((game) => game.id === 'veilquorum')
if (!veilquorum) throw new Error('Veilquorum fixture was not found')

const resolveGame = (id: string) => catalog.games.find((game) => game.id === id)

const importedSession: Session = {
  storageVersion: 1,
  id: 'imported-session',
  name: 'Imported Friday',
  gameId: 'veilquorum',
  gameSchemaVersion: 1,
  players: [
    {
      id: 'imported-player',
      name: 'Ari',
      fields: { active: true, role: 'wayfinder', signals: 0, clue: '' },
    },
  ],
  currentPhase: 'night',
  round: 1,
  notes: 'Keep this private.',
  createdAt: '2026-08-21T18:00:00.000Z',
  updatedAt: '2026-08-21T18:05:00.000Z',
}

function ids(...values: string[]): IdProvider {
  let index = 0
  return { next: () => values[index++] ?? `generated-${index}` }
}

function uploadJson(value: string, name = 'session.json') {
  const input = screen.getByLabelText('Session JSON file')
  const file = new File([value], name, { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
  return input
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

describe('session file UI', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => vi.restoreAllMocks())

  it('previews a valid local file before saving, then imports and opens it', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    render(
      <App games={catalog.games} repository={repository} ids={ids('unused')} />,
    )

    const input = screen.getByLabelText('Session JSON file')
    expect(input).toHaveAttribute('accept', '.json')
    expect(input).not.toHaveAttribute('multiple')
    uploadJson(serializeSession(importedSession))

    const preview = await screen.findByRole('region', {
      name: 'Review import',
    })
    expect(within(preview).getByText('Imported Friday')).toBeInTheDocument()
    expect(within(preview).getByText('Veilquorum')).toBeInTheDocument()
    expect(within(preview).getByText('1 player')).toBeInTheDocument()
    expect(
      within(preview).queryByText('Keep this private.'),
    ).not.toBeInTheDocument()
    expect(repository.list()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Import session' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Imported Friday' }),
    ).toBeInTheDocument()
    expect(repository.load('imported-session')).toMatchObject({ ok: true })
  })

  it('cancels a preview without mutating the repository', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    render(<App games={catalog.games} repository={repository} />)

    uploadJson(serializeSession(importedSession))
    await screen.findByRole('heading', { name: 'Review import' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }))

    expect(
      screen.queryByRole('heading', { name: 'Review import' }),
    ).not.toBeInTheDocument()
    expect(repository.list()).toHaveLength(0)
  })

  it.each([
    {
      label: 'malformed JSON',
      contents: '{broken',
      message: 'not valid JSON',
    },
    {
      label: 'a missing game',
      contents: JSON.stringify({
        ...importedSession,
        gameId: 'missing-game',
      }),
      message: 'unavailable game',
    },
  ])('reports $label without saving', async ({ contents, message }) => {
    const repository = new MemorySessionRepository(resolveGame)
    render(<App games={catalog.games} repository={repository} />)

    uploadJson(contents)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(repository.list()).toHaveLength(0)
  })

  it('rejects a non-JSON filename before reading it', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    render(<App games={catalog.games} repository={repository} />)

    uploadJson(serializeSession(importedSession), 'session.txt')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a .json session file.',
    )
    expect(repository.list()).toHaveLength(0)
  })

  it('reassigns a colliding ID and preserves the existing saved session', async () => {
    const existing = { ...importedSession, name: 'Existing Friday' }
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(existing)
    render(
      <App
        games={catalog.games}
        repository={repository}
        ids={ids('replacement-session')}
      />,
    )

    uploadJson(serializeSession(importedSession))
    await screen.findByRole('heading', { name: 'Review import' })
    fireEvent.click(screen.getByRole('button', { name: 'Import session' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Imported Friday' }),
    ).toBeInTheDocument()
    expect(repository.load('imported-session')).toMatchObject({
      ok: true,
      session: { name: 'Existing Friday' },
    })
    expect(repository.load('replacement-session')).toMatchObject({
      ok: true,
      session: { name: 'Imported Friday' },
    })
  })

  it('exports observable UTF-8 JSON through a sanitized download', async () => {
    const session = { ...importedSession, name: '  Friday / Café!  ' }
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(session)
    window.history.replaceState({}, '', '/?session=imported-session')
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:session-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    render(<App games={catalog.games} repository={repository} />)

    await screen.findByRole('heading', { level: 1, name: /Friday \/ Café!/ })
    expect(
      screen.getByText(/Exports include facilitator notes/i),
    ).toHaveTextContent(/export.*facilitator notes/i)
    fireEvent.click(screen.getByRole('button', { name: 'Export session' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    if (!(blob instanceof Blob)) throw new Error('Export did not create a Blob')
    expect(blob).toHaveProperty('type', 'application/json;charset=utf-8')
    await expect(readBlob(blob)).resolves.toBe(serializeSession(session))
    expect(anchorClick).toHaveBeenCalledTimes(1)
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('friday-cafe.ludocairn-session.json')
    expect(anchor.href).toBe('blob:session-export')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-export')
  })

  it('revokes a failed download URL and leaves tracker actions available', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(importedSession)
    window.history.replaceState({}, '', '/?session=imported-session')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new DOMException('Downloads are blocked.')
    })
    render(<App games={catalog.games} repository={repository} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Export session' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Downloads are blocked.',
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-export')
    expect(
      screen.getByRole('button', { name: 'Print tracker' }),
    ).toBeInTheDocument()
  })
})

describe('valid saved session management', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))
  afterEach(() => vi.useRealTimers())

  it('renames the current session through the saved domain flow', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(importedSession)
    window.history.replaceState({}, '', '/?session=imported-session')
    render(
      <App
        games={catalog.games}
        repository={repository}
        clock={() => '2026-08-21T19:00:00.000Z'}
      />,
    )

    await screen.findByRole('heading', {
      level: 1,
      name: 'Imported Friday',
    })
    fireEvent.change(screen.getByLabelText('Session name'), {
      target: { value: '  Saturday table  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rename session' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Saturday table' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Session name')).toHaveValue('Saturday table')
    expect(repository.load('imported-session')).toMatchObject({
      ok: true,
      session: {
        name: 'Saturday table',
        updatedAt: '2026-08-21T19:00:00.000Z',
      },
    })
  })

  it('requires separate confirmation before deleting a valid session', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(importedSession)
    window.history.replaceState({}, '', '/?session=imported-session')
    render(<App games={catalog.games} repository={repository} />)

    await screen.findByRole('heading', {
      level: 1,
      name: 'Imported Friday',
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Review delete session' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'permanently deletes Imported Friday',
    )
    expect(repository.load('imported-session')).toMatchObject({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: 'Keep session' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(repository.load('imported-session')).toMatchObject({ ok: true })

    fireEvent.click(
      screen.getByRole('button', { name: 'Review delete session' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete saved session' }),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a game' }),
    ).toBeInTheDocument()
    expect(repository.load('imported-session')).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.not-found' },
    })
    expect(
      screen.queryByRole('button', { name: 'Delete unreadable record' }),
    ).not.toBeInTheDocument()
  })

  it('cancels a pending text autosave before deleting a valid session', async () => {
    vi.useFakeTimers()
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(importedSession)
    window.history.replaceState({}, '', '/?session=imported-session')
    render(<App games={catalog.games} repository={repository} />)

    await act(async () => undefined)
    fireEvent.change(screen.getByLabelText('Session notes'), {
      target: { value: 'Pending private note.' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Saving')

    fireEvent.click(
      screen.getByRole('button', { name: 'Review delete session' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete saved session' }),
    )
    expect(repository.load('imported-session')).toMatchObject({ ok: false })

    act(() => vi.advanceTimersByTime(300))

    expect(repository.load('imported-session')).toMatchObject({
      ok: false,
      diagnostic: { code: 'storage.not-found' },
    })
  })

  it('prints the tracker through the browser print boundary', async () => {
    const repository = new MemorySessionRepository(resolveGame)
    repository.save(importedSession)
    window.history.replaceState({}, '', '/?session=imported-session')
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    render(<App games={catalog.games} repository={repository} />)

    const printButton = await screen.findByRole('button', {
      name: 'Print tracker',
    })
    expect(screen.getByText('Phase: Night')).toHaveClass('print-only')
    expect(screen.getByText('Round: 1')).toHaveClass('print-only')
    expect(screen.getByText('Role: wayfinder')).toHaveClass('print-only')
    expect(
      screen.getByText('Facilitator notes: Keep this private.'),
    ).toHaveClass('print-only')
    expect(screen.getByLabelText('Phase').closest('label')).toHaveClass(
      'editing-controls',
    )

    fireEvent.click(printButton)

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })
})
