import { useState, type FormEvent } from 'react'

import type { GameDefinition } from '../../games/model'
import { RoleGuide } from './RoleGuide'

interface SessionSetupProps {
  readonly game: GameDefinition
  readonly onCancel: () => void
  readonly onCreate: (name: string, playerNames: readonly string[]) => void
  readonly error?: string
}

export function SessionSetup({
  game,
  onCancel,
  onCreate,
  error,
}: SessionSetupProps) {
  const [name, setName] = useState('')
  const [playerNames, setPlayerNames] = useState(['', ''])

  function submit(event: FormEvent) {
    event.preventDefault()
    onCreate(
      name,
      playerNames.filter((playerName) => playerName.trim()),
    )
  }

  return (
    <section className="setup-card" aria-labelledby="setup-title">
      <p className="eyebrow">New {game.name} table</p>
      <h1 id="setup-title">Set up the session</h1>
      {game.assignments ? (
        <p>
          {game.name} deals roles digitally for {game.players.min}
          {game.players.max && game.players.max !== game.players.min
            ? '–' + game.players.max
            : ''}{' '}
          named players. The unnamed Game Master stays outside the roster and
          receives no role.
        </p>
      ) : (
        <p>
          {game.name} recommends {game.players.min}
          {game.players.max ? '–' + game.players.max : '+'} players. You can
          still create a smaller practice table.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <RoleGuide game={game} />
      <form onSubmit={submit}>
        <label>
          Session name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Players</legend>
          {playerNames.map((playerName, index) => (
            <div className="setup-player" key={index}>
              <label>
                Player {index + 1} name
                <input
                  value={playerName}
                  onChange={(event) =>
                    setPlayerNames((current) =>
                      current.map((value, playerIndex) =>
                        playerIndex === index ? event.target.value : value,
                      ),
                    )
                  }
                />
              </label>
              {playerNames.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPlayerNames((current) =>
                      current.filter((_, playerIndex) => playerIndex !== index),
                    )
                  }
                >
                  Remove player {index + 1}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPlayerNames((current) => [...current, ''])}
          >
            Add another player
          </button>
        </fieldset>
        <div className="form-actions">
          <button className="primary-button" type="submit">
            Create session
          </button>
          <button type="button" onClick={onCancel}>
            Back to rules
          </button>
        </div>
      </form>
    </section>
  )
}
