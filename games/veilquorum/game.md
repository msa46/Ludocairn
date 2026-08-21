---
schema_version: 1
id: veilquorum
name: Veilquorum
summary: Read the table, protect the quorum, and uncover the hidden Drifters.
deck: standard-52
players:
  min: 5
  max: 12
session:
  phases:
    - id: night
      label: Night
    - id: day
      label: Day
  initial_phase: night
  round:
    enabled: true
    initial: 1
  player_fields:
    - id: active
      label: Active
      type: boolean
      default: true
    - id: role
      label: Role
      type: choice
      choices: [wayfinder, drifter, echo]
      default: wayfinder
    - id: signals
      label: Signals
      type: number
      default: 0
      min: 0
      step: 1
    - id: clue
      label: Private clue
      type: text
      default: ""
      multiline: true
---

# Veilquorum

Veilquorum is a facilitator-led game of observation, persuasion, and hidden
allegiances. The Wayfinders are trying to keep a working quorum. The Drifters
quietly thin that quorum from within. One Echo can test a suspicion each night,
but must decide how much to reveal during the day.

The application tracks shared facilitator state. Players still receive their
roles privately from physical cards.

## What you need

- Five to twelve players.
- One facilitator who does not hold a role card.
- A standard deck with matching card backs.
- A way for everyone to sit where the facilitator can identify them.

## Prepare the role cards

Choose cards with the following suits. Rank does not matter.

| Players | Drifters | Echoes | Wayfinders |
| --- | ---: | ---: | ---: |
| 5–6 | 1 spade | 1 heart | All remaining cards are clubs or diamonds |
| 7–9 | 2 spades | 1 heart | All remaining cards are clubs or diamonds |
| 10–12 | 3 spades | 1 heart | All remaining cards are clubs or diamonds |

Shuffle exactly one card per player and deal them face down. Each player looks
at only their own card. A spade is a Drifter, the heart is the Echo, and every
club or diamond is a Wayfinder. Players keep their cards hidden until the game
ends.

In the tracker, add every player and record the corresponding role. Leave all
players active, set every Signals value to zero, begin at Night, and begin with
round one.

## Objectives

- The Wayfinders and Echo win when no active Drifter remains.
- The Drifters win when the number of active Drifters is at least the number of
  all other active players combined.
- The Echo shares the Wayfinders' objective.

Check these conditions after every player becomes inactive. If neither side
has won, continue the current round.

## Night

1. The facilitator asks every player to close their eyes and remain silent.
2. The facilitator asks the Drifters to open their eyes. The Drifters silently
   agree on one active non-Drifter by pointing. If they do not agree within one
   minute, nobody is removed by the Drifters that night.
3. The Drifters close their eyes.
4. The Echo opens their eyes and points to one active player. The facilitator
   silently indicates yes if that player is a Drifter and no otherwise.
5. The Echo closes their eyes. The facilitator asks everyone to open their
   eyes.
6. If the Drifters agreed, the facilitator marks their chosen player inactive.
   Do not reveal that player's card or recorded role.

Move the tracker to Day. Check the objectives before discussion begins.

## Day

The active players have up to five minutes to discuss what they noticed and
what they believe. Inactive players listen but do not speak, gesture, or vote.
The Echo may share, soften, or withhold their private result; no player is
required to prove a role.

After discussion, every active player names one other active player to receive
a Signal. The facilitator records the Signals as the names are spoken. The
player with the most Signals becomes inactive.

If two or more players tie for the most Signals, each tied player may make one
brief statement. The other active players then Signal only among the tied
players. If the second count is also tied, nobody becomes inactive during the
day.

After resolving the count:

1. Check the objectives.
2. Reset every Signals value to zero.
3. Advance the round by one.
4. Move the tracker to Night.

## Table rules

- A player may not show a role card before the game ends.
- Inactive players do not reveal roles and cannot communicate game information.
- The facilitator resolves unclear gestures neutrally and records private
  details in the clue field or shared notes.
- If a player must leave, mark them inactive and check the objectives; do not
  replace their role.
- For a shorter game, reveal the role of each player who becomes inactive. Use
  the same choice for the entire session.

## Closing the game

When an objective is met, announce the winning side and let everyone reveal
their cards. Review the tracker together only if the group wants to discuss
how its reads changed. Start a new session for a rematch so the previous
facilitator notes remain intact.

