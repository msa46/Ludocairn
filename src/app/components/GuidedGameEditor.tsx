import { useState } from 'react'

import type { GameDefinition, PhaseDefinition } from '../../games/model'
import { serializeGameSource } from '../../games/source'

interface GuidedGameEditorProps {
  readonly game: GameDefinition
  readonly idLocked: boolean
  readonly onChange: (source: string) => void
}

interface NumericDrafts {
  readonly minimumPlayers: string
  readonly maximumPlayers: string
  readonly initialRound: string
}

function numericDraftsFor(game: GameDefinition): NumericDrafts {
  return {
    minimumPlayers: String(game.players.min),
    maximumPlayers:
      game.players.max === undefined ? '' : String(game.players.max),
    initialRound: game.round.enabled ? String(game.round.initial) : '1',
  }
}

function positiveInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

function nextPhase(phases: readonly PhaseDefinition[]): PhaseDefinition {
  let number = phases.length + 1
  while (phases.some((phase) => phase.id === `phase-${number}`)) number += 1
  return { id: `phase-${number}`, label: `Phase ${number}` }
}

export function GuidedGameEditor({
  game,
  idLocked,
  onChange,
}: GuidedGameEditorProps) {
  const [drafts, setDrafts] = useState(() => numericDraftsFor(game))
  const [numericError, setNumericError] = useState<string>()

  function emit(next: GameDefinition) {
    onChange(serializeGameSource(next))
  }

  function replacePhase(index: number, next: PhaseDefinition) {
    const previous = game.phases[index]
    emit({
      ...game,
      phases: game.phases.map((phase, phaseIndex) =>
        phaseIndex === index ? next : phase,
      ),
      ...(previous && game.initialPhase === previous.id
        ? { initialPhase: next.id }
        : {}),
    })
  }

  function changeMinimumPlayers(value: string) {
    setDrafts((current) => ({ ...current, minimumPlayers: value }))
    const minimumPlayers = positiveInteger(value)
    if (minimumPlayers === undefined) {
      setNumericError('Enter a positive whole number.')
      return
    }
    if (game.players.max !== undefined && game.players.max < minimumPlayers) {
      setNumericError('Minimum players cannot exceed maximum players.')
      return
    }
    setNumericError(undefined)
    emit({ ...game, players: { ...game.players, min: minimumPlayers } })
  }

  function changeMaximumPlayers(value: string) {
    setDrafts((current) => ({ ...current, maximumPlayers: value }))
    if (value === '') {
      setNumericError(undefined)
      emit({ ...game, players: { min: game.players.min } })
      return
    }
    const maximumPlayers = positiveInteger(value)
    if (maximumPlayers === undefined) {
      setNumericError('Enter a positive whole number.')
      return
    }
    if (maximumPlayers < game.players.min) {
      setNumericError('Maximum players cannot be lower than minimum players.')
      return
    }
    setNumericError(undefined)
    emit({
      ...game,
      players: { ...game.players, max: maximumPlayers },
    })
  }

  function changeInitialRound(value: string) {
    setDrafts((current) => ({ ...current, initialRound: value }))
    const initialRound = positiveInteger(value)
    if (initialRound === undefined) {
      setNumericError('Enter a positive whole number.')
      return
    }
    setNumericError(undefined)
    emit({ ...game, round: { enabled: true, initial: initialRound } })
  }

  function addPhase() {
    const phase = nextPhase(game.phases)
    emit({
      ...game,
      phases: [...game.phases, phase],
      initialPhase: game.initialPhase ?? phase.id,
    })
  }

  function movePhase(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= game.phases.length) return
    const phases = [...game.phases]
    const [phase] = phases.splice(index, 1)
    if (!phase) return
    phases.splice(destination, 0, phase)
    emit({ ...game, phases })
  }

  function removePhase(index: number) {
    const phases = game.phases.filter((_, phaseIndex) => phaseIndex !== index)
    emit({
      ...game,
      phases,
      ...(phases.length === 0
        ? { initialPhase: undefined }
        : { initialPhase: phases[0]?.id }),
    })
  }

  return (
    <section aria-label="Guided game editor" className="guided-editor">
      <fieldset>
        <legend>Identity</legend>
        <label>
          Game ID
          <input
            disabled={idLocked}
            type="text"
            value={game.id}
            onChange={(event) => emit({ ...game, id: event.target.value })}
          />
        </label>
        <label>
          Game name
          <input
            type="text"
            value={game.name}
            onChange={(event) => emit({ ...game, name: event.target.value })}
          />
        </label>
        <label>
          Summary
          <textarea
            rows={3}
            value={game.summary}
            onChange={(event) => emit({ ...game, summary: event.target.value })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Players and deck</legend>
        <label>
          Deck
          <select
            value={game.deck}
            onChange={(event) =>
              emit({
                ...game,
                deck: event.target.value as GameDefinition['deck'],
              })
            }
          >
            <option value="standard-52">Standard 52-card deck</option>
            <option value="tarot">Tarot deck</option>
          </select>
        </label>
        <label>
          Minimum players
          <input
            inputMode="numeric"
            type="text"
            value={drafts.minimumPlayers}
            onChange={(event) => changeMinimumPlayers(event.target.value)}
          />
        </label>
        <label>
          Maximum players
          <input
            inputMode="numeric"
            type="text"
            value={drafts.maximumPlayers}
            onChange={(event) => changeMaximumPlayers(event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Session flow</legend>
        <div className="form-actions">
          <button type="button" onClick={addPhase}>
            Add phase
          </button>
        </div>
        {game.phases.map((phase, index) => (
          <div key={phase.id}>
            <label>
              Phase {index + 1} ID
              <input
                type="text"
                value={phase.id}
                onChange={(event) =>
                  replacePhase(index, { ...phase, id: event.target.value })
                }
              />
            </label>
            <label>
              Phase {index + 1} label
              <input
                type="text"
                value={phase.label}
                onChange={(event) =>
                  replacePhase(index, { ...phase, label: event.target.value })
                }
              />
            </label>
            <div className="form-actions">
              <button
                aria-label={`Move ${phase.label} up`}
                disabled={index === 0}
                type="button"
                onClick={() => movePhase(index, -1)}
              >
                Move up
              </button>
              <button
                aria-label={`Move ${phase.label} down`}
                disabled={index === game.phases.length - 1}
                type="button"
                onClick={() => movePhase(index, 1)}
              >
                Move down
              </button>
              <button
                aria-label={`Remove ${phase.label}`}
                type="button"
                onClick={() => removePhase(index)}
              >
                Remove phase
              </button>
            </div>
          </div>
        ))}
        {game.phases.length > 0 && (
          <label>
            Initial phase
            <select
              value={game.initialPhase ?? game.phases[0]?.id}
              onChange={(event) =>
                emit({ ...game, initialPhase: event.target.value })
              }
            >
              {game.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox-field">
          <input
            aria-label="Track rounds"
            checked={game.round.enabled}
            type="checkbox"
            onChange={(event) =>
              emit(
                event.target.checked
                  ? {
                      ...game,
                      round: {
                        enabled: true,
                        initial: game.round.enabled ? game.round.initial : 1,
                      },
                    }
                  : { ...game, round: { enabled: false } },
              )
            }
          />
          <span>Track rounds</span>
        </label>
        {game.round.enabled && (
          <label>
            Initial round
            <input
              inputMode="numeric"
              type="text"
              value={drafts.initialRound}
              onChange={(event) => changeInitialRound(event.target.value)}
            />
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Rules</legend>
        <label>
          Rules Markdown
          <textarea
            rows={16}
            spellCheck={false}
            value={game.rulesMarkdown}
            onChange={(event) =>
              emit({ ...game, rulesMarkdown: event.target.value })
            }
          />
        </label>
      </fieldset>

      {numericError && <p role="alert">{numericError}</p>}
    </section>
  )
}
