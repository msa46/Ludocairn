import type { ReactNode } from 'react'

import type { GameDefinition } from '../../games/model'
import type { RepositoryRecord } from '../../storage/repository'
import { RecoveryCard } from './RecoveryCard'

interface CatalogViewProps {
  readonly games: readonly GameDefinition[]
  readonly records: readonly RepositoryRecord[]
  readonly navigate: (search: string) => void
  readonly removeRecord: (id: string) => void
  readonly importSession: ReactNode
}

export function CatalogView({
  games,
  records,
  navigate,
  removeRecord,
  importSession,
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
          <span>{games.length} original game</span>
        </div>
        <div className="catalog-grid">
          {games.map((game, index) => (
            <article className="game-card" key={game.id}>
              <p className="card-index">{String(index + 1).padStart(2, '0')}</p>
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
            </article>
          ))}
        </div>
      </section>

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
    </div>
  )
}
