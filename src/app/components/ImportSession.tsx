import { useRef, useState, type ChangeEvent } from 'react'

import {
  parseSessionFile,
  prepareImportedSession,
  type GameResolver,
  type ImportResult,
} from '../../files/session-files'
import type { IdProvider } from '../../sessions/model'
import type { SessionRepository } from '../../storage/repository'

interface ImportSessionProps {
  readonly resolveGame: GameResolver
  readonly repository: SessionRepository
  readonly ids: IdProvider
  readonly onImported: (id: string) => void
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

export function ImportSession({
  resolveGame,
  repository,
  ids,
  onImported,
}: ImportSessionProps) {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult>()
  const [error, setError] = useState<string>()

  function reset() {
    setResult(undefined)
    setError(undefined)
    if (input.current) input.current.value = ''
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    setResult(undefined)
    setError(undefined)
    if (!files || files.length !== 1) {
      setError('Choose one .json session file.')
      return
    }

    const file = files[0]!
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Choose a .json session file.')
      return
    }

    try {
      const parsed = parseSessionFile(await readFile(file), resolveGame)
      setResult(parsed)
      if (!parsed.ok) setError(parsed.diagnostic.message)
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'The selected file could not be read.',
      )
    }
  }

  function confirmImport() {
    if (!result?.ok) return
    const records = repository.list()
    const readFailure = records.find(
      (record) =>
        !record.ok && record.diagnostic.code === 'storage.read-failed',
    )
    if (readFailure && !readFailure.ok) {
      setError(
        'The session was not imported — ' + readFailure.diagnostic.message,
      )
      return
    }
    const existingIds = new Set(records.map((record) => record.id))
    const session = prepareImportedSession(result.session, existingIds, ids)
    const saved = repository.save(session)
    if (!saved.ok) {
      setError('The session was not imported — ' + saved.diagnostic.message)
      return
    }
    reset()
    onImported(session.id)
  }

  return (
    <section className="import-card" aria-labelledby="import-title">
      <h2 id="import-title">Import a session</h2>
      <p>Select a Ludocairn JSON session file to review before saving it.</p>
      <label>
        Session JSON file
        <input
          ref={input}
          accept=".json"
          type="file"
          onChange={(event) => void selectFile(event)}
        />
      </label>

      {error && <p role="alert">{error}</p>}

      {result?.ok && (
        <section aria-labelledby="import-preview-title">
          <h3 id="import-preview-title">Review import</h3>
          <dl className="import-preview">
            <div>
              <dt>Session</dt>
              <dd>{result.preview.sessionName}</dd>
            </div>
            <div>
              <dt>Game</dt>
              <dd>{result.preview.gameName}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>
                {result.preview.playerCount}{' '}
                {result.preview.playerCount === 1 ? 'player' : 'players'}
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                <time dateTime={result.preview.updatedAt}>
                  {result.preview.updatedAt}
                </time>
              </dd>
            </div>
          </dl>
          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              onClick={confirmImport}
            >
              Import session
            </button>
            <button type="button" onClick={reset}>
              Cancel import
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
