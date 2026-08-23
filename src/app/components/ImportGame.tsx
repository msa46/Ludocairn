import { useRef, useState, type ChangeEvent } from 'react'

import { reviewGameSave } from '../../games/manage'
import {
  parseGameFile,
  parseGameShareHash,
  type GameFileResult,
} from '../../files/game-files'
import type {
  GameRepository,
  GameRepositoryRecord,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'

interface ImportGameProps {
  readonly sharedHash?: string
  readonly bundledIds: ReadonlySet<string>
  readonly customRecords: readonly GameRepositoryRecord[]
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly repository: GameRepository
  readonly onSaved: (id: string) => void
  readonly onRepair: (source: string) => void
}

type ImportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'paste' }
  | {
      readonly kind: 'review-valid'
      readonly source: string
      readonly result: Extract<GameFileResult, { readonly ok: true }>
      readonly shared: boolean
    }
  | {
      readonly kind: 'review-invalid'
      readonly source?: string
      readonly message: string
      readonly shared: boolean
    }

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('File could not be read.')),
    )
    reader.readAsText(file)
  })
}

function reviewResult(source: string, shared: boolean): ImportState {
  const result = parseGameFile(source)
  return result.ok
    ? { kind: 'review-valid', source, result, shared }
    : {
        kind: 'review-invalid',
        source,
        message: result.diagnostic.message,
        shared,
      }
}

function initialState(sharedHash?: string): ImportState {
  if (!sharedHash) return { kind: 'idle' }
  const result = parseGameShareHash(sharedHash)
  return result.ok
    ? {
        kind: 'review-valid',
        source: result.source,
        result,
        shared: true,
      }
    : {
        kind: 'review-invalid',
        message: result.diagnostic.message,
        shared: true,
      }
}

export function ImportGame({
  sharedHash,
  bundledIds,
  customRecords,
  sessionRecords,
  repository,
  onSaved,
  onRepair,
}: ImportGameProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ImportState>(() =>
    initialState(sharedHash),
  )
  const [source, setSource] = useState('')
  const [error, setError] = useState<string>()

  function reset() {
    setState({ kind: 'idle' })
    setSource('')
    setError(undefined)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    setError(undefined)
    if (!files || files.length !== 1) {
      setState({
        kind: 'review-invalid',
        message: 'Choose one Markdown game file.',
        shared: false,
      })
      return
    }
    const file = files[0]
    if (!file || !file.name.toLowerCase().endsWith('.md')) {
      setState({
        kind: 'review-invalid',
        message: 'Choose a Markdown game file.',
        shared: false,
      })
      return
    }

    try {
      setState(reviewResult(await readFile(file), false))
    } catch (cause) {
      setState({
        kind: 'review-invalid',
        message:
          cause instanceof Error && cause.message
            ? cause.message
            : 'The selected file could not be read.',
        shared: false,
      })
    }
  }

  function confirmPaste() {
    setError(undefined)
    setState(reviewResult(source, false))
  }

  function save() {
    if (state.kind !== 'review-valid') return
    const originalId = customRecords.some(
      (record) => record.id === state.result.game.id,
    )
      ? state.result.game.id
      : undefined
    const reviewed = reviewGameSave(state.source, {
      originalId,
      bundledIds,
      customRecords,
      sessionRecords,
    })
    if (!reviewed.ok) {
      setError(reviewed.diagnostic.message)
      return
    }

    const saved = repository.save(reviewed.source)
    if (!saved.ok) {
      setError(saved.diagnostic.message)
      return
    }
    onSaved(reviewed.game.id)
  }

  const reviewing =
    state.kind === 'review-valid' || state.kind === 'review-invalid'
  const reviewName =
    reviewing && state.shared ? 'Review shared game' : 'Review game import'

  return (
    <section className="import-card" aria-labelledby="import-game-title">
      <h2 id="import-game-title">Import a custom game</h2>
      <label>
        Game Markdown file
        <input
          ref={fileInput}
          accept=".md,.ludocairn-game.md,text/markdown"
          type="file"
          onChange={(event) => void selectFile(event)}
        />
      </label>
      {state.kind === 'idle' && (
        <div className="form-actions">
          <button type="button" onClick={() => setState({ kind: 'paste' })}>
            Paste game source
          </button>
        </div>
      )}

      {state.kind === 'paste' && (
        <div>
          <label>
            Complete game source
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              onClick={confirmPaste}
            >
              Review game
            </button>
            <button type="button" onClick={reset}>
              Cancel import
            </button>
          </div>
        </div>
      )}

      {state.kind === 'review-valid' && (
        <section aria-label={reviewName}>
          <h3>{state.shared ? 'Review shared game' : 'Review game import'}</h3>
          <dl className="import-preview">
            <div>
              <dt>Name</dt>
              <dd>{state.result.preview.name}</dd>
            </div>
            <div>
              <dt>Summary</dt>
              <dd>{state.result.preview.summary}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>
                {state.result.preview.players.min}
                {state.result.preview.players.max
                  ? `–${state.result.preview.players.max}`
                  : '+'}
              </dd>
            </div>
            <div>
              <dt>Deck</dt>
              <dd>
                {state.result.preview.deck === 'standard-52'
                  ? '52-card'
                  : 'Tarot'}
              </dd>
            </div>
          </dl>
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={save}>
              Save custom game
            </button>
            <button type="button" onClick={reset}>
              Cancel import
            </button>
          </div>
        </section>
      )}

      {state.kind === 'review-invalid' && (
        <section aria-label={reviewName}>
          <h3>{state.shared ? 'Review shared game' : 'Review game import'}</h3>
          <p role="alert">{state.message}</p>
          <div className="form-actions">
            {state.source !== undefined && (
              <button type="button" onClick={() => onRepair(state.source!)}>
                Repair in Game Studio
              </button>
            )}
            <button type="button" onClick={reset}>
              Cancel import
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
