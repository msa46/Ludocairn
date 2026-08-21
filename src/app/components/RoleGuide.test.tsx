import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../../games/model'
import { RoleGuide } from './RoleGuide'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'veilquorum',
  name: 'Veilquorum',
  summary: 'Fixture',
  deck: 'standard-52',
  players: { min: 5, max: 12 },
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
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Rules\n',
  source: 'fixture/game.md',
}

describe('RoleGuide', () => {
  it('shows role identity, purpose, card marker, and every quantity band', () => {
    const { rerender } = render(<RoleGuide game={game} />)

    expect(
      screen.getByRole('heading', { name: 'Role guide' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
    expect(screen.getByText('Heart')).toBeInTheDocument()
    expect(
      screen.getByText('Privately tests one active player.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Role quantities by player count' }),
    ).toHaveTextContent('5–6')

    rerender(<RoleGuide game={game} playerCount={8} />)
    expect(screen.getByText('Quantities for 8 players')).toBeInTheDocument()
    expect(screen.getByText('5 Wayfinders')).toBeInTheDocument()
  })

  it('renders nothing when a game has no structured roles', () => {
    render(<RoleGuide game={{ ...game, roles: [], roleDistributions: [] }} />)

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Role guide' }),
    ).not.toBeInTheDocument()
  })
})
