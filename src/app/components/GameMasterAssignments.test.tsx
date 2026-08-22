import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../../games/model'
import type { Session } from '../../sessions/model'
import { GameMasterAssignments } from './GameMasterAssignments'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'test-game',
  name: 'Test Game',
  summary: 'Tests the Game Master gate.',
  deck: 'standard-52',
  players: { min: 2, max: 2 },
  roles: [
    { id: 'echo', label: 'Echo', summary: 'Tests one player.' },
    { id: 'drifter', label: 'Drifter', summary: 'Opposes the group.' },
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
  gameId: game.id,
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

describe('GameMasterAssignments', () => {
  it('mounts assignments only after confirmation and gates every reopening', () => {
    render(<GameMasterAssignments game={game} session={session} />)

    expect(
      screen.getByRole('button', { name: 'Game Master assignments' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Game Master assignments' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Private assignment warning' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Show all assignments' }),
    )
    expect(screen.getByText('Drifter')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close assignments' }))
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Game Master assignments' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Private assignment warning' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Drifter')).not.toBeInTheDocument()
  })

  it('renders no entry point when the game master visibility is none', () => {
    const hiddenGame: GameDefinition = {
      ...game,
      assignments: {
        method: 'shuffle',
        visibility: { players: 'own', gameMaster: 'none' },
      },
    }

    const { container } = render(
      <GameMasterAssignments game={hiddenGame} session={session} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
