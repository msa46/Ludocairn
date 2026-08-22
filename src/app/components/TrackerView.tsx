import { useState, type FormEvent } from 'react'

import { serializeSession } from '../../files/session-files'
import type { GameDefinition } from '../../games/model'
import type { Session, SessionFieldValue } from '../../sessions/model'
import { getPlayerCountWarning } from '../../sessions/operations'
import { PlayerFieldControl } from './PlayerFieldControl'
import { GameMasterAssignments } from './GameMasterAssignments'
import { RoleGuide } from './RoleGuide'

interface TrackerViewProps {
  readonly game: GameDefinition
  readonly session: Session
  readonly saveStatus: string
  readonly error?: string
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
  readonly onRenamePlayer: (id: string, name: string) => void
  readonly onRename: (name: string) => void
  readonly onDeleteSession: () => void
  readonly onDealAssignments: () => void
}

export function TrackerView({
  game,
  session,
  saveStatus,
  error,
  navigateHome,
  onPhase,
  onRound,
  onField,
  onNotes,
  onAddPlayer,
  onRemovePlayer,
  onRenamePlayer,
  onRename,
  onDeleteSession,
  onDealAssignments,
}: TrackerViewProps) {
  const [newPlayerName, setNewPlayerName] = useState('')
  const [confirmingRemoval, setConfirmingRemoval] = useState<string>()
  const [confirmingSessionDelete, setConfirmingSessionDelete] = useState(false)
  const [exportError, setExportError] = useState<string>()
  const warning = getPlayerCountWarning(session, game)
  const hasAssignments = session.assignments !== undefined

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onRename(String(data.get('session-name') ?? ''))
  }

  function exportSession() {
    setExportError(undefined)
    let url: string | undefined
    try {
      url = URL.createObjectURL(
        new Blob([serializeSession(session)], {
          type: 'application/json;charset=utf-8',
        }),
      )
      const filename =
        session.name
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'session'
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename + '.ludocairn-session.json'
      anchor.click()
    } catch (cause) {
      setExportError(
        typeof cause === 'object' &&
          cause !== null &&
          'message' in cause &&
          typeof cause.message === 'string' &&
          cause.message
          ? cause.message
          : 'The session file could not be downloaded.',
      )
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  }

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
        <p className="save-status" role="status" aria-live="polite">
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
      {(error || exportError) && <p role="alert">{error ?? exportError}</p>}
      <RoleGuide game={game} playerCount={session.players.length} />
      {!hasAssignments && game.assignments && (
        <section
          className="assignment-management print-hidden"
          aria-labelledby="digital-assignments-title"
        >
          <div>
            <p className="eyebrow">Optional upgrade for this saved table</p>
            <h2 id="digital-assignments-title">Deal digital roles</h2>
            <p>
              This older session has no digital deal. Dealing now replaces its
              recorded role fields and locks the player roster.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={onDealAssignments}
          >
            Deal digital roles
          </button>
        </section>
      )}
      {hasAssignments && (
        <GameMasterAssignments game={game} session={session} />
      )}

      <section
        className="session-management print-hidden"
        aria-labelledby="session-management-title"
      >
        <h2 id="session-management-title">Session management</h2>
        <form onSubmit={submitRename}>
          <label>
            Session name
            <input
              key={session.name}
              defaultValue={session.name}
              name="session-name"
              required
            />
          </label>
          <button type="submit">Rename session</button>
        </form>
        <div>
          <button type="button" onClick={exportSession}>
            Export session
          </button>
          <p className="privacy-note">
            Exports include facilitator notes
            {hasAssignments ? ' and private assignments' : ''}. Handle the
            downloaded file as private table material.
          </p>
        </div>
        <div className="destructive-controls">
          {confirmingSessionDelete ? (
            <div role="alert">
              <p>This permanently deletes {session.name} from this browser.</p>
              <button type="button" onClick={onDeleteSession}>
                Delete saved session
              </button>
              <button
                type="button"
                onClick={() => setConfirmingSessionDelete(false)}
              >
                Keep session
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSessionDelete(true)}
            >
              Review delete session
            </button>
          )}
        </div>
      </section>

      <section className="tracker-controls" aria-label="Round and phase">
        {game.phases.length > 0 && (
          <>
            <label className="editing-controls">
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
            <p className="print-only" aria-hidden="true">
              Phase:{' '}
              {game.phases.find((phase) => phase.id === session.currentPhase)
                ?.label ?? session.currentPhase}
            </p>
          </>
        )}
        {game.round.enabled && (
          <>
            <div className="round-control editing-controls">
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
            <p className="print-only" aria-hidden="true">
              Round: {session.round}
            </p>
          </>
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
              <form
                className="print-hidden"
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  onRenamePlayer(
                    player.id,
                    String(data.get('player-name') ?? ''),
                  )
                }}
              >
                <label>
                  {player.name} name
                  <input
                    key={player.name}
                    defaultValue={player.name}
                    name="player-name"
                    required
                  />
                </label>
                <button type="submit">Rename {player.name}</button>
              </form>
              <div className="field-grid">
                {game.fields
                  .filter((field) => !(hasAssignments && field.type === 'role'))
                  .map((field) => (
                    <PlayerFieldControl
                      field={field}
                      key={field.id}
                      playerName={player.name}
                      roles={game.roles}
                      value={player.fields[field.id]!}
                      onChange={(value) => onField(player.id, field.id, value)}
                    />
                  ))}
              </div>
              {!hasAssignments && (
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
              )}
            </article>
          ))}
        </div>
      </section>

      {hasAssignments ? (
        <section
          className="locked-roster print-hidden"
          aria-label="Locked roster"
        >
          <h2>Player roster locked</h2>
          <p>
            The roster is locked because roles have been dealt. Player names can
            still be corrected without changing assignments.
          </p>
        </section>
      ) : (
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
      )}

      <section className="notes-section">
        <h2>Facilitator notes</h2>
        <label className="editing-controls">
          Session notes
          <textarea
            rows={5}
            value={session.notes}
            onChange={(event) => onNotes(event.target.value)}
          />
        </label>
        <p className="print-only" aria-hidden="true">
          Facilitator notes: {session.notes || 'None'}
        </p>
        <p className="privacy-note">
          These notes remain in this browser unless you later export them.
        </p>
      </section>
    </div>
  )
}
