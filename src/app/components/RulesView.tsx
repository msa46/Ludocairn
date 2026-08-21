import type { GameDefinition } from '../../games/model'
import { renderRules } from '../../games/render'
import { RoleGuide } from './RoleGuide'

interface RulesViewProps {
  readonly game: GameDefinition
  readonly onStart: () => void
  readonly navigateHome: () => void
}

export function RulesView({ game, onStart, navigateHome }: RulesViewProps) {
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
      <div className="rules-actions print-hidden">
        <button className="primary-button" type="button" onClick={onStart}>
          Start session
        </button>
        <button type="button" onClick={() => window.print()}>
          Print rules
        </button>
      </div>
      <RoleGuide game={game} />
      <article
        className="rules-print prose"
        dangerouslySetInnerHTML={{ __html: renderRules(game.rulesMarkdown) }}
      />
    </div>
  )
}
