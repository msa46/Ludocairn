import type { Card } from './model'

export interface CardSelector {
  readonly ids?: readonly string[]
  readonly suits?: readonly string[]
  readonly ranks?: readonly string[]
  readonly arcana?: readonly string[]
  readonly tags?: readonly string[]
}

type SelectorProperty = keyof CardSelector

export interface SelectionDiagnostic {
  readonly code:
    | 'selector.empty'
    | 'selector.empty-property'
    | 'selector.inapplicable-property'
    | 'selector.no-matches'
    | 'selector.unknown-value'
  readonly message: string
  readonly property?: SelectorProperty
  readonly value?: string
}

export type SelectionResult =
  | { readonly ok: true; readonly cards: readonly Card[] }
  | { readonly ok: false; readonly diagnostic: SelectionDiagnostic }

const SELECTOR_PROPERTIES: readonly SelectorProperty[] = [
  'ids',
  'suits',
  'ranks',
  'arcana',
  'tags',
]

function diagnostic(
  code: SelectionDiagnostic['code'],
  message: string,
  details: Pick<SelectionDiagnostic, 'property' | 'value'> = {},
): SelectionResult {
  return { ok: false, diagnostic: { code, message, ...details } }
}

function availableValues(
  deck: readonly Card[],
): Record<SelectorProperty, ReadonlySet<string>> {
  return {
    ids: new Set(deck.map((card) => card.id)),
    suits: new Set(deck.flatMap((card) => ('suit' in card ? [card.suit] : []))),
    ranks: new Set(deck.flatMap((card) => ('rank' in card ? [card.rank] : []))),
    arcana: new Set(
      deck.flatMap((card) => ('arcana' in card ? [card.arcana] : [])),
    ),
    tags: new Set(deck.flatMap((card) => card.tags)),
  }
}

function matches(
  card: Card,
  property: SelectorProperty,
  selectedValues: readonly string[],
): boolean {
  switch (property) {
    case 'ids':
      return selectedValues.includes(card.id)
    case 'suits':
      return 'suit' in card && selectedValues.includes(card.suit)
    case 'ranks':
      return 'rank' in card && selectedValues.includes(card.rank)
    case 'arcana':
      return 'arcana' in card && selectedValues.includes(card.arcana)
    case 'tags':
      return selectedValues.some((tag) => card.tags.includes(tag))
  }
}

export function selectCards(
  deck: readonly Card[],
  selector: CardSelector,
): SelectionResult {
  const populatedProperties = SELECTOR_PROPERTIES.filter(
    (property) => selector[property] !== undefined,
  )
  if (populatedProperties.length === 0) {
    return diagnostic('selector.empty', 'Select at least one card property.')
  }

  const valuesByProperty = availableValues(deck)
  for (const property of populatedProperties) {
    const selectedValues = selector[property] ?? []
    if (selectedValues.length === 0) {
      return diagnostic(
        'selector.empty-property',
        `Selector property "${property}" cannot be empty.`,
        { property },
      )
    }

    if (valuesByProperty[property].size === 0) {
      return diagnostic(
        'selector.inapplicable-property',
        `Selector property "${property}" does not apply to this deck.`,
        { property },
      )
    }

    const unknownValue = selectedValues.find(
      (value) => !valuesByProperty[property].has(value),
    )
    if (unknownValue !== undefined) {
      return diagnostic(
        'selector.unknown-value',
        `Unknown ${property} value "${unknownValue}".`,
        { property, value: unknownValue },
      )
    }
  }

  const cards = deck.filter((card) =>
    populatedProperties.every((property) =>
      matches(card, property, selector[property] ?? []),
    ),
  )

  if (cards.length === 0) {
    return diagnostic('selector.no-matches', 'No cards match this selector.')
  }

  return { ok: true, cards: Object.freeze(cards) }
}
