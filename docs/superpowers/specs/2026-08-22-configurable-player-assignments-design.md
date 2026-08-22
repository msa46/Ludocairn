# Configurable Player Assignments Design

**Date:** 2026-08-22  
**Status:** Approved for implementation planning  
**Project:** Ludocairn / Deckwright

## Purpose

Ludocairn already models structured roles, their physical card markers, and
player-count distributions. Those definitions currently provide public setup
guidance only: the facilitator must prepare physical cards, deal them, and
record roles manually. This increment lets an eligible game use the same role
definitions as a digital dealer.

The application will create one role assignment per named player, support a
private pass-the-phone reveal, and optionally give the separate, unnamed Game
Master a gated overview of every assignment. Visibility remains a per-game
policy. Games that do not opt in keep their current behavior.

## Product decisions

- The Game Master is a separate facilitator, not a player.
- The Game Master has no name, player record, or assignment.
- Digital assignment uses the existing `roles` and `role_distributions` as its
  authoritative inputs.
- Assignments are immutable after dealing. Player names may change, but the
  roster may not gain or lose players.
- Visibility protects against accidental disclosure and pass-the-phone
  shoulder surfing. It is not authentication or access control against a
  determined user with access to the device, browser storage, or an exported
  session file.
- Assignment-enabled sessions require a player count covered by a declared
  role distribution. The smaller practice-table exception remains available
  only for games without digital assignments.

## Considered approaches

### Extend structured roles with assignment policy — selected

An optional assignment policy activates digital dealing for the existing role
definitions and distributions. This keeps role labels, counts, stored IDs, and
guide content on one validated path. It adds only the private runtime state and
the views needed to reveal it.

### Add a parallel generic assignment-definition system

A second model could represent roles, cards, words, objectives, locations, and
other secrets independently of the current role model. That may become useful
after real games demonstrate multiple assignment kinds, but it would duplicate
the role and distribution concepts now and create unclear precedence between
the two systems.

### Treat an editable role player field as the assignment

The current role field already stores role IDs per player, but it is rendered
openly in the facilitator tracker and may be edited independently. Reusing it
would leak secrets, permit invalid distributions, and make the reveal flow
depend on a tracker control intended for shared state.

## Game-definition model

Version 1 gains one optional top-level property:

```yaml
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
```

The normalized `GameDefinition` contains either no assignment policy or:

```ts
interface AssignmentDefinition {
  readonly method: 'shuffle'
  readonly visibility: {
    readonly players: 'own' | 'all' | 'none'
    readonly gameMaster: 'all' | 'none'
  }
}
```

`method` is required and accepts only `shuffle`. Naming the method keeps the
format explicit without implementing unneeded dealing strategies.

`visibility.players` determines the player-facing presentation:

- `own`: each player receives a private pass-the-phone reveal of only their
  assignment;
- `all`: the player-facing assignment stage shows one public overview; or
- `none`: the application provides no player-facing assignment view.

`visibility.game_master` determines whether the separate facilitator may open
an all-assignments overview from the tracker. It accepts `all` or `none`.

An assignment policy is valid only when the game declares non-empty `roles`, a
finite player maximum, and complete `role_distributions` under the existing
distribution rules. Roles and role distributions remain valid without an
assignment policy and retain their current read-only-guide meaning.

Unknown assignment properties and unsupported enum values produce the same
structured parser diagnostics used elsewhere. Games that omit `assignments`
normalize without a policy and preserve their current behavior.

## Session model and dealing

An assignment is stored independently from editable player fields:

```ts
interface PlayerAssignment {
  readonly playerId: string
  readonly roleId: string
}
```

An assignment-enabled session contains exactly one assignment for every
player and no assignment for any other ID. Each `roleId` must reference a role
declared by the session's game. The assignment multiset must exactly match the
resolved role distribution for the session's player count.

Session creation performs these steps in the domain layer:

1. Validate that the named-player count is covered by the game's player range
   and a role distribution.
2. Resolve fixed and `remaining` role quantities using the existing role-count
   resolver.
3. Expand those quantities into a role-ID pool.
4. Shuffle that pool with an injected randomness source.
5. Pair the shuffled IDs with players in roster order.

The production application supplies browser randomness. Tests supply a
deterministic source so they can assert exact results without mocking the
assignment engine.

The session storage version remains `1`. `assignments` is an optional additive
property: old stored sessions and games without assignment policy retain their
meaning. Validation applies these compatibility rules:

- a game without assignment policy accepts only a missing assignment list;
- an assignment-enabled game accepts a missing list on an older session, so
  existing user data remains recoverable;
- a newly created assignment-enabled session must contain a complete valid
  list; and
- when an assignment list is present, storage load, file import, and every
  subsequent save validate its player references, role references, uniqueness,
  and distribution counts.

An older assignment-enabled session with no assignment list opens normally but
does not invent secret state during validation. The tracker offers an explicit
`Deal digital roles` action when its current roster has a supported count.
Dealing is a user action and immediately persists the result.

Once assignments exist, `addPlayer` and `removePlayer` return a structured
diagnostic explaining that a dealt roster is locked. `renamePlayer` remains
valid because assignments refer to stable player IDs. This increment does not
provide re-dealing, partial replacement, or assignment editing.

Exports include assignments and therefore receive explicit private-material
copy. Imports validate assignments before preview or persistence. The import
preview does not display role values.

## User experience

### Session setup

Games without assignment policy keep the current setup experience.

For an assignment-enabled game, setup explains that roles will be dealt
digitally and that the Game Master is not a named player. The form requires a
supported number of non-blank player names before session creation. Its
validation message states the allowed player range rather than silently
creating an undealable practice table.

Creating the session deals assignments immediately. The next view depends on
player visibility.

### Private pass-the-phone reveal (`players: own`)

The reveal stage is transient interface state; reveal progress is not stored
in the session. Reloading or reopening the reveal stage begins at the first
player without changing the deal.

For each rostered player, the stage has three explicit states:

1. **Handoff:** a neutral screen says `Pass the device to <name>` and contains
   no role label, summary, team, or neighboring assignment in the DOM.
2. **Revealed:** after a deliberate reveal action, the screen shows only that
   player's role label, optional team, and summary.
3. **Hidden:** the player hides the role, returning the screen to neutral
   before advancing to the next player.

The final confirmation opens the normal tracker. Back navigation never exposes
the preceding player's role. Controls use semantic buttons, visible focus, and
live-region messaging only where it improves orientation without announcing a
secret unexpectedly.

### Public assignment stage (`players: all`)

After creation, the application shows a labeled table of all player-to-role
assignments and an explicit action to continue to the tracker. This view is not
described as private.

### No player view (`players: none`)

After creation, the application opens the tracker directly. No player reveal
or public assignment control appears.

### Game Master overview

When `game_master: all` and complete assignments exist, the tracker contains a
`Game Master assignments` control. Opening it first shows a spoiler warning and
requires explicit confirmation. Only confirmation mounts the player-to-role
table. Closing the overview unmounts all role values and returns to the
tracker. The confirmation is required every time the overview is opened.

When `game_master: none`, the tracker has no Game Master overview. Player
visibility does not grant the Game Master an additional view.

### Shared tracker

Secret assignments do not appear in ordinary player cards, print output, or
the existing role guide. When an assignment-enabled game retains a role player
field for saved-session compatibility, creating or explicitly dealing a
session mirrors the assigned role ID into that field. The tracker suppresses
that role control whenever complete digital assignments exist, while an older
session without digital assignments retains its existing editable field.

The add/remove-player interface is hidden or disabled with explanatory text
after assignments have been dealt. Renaming remains available.

## Application boundaries

- `src/games` owns assignment-policy types, parsing, normalization, and
  cross-validation with roles and distributions.
- A focused assignment domain owns role-pool expansion, shuffling, and
  assignment validation. It depends on normalized game data and stable player
  IDs, not React or browser storage.
- `src/sessions` owns persisted assignment state, session lifecycle
  transformations, roster locking, and diagnostics.
- React owns transient reveal position, hidden/revealed presentation, spoiler
  gates, and routing between reveal and tracker views.
- Storage and session-file adapters continue serializing the validated session
  object without a second secret store.

No server, account, Game Master identity, password, PIN, or cryptographic
secrecy boundary is introduced.

## Error handling

- Invalid assignment configuration fails game parsing with a stable diagnostic
  and precise YAML path.
- Unsupported player counts fail session creation before IDs, assignments, or
  storage writes are committed.
- An injected randomness source that returns a value outside `[0, 1)` causes a
  domain diagnostic rather than a biased or partial deal.
- Missing, duplicate, unknown-player, unknown-role, and wrong-count persisted
  assignments fail validation non-destructively.
- An older session without assignments remains openable and can be dealt only
  through the explicit tracker action.
- Reveal and Game Master views do not mutate assignment data.

## Testing strategy

Domain tests will prove:

- assignment-policy parsing, normalization, unknown-property rejection, enum
  validation, and the requirement for complete role distributions;
- exact pool expansion for fixed and `remaining` counts;
- deterministic Fisher-Yates shuffling through injected randomness;
- one assignment per player, exact distribution counts, and no Game Master
  assignment;
- session-creation rejection outside supported player counts;
- roster locking after dealing and safe player renaming;
- validation of missing, duplicate, unknown, and distribution-incompatible
  stored assignments; and
- import/export round trips without exposing role values in import preview.

Component tests will exercise real views and assert:

- a role is absent from the handoff DOM, present only after reveal, and absent
  again before advancing;
- each player sees only their own assignment in `own` mode;
- `all` mode shows the public overview and `none` mode skips player reveals;
- the Game Master table is absent before confirmation, visible afterward,
  unmounted on close, and unavailable when configured as `none`;
- ordinary tracker cards and print-oriented markup do not expose assignments;
- assignment-enabled setup enforces the supported count; and
- games without assignment policy retain current setup and tracker behavior.

The full release gate remains `npm run ci`.

## Documentation and example game

`docs/game-format.md` will document the new optional block, compatibility
rules, visibility semantics, and private-export warning. `docs/architecture.md`
will replace the current statement that roles are never assigned with the new
opt-in assignment flow and its privacy boundary. README and roadmap material
will summarize the capability.

Veilquorum will opt in with private player reveals and full Game Master
visibility:

```yaml
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
```

Its rules will state that the application can replace physical role cards,
that the facilitator is not a player, and that exported sessions contain
private assignments. Its existing role player field remains in the definition
so saved sessions retain their recorded values. New digital deals mirror each
assignment into that field, and the ordinary tracker suppresses the field once
complete assignments exist. Older sessions without assignments continue to
show their recorded role field and may opt into a fresh digital deal; the
application never overwrites those values merely because the session was
loaded.

## Out of scope

- A named or playing Game Master
- Multiple Game Masters
- Authentication, PINs, or permissions resistant to device inspection
- Re-dealing, swapping, replacing, or manually editing assignments
- Reveal-on-death or timed/round-based reveals
- Multiple simultaneous assignment types
- Remote multiplayer or synchronized devices
- Game-rule execution based on assigned roles
