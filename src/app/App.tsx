import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type { RandomSource } from '../assignments/model'
import { loadBundledGames } from '../games/catalog'
import { createGameTemplate } from '../games/source'
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
import { GameStudio } from './components/GameStudio'
import { GameRecoveryCard } from './components/GameRecoveryCard'
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
const missingRepairMessage =
  'The repair draft is no longer available after refresh. Paste or import the source again to recover it.'

interface PendingNavigation {
  readonly search: string
  readonly hash: string
  readonly history: 'push' | 'replace'
}

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
  const [studioDirty, setStudioDirty] = useState(false)
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation>()
  const [revision, setRevision] = useState(0)
  const [actionError, setActionError] = useState<string>()
  const discardDialog = useRef<HTMLDivElement>(null)
  const keepEditingButton = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
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
  const studioMode = parameters.get('studio')
  const requestedView = parameters.get('view')
  const game = gameId
    ? catalogGames.find((candidate) => candidate.id === gameId)
    : undefined
  const sessionGame = session ? resolveGame(session.gameId) : undefined
  const shareHash = sharedHash.startsWith('#share-game=')
    ? sharedHash
    : undefined

  useEffect(() => {
    function onPopState() {
      const nextSearch = window.location.search
      const nextHash = window.location.hash
      if (studioDirty) {
        window.history.pushState(
          {},
          '',
          (search || window.location.pathname) + sharedHash,
        )
        setPendingNavigation({
          search: nextSearch,
          hash: nextHash,
          history: 'replace',
        })
        return
      }
      const missingRepair =
        !nextHash.startsWith('#share-game=') &&
        repairSource === undefined &&
        new URLSearchParams(nextSearch).get('studio') === 'repair'
      if (missingRepair) {
        window.history.replaceState(
          {},
          '',
          window.location.pathname + window.location.hash,
        )
      }
      setSearch(nextSearch)
      setSharedHash(nextHash)
      setSetupGameId(undefined)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [repairSource, search, sharedHash, studioDirty])

  useEffect(() => {
    if (
      studioMode !== 'repair' ||
      repairSource !== undefined ||
      shareHash !== undefined
    )
      return

    window.history.replaceState(
      {},
      '',
      window.location.pathname + window.location.hash,
    )
  }, [repairSource, shareHash, studioMode])

  useEffect(() => {
    function onHashChange() {
      const nextHash = window.location.hash
      if (studioDirty && nextHash.startsWith('#share-game=')) {
        window.history.replaceState(
          {},
          '',
          (search || window.location.pathname) + sharedHash,
        )
        setPendingNavigation({
          search,
          hash: nextHash,
          history: 'replace',
        })
        return
      }
      setSharedHash(nextHash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [search, sharedHash, studioDirty])

  useEffect(() => {
    if (sessionId && session?.id !== sessionId) open(sessionId)
  }, [open, session?.id, sessionId])

  useEffect(() => {
    if (!pendingNavigation) return

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    keepEditingButton.current?.focus()

    return () => {
      const target = previousFocus.current
      previousFocus.current = null
      if (target?.isConnected) target.focus()
    }
  }, [pendingNavigation])

  function commitNavigation(
    nextSearch: string,
    nextHash: string,
    history: PendingNavigation['history'],
  ) {
    const url = (nextSearch || window.location.pathname) + nextHash
    window.history[history === 'push' ? 'pushState' : 'replaceState'](
      {},
      '',
      url,
    )
    setSearch(nextSearch)
    setSharedHash(nextHash)
    setSetupGameId(undefined)
    setActionError(undefined)
  }

  function navigate(nextSearch: string, bypassDirtyGuard = false) {
    const normalizedSearch = nextSearch ? '?' + nextSearch : ''
    if (studioDirty && !bypassDirtyGuard) {
      setPendingNavigation({
        search: normalizedSearch,
        hash: window.location.hash,
        history: 'push',
      })
      return
    }
    commitNavigation(normalizedSearch, window.location.hash, 'push')
  }

  function keepEditing() {
    setPendingNavigation(undefined)
  }

  function discardChanges() {
    const target = pendingNavigation
    if (!target) return

    setPendingNavigation(undefined)
    setStudioDirty(false)
    setRepairSource(undefined)
    commitNavigation(target.search, target.hash, target.history)
  }

  function trapDiscardDialog(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      keepEditing()
      return
    }
    if (event.key !== 'Tab' || !discardDialog.current) return

    const focusable = [
      ...discardDialog.current.querySelectorAll<HTMLElement>('button'),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
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

  function importGame(sessionRecords: ReturnType<SessionRepository['list']>) {
    return (
      <ImportGame
        key={sharedHash}
        sharedHash={shareHash}
        bundledIds={new Set(games.map((candidate) => candidate.id))}
        customRecords={customRecords}
        sessionRecords={sessionRecords}
        repository={storedGames}
        onSaved={(id) => {
          if (shareHash) clearSharedHash()
          refreshGames()
          navigate('game=' + encodeURIComponent(id))
        }}
        onRepair={(source) => {
          setRepairSource(source)
          navigate('studio=repair')
        }}
      />
    )
  }

  function catalog(
    sessionRecords: ReturnType<SessionRepository['list']>,
    recoveryMessage?: string,
  ) {
    return (
      <CatalogView
        games={catalogGames}
        customGameIds={customIds}
        gameRecovery={
          (gameRecovery.length > 0 || recoveryMessage) && (
            <div>
              {recoveryMessage && (
                <article className="recovery-card">
                  <h3>Repair draft unavailable</h3>
                  <p role="alert">{recoveryMessage}</p>
                </article>
              )}
              {gameRecovery.map((record) => (
                <GameRecoveryCard
                  key={record.id || 'storage-error'}
                  record={record}
                  sessionRecords={sessionRecords}
                  onRemove={(id) => storedGames.remove(id)}
                  onRemoved={refreshGames}
                />
              ))}
            </div>
          )
        }
        customGameRecords={customRecords}
        records={sessionRecords}
        navigate={navigate}
        removeGame={(id) => storedGames.remove(id)}
        refreshGames={refreshGames}
        removeRecord={(id) => {
          sessionRepository.remove(id)
          setRevision((value) => value + 1)
        }}
        importSession={
          <ImportSession
            ids={ids}
            repository={sessionRepository}
            resolveGame={resolveGame}
            isCustomGame={(id) => customIds.has(id)}
            onImported={(id) => navigate('session=' + encodeURIComponent(id))}
          />
        }
        importGame={importGame(sessionRecords)}
        repairSource={repairSource}
        key={revision}
      />
    )
  }

  let content
  if (shareHash) {
    content = (
      <div className="page-stack">{importGame(sessionRepository.list())}</div>
    )
  } else if (studioMode) {
    const sessionRecords = sessionRepository.list()
    const editId = studioMode === 'edit' ? gameId : null
    const bundledCollision =
      editId !== null && games.some((candidate) => candidate.id === editId)
    const loaded =
      editId !== null && !bundledCollision
        ? storedGames.load(editId)
        : undefined
    const initialSource =
      studioMode === 'new'
        ? createGameTemplate()
        : studioMode === 'repair'
          ? repairSource
          : studioMode === 'edit' && loaded?.ok
            ? loaded.source
            : undefined

    if (initialSource !== undefined) {
      content = (
        <GameStudio
          key={editId === null ? studioMode : `edit:${editId}`}
          initialSource={initialSource}
          originalId={editId ?? undefined}
          bundledIds={new Set(games.map((candidate) => candidate.id))}
          customRecords={customRecords}
          sessionRecords={sessionRecords}
          onSave={(source) => storedGames.save(source)}
          onSaved={(id) => {
            setRepairSource(undefined)
            setStudioDirty(false)
            refreshGames()
            navigate('game=' + encodeURIComponent(id), true)
          }}
          onCancel={() => navigate('')}
          onDirtyChange={setStudioDirty}
        />
      )
    } else if (studioMode === 'repair') {
      content = catalog(sessionRecords, missingRepairMessage)
    } else {
      content = (
        <section className="message-card">
          <h1>Game unavailable</h1>
          <p role="alert">
            {bundledCollision
              ? 'Bundled games cannot be edited in Game Studio.'
              : studioMode !== 'edit'
                ? `Studio mode “${studioMode}” is not available.`
                : editId === null
                  ? 'Choose a saved custom game to edit.'
                  : loaded && !loaded.ok
                    ? loaded.diagnostic.message
                    : `No saved custom game with ID “${editId}” was found.`}
          </p>
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
  } else if (sessionId) {
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
            isCustomGame={customIds.has(sessionGame.id)}
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
          onEdit={
            customIds.has(game.id)
              ? () =>
                  navigate('studio=edit&game=' + encodeURIComponent(game.id))
              : undefined
          }
          onStart={() => setSetupGameId(game.id)}
        />
      )
    }
  } else {
    const sessionRecords = sessionRepository.list()
    content = catalog(sessionRecords)
  }

  return (
    <>
      <div className="app-shell" inert={pendingNavigation ? true : undefined}>
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

      {pendingNavigation && (
        <div
          ref={discardDialog}
          aria-labelledby="discard-studio-title"
          aria-modal="true"
          className="message-card"
          role="dialog"
          onKeyDown={trapDiscardDialog}
        >
          <h2 id="discard-studio-title">Discard unsaved changes?</h2>
          <p>Your current Game Studio draft will be lost.</p>
          <div className="form-actions">
            <button type="button" onClick={discardChanges}>
              Discard changes
            </button>
            <button ref={keepEditingButton} type="button" onClick={keepEditing}>
              Keep editing
            </button>
          </div>
        </div>
      )}
    </>
  )
}
