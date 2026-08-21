import type { DeckType } from '../cards/model'

export interface PlayersDefinition {
  readonly min: number
  readonly max?: number
}

export interface PhaseDefinition {
  readonly id: string
  readonly label: string
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

export type PlayerFieldDefinition =
  | BooleanFieldDefinition
  | ChoiceFieldDefinition
  | NumberFieldDefinition
  | TextFieldDefinition

export interface GameDefinition {
  readonly schemaVersion: 1
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly deck: DeckType
  readonly players: PlayersDefinition
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
