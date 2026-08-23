import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { reviewGameSave } from '../../games/manage'
import type { GameDefinition } from '../../games/model'
import { parseGameSource } from '../../games/parse'
import { renderRules } from '../../games/render'
import { sourceHasFrontmatterComments } from '../../games/source'
import type {
  GameRepositoryRecord,
  GameSaveResult,
} from '../../storage/game-repository'
import type { RepositoryRecord } from '../../storage/repository'
import { GuidedGameEditor } from './GuidedGameEditor'
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
type StudioEditorView = Exclude<StudioView, 'preview'>

const STUDIO_VIEWS: readonly StudioView[] = ['guided', 'source', 'preview']
const STUDIO_EDITOR_VIEWS: readonly StudioEditorView[] = ['guided', 'source']
const WIDE_STUDIO_QUERY = '(min-width: 64rem)'

function studioIsWide(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(WIDE_STUDIO_QUERY).matches
  )
}

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
  const [activeEditor, setActiveEditor] = useState<StudioEditorView>(
    initial.ok ? 'guided' : 'source',
  )
  const [saveError, setSaveError] = useState<string>()
  const [pendingGuidedSource, setPendingGuidedSource] = useState<string>()
  const [normalizationAcknowledged, setNormalizationAcknowledged] =
    useState(false)
  const [wide, setWide] = useState(studioIsWide)
  const mobilePreviewTab = useRef<HTMLButtonElement>(null)
  const mobilePreviewPanel = useRef<HTMLElement>(null)
  const widePreview = useRef<HTMLElement>(null)
  const pendingPreviewFocus = useRef(false)
  const dirty = savedSource === undefined || source !== savedSource

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }

    const media = window.matchMedia(WIDE_STUDIO_QUERY)
    const update = (event: MediaQueryListEvent) => {
      const active = document.activeElement
      if (
        event.matches &&
        (active === mobilePreviewTab.current ||
          (active !== null && mobilePreviewPanel.current?.contains(active)))
      ) {
        pendingPreviewFocus.current = true
      } else if (
        !event.matches &&
        active !== null &&
        widePreview.current?.contains(active)
      ) {
        pendingPreviewFocus.current = true
        setActiveView('preview')
      }
      setWide(event.matches)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    if (!pendingPreviewFocus.current) return
    const target = wide ? widePreview.current : mobilePreviewPanel.current
    target?.focus()
    pendingPreviewFocus.current = false
  }, [activeView, wide])

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

  function changeGuidedSource(nextSource: string) {
    if (pendingGuidedSource) return
    if (!normalizationAcknowledged && sourceHasFrontmatterComments(source)) {
      setPendingGuidedSource(nextSource)
      return
    }
    changeSource(nextSource)
  }

  function continueGuidedEditing() {
    if (!pendingGuidedSource) return
    setNormalizationAcknowledged(true)
    setPendingGuidedSource(undefined)
    changeSource(pendingGuidedSource)
  }

  function save() {
    const parsed = parseDraft(source, originalId)
    if (!parsed.ok) {
      setDiagnostics(parsed.diagnostics)
      setSaveError(undefined)
      setActiveView('source')
      setActiveEditor('source')
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

  function selectView(view: StudioView) {
    setActiveView(view)
    if (view !== 'preview') setActiveEditor(view)
  }

  function editorPanel(view: StudioEditorView) {
    if (view === 'guided') {
      return lastValid ? (
        <section
          aria-labelledby="studio-guided-tab"
          className="guided-editor"
          id="studio-guided-panel"
          role="tabpanel"
        >
          <GuidedGameEditor
            game={lastValid}
            idLocked={originalId !== undefined}
            onChange={changeGuidedSource}
          />
        </section>
      ) : null
    }

    return (
      <section
        aria-labelledby="studio-source-tab"
        className="source-editor"
        id="studio-source-panel"
        role="tabpanel"
      >
        <label>
          Complete game source
          <textarea
            aria-describedby={invalid ? 'studio-source-diagnostics' : undefined}
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
    )
  }

  function previewContents() {
    return (
      <>
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
      </>
    )
  }

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
        {(wide ? STUDIO_EDITOR_VIEWS : STUDIO_VIEWS).map((view) => {
          const label = view[0].toUpperCase() + view.slice(1)
          return (
            <button
              aria-controls={`studio-${view}-panel`}
              aria-selected={wide ? activeEditor === view : activeView === view}
              disabled={view === 'guided' && invalid}
              id={`studio-${view}-tab`}
              key={view}
              ref={view === 'preview' ? mobilePreviewTab : undefined}
              role="tab"
              type="button"
              onClick={() => selectView(view)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="game-studio-workbench">
        {wide ? (
          <>
            {editorPanel(activeEditor)}
            <aside
              aria-label="Live game preview"
              className="studio-preview"
              ref={widePreview}
              tabIndex={-1}
            >
              <p className="eyebrow studio-preview-label">Live preview</p>
              {previewContents()}
            </aside>
          </>
        ) : activeView === 'preview' ? (
          <section
            aria-labelledby="studio-preview-tab"
            className="studio-preview"
            id="studio-preview-panel"
            ref={mobilePreviewPanel}
            role="tabpanel"
            tabIndex={-1}
          >
            {previewContents()}
          </section>
        ) : (
          editorPanel(activeView)
        )}
      </div>

      {pendingGuidedSource && (
        <div
          aria-labelledby="normalize-source-title"
          aria-modal="true"
          className="message-card"
          role="dialog"
        >
          <h2 id="normalize-source-title">Normalize source formatting?</h2>
          <p>
            Guided editing rewrites the YAML frontmatter and will remove its
            comments. Your rules Markdown will be preserved.
          </p>
          <div className="form-actions">
            <button type="button" onClick={continueGuidedEditing}>
              Continue with guided editing
            </button>
            <button
              type="button"
              onClick={() => setPendingGuidedSource(undefined)}
            >
              Cancel guided edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
