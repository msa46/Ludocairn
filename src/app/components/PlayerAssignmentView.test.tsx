import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { GameDefinition } from '../../games/model'
import type { Session } from '../../sessions/model'
import { PlayerAssignmentView } from './PlayerAssignmentView'

const baseGame: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Tests assignment reveals.',
  deck: 'standard-52',
  players: { min: 2, max: 2 },
  roles: [
    {
      id: 'echo',
      label: 'Echo',
      team: 'Quorum',
      summary: 'Privately tests one player.',
    },
    {
      id: 'drifter',
      label: 'Drifter',
      team: 'Drifters',
      summary: 'Quietly opposes the group.',
    },
  ],
  roleDistributions: [
    {
      players: { min: 2, max: 2 },
      counts: { echo: 1, drifter: 1 },
    },
  ],
  assignments: {
    method: 'shuffle',
    visibility: { players: 'own', gameMaster: 'all' },
  },
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Test Game\n',
  source: 'test/game.md',
}

const session: Session = {
  storageVersion: 1,
  id: 'session-1',
  name: 'Friday table',
  gameId: baseGame.id,
  gameSchemaVersion: 1,
  players: [
    { id: 'player-1', name: 'Alice', fields: {} },
    { id: 'player-2', name: 'Bob', fields: {} },
  ],
  assignments: [
    { playerId: 'player-1', roleId: 'echo' },
    { playerId: 'player-2', roleId: 'drifter' },
  ],
  notes: '',
  createdAt: '2026-08-22T12:00:00.000Z',
  updatedAt: '2026-08-22T12:00:00.000Z',
}

describe('PlayerAssignmentView', () => {
  it('mounts only the current private role between reveal and hide actions', () => {
    const onComplete = vi.fn()
    render(
      <PlayerAssignmentView
        game={baseGame}
        session={session}
        onComplete={onComplete}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Pass the device to Alice' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Echo')).not.toBeInTheDocument()
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Reveal Alice’s assignment' }),
    )
    expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
    expect(screen.getByText('Quorum')).toBeInTheDocument()
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide assignment' }))
    expect(screen.queryByText('Echo')).not.toBeInTheDocument()
    expect(screen.queryByText('Quorum')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ready for Bob' }))
    expect(
      screen.getByRole('heading', { name: 'Pass the device to Bob' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Echo')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Reveal Bob’s assignment' }),
    )
    expect(screen.getByRole('heading', { name: 'Drifter' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide assignment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish reveals' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('shows all assignments together when player visibility is public', () => {
    const game: GameDefinition = {
      ...baseGame,
      assignments: {
        method: 'shuffle',
        visibility: { players: 'all', gameMaster: 'none' },
      },
    }
    const onComplete = vi.fn()
    render(
      <PlayerAssignmentView
        game={game}
        session={session}
        onComplete={onComplete}
      />,
    )

    const table = screen.getByRole('table', { name: 'Player assignments' })
    expect(within(table).getByText('Alice')).toBeInTheDocument()
    expect(within(table).getByText('Echo')).toBeInTheDocument()
    expect(within(table).getByText('Bob')).toBeInTheDocument()
    expect(within(table).getByText('Drifter')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open tracker' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
