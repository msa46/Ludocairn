import { describe, expect, it } from 'vitest'

import { createStandardDeck, createTarotDeck } from './decks'
import { selectCards } from './select'

describe('selectCards', () => {
  it('uses OR within properties and AND between properties', () => {
    const result = selectCards(createStandardDeck(), {
      suits: ['hearts', 'diamonds'],
      ranks: ['queen', 'king'],
    })

    expect(result).toEqual({
      ok: true,
      cards: [
        expect.objectContaining({ id: 'standard-52:diamonds:queen' }),
        expect.objectContaining({ id: 'standard-52:diamonds:king' }),
        expect.objectContaining({ id: 'standard-52:hearts:queen' }),
        expect.objectContaining({ id: 'standard-52:hearts:king' }),
      ],
    })
  })

  it('selects by stable IDs and tags', () => {
    const byIds = selectCards(createStandardDeck(), {
      ids: ['standard-52:clubs:ace', 'standard-52:spades:king'],
    })
    const redCards = selectCards(createStandardDeck(), { tags: ['red'] })

    expect(byIds.ok && byIds.cards.map((card) => card.id)).toEqual([
      'standard-52:clubs:ace',
      'standard-52:spades:king',
    ])
    expect(redCards.ok && redCards.cards).toHaveLength(26)
  })

  it('selects tarot cards by arcana, suit, rank, and tags', () => {
    const majors = selectCards(createTarotDeck(), { arcana: ['major'] })
    const cupsCourt = selectCards(createTarotDeck(), {
      arcana: ['minor'],
      suits: ['cups'],
      ranks: ['page', 'king'],
      tags: ['court'],
    })

    expect(majors.ok && majors.cards).toHaveLength(22)
    expect(cupsCourt.ok && cupsCourt.cards.map((card) => card.id)).toEqual([
      'tarot:minor:cups:page',
      'tarot:minor:cups:king',
    ])
  })

  it('rejects an empty selector and empty properties', () => {
    expect(selectCards(createStandardDeck(), {})).toEqual({
      ok: false,
      diagnostic: {
        code: 'selector.empty',
        message: 'Select at least one card property.',
      },
    })
    expect(selectCards(createStandardDeck(), { suits: [] })).toMatchObject({
      ok: false,
      diagnostic: { code: 'selector.empty-property', property: 'suits' },
    })
  })

  it('rejects properties that do not apply to the selected deck', () => {
    expect(
      selectCards(createStandardDeck(), { arcana: ['major'] }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'selector.inapplicable-property',
        property: 'arcana',
      },
    })
  })

  it('rejects unknown selector values before filtering', () => {
    expect(
      selectCards(createStandardDeck(), { ranks: ['page'] }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'selector.unknown-value',
        property: 'ranks',
        value: 'page',
      },
    })
  })

  it('reports when valid properties have no matching card', () => {
    expect(
      selectCards(createTarotDeck(), {
        arcana: ['major'],
        suits: ['wands'],
      }),
    ).toEqual({
      ok: false,
      diagnostic: {
        code: 'selector.no-matches',
        message: 'No cards match this selector.',
      },
    })
  })
})
