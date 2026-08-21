import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { loadBundledGames } from '../games/catalog'
import type { IdProvider } from '../sessions/model'
import { MemorySessionRepository } from '../storage/memory'
import { App } from './App'

const catalog = loadBundledGames()
if (!catalog.ok) throw new Error('Bundled catalog fixture failed to load')
const veilquorum = catalog.games.find((game) => game.id === 'veilquorum')
if (!veilquorum) throw new Error('Veilquorum fixture was not found')

function ids(...values: string[]): IdProvider {
  let index = 0
  return { next: () => values[index++] ?? `generated-${index}` }
}

describe('App', () => {
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
})
