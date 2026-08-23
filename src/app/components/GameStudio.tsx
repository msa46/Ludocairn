import { useEffect, useState } from 'react'

import { reviewGameSave } from '../../games/manage'
import type { GameDefinition } from '../../games/model'
import { parseGameSource } from '../../games/parse'
import { renderRules } from '../../games/render'
import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'
import { RoleGuide } from './RoleGuide'

interface GameStudioProps {
  readonly initialSource: string
  readonly originalId?: string
  readonly bundledIds: ReadonlySet<string>
  readonly customRecords: readonly GameRepositoryRecord[]
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly onSave: (source: string) => GameSaveResult
  readonly onSaved: (id: string) => void
  readonly onCancel: () => void
  readonly onDirtyChange: (dirty: boolean) => void
}

type StudioView = 'guided' | 'source' | 'preview'

function parseDraft(source: string, originalId?: string) {
  return parseGameSource(source, `custom/${originalId ?? 'unsaved'}/game.md`)
}

export function GameStudio({
  initialSource,
  originalId,
  bundledIds,
  customRecords,
  sessionRecords,
  onSave,
  onSaved,
  onCancel,
  onDirtyChange,
}: GameStudioProps) {
  const initial = parseDraft(initialSource, originalId)
  const [source, setSource] = useState(initialSource)
  const [lastValid, setLastValid] = useState<GameDefinition | undefined>(
    initial.ok ? initial.game : undefined,
  )
  const [savedSource, setSavedSource] = useState<string | undefined>(
    initial.ok ? initialSource : undefined,
  )
  const [diagnostics, setDiagnostics] = useState(
    initial.ok ? [] : initial.diagnostics,
  )
  const [activeView, setActiveView] = useState<StudioView>(
    initial.ok ? 'guided' : 'source',
  )
  const [saveError, setSaveError] = useState<string>()
  const dirty = savedSource === undefined || source !== savedSource

  useEffect(() => {
    if (!dirty) return

    function protectUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', protectUnload)
    return () => window.removeEventListener('beforeunload', protectUnload)
  }, [dirty])

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  function changeSource(nextSource: string) {
    const parsed = parseDraft(nextSource, originalId)
    setSource(nextSource)
    setSaveError(undefined)
    if (parsed.ok) {
      setLastValid(parsed.game)
      setDiagnostics([])
    } else {
      setDiagnostics(parsed.diagnostics)
    }
  }

  function save() {
    const parsed = parseDraft(source, originalId)
    if (!parsed.ok) {
      setDiagnostics(parsed.diagnostics)
      setSaveError(undefined)
      setActiveView('source')
      return
    }

    const reviewed = reviewGameSave(source, {
      originalId,
      bundledIds,
      customRecords,
      sessionRecords,
    })
    if (!reviewed.ok) {
      setSaveError(reviewed.diagnostic.message)
      return
    }

    const saved = onSave(reviewed.source)
    if (!saved.ok) {
      setSaveError(saved.diagnostic.message)
      return
    }

    setSavedSource(reviewed.source)
    onSaved(reviewed.game.id)
  }

  const invalid = diagnostics.length > 0

  return (
    <div className="game-studio page-stack">
      <nav aria-label="Breadcrumb" className="breadcrumb print-hidden">
        <a
          href="?"
          onClick={(event) => {
            event.preventDefault()
            onCancel()
          }}
        >
          All games
        </a>
        <span aria-hidden="true">/</span>
        <span>Game Studio</span>
      </nav>

      <header className="page-intro">
        <p className="eyebrow">Game Studio</p>
        <h1>{originalId ? 'Edit custom game' : 'Create custom game'}</h1>
        <p className="lede">
          Keep the complete game source valid, then preview and save it to this
          browser.
        </p>
      </header>

      <div className="form-actions print-hidden">
        <button className="primary-button" type="button" onClick={save}>
          Save game
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {saveError && <p role="alert">{saveError}</p>}

      <div
        aria-label="Game Studio views"
        className="game-studio-tabs"
        role="tablist"
      >
        {(['guided', 'source', 'preview'] as const).map((view) => {
          const label = view[0].toUpperCase() + view.slice(1)
          return (
            <button
              aria-controls={`studio-${view}-panel`}
              aria-selected={activeView === view}
              disabled={view === 'guided' && invalid}
              id={`studio-${view}-tab`}
              key={view}
              role="tab"
              type="button"
              onClick={() => setActiveView(view)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="game-studio-workbench">
        {activeView === 'guided' && lastValid && (
          <section
            aria-labelledby="studio-guided-tab"
            className="guided-editor"
            id="studio-guided-panel"
            role="tabpanel"
          >
            <h2>Draft summary</h2>
            <label>
              Game ID
              <input
                disabled={originalId !== undefined}
                readOnly
                type="text"
                value={lastValid.id}
              />
            </label>
            <dl className="import-preview">
              <div>
                <dt>Name</dt>
                <dd>{lastValid.name}</dd>
              </div>
              <div>
                <dt>Summary</dt>
                <dd>{lastValid.summary}</dd>
              </div>
              <div>
                <dt>Players</dt>
                <dd>
                  {lastValid.players.min}
                  {lastValid.players.max ? `–${lastValid.players.max}` : '+'}
                </dd>
              </div>
              <div>
                <dt>Deck</dt>
                <dd>
                  {lastValid.deck === 'standard-52' ? '52-card' : 'Tarot'}
                </dd>
              </div>
            </dl>
            <p>
              Guided controls arrive in the next Studio step. Use Source to edit
              this draft now.
            </p>
          </section>
        )}

        {activeView === 'source' && (
          <section
            aria-labelledby="studio-source-tab"
            className="source-editor"
            id="studio-source-panel"
            role="tabpanel"
          >
            <label>
              Complete game source
              <textarea
                aria-describedby={
                  invalid ? 'studio-source-diagnostics' : undefined
                }
                rows={24}
                spellCheck={false}
                value={source}
                onChange={(event) => changeSource(event.target.value)}
              />
            </label>
            {invalid && (
              <div id="studio-source-diagnostics" role="alert">
                {diagnostics.map((diagnostic, index) => (
                  <p key={`${diagnostic.code}-${diagnostic.path ?? index}`}>
                    {diagnostic.message}
                    {diagnostic.path ? ` Path: ${diagnostic.path}.` : ''}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === 'preview' && (
          <section
            aria-labelledby="studio-preview-tab"
            className="studio-preview"
            id="studio-preview-panel"
            role="tabpanel"
          >
            {invalid && lastValid && (
              <p className="status-note">Preview shows the last valid draft</p>
            )}
            {lastValid ? (
              <>
                <RoleGuide game={lastValid} />
                <article
                  className="rules-print prose"
                  dangerouslySetInnerHTML={{
                    __html: renderRules(lastValid.rulesMarkdown),
                  }}
                />
              </>
            ) : (
              <p>Preview is unavailable until the source validates.</p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
