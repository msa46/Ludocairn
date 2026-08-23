import type { ReactNode } from 'react'

import type { GameDefinition } from '../../games/model'
import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'
import { CustomGameActions } from './CustomGameActions'
import { RecoveryCard } from './RecoveryCard'

interface CatalogViewProps {
  readonly games: readonly GameDefinition[]
  readonly customGameIds: ReadonlySet<string>
  readonly customGameRecords: readonly GameRepositoryRecord[]
  readonly gameRecovery: ReactNode
  readonly records: readonly RepositoryRecord[]
  readonly navigate: (search: string) => void
  readonly removeGame: (id: string) => GameSaveResult
  readonly refreshGames: () => void
  readonly removeRecord: (id: string) => void
  readonly importSession: ReactNode
  readonly importGame: ReactNode
  readonly repairSource?: string
}

export function CatalogView({
  games,
  customGameIds,
  customGameRecords,
  gameRecovery,
  records,
  navigate,
  removeGame,
  refreshGames,
  removeRecord,
  importSession,
  importGame,
}: CatalogViewProps) {
  const sessions = records.filter((record) => record.ok)
  const recovery = records.filter((record) => !record.ok)

  return (
    <div className="page-stack">
      <section className="page-intro" aria-labelledby="catalog-title">
        <p className="eyebrow">Local-first tabletop tools</p>
        <h1 id="catalog-title">Choose a game</h1>
        <p className="lede">
          Read the rules, gather the table, and keep facilitator notes on this
          device.
        </p>
      </section>

      <section aria-labelledby="games-title">
        <div className="section-heading">
          <h2 id="games-title">Game shelf</h2>
          <span>
            {games.length} game{games.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="catalog-grid">
          {games.map((game, index) => {
            const customRecord = customGameIds.has(game.id)
              ? customGameRecords.find(
                  (record) => record.ok && record.id === game.id,
                )
              : undefined
            return (
              <article className="game-card" key={game.id}>
                <p className="card-index">
                  {String(index + 1).padStart(2, '0')}
                </p>
                {customGameIds.has(game.id) && <p>Custom game</p>}
                <h3>{game.name}</h3>
                <p>{game.summary}</p>
                <dl className="game-facts">
                  <div>
                    <dt>Players</dt>
                    <dd>
                      {game.players.min}
                      {game.players.max ? '–' + game.players.max : '+'}
                    </dd>
                  </div>
                  <div>
                    <dt>Deck</dt>
                    <dd>{game.deck === 'standard-52' ? '52-card' : 'Tarot'}</dd>
                  </div>
                </dl>
                <a
                  className="primary-link"
                  href={'?game=' + encodeURIComponent(game.id)}
                  onClick={(event) => {
                    event.preventDefault()
                    navigate('game=' + encodeURIComponent(game.id))
                  }}
                >
                  Open {game.name}
                </a>
                {customRecord?.ok && (
                  <CustomGameActions
                    record={customRecord}
                    sessionRecords={records}
                    onEdit={() =>
                      navigate(
                        'studio=edit&game=' + encodeURIComponent(game.id),
                      )
                    }
                    onRemove={removeGame}
                    onRemoved={refreshGames}
                  />
                )}
              </article>
            )
          })}
        </div>
      </section>

      {gameRecovery && (
        <section aria-labelledby="game-recovery-title">
          <h2 id="game-recovery-title">Custom games needing attention</h2>
          {gameRecovery}
        </section>
      )}

      {sessions.length > 0 && (
        <section aria-labelledby="sessions-title">
          <div className="section-heading">
            <h2 id="sessions-title">Saved sessions</h2>
            <span>Stored only in this browser</span>
          </div>
          <div className="session-list">
            {sessions.map((record) => (
              <article className="session-row" key={record.id}>
                <div>
                  <h3>{record.session.name}</h3>
                  <p>
                    {
                      games.find((game) => game.id === record.session.gameId)
                        ?.name
                    }
                  </p>
                </div>
                <a
                  href={'?session=' + encodeURIComponent(record.id)}
                  onClick={(event) => {
                    event.preventDefault()
                    navigate('session=' + encodeURIComponent(record.id))
                  }}
                >
                  Resume {record.session.name}
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      {recovery.length > 0 && (
        <section aria-labelledby="recovery-title">
          <h2 id="recovery-title">Records needing attention</h2>
          {recovery.map((record) => (
            <RecoveryCard
              key={record.id || 'storage-error'}
              record={record}
              onDelete={() => removeRecord(record.id)}
            />
          ))}
        </section>
      )}

      {importSession}
      {importGame}
    </div>
  )
}
