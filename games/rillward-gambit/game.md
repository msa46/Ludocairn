---
schema_version: 1
id: rillward-gambit
name: Rillward Gambit
summary: Bank a rising run or risk it on the next high-card crossing.
deck: standard-52
players:
  min: 2
  max: 8
session:
  round:
    enabled: true
    initial: 1
  player_fields:
    - id: score
      label: Score
      type: number
      default: 0
      step: 1
    - id: streak
      label: Streak
      type: number
      default: 0
      min: 0
      step: 1
    - id: stance
      label: Stance
      type: choice
      choices: [steady, bold, reset]
      default: steady
    - id: notes
      label: Notes
      type: text
      default: ""
      multiline: true
---

# Rillward Gambit

Rillward Gambit is a quick comparison game about deciding when a run is worth
protecting. Each crossing reveals one card per participating player. Winning
cards raise both score and streak, while the three stances determine how much
risk a player accepts before the cards appear.

The facilitator handles the deck and tracker so every choice and result stays
visible to the table.

## What you need

- Two to eight players and one facilitator.
- One standard 52-card deck without jokers.
- Space for a face-up discard pile.

## Card order

Cards compare by rank only. Ace is low, followed by two through ten, jack,
queen, and king. Suits never break a tie.

## Set up the crossing

1. Shuffle the complete deck and place it face down within the facilitator's
   reach.
2. Create a session with every player. Leave Score and Streak at zero, Stance
   at `steady`, and Notes empty.
3. Choose the game length: eight rounds for two to four players, or six rounds
   for five to eight players. Record that choice in the session notes.
4. Choose a first caller. The caller role moves one seat clockwise after every
   round and only determines the order in which stances are announced.

## A round

Resolve each round in this order.

### 1. Choose stances

Beginning with the caller and continuing clockwise, each player announces one
stance. The facilitator records it before the next player announces.

- **Steady:** take part in the comparison. An outright win scores one point.
  A loss or unresolved tie has no score penalty.
- **Bold:** take part in the comparison. An outright win scores two points. A
  loss or unresolved tie costs one point, even if that makes the score
  negative.
- **Reset:** sit out this comparison, add the current Streak to Score, and set
  Streak to zero. A reset player receives no card this round.

A stance cannot change after the first card is revealed.

### 2. Reveal the crossing

Deal one face-up card to every steady or bold player. Reveal the cards one at
a time in announcement order. If everyone reset, there is no comparison; move
directly to the end of the round.

The participating player with the highest rank is the provisional winner.

### 3. Resolve a tie

If exactly one player has the highest rank, that player wins the comparison.
If two or more players share the highest rank, only those tied leaders receive
one face-up breaker card. Compare the breaker ranks and repeat once if the new
highest rank is still tied.

After two breaker deals, a remaining tie is unresolved. Nobody wins that
comparison. Treat every participating player as not winning for score and
streak purposes.

Whenever the deck lacks enough cards for the next complete deal, leave any
cards already in the current comparison on the table, shuffle the discard pile
to form a new deck, and continue. If there is still no complete deal available,
the comparison is unresolved.

### 4. Update score and streak

Apply the chosen stance first:

- A steady winner adds one to Score.
- A bold winner adds two to Score.
- A bold player who did not win subtracts one from Score.
- A reset player has already banked their previous Streak and makes no further
  score change.

Then update Streak. An outright winner adds one to their current Streak. Every
other participating player sets Streak to zero. A reset player's Streak remains
zero.

The facilitator announces each change and records unusual rulings or a planned
next stance in that player's Notes.

### 5. Clear the table

Move every revealed card to the discard pile, advance the tracker by one
round, and move the caller marker clockwise. The displayed round identifies
the crossing about to begin, so do not advance it after the final scheduled
round.

## Ending the game

After the chosen number of rounds, the highest Score wins. If players share
the highest Score, the tied player with the higher Streak wins. If both values
are tied, deal one face-up card to each tied player with stances ignored.
Repeat among tied leaders until one player shows the highest rank.

## Facilitation notes

- Confirm every stance aloud before revealing cards.
- Keep score arithmetic public and correct the tracker before the next round.
- A card exposed early remains the player's card; finish recording all stances
  before revealing the rest.
- If a player leaves, keep their existing Score but exclude them from future
  rounds and final ranking. Note the departure in their Notes.
- Players may discuss likely cards and choices, but nobody may touch the deck
  or discard pile except the facilitator.
- Begin a new session for a rematch so the completed scores remain available
  for review.
