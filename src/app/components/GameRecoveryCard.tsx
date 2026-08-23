import { useState } from 'react'

import { reviewGameDeletion } from '../../games/manage'
import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'

interface GameRecoveryCardProps {
  readonly record: GameRepositoryRecord
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly onRemove: (id: string) => GameSaveResult
  readonly onRemoved: () => void
}

function recoverableSource(record: GameRepositoryRecord): string | undefined {
  return record.ok ? record.source : record.raw
}

export function GameRecoveryCard({
  record,
  sessionRecords,
  onRemove,
  onRemoved,
}: GameRecoveryCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()
  const source = recoverableSource(record)
  const diagnostic = record.ok
    ? `Custom game ID conflicts with bundled game "${record.id}".`
    : record.diagnostic.message
  const readFailureSentinel =
    !record.ok && record.diagnostic.code === 'game-storage.read-failed'
  const storageIdLabel = record.id === '' ? 'empty storage ID' : record.id

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
    const review = reviewGameDeletion(record.id, sessionRecords)
    if (!review.ok) {
      if (review.diagnostic.code === 'game-delete.sessions-use-game') {
        const names = review.diagnostic.sessionIds.map((id) => {
          const blocking = sessionRecords.find(
            (candidate) => candidate.id === id,
          )
          return blocking?.ok ? blocking.session.name : id
        })
        setError(
          `${review.diagnostic.message} Export or delete these sessions first: ${names.join(', ')}.`,
        )
      } else {
        setError(review.diagnostic.message)
      }
      return
    }

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
      {readFailureSentinel ? (
        <p>
          No stored game can be targeted for deletion because browser storage
          could not be read.
        </p>
      ) : confirming ? (
        <div
          role="group"
          aria-label={`Confirm deletion of stored game ${storageIdLabel}`}
        >
          <p>
            This permanently deletes the stored custom game record from this
            browser. Storage ID:{' '}
            <strong>{record.id === '' ? '"" (empty)' : record.id}</strong>.
          </p>
          <button type="button" onClick={remove}>
            Delete stored game {storageIdLabel}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Keep stored game {storageIdLabel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Review delete {storageIdLabel}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  )
}
