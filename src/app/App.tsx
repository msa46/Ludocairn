import { useEffect, useMemo, useState } from 'react'

import type { RandomSource } from '../assignments/model'
import { loadBundledGames } from '../games/catalog'
import type { GameDefinition } from '../games/model'
import { PwaStatus } from '../pwa/PwaStatus'
import type { RegisterWorker } from '../pwa/register'
import type { Clock, IdProvider, SessionFieldValue } from '../sessions/model'
import {
  addPlayer,
  createSession,
  dealSessionAssignments,
  removePlayer,
  renamePlayer,
  renameSession,
  setPhase,
  setRound,
  updateNotes,
  updatePlayerField,
} from '../sessions/operations'
import { LocalStorageGameRepository } from '../storage/local-game-storage'
import { LocalStorageSessionRepository } from '../storage/local-storage'
import type { GameRepository } from '../storage/game-repository'
import type { SessionRepository } from '../storage/repository'
import { CatalogView } from './components/CatalogView'
import { ImportGame } from './components/ImportGame'
import { ImportSession } from './components/ImportSession'
import { PlayerAssignmentView } from './components/PlayerAssignmentView'
import { RulesView } from './components/RulesView'
import { SessionSetup } from './components/SessionSetup'
import { TrackerView } from './components/TrackerView'
import { useGameStore } from './useGameStore'
import { useSessionStore } from './useSessionStore'

interface AppProps {
  readonly games?: readonly GameDefinition[]
  readonly gameRepository?: GameRepository
  readonly repository?: SessionRepository
  readonly clock?: Clock
  readonly ids?: IdProvider
  readonly random?: RandomSource
  readonly registerWorker?: RegisterWorker
}

const bundledCatalog = loadBundledGames()
const bundledGames = bundledCatalog.ok ? bundledCatalog.games : []

const systemClock: Clock = () => new Date().toISOString()
const systemIds: IdProvider = {
  next: (kind) => kind + '-' + crypto.randomUUID(),
}
const noPwaRegistration: RegisterWorker = () => () => Promise.resolve()

export function App({
  games = bundledGames,
  gameRepository,
  repository,
  clock = systemClock,
  ids = systemIds,
  random = Math.random,
  registerWorker = noPwaRegistration,
}: AppProps) {
  const storedGames = useMemo(
    () => gameRepository ?? new LocalStorageGameRepository(window.localStorage),
    [gameRepository],
  )
  const {
    games: catalogGames,
    customIds,
    recovery: gameRecovery,
    records: customRecords,
    refresh: refreshGames,
  } = useGameStore(storedGames, games)
  const resolveGame = useMemo(
    () => (id: string) => {
      const bundledGame = games.find((game) => game.id === id)
      if (bundledGame) return bundledGame

      const loaded = storedGames.load(id)
      return loaded.ok ? loaded.game : undefined
    },
    [games, storedGames],
  )
  const sessionRepository = useMemo(
    () =>
      repository ??
      new LocalStorageSessionRepository(window.localStorage, resolveGame),
    [repository, resolveGame],
  )
  const [search, setSearch] = useState(() => window.location.search)
  const [sharedHash, setSharedHash] = useState(() => window.location.hash)
  const [setupGameId, setSetupGameId] = useState<string>()
  const [repairSource, setRepairSource] = useState<string>()
  const [revision, setRevision] = useState(0)
  const [actionError, setActionError] = useState<string>()
  const {
    session,
    saveStatus,
    error,
    open,
    accept,
    cancelPendingSave,
    flushPendingSave,
  } = useSessionStore(sessionRepository)

  const parameters = new URLSearchParams(search)
  const gameId = parameters.get('game')
  const sessionId = parameters.get('session')
  const requestedView = parameters.get('view')
  const game = gameId
    ? catalogGames.find((candidate) => candidate.id === gameId)
    : undefined
  const sessionGame = session ? resolveGame(session.gameId) : undefined

  useEffect(() => {
    function onPopState() {
      setSearch(window.location.search)
      setSharedHash(window.location.hash)
      setSetupGameId(undefined)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    function onHashChange() {
      setSharedHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) open(sessionId)
  }, [open, session?.id, sessionId])

  function navigate(nextSearch: string) {
    const query = nextSearch ? '?' + nextSearch : window.location.pathname
    window.history.pushState({}, '', query + window.location.hash)
    setSearch(nextSearch ? '?' + nextSearch : '')
    setSetupGameId(undefined)
    setActionError(undefined)
  }

  function clearSharedHash() {
    window.history.replaceState(
      {},
      '',
      window.location.pathname + window.location.search,
    )
    setSharedHash('')
  }

  function mutate(result: ReturnType<typeof updateNotes>, debounce = false) {
    accept(result, debounce)
  }

  function sessionSearch(
    id: string,
    sessionGame: GameDefinition,
    includePlayerAssignments: boolean,
  ) {
    const base = 'session=' + encodeURIComponent(id)
    const playerVisibility = sessionGame.assignments?.visibility.players
    return includePlayerAssignments &&
      (playerVisibility === 'own' || playerVisibility === 'all')
      ? base + '&view=assignments'
      : base
  }

  let content
  if (sessionId) {
    if (session?.id === sessionId && sessionGame) {
      content =
        requestedView === 'assignments' &&
        session.assignments &&
        (sessionGame.assignments?.visibility.players === 'own' ||
          sessionGame.assignments?.visibility.players === 'all') ? (
          <PlayerAssignmentView
            game={sessionGame}
            session={session}
            onComplete={() =>
              navigate(sessionSearch(session.id, sessionGame, false))
            }
          />
        ) : (
          <TrackerView
            game={sessionGame}
            session={session}
            saveStatus={saveStatus}
            error={error ?? actionError}
            navigateHome={() => navigate('')}
            onPhase={(phase) =>
              mutate(setPhase(session, sessionGame, phase, clock))
            }
            onRound={(round) =>
              mutate(setRound(session, sessionGame, round, clock))
            }
            onField={(playerId, fieldId, value: SessionFieldValue) => {
              const field = sessionGame.fields.find(
                (candidate) => candidate.id === fieldId,
              )
              mutate(
                updatePlayerField(
                  session,
                  sessionGame,
                  playerId,
                  fieldId,
                  value,
                  clock,
                ),
                field?.type === 'text',
              )
            }}
            onNotes={(notes) =>
              mutate(updateNotes(session, notes, clock), true)
            }
            onAddPlayer={(name) =>
              mutate(addPlayer(session, sessionGame, name, clock, ids))
            }
            onRemovePlayer={(id) => mutate(removePlayer(session, id, clock))}
            onRenamePlayer={(id, name) =>
              mutate(renamePlayer(session, id, name, clock))
            }
            onRename={(name) => mutate(renameSession(session, name, clock))}
            onDeleteSession={() => {
              const removed = sessionRepository.remove(session.id)
              if (removed.ok) {
                cancelPendingSave()
                navigate('')
              } else {
                setActionError(removed.diagnostic.message)
              }
            }}
            onDealAssignments={() => {
              const dealt = dealSessionAssignments(
                session,
                sessionGame,
                random,
                clock,
              )
              if (accept(dealt) && dealt.ok) {
                navigate(sessionSearch(dealt.session.id, sessionGame, true))
              }
            }}
          />
        )
    } else {
      content = (
        <section className="message-card">
          <h1>Session unavailable</h1>
          <p role="alert">{error ?? 'Loading saved session…'}</p>
          <a
            href="?"
            onClick={(event) => {
              event.preventDefault()
              navigate('')
            }}
          >
            Return to all games
          </a>
        </section>
      )
    }
  } else if (gameId) {
    if (!game) {
      content = (
        <section className="message-card">
          <h1>Game unavailable</h1>
          <p role="alert">No bundled game has the ID “{gameId}”.</p>
          <a
            href="?"
            onClick={(event) => {
              event.preventDefault()
              navigate('')
            }}
          >
            Return to all games
          </a>
        </section>
      )
    } else if (setupGameId === game.id) {
      content = (
        <SessionSetup
          game={game}
          error={error}
          onCancel={() => setSetupGameId(undefined)}
          onCreate={(name, playerNames) => {
            const created = createSession(
              game,
              { name, playerNames },
              clock,
              ids,
              random,
            )
            if (accept(created) && created.ok) {
              navigate(sessionSearch(created.session.id, game, true))
            }
          }}
        />
      )
    } else {
      content = (
        <RulesView
          game={game}
          navigateHome={() => navigate('')}
          onStart={() => setSetupGameId(game.id)}
        />
      )
    }
  } else {
    const sessionRecords = sessionRepository.list()
    content = (
      <CatalogView
        games={catalogGames}
        customGameIds={customIds}
        gameRecovery={
          gameRecovery.length > 0 && (
            <div>
              {gameRecovery.map((record) => (
                <article
                  className="recovery-card"
                  key={record.id || 'storage-error'}
                >
                  <h3>{record.id || 'Browser storage'}</h3>
                  <p>
                    {record.ok
                      ? `Custom game ID conflicts with bundled game "${record.id}".`
                      : record.diagnostic.message}
                  </p>
                </article>
              ))}
            </div>
          )
        }
        records={sessionRecords}
        navigate={navigate}
        removeRecord={(id) => {
          sessionRepository.remove(id)
          setRevision((value) => value + 1)
        }}
        importSession={
          <ImportSession
            ids={ids}
            repository={sessionRepository}
            resolveGame={resolveGame}
            onImported={(id) => navigate('session=' + encodeURIComponent(id))}
          />
        }
        importGame={
          <ImportGame
            key={sharedHash}
            sharedHash={
              sharedHash.startsWith('#share-game=') ? sharedHash : undefined
            }
            bundledIds={new Set(games.map((candidate) => candidate.id))}
            customRecords={customRecords}
            sessionRecords={sessionRecords}
            repository={storedGames}
            onSaved={(id) => {
              if (sharedHash.startsWith('#share-game=')) clearSharedHash()
              refreshGames()
              navigate('game=' + encodeURIComponent(id))
            }}
            onRepair={(source) => {
              setRepairSource(source)
              navigate('studio=repair')
            }}
          />
        }
        repairSource={repairSource}
        key={revision}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="site-header print-hidden">
        <a
          className="wordmark"
          href="?"
          onClick={(event) => {
            event.preventDefault()
            navigate('')
          }}
        >
          Ludocairn
        </a>
        <p className="tagline">A local-first tabletop card-game toolkit</p>
      </header>

      <PwaStatus
        prepareForReload={flushPendingSave}
        registerWorker={registerWorker}
      />

      <main id="main-content" className="site-main">
        {content}
      </main>

      <footer className="site-footer print-hidden">
        <p>Static by design. No account or backend required.</p>
        <p>Your saved sessions remain on this device.</p>
        <p>
          For AI assistants:{' '}
          <a href="https://github.com/msa46/Deckwright/blob/main/Bots.md">
            AI game translation guide
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
