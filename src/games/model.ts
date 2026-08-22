import type { DeckType } from '../cards/model'
import type { CardSelector } from '../cards/select'

export interface PlayersDefinition {
  readonly min: number
  readonly max?: number
}

export interface PhaseDefinition {
  readonly id: string
  readonly label: string
}

export interface RoleCardMarker {
  readonly label: string
  readonly selector: CardSelector
}

export interface RoleDefinition {
  readonly id: string
  readonly label: string
  readonly team?: string
  readonly summary: string
  readonly card?: RoleCardMarker
}

export type RoleCount = number | 'remaining'

export interface RoleDistribution {
  readonly players: Required<PlayersDefinition>
  readonly counts: Readonly<Record<string, RoleCount>>
}

export type PlayerAssignmentVisibility = 'own' | 'all' | 'none'
export type GameMasterAssignmentVisibility = 'all' | 'none'

export interface AssignmentDefinition {
  readonly method: 'shuffle'
  readonly visibility: {
    readonly players: PlayerAssignmentVisibility
    readonly gameMaster: GameMasterAssignmentVisibility
  }
}

export type RoundDefinition =
  | { readonly enabled: true; readonly initial: number }
  | { readonly enabled: false }

interface BasePlayerFieldDefinition {
  readonly id: string
  readonly label: string
}

export interface BooleanFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'boolean'
  readonly default: boolean
}

export interface ChoiceFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'choice'
  readonly choices: readonly string[]
  readonly default: string
}

export interface NumberFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'number'
  readonly default: number
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

export interface TextFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'text'
  readonly default: string
  readonly multiline: boolean
}

export interface RoleFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'role'
  readonly default: string
}

export type PlayerFieldDefinition =
  | BooleanFieldDefinition
  | ChoiceFieldDefinition
  | NumberFieldDefinition
  | TextFieldDefinition
  | RoleFieldDefinition

export interface GameDefinition {
  readonly schemaVersion: 1
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly deck: DeckType
  readonly players: PlayersDefinition
  readonly roles: readonly RoleDefinition[]
  readonly roleDistributions: readonly RoleDistribution[]
  readonly assignments?: AssignmentDefinition
  readonly phases: readonly PhaseDefinition[]
  readonly initialPhase?: string
  readonly round: RoundDefinition
  readonly fields: readonly PlayerFieldDefinition[]
  readonly rulesMarkdown: string
  readonly source: string
}

export interface Diagnostic {
  readonly code:
    | 'catalog.duplicate-id'
    | 'catalog.path-id-mismatch'
    | 'frontmatter.invalid'
    | 'schema.duplicate-field-id'
    | 'schema.duplicate-phase-id'
    | 'schema.initial-phase-missing'
    | 'schema.invalid-default'
    | 'schema.invalid-id'
    | 'schema.invalid-round'
    | 'schema.invalid-value'
    | 'schema.unknown-property'
    | 'schema.unsupported-version'
  readonly message: string
  readonly source: string
  readonly path?: string
}

export type ParseGameResult =
  | { readonly ok: true; readonly game: GameDefinition }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }
