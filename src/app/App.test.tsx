import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadBundledGames } from '../games/catalog'
import type { IdProvider } from '../sessions/model'
import { MemorySessionRepository } from '../storage/memory'
import { App } from './App'

const catalog = loadBundledGames()
if (!catalog.ok) throw new Error('Bundled catalog fixture failed to load')
const veilquorum = catalog.games.find((game) => game.id === 'veilquorum')
if (!veilquorum) throw new Error('Veilquorum fixture was not found')
const rillwardGambit = catalog.games.find(
  (game) => game.id === 'rillward-gambit',
)
if (!rillwardGambit) throw new Error('Rillward Gambit fixture was not found')

const structuredVeilquorum = {
  ...veilquorum,
  roles: [
    {
      id: 'echo',
      label: 'Echo',
      team: 'Quorum',
      summary: 'Privately tests one active player.',
      card: { label: 'Heart', selector: { suits: ['hearts'] } },
    },
    {
      id: 'drifter',
      label: 'Drifter',
      team: 'Drifters',
      summary: 'Quietly reduces the quorum.',
    },
    {
      id: 'wayfinder',
      label: 'Wayfinder',
      team: 'Quorum',
      summary: 'Finds Drifters through public discussion.',
    },
  ],
  roleDistributions: [
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
  ],
  fields: veilquorum.fields.map((field) =>
    field.id === 'role'
      ? {
          id: 'role',
          label: 'Role',
          type: 'role' as const,
          default: 'wayfinder',
        }
      : field,
  ),
} satisfies typeof veilquorum

const gameJourneys = [
  {
    id: 'veilquorum',
    name: 'Veilquorum',
    controls: [
      ['Ari — Active', true],
      ['Ari — Role', 'wayfinder'],
      ['Ari — Signals', 0],
      ['Ari — Private clue', ''],
      ['Phase', 'night'],
      ['Round', 1],
    ],
  },
  {
    id: 'rillward-gambit',
    name: 'Rillward Gambit',
    controls: [
      ['Ari — Score', 0],
      ['Ari — Streak', 0],
      ['Ari — Stance', 'steady'],
      ['Ari — Notes', ''],
      ['Round', 1],
    ],
  },
  {
    id: 'sereinfolio',
    name: 'Sereinfolio',
    controls: [
      ['Ari — Reflection', ''],
      ['Ari — Tone', 'quiet'],
      ['Ari — Prompt notes', ''],
      ['Round', 1],
    ],
  },
] as const

function ids(...values: string[]): IdProvider {
  let index = 0
  return { next: () => values[index++] ?? `generated-${index}` }
}

describe('App', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  it('renders the catalog in a semantic application shell', () => {
    const repository = new MemorySessionRepository(() => veilquorum)
    render(<App games={[veilquorum]} repository={repository} />)

    expect(screen.getByRole('banner')).toHaveTextContent('Ludocairn')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a game' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Open Veilquorum/ }),
    ).toBeInTheDocument()
  })

  it('links AI tools to the repository game-translation guide', () => {
    const repository = new MemorySessionRepository(() => veilquorum)
    render(<App games={[veilquorum]} repository={repository} />)

    expect(
      screen.getByRole('link', { name: 'AI game translation guide' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/msa46/Deckwright/blob/main/Bots.md',
    )
  })

  it('shows the shared role guide through setup and live tracker quantities', () => {
    const repository = new MemorySessionRepository(() => structuredVeilquorum)
    render(
      <App
        games={[structuredVeilquorum]}
        repository={repository}
        clock={() => '2026-08-21T21:00:00.000Z'}
        ids={ids(
          'role-session',
          'player-1',
          'player-2',
          'player-3',
          'player-4',
          'player-5',
          'player-6',
        )}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: /Open Veilquorum/ }))
    expect(screen.getAllByRole('heading', { name: 'Role guide' })).toHaveLength(
      1,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(screen.getAllByRole('heading', { name: 'Role guide' })).toHaveLength(
      1,
    )
    fireEvent.change(screen.getByLabelText('Session name'), {
      target: { value: 'Role table' },
    })
    for (const [index, name] of ['Ari', 'Bea', 'Cy', 'Dee', 'Eli'].entries()) {
      if (index >= 2) {
        fireEvent.click(
          screen.getByRole('button', { name: 'Add another player' }),
        )
      }
      fireEvent.change(screen.getByLabelText(`Player ${index + 1} name`), {
        target: { value: name },
      })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    expect(screen.getAllByRole('heading', { name: 'Role guide' })).toHaveLength(
      1,
    )
    expect(screen.getByText('Quantities for 5 players')).toBeInTheDocument()
    expect(screen.getByText('3 Wayfinders')).toBeInTheDocument()

    const role = screen.getByRole('combobox', { name: 'Ari — Role' })
    fireEvent.change(role, { target: { value: 'echo' } })
    expect(role).toHaveDisplayValue('Echo')
    expect(role).toHaveValue('echo')

    fireEvent.change(screen.getByLabelText('New player name'), {
      target: { value: 'Fox' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }))
    expect(screen.getByText('Quantities for 6 players')).toBeInTheDocument()
    expect(screen.getByText('4 Wayfinders')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Fox' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove Fox' }))
    expect(screen.getByText('Quantities for 5 players')).toBeInTheDocument()
    expect(screen.getByText('3 Wayfinders')).toBeInTheDocument()
  })

  it('does not show an empty role guide for games without roles', () => {
    const repository = new MemorySessionRepository(() => rillwardGambit)
    render(<App games={[rillwardGambit]} repository={repository} />)

    fireEvent.click(screen.getByRole('link', { name: /Open Rillward Gambit/ }))
    expect(
      screen.queryAllByRole('heading', { name: 'Role guide' }),
    ).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(
      screen.queryAllByRole('heading', { name: 'Role guide' }),
    ).toHaveLength(0)
  })

  it('encodes route values before navigating', () => {
    const game = { ...veilquorum, id: 'veil&copy=true', name: 'Route Test' }
    const repository = new MemorySessionRepository((id) =>
      id === game.id ? game : undefined,
    )
    render(<App games={[game]} repository={repository} />)

    fireEvent.click(screen.getByRole('link', { name: 'Open Route Test' }))

    expect(window.location.search).toBe('?game=veil%26copy%3Dtrue')
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveTextContent('Route Test')
  })

  it('shows recoverable corruption when a storage key and session ID differ', async () => {
    const raw = JSON.stringify({
      storageVersion: 1,
      id: 'embedded-session',
      name: 'Mismatched table',
      gameId: veilquorum.id,
      gameSchemaVersion: veilquorum.schemaVersion,
      players: [],
      currentPhase: 'night',
      round: 1,
      notes: '',
      createdAt: '2026-08-21T18:00:00.000Z',
      updatedAt: '2026-08-21T18:00:00.000Z',
    })
    const repository = new MemorySessionRepository(() => veilquorum, {
      initial: { 'ludocairn.session.v1.storage-key-session': raw },
    })
    window.history.replaceState({}, '', '/?session=storage-key-session')

    render(<App games={[veilquorum]} repository={repository} />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'does not match its browser storage key',
      ),
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('Loading')
    expect(repository.raw('storage-key-session')).toBe(raw)
  })

  it('completes and resumes a persisted Veilquorum session', async () => {
    const repository = new MemorySessionRepository(() => veilquorum)
    render(
      <App
        games={[veilquorum]}
        repository={repository}
        clock={() => '2026-08-21T18:00:00.000Z'}
        ids={ids('session-1', 'player-1', 'player-2')}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: /Open Veilquorum/ }))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Veilquorum' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.change(screen.getByLabelText('Session name'), {
      target: { value: 'Friday table' },
    })
    fireEvent.change(screen.getByLabelText('Player 1 name'), {
      target: { value: 'Ari' },
    })
    fireEvent.change(screen.getByLabelText('Player 2 name'), {
      target: { value: 'Bea' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Friday table' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Ari — Role'), {
      target: { value: 'echo' },
    })
    fireEvent.change(screen.getByLabelText('Ari — Signals'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByLabelText('Bea — Active'))
    fireEvent.change(screen.getByLabelText('Ari — Private clue'), {
      target: { value: 'Trusted Bea' },
    })
    fireEvent.change(screen.getByLabelText('Phase'), {
      target: { value: 'day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Increase round' }))
    fireEvent.change(screen.getByLabelText('Session notes'), {
      target: { value: 'Watch the next vote.' },
    })

    expect(screen.getByRole('status')).toHaveTextContent('Saving')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Saved'),
    )
    fireEvent.click(screen.getByRole('link', { name: 'All games' }))
    fireEvent.click(screen.getByRole('link', { name: 'Resume Friday table' }))

    expect(screen.getByLabelText('Ari — Role')).toHaveValue('echo')
    expect(screen.getByLabelText('Ari — Signals')).toHaveValue(2)
    expect(screen.getByLabelText('Bea — Active')).not.toBeChecked()
    expect(screen.getByLabelText('Ari — Private clue')).toHaveValue(
      'Trusted Bea',
    )
    expect(screen.getByLabelText('Phase')).toHaveValue('day')
    expect(screen.getByLabelText('Round')).toHaveValue(2)
    expect(screen.getByLabelText('Session notes')).toHaveValue(
      'Watch the next vote.',
    )
  })

  it('renames a player and restores that name from the saved session', async () => {
    const repository = new MemorySessionRepository(() => veilquorum)
    render(
      <App
        games={[veilquorum]}
        repository={repository}
        clock={() => '2026-08-21T20:00:00.000Z'}
        ids={ids('session-rename', 'player-rename')}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: /Open Veilquorum/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.change(screen.getByLabelText('Session name'), {
      target: { value: 'Rename table' },
    })
    fireEvent.change(screen.getByLabelText('Player 1 name'), {
      target: { value: 'Ari' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    fireEvent.change(screen.getByLabelText('Ari name'), {
      target: { value: '  Arden  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rename Ari' }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Arden' }),
      ).toBeInTheDocument(),
    )
    expect(repository.load('session-rename')).toMatchObject({
      ok: true,
      session: {
        players: [{ id: 'player-rename', name: 'Arden' }],
        updatedAt: '2026-08-21T20:00:00.000Z',
      },
    })

    fireEvent.click(screen.getByRole('link', { name: 'All games' }))
    fireEvent.click(screen.getByRole('link', { name: 'Resume Rename table' }))

    expect(screen.getByRole('heading', { name: 'Arden' })).toBeInTheDocument()
    expect(screen.getByLabelText('Arden name')).toHaveValue('Arden')
  })

  it.each(gameJourneys)(
    'starts a $name session with its configured tracker controls',
    ({ id, name, controls }) => {
      const game = catalog.games.find((candidate) => candidate.id === id)
      expect(game, `${name} fixture`).toBeDefined()
      if (!game) return

      const repository = new MemorySessionRepository((candidateId) =>
        catalog.games.find((candidate) => candidate.id === candidateId),
      )
      render(
        <App
          games={catalog.games}
          repository={repository}
          clock={() => '2026-08-21T19:00:00.000Z'}
          ids={ids(`${id}-session`, `${id}-player`)}
        />,
      )

      fireEvent.click(screen.getByRole('link', { name: `Open ${name}` }))
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
      fireEvent.change(screen.getByLabelText('Session name'), {
        target: { value: `${name} table` },
      })
      fireEvent.change(screen.getByLabelText('Player 1 name'), {
        target: { value: 'Ari' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

      expect(
        screen.getByRole('heading', { level: 1, name: `${name} table` }),
      ).toBeInTheDocument()
      for (const [label, value] of controls) {
        const control = screen.getByLabelText(label)
        if (typeof value === 'boolean') {
          expect(control).toBeChecked()
        } else {
          expect(control).toHaveValue(value)
        }
      }
    },
  )
})
