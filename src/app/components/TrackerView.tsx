import { useState } from 'react'

import type { GameDefinition } from '../../games/model'
import type { Session, SessionFieldValue } from '../../sessions/model'
import { getPlayerCountWarning } from '../../sessions/operations'
import { PlayerFieldControl } from './PlayerFieldControl'

interface TrackerViewProps {
  readonly game: GameDefinition
  readonly session: Session
  readonly saveStatus: string
  readonly navigateHome: () => void
  readonly onPhase: (phase: string) => void
  readonly onRound: (round: number) => void
  readonly onField: (
    playerId: string,
    fieldId: string,
    value: SessionFieldValue,
  ) => void
  readonly onNotes: (notes: string) => void
  readonly onAddPlayer: (name: string) => void
  readonly onRemovePlayer: (id: string) => void
}

export function TrackerView({
  game,
  session,
  saveStatus,
  navigateHome,
  onPhase,
  onRound,
  onField,
  onNotes,
  onAddPlayer,
  onRemovePlayer,
}: TrackerViewProps) {
  const [newPlayerName, setNewPlayerName] = useState('')
  const [confirmingRemoval, setConfirmingRemoval] = useState<string>()
  const warning = getPlayerCountWarning(session, game)

  return (
    <div className="page-stack tracker-print">
      <nav aria-label="Session" className="tracker-nav print-hidden">
        <a
          href="?"
          onClick={(event) => {
            event.preventDefault()
            navigateHome()
          }}
        >
          All games
        </a>
        <p role="status" aria-live="polite">
          {saveStatus}
        </p>
      </nav>
      <header className="tracker-heading">
        <div>
          <p className="eyebrow">{game.name} facilitator tracker</p>
          <h1>{session.name}</h1>
        </div>
        <button
          className="print-hidden"
          type="button"
          onClick={() => window.print()}
        >
          Print tracker
        </button>
      </header>

      {warning && <p className="guidance">{warning}</p>}

      <section className="tracker-controls" aria-label="Round and phase">
        {game.phases.length > 0 && (
          <label>
            Phase
            <select
              aria-label="Phase"
              value={session.currentPhase}
              onChange={(event) => onPhase(event.target.value)}
            >
              {game.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {game.round.enabled && (
          <div className="round-control">
            <span>Round</span>
            <button
              aria-label="Decrease round"
              type="button"
              disabled={(session.round ?? 1) <= 1}
              onClick={() => onRound((session.round ?? 1) - 1)}
            >
              −
            </button>
            <input
              aria-label="Round"
              min={1}
              type="number"
              value={session.round}
              onChange={(event) => onRound(event.target.valueAsNumber)}
            />
            <button
              aria-label="Increase round"
              type="button"
              onClick={() => onRound((session.round ?? 0) + 1)}
            >
              +
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="players-title">
        <div className="section-heading">
          <h2 id="players-title">Players</h2>
          <span>{session.players.length} at this table</span>
        </div>
        <div className="player-grid">
          {session.players.map((player, index) => (
            <article className="player-card" key={player.id}>
              <header>
                <p>{String(index + 1).padStart(2, '0')}</p>
                <h3>{player.name}</h3>
              </header>
              <div className="field-grid">
                {game.fields.map((field) => (
                  <PlayerFieldControl
                    field={field}
                    key={field.id}
                    playerName={player.name}
                    value={player.fields[field.id]!}
                    onChange={(value) => onField(player.id, field.id, value)}
                  />
                ))}
              </div>
              <div className="remove-region print-hidden">
                {confirmingRemoval === player.id ? (
                  <div role="alert">
                    <p>Remove {player.name} from this session?</p>
                    <button
                      type="button"
                      onClick={() => onRemovePlayer(player.id)}
                    >
                      Confirm remove {player.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingRemoval(undefined)}
                    >
                      Keep {player.name}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoval(player.id)}
                  >
                    Remove {player.name}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="add-player print-hidden"
        aria-labelledby="add-player-title"
      >
        <h2 id="add-player-title">Add a player</h2>
        <label>
          New player name
          <input
            value={newPlayerName}
            onChange={(event) => setNewPlayerName(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            onAddPlayer(newPlayerName)
            setNewPlayerName('')
          }}
        >
          Add player
        </button>
      </section>

      <section className="notes-section">
        <h2>Facilitator notes</h2>
        <label>
          Session notes
          <textarea
            rows={5}
            value={session.notes}
            onChange={(event) => onNotes(event.target.value)}
          />
        </label>
        <p className="privacy-note">
          These notes remain in this browser unless you later export them.
        </p>
      </section>
    </div>
  )
}
