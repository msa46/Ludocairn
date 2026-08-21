# Structured Roles and Card Guide Design

**Date:** 2026-08-21  
**Status:** Proposed for user review  
**Project:** Ludocairn / Deckwright

## Purpose

Games such as social-deduction games treat roles as meaningful game concepts,
while physical cards are only a way to assign those roles. Ludocairn currently
stores Veilquorum roles as generic choice values and explains the card mapping
only inside prose. That is technically sufficient for tracking a session, but
it makes the most important setup information harder to scan and does not scale
well to games with larger role sets.

This increment makes roles first-class, optional game-definition data. It adds
an accessible at-a-glance role guide that answers four questions without
requiring the facilitator to reread the rules:

1. What is each role called?
2. What does the role do?
3. Which physical card represents it?
4. How many of that role are used for the current table size?

Cards remain physical markers. Ludocairn will not deal cards, secretly assign
roles, reveal private information, or enforce role behavior.

## Design principles

- **Role first, card second.** The tracker records `Echo`, `Drifter`, or
  `Wayfinder`; it never treats `heart` or `spade` as the player's role.
- **Optional capability.** Games without roles retain exactly their current
  meaning and interface.
- **Structured summary, complete prose.** The guide provides concise setup and
  reference information. The Markdown rules remain the authoritative place for
  complete behavior, timing, exceptions, and examples.
- **Physical-table friendly.** The guide is readable on narrow screens, in the
  session tracker, and in printed rules/tracker output.
- **No private automation.** The application helps a facilitator prepare and
  record a table but does not become a hidden-role dealer.

## Considered approaches

### Keep roles in prose and generic choices

This preserves the smallest schema, but every game must duplicate role names
between prose and tracker choices. The application cannot reliably show a role
legend or validate that tracker choices match the documented roles. This is
acceptable for simple games but weak for role-heavy games.

### Add a complete role assignment engine

This could calculate a deck, assign roles, and reveal them privately. It would
introduce hidden-state handling, secrecy expectations, dealing workflows, and
game-specific distribution rules before the project has evidence that those
features are needed. It is deliberately out of scope.

### Add structured roles and a read-only guide — selected

The selected approach captures role identity, concise purpose, optional team,
physical card marker, and table-size distribution. A semantic role field
references those definitions. The UI renders the same validated information in
rules, setup, tracker, and print contexts, without automating assignment.

## Game-definition model

Version 1 gains two optional top-level properties: `roles` and
`role_distributions`. Existing version 1 files remain valid and retain their
meaning, so a new schema version is not required.

### Roles

```yaml
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
```

Each role has:

- a unique stable `id` using the existing lowercase ID grammar;
- a non-empty human-readable `label`;
- an optional non-empty `team` label;
- a non-empty plain-text `summary`; and
- an optional `card` marker with a non-empty display `label` and a structured
  selector valid for the game's declared deck.

The card label is the concise text shown to people. The selector validates that
the marker can exist in the selected deck and preserves structured data for
future card-reference features. Selectors do not assign or reserve cards.

Role IDs and labels are game-local. Different games may use the same role ID
without implying shared behavior.

### Role distributions

```yaml
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
```

A distribution covers an inclusive player-count band. `counts` maps every role
ID to either a non-negative integer or the literal `remaining`. At most one role
may use `remaining` in a band. Fixed counts must not exceed the band's minimum
player count; a remaining count is derived from the table size after fixed
counts are subtracted. A band without `remaining` is valid only when it covers a
single player count and its fixed counts sum exactly to that count.

When distributions are present:

- `roles` is required and non-empty;
- the game must have a finite `players.max`;
- bands must be ordered, non-overlapping, and collectively cover every
  supported player count from `players.min` through `players.max` exactly once;
- each `counts` object must contain every role exactly once and no unknown role
  IDs; and
- every supported table size must yield a non-negative count.

Roles may exist without distributions. This supports games that explain roles
but let the facilitator choose a composition. Distributions may not exist
without roles.

### Semantic role player field

A new player-field variant references the game's role definitions:

```yaml
session:
  player_fields:
    - id: role
      label: Role
      type: role
      default: wayfinder
```

The field has `id`, `label`, `type: role`, and `default`. It does not repeat a
`choices` array. Its available values and display labels come from `roles`.
Parsing fails when the game has no roles or the default does not name one.

Role field values remain plain role-ID strings in stored and exported sessions.
Veilquorum's existing values (`wayfinder`, `drifter`, and `echo`) therefore
remain compatible when its field changes from generic `choice` to `role`.
Session storage versions do not change.

Generic choice fields remain unchanged for non-role concepts such as stance or
tone.

## User interface

### Shared role guide

A shared `RoleGuide` component consumes only a validated `GameDefinition` and
an optional current player count. It renders:

- the role label;
- optional team;
- card marker label, or `No fixed card` when omitted;
- concise purpose; and
- quantities for either all supported distribution bands or the applicable
  current band.

The guide uses semantic headings, definition content, and an accessible table
for distribution data. It does not rely on suit color alone. Card suits are
written as text, so grayscale printing and screen readers preserve the
meaning.

At narrow widths, role summaries stack as cards and distribution tables may
scroll within their own labeled region only if necessary. The document itself
must not require horizontal scrolling.

### Rules page

The guide appears after the rules actions and before the Markdown article. It
shows all role definitions and all supported distribution bands. The existing
rules remain complete and may repeat important explanations, but the structured
guide becomes the quickest setup reference.

The guide is included in `Print rules` output.

### Session setup

The guide appears before the player-name form. It shows all distributions
because the final number of named players may still be changing. This lets the
facilitator select the correct physical cards before creating the tracker.

### Session tracker

The guide appears in a compact `Role guide` section before round and player
controls. It receives the current session player count, displays the matching
distribution prominently, and derives the exact `remaining` quantity. Adding
or removing a player updates the applicable quantities immediately.

The guide is included in `Print tracker` output. It contains no edit controls
and does not modify the session.

### Role field control

The tracker renders a native select for `type: role`. Options use role labels
while values remain stable role IDs. This preserves keyboard and assistive
technology behavior and makes display text intentionally human-readable rather
than relying on ID humanization.

## Veilquorum content

Veilquorum becomes the first structured-role example. The current physical
mapping remains unchanged:

- one heart represents the Echo;
- one, two, or three spades represent Drifters according to table size; and
- the remaining clubs or diamonds represent Wayfinders.

The existing player-count bands remain 5–6, 7–9, and 10–12. The rules prose is
edited only to point readers to the role guide and to remove avoidable
duplication or ambiguity. Role behavior and objectives do not change.

Rillward Gambit and Sereinfolio do not gain roles. Their definitions and user
flows must remain unchanged, demonstrating that roles are optional.

## Parsing and diagnostics

The parser continues to reject unknown properties. New validation is split
into focused role, card-marker, distribution, and role-field parsers rather
than expanding one large function.

Diagnostics use the existing schema diagnostic family with precise paths, for
example:

- `roles.1.id` for a duplicate or invalid role ID;
- `roles.0.card.selector.suits` for a selector incompatible with the deck;
- `role_distributions.1.players` for an overlapping or missing band;
- `role_distributions.0.counts.unknown-role` for an unknown count key; and
- `session.player_fields.1.default` for an unknown role default.

No partially valid role guide is exposed. A bundled game with invalid role data
fails catalog loading through the existing diagnostic path.

## Compatibility and failure behavior

- Existing games without roles parse and render exactly as before.
- Existing Veilquorum sessions remain readable because stored role values and
  the game schema version remain unchanged.
- An imported session with a role ID absent from the current game is rejected
  by normal session validation.
- A current session outside the recommended player range still opens. The role
  guide shows that no published distribution applies and points the facilitator
  back to the supported range; it never deletes or rewrites player state.
- Missing optional card markers display `No fixed card` rather than an empty
  cell.

## Testing strategy

Implementation follows test-driven development.

### Parser and model tests

- Parse roles, teams, summaries, card labels, and deck-valid selectors.
- Reject unknown properties, invalid/duplicate role IDs, empty labels and
  summaries, incompatible selectors, and invalid role defaults.
- Reject missing, overlapping, unordered, or out-of-range distribution bands.
- Reject missing/unknown count keys, multiple `remaining` values, negative or
  non-integer counts, and impossible fixed totals.
- Prove games without roles retain their current normalized output.

### Session compatibility tests

- Prove the semantic role field accepts only configured role IDs.
- Restore an existing Veilquorum-shaped stored session without migration.
- Reject an imported session containing an unknown role ID.

### Component tests

- Rules show every Veilquorum role, card marker, purpose, and distribution band.
- Setup shows the guide before session creation.
- Tracker selects role labels while persisting IDs.
- Tracker quantities match the current player count and update after adding or
  removing a player.
- Rillward Gambit and Sereinfolio render without an empty role-guide region.
- Role guides remain present in both print contracts.

### Release verification

Run the complete `npm run ci` gate, build the static artifact, and manually
exercise Veilquorum rules, setup, tracker, refresh restoration, narrow layout,
keyboard operation, and both print actions in the production build. After
review, publish through the existing GitHub Pages workflow and verify the
repository-subpath deployment.

## Documentation

Update:

- `docs/game-format.md` with roles, distributions, card markers, and role fields;
- `docs/architecture.md` with the role model and UI data flow;
- `docs/roadmap.md` with the delivered capability and remaining automation
  boundary;
- `README.md` only where the public feature summary benefits from mentioning
  structured role guides; and
- Veilquorum rules so prose and structured data agree.

## Out of scope

- automatic dealing or random role assignment;
- private per-player reveal screens or links;
- remote multiplayer or facilitator/player synchronization;
- enforcement of role actions, victory conditions, or phase scripts;
- role-specific session fields beyond the existing generic tracker fields;
- card artwork, custom deck imagery, or suit icons that require an asset policy;
- importing role definitions independently of a game; and
- claiming compatibility with or bundling copyrighted expression from Mafia,
  Avalon, Blood on the Clocktower, or other commercial games.

Those games motivate the need for scalable role presentation, but Ludocairn's
built-in content remains original and separately rights-documented.

## Acceptance criteria

- Roles are validated first-class game data rather than duplicated generic
  choice values.
- Every configured role has a readable label, purpose, and optional team/card
  marker.
- Veilquorum shows a glanceable role/card guide and exact quantities for every
  supported player count.
- Rules, setup, tracker, rules print, and tracker print expose the same role
  information.
- Tracker role controls display labels and persist stable role IDs.
- Existing saved Veilquorum sessions restore without migration.
- Games without roles remain unchanged and display no empty guide.
- No automatic or private role assignment is introduced.
- All automated gates and production-browser release checks pass before
  publication.
