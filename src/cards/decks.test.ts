import { describe, expect, it } from 'vitest'

import { createStandardDeck, createTarotDeck } from './decks'

describe('canonical card decks', () => {
  it('creates 52 unique standard cards across four suits and thirteen ranks', () => {
    const deck = createStandardDeck()

    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((card) => card.id))).toHaveProperty('size', 52)
    expect(new Set(deck.map((card) => card.suit))).toEqual(
      new Set(['clubs', 'diamonds', 'hearts', 'spades']),
    )
    expect(new Set(deck.map((card) => card.rank))).toHaveProperty('size', 13)
    expect(deck[0]).toMatchObject({
      id: 'standard-52:clubs:ace',
      name: 'Ace of Clubs',
      deckType: 'standard-52',
      suit: 'clubs',
      rank: 'ace',
    })
  })

  it('creates 22 major and 56 minor tarot cards with unique stable IDs', () => {
    const deck = createTarotDeck()
    const majors = deck.filter((card) => card.arcana === 'major')
    const minors = deck.filter((card) => card.arcana === 'minor')

    expect(deck).toHaveLength(78)
    expect(new Set(deck.map((card) => card.id))).toHaveProperty('size', 78)
    expect(majors).toHaveLength(22)
    expect(minors).toHaveLength(56)
    expect(majors[0]).toMatchObject({
      id: 'tarot:major:the-fool',
      name: 'The Fool',
      deckType: 'tarot',
      arcana: 'major',
    })
    expect(minors[0]).toMatchObject({
      id: 'tarot:minor:wands:ace',
      name: 'Ace of Wands',
      deckType: 'tarot',
      arcana: 'minor',
      suit: 'wands',
      rank: 'ace',
    })
  })

  it('returns deeply frozen card records and deck arrays', () => {
    const standard = createStandardDeck()
    const tarot = createTarotDeck()

    expect(Object.isFrozen(standard)).toBe(true)
    expect(Object.isFrozen(standard[0])).toBe(true)
    expect(Object.isFrozen(standard[0]?.tags)).toBe(true)
    expect(Object.isFrozen(tarot)).toBe(true)
    expect(Object.isFrozen(tarot[0])).toBe(true)
    expect(Object.isFrozen(tarot[0]?.tags)).toBe(true)
  })
})
