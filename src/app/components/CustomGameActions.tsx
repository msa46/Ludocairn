import { useRef, useState } from 'react'

import { createGameDownload, createGameShareUrl } from '../../files/game-files'
import { reviewGameDeletion } from '../../games/manage'
import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'

interface CustomGameActionsProps {
  readonly record: Extract<GameRepositoryRecord, { ok: true }>
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly onEdit: () => void
  readonly onRemove: (id: string) => GameSaveResult
  readonly onRemoved: () => void
}

function causeMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

export function CustomGameActions({
  record,
  sessionRecords,
  onEdit,
  onRemove,
  onRemoved,
}: CustomGameActionsProps) {
  const [shareUrl, setShareUrl] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<string>()
  const shareInput = useRef<HTMLInputElement>(null)

  function exportGame() {
    setError(undefined)
    setStatus(undefined)
    let objectUrl: string | undefined
    try {
      const download = createGameDownload(record.game, record.source)
      objectUrl = URL.createObjectURL(download.blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = download.filename
      anchor.click()
    } catch (cause) {
      setError(causeMessage(cause, 'The game file could not be downloaded.'))
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  function createShareLink() {
    setError(undefined)
    setStatus(undefined)
    const shared = createGameShareUrl(record.source, window.location.href)
    if (!shared.ok) {
      setShareUrl(undefined)
      setError(shared.diagnostic.message)
      return
    }
    setShareUrl(shared.url)
  }

  async function copyShareLink() {
    if (!shareUrl) return
    setError(undefined)
    setStatus(undefined)
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable.')
      }
      await navigator.clipboard.writeText(shareUrl)
      setStatus('Share link copied.')
    } catch {
      shareInput.current?.select()
      setError('Select the share link and copy it manually.')
    }
  }

  function deleteGame() {
    setError(undefined)
    setStatus(undefined)
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
    <div className="custom-game-actions">
      <div className="form-actions">
        <button type="button" onClick={onEdit}>
          Edit {record.game.name}
        </button>
        <button type="button" onClick={exportGame}>
          Export {record.game.name}
        </button>
        <button type="button" onClick={createShareLink}>
          Share {record.game.name}
        </button>
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          Delete {record.game.name}
        </button>
      </div>

      {shareUrl && (
        <div>
          <label>
            Share link
            <input ref={shareInput} readOnly value={shareUrl} />
          </label>
          <button type="button" onClick={() => void copyShareLink()}>
            Copy link
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div
          role="group"
          aria-label={`Confirm deletion of ${record.game.name}`}
        >
          <p>
            Type <strong>{record.game.name}</strong> to confirm permanent
            deletion from this browser.
          </p>
          <label>
            Confirm game name
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={confirmation !== record.game.name}
            onClick={deleteGame}
          >
            Permanently delete {record.game.name}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(false)
              setConfirmation('')
              setError(undefined)
            }}
          >
            Keep {record.game.name}
          </button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </div>
  )
}
