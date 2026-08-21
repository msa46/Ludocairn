import { useState } from 'react'

import type { RepositoryRecord } from '../../storage/repository'

interface RecoveryCardProps {
  readonly record: Extract<RepositoryRecord, { ok: false }>
  readonly onDelete: () => void
}

export function RecoveryCard({ record, onDelete }: RecoveryCardProps) {
  const [confirming, setConfirming] = useState(false)

  function download() {
    if (!record.raw) return
    const url = URL.createObjectURL(
      new Blob([record.raw], { type: 'application/json;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = (record.id || 'unreadable') + '.ludocairn-recovery.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <article className="recovery-card">
      <h3>{record.id || 'Browser storage'}</h3>
      <p>{record.diagnostic.message}</p>
      {record.raw && (
        <button type="button" onClick={download}>
          Download raw record
        </button>
      )}
      {record.id &&
        (confirming ? (
          <div role="alert">
            <p>This permanently removes the unreadable browser record.</p>
            <button type="button" onClick={onDelete}>
              Delete unreadable record
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Review delete
          </button>
        ))}
    </article>
  )
}
