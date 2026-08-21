import { useEffect, useMemo, useState } from 'react'

import { loadBundledGames } from '../games/catalog'
import type { GameDefinition } from '../games/model'
import type { Clock, IdProvider, SessionFieldValue } from '../sessions/model'
import {
  addPlayer,
  createSession,
  removePlayer,
  setPhase,
  setRound,
  updateNotes,
  updatePlayerField,
} from '../sessions/operations'
import { LocalStorageSessionRepository } from '../storage/local-storage'
import type { SessionRepository } from '../storage/repository'
import { CatalogView } from './components/CatalogView'
import { RulesView } from './components/RulesView'
import { SessionSetup } from './components/SessionSetup'
import { TrackerView } from './components/TrackerView'
import { useSessionStore } from './useSessionStore'

interface AppProps {
  readonly games?: readonly GameDefinition[]
  readonly repository?: SessionRepository
  readonly clock?: Clock
  readonly ids?: IdProvider
}

const bundledCatalog = loadBundledGames()
const bundledGames = bundledCatalog.ok ? bundledCatalog.games : []

const systemClock: Clock = () => new Date().toISOString()
const systemIds: IdProvider = {
  next: (kind) => kind + '-' + crypto.randomUUID(),
}

export function App({
  games = bundledGames,
  repository,
  clock = systemClock,
  ids = systemIds,
}: AppProps) {
  const resolveGame = useMemo(
    () => (id: string) => games.find((game) => game.id === id),
    [games],
  )
  const sessionRepository = useMemo(
    () =>
      repository ??
      new LocalStorageSessionRepository(window.localStorage, resolveGame),
    [repository, resolveGame],
  )
  const [search, setSearch] = useState(() => window.location.search)
  const [setupGameId, setSetupGameId] = useState<string>()
  const [revision, setRevision] = useState(0)
  const { session, saveStatus, error, open, accept } =
    useSessionStore(sessionRepository)

  const parameters = new URLSearchParams(search)
  const gameId = parameters.get('game')
  const sessionId = parameters.get('session')
  const game = gameId ? resolveGame(gameId) : undefined
  const sessionGame = session ? resolveGame(session.gameId) : undefined

  useEffect(() => {
    function onPopState() {
      setSearch(window.location.search)
      setSetupGameId(undefined)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) open(sessionId)
  }, [open, session?.id, sessionId])

  function navigate(nextSearch: string) {
    const query = nextSearch ? '?' + nextSearch : window.location.pathname
    window.history.pushState({}, '', query)
    setSearch(nextSearch ? '?' + nextSearch : '')
    setSetupGameId(undefined)
  }

  function mutate(result: ReturnType<typeof updateNotes>, debounce = false) {
    accept(result, debounce)
  }

  let content
  if (sessionId) {
    if (session?.id === sessionId && sessionGame) {
      content = (
        <TrackerView
          game={sessionGame}
          session={session}
          saveStatus={saveStatus}
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
          onNotes={(notes) => mutate(updateNotes(session, notes, clock), true)}
          onAddPlayer={(name) =>
            mutate(addPlayer(session, sessionGame, name, clock, ids))
          }
          onRemovePlayer={(id) => mutate(removePlayer(session, id, clock))}
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
            )
            if (accept(created) && created.ok) {
              navigate('session=' + created.session.id)
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
    content = (
      <CatalogView
        games={games}
        records={sessionRepository.list()}
        navigate={navigate}
        removeRecord={(id) => {
          sessionRepository.remove(id)
          setRevision((value) => value + 1)
        }}
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

      <main id="main-content" className="site-main">
        {content}
      </main>

      <footer className="site-footer print-hidden">
        <p>Static by design. No account or backend required.</p>
        <p>Your saved sessions remain on this device.</p>
      </footer>
    </div>
  )
}
