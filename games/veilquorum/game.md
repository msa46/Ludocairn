---
schema_version: 1
id: veilquorum
name: Veilquorum
summary: Read the table, protect the quorum, and uncover the hidden Drifters.
deck: standard-52
players:
  min: 5
  max: 12
roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player each night.
    card:
      label: Heart
      selector:
        suits: [hearts]
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Works with the other Drifters to reduce the quorum.
    card:
      label: Any spade
      selector:
        suits: [spades]
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Discusses and signals to identify the Drifters.
    card:
      label: Any club or diamond
      selector:
        suits: [clubs, diamonds]
role_distributions:
  - players: { min: 5, max: 6 }
    counts:
      echo: 1
      drifter: 1
      wayfinder: remaining
  - players: { min: 7, max: 9 }
    counts:
      echo: 1
      drifter: 2
      wayfinder: remaining
  - players: { min: 10, max: 12 }
    counts:
      echo: 1
      drifter: 3
      wayfinder: remaining
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
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
      type: role
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

The application can shuffle and reveal roles privately on one shared device,
so physical cards are optional. It also tracks shared facilitator state.

## What you need

- Five to twelve players.
- One Game Master who is not entered as a player and receives no role.
- One shared device, or a standard deck with matching card backs if the group
  prefers physical role markers.
- A way for everyone to sit where the facilitator can identify them.

## Choose digital or physical roles

For digital roles, start a session, enter only the five to twelve players, and
leave the Game Master outside the named roster. Ludocairn creates the correct
role mix, shuffles it, and begins a pass-the-device reveal. Each player must
reveal, memorize, and hide their own role before passing the neutral screen to
the next player. After all reveals, the Game Master can open the separately
gated **Game Master assignments** view when the rules require a complete
overview.

The ordinary tracker does not show assigned role controls, and its roster is
locked after dealing. Exported session files contain the private assignments;
handle them as secret table material.

For physical roles, use the structured role guide shown with these rules. It
summarizes each role, its team, its purpose, its physical card marker, and the
correct counts for the group size. Choose cards by suit using the table below.

Rank does not matter.

| Players | Drifters | Echoes | Wayfinders |
| --- | ---: | ---: | ---: |
| 5–6 | 1 spade | 1 heart | All remaining cards are clubs or diamonds |
| 7–9 | 2 spades | 1 heart | All remaining cards are clubs or diamonds |
| 10–12 | 3 spades | 1 heart | All remaining cards are clubs or diamonds |

Shuffle exactly one card per player and deal them face down. Each player looks
at only their own card. Assign the Drifter role to each player holding a spade,
the Echo role to the player holding the heart, and the Wayfinder role to every
player holding a club or diamond. The cards are physical role markers; players
keep them hidden until the game ends.

With physical cards, create the tracker before dealing or open an older saved
session and record the corresponding role. With a digital deal, those role
values are recorded automatically and kept out of ordinary player cards.
Leave all players active, set every Signals value to zero, begin at Night, and
begin with round one.

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

- A player may not show a physical role card or private digital reveal before
  the game ends.
- Inactive players do not reveal roles and cannot communicate game information.
- The facilitator resolves unclear gestures neutrally and records private
  details in the clue field or shared notes.
- If a player must leave, mark them inactive and check the objectives; do not
  replace their role.
- For a shorter game, reveal the role of each player who becomes inactive. Use
  the same choice for the entire session.

## Closing the game

When an objective is met, announce the winning side and let everyone reveal
their physical cards or announce their digital assignments. Review the Game
Master view together only if the group wants to discuss how its reads changed.
Start a new session for a rematch so the previous facilitator notes and private
assignments remain intact.
