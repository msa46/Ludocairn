import type {
  StandardCard,
  StandardRank,
  StandardSuit,
  TarotCard,
  TarotMinorRank,
  TarotSuit,
} from './model'

const STANDARD_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
const STANDARD_RANKS = [
  'ace',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'jack',
  'queen',
  'king',
] as const

const TAROT_SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const
const TAROT_MINOR_RANKS = [
  'ace',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'page',
  'knight',
  'queen',
  'king',
] as const

const MAJOR_ARCANA = [
  ['the-fool', 'The Fool'],
  ['the-magician', 'The Magician'],
  ['the-high-priestess', 'The High Priestess'],
  ['the-empress', 'The Empress'],
  ['the-emperor', 'The Emperor'],
  ['the-hierophant', 'The Hierophant'],
  ['the-lovers', 'The Lovers'],
  ['the-chariot', 'The Chariot'],
  ['strength', 'Strength'],
  ['the-hermit', 'The Hermit'],
  ['wheel-of-fortune', 'Wheel of Fortune'],
  ['justice', 'Justice'],
  ['the-hanged-man', 'The Hanged Man'],
  ['death', 'Death'],
  ['temperance', 'Temperance'],
  ['the-devil', 'The Devil'],
  ['the-tower', 'The Tower'],
  ['the-star', 'The Star'],
  ['the-moon', 'The Moon'],
  ['the-sun', 'The Sun'],
  ['judgement', 'Judgement'],
  ['the-world', 'The World'],
] as const

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function freezeTags(tags: string[]): readonly string[] {
  return Object.freeze(tags)
}

function standardTags(
  suit: StandardSuit,
  rank: StandardRank,
): readonly string[] {
  const color = suit === 'diamonds' || suit === 'hearts' ? 'red' : 'black'
  const rankKind = ['jack', 'queen', 'king'].includes(rank)
    ? 'face'
    : rank === 'ace'
      ? 'ace'
      : 'number'

  return freezeTags([color, rankKind, suit])
}

function tarotMinorTags(
  suit: TarotSuit,
  rank: TarotMinorRank,
): readonly string[] {
  const rankKind = ['page', 'knight', 'queen', 'king'].includes(rank)
    ? 'court'
    : rank === 'ace'
      ? 'ace'
      : 'number'

  return freezeTags(['minor', rankKind, suit])
}

const STANDARD_DECK = Object.freeze(
  STANDARD_SUITS.flatMap((suit) =>
    STANDARD_RANKS.map((rank) =>
      Object.freeze<StandardCard>({
        id: `standard-52:${suit}:${rank}`,
        name: `${titleCase(rank)} of ${titleCase(suit)}`,
        deckType: 'standard-52',
        suit,
        rank,
        tags: standardTags(suit, rank),
      }),
    ),
  ),
)

const TAROT_DECK = Object.freeze<TarotCard[]>([
  ...MAJOR_ARCANA.map(([slug, name]) =>
    Object.freeze({
      id: `tarot:major:${slug}`,
      name,
      deckType: 'tarot' as const,
      arcana: 'major' as const,
      tags: freezeTags(['major']),
    }),
  ),
  ...TAROT_SUITS.flatMap((suit) =>
    TAROT_MINOR_RANKS.map((rank) =>
      Object.freeze({
        id: `tarot:minor:${suit}:${rank}`,
        name: `${titleCase(rank)} of ${titleCase(suit)}`,
        deckType: 'tarot' as const,
        arcana: 'minor' as const,
        suit,
        rank,
        tags: tarotMinorTags(suit, rank),
      }),
    ),
  ),
])

export function createStandardDeck(): readonly StandardCard[] {
  return STANDARD_DECK
}

export function createTarotDeck(): readonly TarotCard[] {
  return TAROT_DECK
}
