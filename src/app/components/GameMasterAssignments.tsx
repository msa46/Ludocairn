import { useState } from 'react'

import type { GameDefinition } from '../../games/model'
import type { Session } from '../../sessions/model'
import { AssignmentTable } from './AssignmentTable'

interface GameMasterAssignmentsProps {
  readonly game: GameDefinition
  readonly session: Session
}

type GateState = 'closed' | 'warning' | 'open'

export function GameMasterAssignments({
  game,
  session,
}: GameMasterAssignmentsProps) {
  const [gateState, setGateState] = useState<GateState>('closed')

  if (
    !session.assignments ||
    game.assignments?.visibility.gameMaster !== 'all'
  ) {
    return null
  }

  if (gateState === 'closed') {
    return (
      <section className="game-master-assignments print-hidden">
        <div>
          <p className="eyebrow">Facilitator only</p>
          <h2>Game Master view</h2>
          <p>
            Review every assignment without adding the Game Master as a player.
          </p>
        </div>
        <button type="button" onClick={() => setGateState('warning')}>
          Game Master assignments
        </button>
      </section>
    )
  }

  if (gateState === 'warning') {
    return (
      <section
        className="game-master-assignments assignment-warning print-hidden"
        aria-labelledby="assignment-warning-title"
      >
        <div>
          <p className="eyebrow">Spoiler check</p>
          <h2 id="assignment-warning-title">Private assignment warning</h2>
          <p>
            The next screen shows every player’s role. Make sure no player can
            see the device.
          </p>
        </div>
        <div className="form-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => setGateState('open')}
          >
            Show all assignments
          </button>
          <button type="button" onClick={() => setGateState('closed')}>
            Keep assignments hidden
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="game-master-assignments assignment-overview print-hidden"
      aria-labelledby="game-master-assignments-title"
    >
      <div>
        <p className="eyebrow">Game Master only</p>
        <h2 id="game-master-assignments-title">All assignments</h2>
      </div>
      <AssignmentTable game={game} session={session} />
      <button
        className="primary-button"
        type="button"
        onClick={() => setGateState('closed')}
      >
        Close assignments
      </button>
    </section>
  )
}
