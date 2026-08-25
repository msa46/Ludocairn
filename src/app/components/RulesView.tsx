import type { GameDefinition } from '../../games/model'
import { renderRules } from '../../games/render'
import { RoleGuide } from './RoleGuide'

interface RulesViewProps {
  readonly game: GameDefinition
  readonly onStart: () => void
  readonly onEdit?: () => void
  readonly navigateHome: () => void
  readonly shared?: boolean
  readonly error?: string
}

export function RulesView({
  game,
  onStart,
  onEdit,
  navigateHome,
  shared = false,
  error,
}: RulesViewProps) {
  return (
    <div className="page-stack rules-page">
      <nav aria-label="Breadcrumb" className="breadcrumb print-hidden">
        <a
          href="?"
          onClick={(event) => {
            event.preventDefault()
            navigateHome()
          }}
        >
          All games
        </a>
        <span aria-hidden="true">/</span>
        <span>{game.name}</span>
      </nav>
      {shared && (
        <section
          aria-label="Shared rulebook"
          className="shared-rulebook-notice print-hidden"
        >
          <div>
            <p className="eyebrow">Shared rulebook</p>
            <p>
              Read the rules here, print a table copy, or add this game to your
              library and play.
            </p>
          </div>
          <p className="shared-rulebook-status">Not yet in library</p>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="rules-actions print-hidden">
        <button className="primary-button" type="button" onClick={onStart}>
          {shared ? 'Play game' : 'Start session'}
        </button>
        <button type="button" onClick={() => window.print()}>
          Print rules
        </button>
        {onEdit && (
          <button type="button" onClick={onEdit}>
            Edit custom game
          </button>
        )}
      </div>
      <RoleGuide game={game} />
      <article
        className="rules-print prose"
        dangerouslySetInnerHTML={{ __html: renderRules(game.rulesMarkdown) }}
      />
    </div>
  )
}
