import { useState } from 'react'

import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'

interface GameRecoveryCardProps {
  readonly record: GameRepositoryRecord
  readonly onRemove: (id: string) => GameSaveResult
  readonly onRemoved: () => void
}

function recoverableSource(record: GameRepositoryRecord): string | undefined {
  return record.ok ? record.source : record.raw
}

export function GameRecoveryCard({
  record,
  onRemove,
  onRemoved,
}: GameRecoveryCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()
  const source = recoverableSource(record)
  const diagnostic = record.ok
    ? `Custom game ID conflicts with bundled game "${record.id}".`
    : record.diagnostic.message
  const readFailed =
    !record.ok && record.diagnostic.code === 'game-storage.read-failed'

  function download() {
    if (source === undefined) return
    setError(undefined)
    let objectUrl: string | undefined
    try {
      objectUrl = URL.createObjectURL(
        new Blob([source], { type: 'text/markdown;charset=utf-8' }),
      )
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${record.id || 'unreadable'}.ludocairn-game-recovery.md`
      anchor.click()
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'The raw game source could not be downloaded.',
      )
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  function remove() {
    setError(undefined)
    const removed = onRemove(record.id)
    if (!removed.ok) {
      setError(removed.diagnostic.message)
      return
    }
    onRemoved()
  }

  return (
    <article className="recovery-card">
      <h3>{record.id || 'Browser storage'}</h3>
      <p>{diagnostic}</p>
      {source !== undefined && (
        <button type="button" onClick={download}>
          Download raw source
        </button>
      )}
      {readFailed ? (
        <p>
          No stored game can be targeted for deletion because browser storage
          could not be read.
        </p>
      ) : (
        record.id &&
        (confirming ? (
          <div role="alert">
            <p>
              This permanently deletes the stored custom game record with ID{' '}
              <strong>{record.id}</strong> from this browser.
            </p>
            <button type="button" onClick={remove}>
              Delete stored game {record.id}
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Keep stored game {record.id}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Review delete {record.id}
          </button>
        ))
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  )
}
