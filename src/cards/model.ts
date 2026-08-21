export type DeckType = 'standard-52' | 'tarot'

export type StandardSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export type StandardRank =
  | 'ace'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'jack'
  | 'queen'
  | 'king'

export type TarotArcana = 'major' | 'minor'

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles'

export type TarotMinorRank =
  | 'ace'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'page'
  | 'knight'
  | 'queen'
  | 'king'

interface BaseCard {
  readonly id: string
  readonly name: string
  readonly deckType: DeckType
  readonly tags: readonly string[]
}

export interface StandardCard extends BaseCard {
  readonly deckType: 'standard-52'
  readonly suit: StandardSuit
  readonly rank: StandardRank
}

export interface TarotMajorCard extends BaseCard {
  readonly deckType: 'tarot'
  readonly arcana: 'major'
}

export interface TarotMinorCard extends BaseCard {
  readonly deckType: 'tarot'
  readonly arcana: 'minor'
  readonly suit: TarotSuit
  readonly rank: TarotMinorRank
}

export type TarotCard = TarotMajorCard | TarotMinorCard
export type Card = StandardCard | TarotCard
