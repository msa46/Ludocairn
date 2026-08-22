import { useState } from 'react'

import type { GameDefinition } from '../../games/model'
import type { Session } from '../../sessions/model'
import { AssignmentTable } from './AssignmentTable'

interface PlayerAssignmentViewProps {
  readonly game: GameDefinition
  readonly session: Session
  readonly onComplete: () => void
}

type PrivateRevealState = 'handoff' | 'revealed' | 'hidden'

export function PlayerAssignmentView({
  game,
  session,
  onComplete,
}: PlayerAssignmentViewProps) {
  const [playerIndex, setPlayerIndex] = useState(0)
  const [revealState, setRevealState] = useState<PrivateRevealState>('handoff')
  const visibility = game.assignments?.visibility.players

  if (visibility === 'all') {
    return (
      <section
        className="assignment-stage print-hidden"
        aria-labelledby="assignments-title"
      >
        <p className="eyebrow">Public assignments</p>
        <h1 id="assignments-title">Assignments for {session.name}</h1>
        <p>These assignments are visible to everyone at the table.</p>
        <AssignmentTable game={game} session={session} />
        <button className="primary-button" type="button" onClick={onComplete}>
          Open tracker
        </button>
      </section>
    )
  }

  if (visibility !== 'own') return null

  const player = session.players[playerIndex]
  if (!player) {
    return (
      <section className="assignment-stage print-hidden">
        <h1>No player is ready for a reveal</h1>
        <button className="primary-button" type="button" onClick={onComplete}>
          Open tracker
        </button>
      </section>
    )
  }
  const isLastPlayer = playerIndex === session.players.length - 1

  if (revealState === 'revealed') {
    const assignment = session.assignments?.find(
      (candidate) => candidate.playerId === player.id,
    )
    const role = game.roles.find(
      (candidate) => candidate.id === assignment?.roleId,
    )
    return (
      <section
        className="assignment-stage assignment-reveal print-hidden"
        aria-labelledby="private-role-title"
      >
        <p className="eyebrow">{player.name}, this is private</p>
        <h1 id="private-role-title">{role?.label ?? 'Unknown role'}</h1>
        {role?.team && <p className="assignment-team">{role.team}</p>}
        <p>{role?.summary}</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => setRevealState('hidden')}
        >
          Hide assignment
        </button>
      </section>
    )
  }

  if (revealState === 'hidden') {
    return (
      <section
        className="assignment-stage assignment-handoff print-hidden"
        aria-labelledby="assignment-hidden-title"
      >
        <p className="eyebrow">Assignment hidden</p>
        <h1 id="assignment-hidden-title">The screen is safe to pass</h1>
        <p>{player.name}’s private assignment is no longer on this page.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            if (isLastPlayer) {
              onComplete()
              return
            }
            setPlayerIndex((current) => current + 1)
            setRevealState('handoff')
          }}
        >
          {isLastPlayer
            ? 'Finish reveals'
            : `Ready for ${session.players[playerIndex + 1]?.name}`}
        </button>
      </section>
    )
  }

  return (
    <section
      className="assignment-stage assignment-handoff print-hidden"
      aria-labelledby="assignment-handoff-title"
    >
      <p className="eyebrow">
        Private reveal {playerIndex + 1} of {session.players.length}
      </p>
      <h1 id="assignment-handoff-title">Pass the device to {player.name}</h1>
      <p>Only {player.name} should look at the next screen.</p>
      <button
        className="primary-button"
        type="button"
        onClick={() => setRevealState('revealed')}
      >
        Reveal {player.name}’s assignment
      </button>
    </section>
  )
}
