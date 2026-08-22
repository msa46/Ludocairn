# Configurable Player Assignments Implementation Plan

**Status:** Implemented; live release verification pending.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-game digital role dealing, private pass-the-phone reveals, and an optional gated Game Master overview without changing games that do not opt in.

**Architecture:** Extend normalized game definitions with an optional assignment policy, then use a focused pure assignment domain to expand and shuffle existing role distributions. Persist immutable player-to-role assignments inside version-1 sessions, coordinate transient reveal state in React, and keep parser, session, storage, and UI boundaries consistent with the existing architecture.

**Tech Stack:** React 19, TypeScript 6, Vite 8, YAML, Vitest, Testing Library, browser `localStorage`

**Spec:** `docs/superpowers/specs/2026-08-22-configurable-player-assignments-design.md`

## Global Constraints

- The Game Master is a separate unnamed facilitator and never receives a player record or assignment.
- Games without an `assignments` block retain identical parsing, setup, tracker, storage, and export behavior.
- Digital assignments use existing `roles` and complete `role_distributions`; no second authoring model is introduced.
- Player visibility is exactly `own`, `all`, or `none`; Game Master visibility is exactly `all` or `none`.
- Assignments are immutable after dealing; renaming is allowed, while adding, removing, or editing assigned role fields is rejected.
- Hidden roles must not exist in the rendered DOM during handoff, after hiding, in ordinary tracker cards, or in import previews.
- Session `storageVersion` and game `schemaVersion` remain `1`; missing assignments stay valid for older sessions.
- No server, account, PIN, authentication, remote synchronization, re-deal, role swap, or rule automation is added.
- Every behavior change follows red-green-refactor and the release gate remains `npm run ci`.

---

## File map

- `src/games/model.ts`: normalized assignment-policy types.
- `src/games/parse.ts`: YAML parsing and cross-validation against roles and distributions.
- `src/games/parse.test.ts`: parser behavior and compatibility cases.
- `src/assignments/model.ts`: assignment-domain result and randomness contracts.
- `src/assignments/deal.ts`: pool expansion, Fisher-Yates shuffle, and persisted-assignment validation.
- `src/assignments/deal.test.ts`: deterministic dealing and validation behavior.
- `src/sessions/model.ts`: persisted player-assignment shape and new diagnostics.
- `src/sessions/operations.ts`: creation-time dealing, explicit legacy-session dealing, role mirroring, and roster locks.
- `src/sessions/operations.test.ts`: session lifecycle and immutability behavior.
- `src/sessions/validate.ts`: untrusted persisted assignment validation.
- `src/sessions/validate.test.ts`: malformed assignment records and compatibility.
- `src/files/session-files.test.ts`: assignment export round-trip and non-sensitive import preview.
- `src/app/components/PlayerAssignmentView.tsx`: private handoff/reveal flow and public overview.
- `src/app/components/PlayerAssignmentView.test.tsx`: DOM secrecy and visibility behavior.
- `src/app/components/AssignmentTable.tsx`: shared semantic player-to-role table used only after authorization.
- `src/app/components/GameMasterAssignments.tsx`: spoiler gate and unmount-on-close behavior.
- `src/app/components/GameMasterAssignments.test.tsx`: Game Master authorization boundary.
- `src/app/components/SessionSetup.tsx`: digital-deal explanation and supported-count guidance.
- `src/app/components/TrackerView.tsx`: deal action for old sessions, GM entry point, roster lock UI, role-field suppression, and export warning.
- `src/app/App.tsx`: randomness injection, assignment-stage navigation, and deal mutation wiring.
- `src/app/App.test.tsx`: creation-to-reveal-to-tracker integration and no-policy regression coverage.
- `src/app/ImportSession.test.tsx`: imported assignments remain absent from preview and appear only behind the correct gate.
- `src/styles/global.css`: narrow-screen reveal, overview, gate, and locked-roster styles.
- `games/veilquorum/game.md`: opt-in example and digital/physical setup rules.
- `docs/game-format.md`: authoring contract and compatibility semantics.
- `docs/architecture.md`: assignment data flow and privacy boundary.
- `README.md`: user-facing capability summary and private-export warning.
- `docs/roadmap.md`: delivered increment record.

---

### Task 1: Parse an optional per-game assignment policy

**Files:**
- Modify: `src/games/model.ts`
- Modify: `src/games/parse.ts`
- Test: `src/games/parse.test.ts`

**Interfaces:**
- Consumes: existing `RoleDefinition[]` and `RoleDistribution[]` normalized by `parseGameSource`.
- Produces: `AssignmentDefinition` and optional `GameDefinition.assignments`.

- [x] **Step 1: Add a failing parser test for a valid assignment policy**

Insert this block in the `validSource` fixture after `role_distributions` and assert the normalized camel-case result:

```yaml
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
```

```ts
expect(result).toMatchObject({
  ok: true,
  game: {
    assignments: {
      method: 'shuffle',
      visibility: { players: 'own', gameMaster: 'all' },
    },
  },
})
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/games/parse.test.ts`

Expected: FAIL because `assignments` is currently an unknown top-level property.

- [x] **Step 3: Add failing table cases for every invalid branch**

Add literal cases that expect the shown paths:

```ts
it.each([
  ['unknown method', 'shuffle', 'ordered', 'assignments.method'],
  ['unknown player visibility', 'players: own', 'players: team', 'assignments.visibility.players'],
  ['unknown GM visibility', 'game_master: all', 'game_master: own', 'assignments.visibility.game_master'],
  ['unknown assignment property', 'method: shuffle', 'method: shuffle\n  extra: true', 'assignments.extra'],
  ['unknown visibility property', 'players: own', 'players: own\n    extra: true', 'assignments.visibility.extra'],
])('%s is rejected', (_name, search, replacement, path) => {
  expect(parseGameSource(replaceOnce(search, replacement), 'broken/game.md')).toMatchObject({
    ok: false,
    diagnostics: [{ path }],
  })
})
```

Also add separate sources proving `assignments` is rejected when roles are absent or `role_distributions` is absent.

- [x] **Step 4: Implement the normalized model and parser**

Add to `src/games/model.ts`:

```ts
export type PlayerAssignmentVisibility = 'own' | 'all' | 'none'
export type GameMasterAssignmentVisibility = 'all' | 'none'

export interface AssignmentDefinition {
  readonly method: 'shuffle'
  readonly visibility: {
    readonly players: PlayerAssignmentVisibility
    readonly gameMaster: GameMasterAssignmentVisibility
  }
}
```

Add `readonly assignments?: AssignmentDefinition` to `GameDefinition`. In `parse.ts`, allow the top-level `assignments` key and add `parseAssignments(value, roles, roleDistributions, source)`. It must reject unknown keys, require `method === 'shuffle'`, validate both visibility enums, and reject opt-in unless roles and distributions are non-empty. Normalize `game_master` to `gameMaster`.

- [x] **Step 5: Run parser and catalog tests and verify GREEN**

Run: `npm test -- src/games/parse.test.ts src/games/catalog.test.ts`

Expected: PASS with old fixtures omitting `assignments` and the new fixture normalizing it.

- [x] **Step 6: Commit the parser increment**

```bash
git add src/games/model.ts src/games/parse.ts src/games/parse.test.ts
git commit -m "feat: parse assignment visibility policy"
```

---

### Task 2: Build and validate deterministic role deals

**Files:**
- Create: `src/assignments/model.ts`
- Create: `src/assignments/deal.ts`
- Create: `src/assignments/deal.test.ts`
- Modify: `src/sessions/model.ts`

**Interfaces:**
- Consumes: `resolveRoleCounts(game, playerCount)` and stable player IDs.
- Produces: `dealPlayerAssignments(game, playerIds, random)` and `validatePlayerAssignments(game, playerIds, value)`.

- [x] **Step 1: Define the persisted and domain contracts in tests**

Use these exact shapes in `deal.test.ts`:

```ts
const playerIds = ['player-1', 'player-2', 'player-3', 'player-4']

const dealt = dealPlayerAssignments(game, playerIds, () => 0)

expect(dealt).toEqual({
  ok: true,
  assignments: [
    { playerId: 'player-1', roleId: 'drifter' },
    { playerId: 'player-2', roleId: 'wayfinder' },
    { playerId: 'player-3', roleId: 'wayfinder' },
    { playerId: 'player-4', roleId: 'echo' },
  ],
})
```

The fixture distribution must be `{ echo: 1, drifter: 1, wayfinder: remaining }`. Derive the expected order by hand from an in-place Fisher-Yates shuffle whose random value is always zero.

- [x] **Step 2: Run the new test and verify RED**

Run: `npm test -- src/assignments/deal.test.ts`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Add failing tests for deal failures and validator mutations**

Cover these observable cases with literal expectations:

```ts
expect(dealPlayerAssignments(game, ['player-1'], () => 0)).toMatchObject({
  ok: false,
  diagnostic: { code: 'assignment.unsupported-player-count' },
})

expect(dealPlayerAssignments(game, playerIds, () => 1)).toMatchObject({
  ok: false,
  diagnostic: { code: 'assignment.invalid-random' },
})
```

For `validatePlayerAssignments`, mutate one valid literal fixture at a time to prove rejection of a non-array value, missing player, duplicate player, unknown player, unknown role, and wrong role multiset. Assert the exact diagnostic code and path for each.

- [x] **Step 4: Implement minimal assignment types and Fisher-Yates dealing**

Add to `src/sessions/model.ts`:

```ts
export interface PlayerAssignment {
  readonly playerId: string
  readonly roleId: string
}
```

Add to `src/assignments/model.ts`:

```ts
export type RandomSource = () => number

export interface AssignmentDiagnostic {
  readonly code:
    | 'assignment.invalid-random'
    | 'assignment.invalid-record'
    | 'assignment.unknown-player'
    | 'assignment.unknown-role'
    | 'assignment.duplicate-player'
    | 'assignment.incorrect-distribution'
    | 'assignment.unsupported-player-count'
  readonly message: string
  readonly path?: string
}
```

Implement `dealPlayerAssignments` by expanding `resolveRoleCounts`, then applying:

```ts
for (let index = pool.length - 1; index > 0; index -= 1) {
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) return failure(...)
  const swapIndex = Math.floor(sample * (index + 1))
  ;[pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!]
}
```

Implement `validatePlayerAssignments` without calling the dealer. Validate the untrusted structure, then compare hand-counted actual role totals with literal totals produced by `resolveRoleCounts`.

- [x] **Step 5: Run the assignment tests and verify GREEN**

Run: `npm test -- src/assignments/deal.test.ts src/games/roles.test.ts`

Expected: PASS.

- [x] **Step 6: Commit the pure domain increment**

```bash
git add src/assignments src/sessions/model.ts
git commit -m "feat: deal and validate player assignments"
```

---

### Task 3: Integrate immutable assignments into session lifecycle

**Files:**
- Modify: `src/sessions/model.ts`
- Modify: `src/sessions/operations.ts`
- Modify: `src/sessions/operations.test.ts`

**Interfaces:**
- Consumes: `dealPlayerAssignments`, `RandomSource`, `GameDefinition.assignments`.
- Produces: optional `Session.assignments`, assignment-aware `createSession`, and `dealSessionAssignments`.

- [x] **Step 1: Add a failing creation test for an exact digital deal**

Create an assignment-enabled fixture with four players and call:

```ts
const result = createSession(
  assignmentGame,
  { name: 'Friday table', playerNames: ['Ari', 'Bea', 'Cy', 'Dee'] },
  clock('2026-08-22T12:00:00.000Z'),
  ids('session-1', 'player-1', 'player-2', 'player-3', 'player-4'),
  () => 0,
)

expect(result).toMatchObject({
  ok: true,
  session: {
    assignments: [
      { playerId: 'player-1', roleId: 'drifter' },
      { playerId: 'player-2', roleId: 'wayfinder' },
      { playerId: 'player-3', roleId: 'wayfinder' },
      { playerId: 'player-4', roleId: 'echo' },
    ],
  },
})
```

Also assert each player's `type: role` field mirrors their assigned `roleId`.

- [x] **Step 2: Run the focused session test and verify RED**

Run: `npm test -- src/sessions/operations.test.ts`

Expected: FAIL because `createSession` neither accepts randomness nor stores assignments.

- [x] **Step 3: Add failing session invariants**

Add tests proving:

```ts
expect(createSession(assignmentGame, tooFewPlayers, fixedClock, fixedIds, () => 0)).toMatchObject({
  ok: false,
  diagnostic: { code: 'session.unsupported-player-count' },
})

expect(addPlayer(dealtSession, assignmentGame, 'Eli', fixedClock, fixedIds)).toMatchObject({
  ok: false,
  diagnostic: { code: 'session.roster-locked' },
})

expect(removePlayer(dealtSession, 'player-1', fixedClock)).toMatchObject({
  ok: false,
  diagnostic: { code: 'session.roster-locked' },
})

expect(updatePlayerField(dealtSession, assignmentGame, 'player-1', 'role', 'echo', fixedClock)).toMatchObject({
  ok: false,
  diagnostic: { code: 'session.assignment-locked' },
})
```

Prove `renamePlayer` preserves assignment player IDs, and prove `dealSessionAssignments` adds assignments to an old assignment-enabled session only when explicitly invoked.

- [x] **Step 4: Implement assignment-aware session operations**

Extend `Session`:

```ts
readonly assignments?: readonly PlayerAssignment[]
```

Extend `SessionDiagnostic['code']` with:

```ts
| 'session.assignment-locked'
| 'session.invalid-assignments'
| 'session.roster-locked'
| 'session.unsupported-player-count'
```

Add a final optional `random: RandomSource = Math.random` argument to `createSession`. Validate all names and the supported count before consuming IDs. When assignment policy is present, deal after players are built, mirror every declared role field from the player assignment, and attach `assignments`.

Add:

```ts
export function dealSessionAssignments(
  session: Session,
  game: GameDefinition,
  random: RandomSource,
  clock: Clock,
): SessionResult
```

Reject it when the game has no policy or assignments already exist. Lock add/remove and role-field edits whenever `session.assignments` is present.

- [x] **Step 5: Run session tests and verify GREEN**

Run: `npm test -- src/sessions/operations.test.ts`

Expected: PASS, including all pre-existing session operations for games without a policy.

- [x] **Step 6: Commit the session lifecycle increment**

```bash
git add src/sessions/model.ts src/sessions/operations.ts src/sessions/operations.test.ts
git commit -m "feat: persist immutable session assignments"
```

---

### Task 4: Validate storage and file boundaries without leaking previews

**Files:**
- Modify: `src/sessions/validate.ts`
- Modify: `src/sessions/validate.test.ts`
- Modify: `src/files/session-files.test.ts`
- Modify: `src/app/ImportSession.test.tsx`

**Interfaces:**
- Consumes: `validatePlayerAssignments` and optional untrusted `Session.assignments`.
- Produces: validated version-1 sessions that preserve assignments through local storage and JSON files.

- [x] **Step 1: Add failing validation tests for valid, missing, and malformed assignment data**

Assert a valid assignment list returns unchanged and a missing list stays valid for an assignment-enabled game:

```ts
expect(validateSession({ ...validSession, assignments: validAssignments }, assignmentGame)).toEqual({
  ok: true,
  session: { ...validSession, assignments: validAssignments },
})

expect(validateSession(validSession, assignmentGame)).toEqual({
  ok: true,
  session: validSession,
})
```

Add one mutation test per assignment-domain diagnostic and assert it is wrapped as `session.invalid-assignments` with the assignment path preserved.

- [x] **Step 2: Run validation tests and verify RED**

Run: `npm test -- src/sessions/validate.test.ts`

Expected: FAIL because assignment records are currently accepted by an unchecked cast.

- [x] **Step 3: Implement validation at the untrusted boundary**

In `validateSession`, after players and fields are validated:

```ts
if (value.assignments !== undefined) {
  if (!game.assignments) {
    return failure('session.invalid-assignments', 'This game does not define digital assignments.', 'assignments')
  }
  const assignments = validatePlayerAssignments(
    game,
    value.players.map((player) => (player as { id: string }).id),
    value.assignments,
  )
  if (!assignments.ok) {
    return failure(
      'session.invalid-assignments',
      assignments.diagnostic.message,
      assignments.diagnostic.path ?? 'assignments',
    )
  }
}
```

Also verify every declared role field equals the assignment for the same player whenever assignments exist.

- [x] **Step 4: Add and run file round-trip and preview secrecy tests**

Add a session with assignments to `session-files.test.ts` and assert:

```ts
expect(parseSessionFile(serializeSession(assignedSession), resolveGame)).toMatchObject({
  ok: true,
  session: { assignments: assignedSession.assignments },
  preview: { sessionName: assignedSession.name, playerCount: 4 },
})
expect(Object.values(result.preview)).not.toContain('Drifter')
expect(Object.values(result.preview)).not.toContain('drifter')
```

In `ImportSession.test.tsx`, upload the assigned session and assert the review region contains neither role IDs nor labels.

Run: `npm test -- src/files/session-files.test.ts src/app/ImportSession.test.tsx`

Expected: PASS after validation is connected; no production import-preview changes should be needed because the existing preview is already allow-listed.

- [x] **Step 5: Run repository persistence regressions and verify GREEN**

Run: `npm test -- src/sessions/validate.test.ts src/storage/repository.test.ts src/files/session-files.test.ts src/app/ImportSession.test.tsx`

Expected: PASS.

- [x] **Step 6: Commit the persistence boundary increment**

```bash
git add src/sessions/validate.ts src/sessions/validate.test.ts src/files/session-files.test.ts src/app/ImportSession.test.tsx
git commit -m "feat: validate assignments across session files"
```

---

### Task 5: Add private and public player assignment stages

**Files:**
- Create: `src/app/components/AssignmentTable.tsx`
- Create: `src/app/components/PlayerAssignmentView.tsx`
- Create: `src/app/components/PlayerAssignmentView.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: complete `Session.assignments`, `GameDefinition.roles`, and `game.assignments.visibility.players`.
- Produces: `PlayerAssignmentView({ game, session, onComplete })` and shared `AssignmentTable`.

- [x] **Step 1: Add a failing component test for DOM secrecy**

Render `PlayerAssignmentView` in `own` mode with Alice assigned Echo and Bob assigned Drifter. Assert this exact sequence:

```ts
expect(screen.getByRole('heading', { name: 'Pass the device to Alice' })).toBeInTheDocument()
expect(screen.queryByText('Echo')).not.toBeInTheDocument()
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: 'Reveal Alice’s assignment' }))
expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: 'Hide assignment' }))
expect(screen.queryByText('Echo')).not.toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: 'Ready for Bob' }))
expect(screen.getByRole('heading', { name: 'Pass the device to Bob' })).toBeInTheDocument()
expect(screen.queryByText('Echo')).not.toBeInTheDocument()
```

- [x] **Step 2: Run the new component test and verify RED**

Run: `npm test -- src/app/components/PlayerAssignmentView.test.tsx`

Expected: FAIL because the component does not exist.

- [x] **Step 3: Add failing tests for public and skipped modes**

For `players: all`, assert the semantic table contains both `Alice — Echo` and `Bob — Drifter`, and completion calls `onComplete` once. For `players: none`, test `App` directly and assert session creation opens the tracker without mounting `PlayerAssignmentView`.

- [x] **Step 4: Implement the assignment table and player-stage state machine**

`AssignmentTable` must resolve stable IDs through `game.roles` and render only when its caller has authorized all-role display:

```tsx
<table>
  <thead><tr><th scope="col">Player</th><th scope="col">Assignment</th></tr></thead>
  <tbody>{rows.map(({ player, role }) => (
    <tr key={player.id}><th scope="row">{player.name}</th><td>{role.label}</td></tr>
  ))}</tbody>
</table>
```

`PlayerAssignmentView` uses `useState<number>(0)` and `useState<'handoff' | 'revealed' | 'hidden'>('handoff')`. In handoff and hidden states, do not call the role resolver in rendered JSX and do not mount any role-bearing child. In revealed state, render only the current role label, optional team, and summary.

- [x] **Step 5: Route new sessions through the assignment stage**

Add an optional `random?: RandomSource` App prop, default it to `Math.random`, and pass it to `createSession` and later deal actions. Use `view=assignments` in the query string for `own` and `all`; use the tracker URL directly for `none`.

When `view=assignments`, load the saved session normally and render `PlayerAssignmentView`. Its completion action navigates to `session=<id>` without changing assignment data. A reload restarts component-local reveal progress at player zero.

- [x] **Step 6: Add focused responsive styles and run UI tests**

Add `.assignment-stage`, `.assignment-handoff`, `.assignment-reveal`, and `.assignment-table-region` styles using the existing color variables, button treatment, and narrow-first spacing. Keep the table region independently scrollable and ensure role content has no `print-only` duplicate.

Run: `npm test -- src/app/components/PlayerAssignmentView.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [x] **Step 7: Commit the player reveal increment**

```bash
git add src/app/components/AssignmentTable.tsx src/app/components/PlayerAssignmentView.tsx src/app/components/PlayerAssignmentView.test.tsx src/app/App.tsx src/app/App.test.tsx src/styles/global.css
git commit -m "feat: add pass-device assignment reveals"
```

---

### Task 6: Add the gated Game Master view and assignment-aware tracker

**Files:**
- Create: `src/app/components/GameMasterAssignments.tsx`
- Create: `src/app/components/GameMasterAssignments.test.tsx`
- Modify: `src/app/components/TrackerView.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `AssignmentTable`, complete assignments, `game.assignments.visibility.gameMaster`, and `dealSessionAssignments`.
- Produces: an explicit spoiler gate, old-session deal action, and locked-roster tracker behavior.

- [x] **Step 1: Add a failing Game Master gate test**

```ts
render(<GameMasterAssignments game={game} session={assignedSession} />)

expect(screen.getByRole('button', { name: 'Game Master assignments' })).toBeInTheDocument()
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: 'Game Master assignments' }))
expect(screen.getByRole('heading', { name: 'Private assignment warning' })).toBeInTheDocument()
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: 'Show all assignments' }))
expect(screen.getByText('Drifter')).toBeInTheDocument()

fireEvent.click(screen.getByRole('button', { name: 'Close assignments' }))
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()
```

Reopen and assert the warning appears again. Render a `game_master: none` fixture and assert the entry button is absent.

- [x] **Step 2: Run the gate test and verify RED**

Run: `npm test -- src/app/components/GameMasterAssignments.test.tsx`

Expected: FAIL because the gate does not exist.

- [x] **Step 3: Implement the three-state Game Master gate**

Use local state `'closed' | 'warning' | 'open'`. Mount `AssignmentTable` only in `open`; closing resets to `closed`. Do not use CSS visibility to conceal role-bearing DOM.

- [x] **Step 4: Add failing tracker integration tests**

Prove all of these behaviors through `App` with a real memory repository:

```ts
expect(screen.queryByLabelText('Alice role')).not.toBeInTheDocument()
expect(screen.queryByText('Drifter')).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Add player' })).not.toBeInTheDocument()
expect(screen.getByText(/roster is locked/i)).toBeInTheDocument()
expect(screen.getByText(/exports include.*assignments/i)).toBeInTheDocument()
```

For an older assignment-enabled session without `assignments`, assert its legacy role field and `Deal digital roles` action remain visible. Click deal, verify persistence, then verify the correct player-visibility route opens.

- [x] **Step 5: Wire tracker behavior and deal mutation**

Add `onDealAssignments: () => void` to `TrackerView`. Render `GameMasterAssignments` only for complete assignments. Filter role fields from player controls when `session.assignments` exists. Replace add/remove controls with a non-print locked-roster explanation while preserving rename.

In `App`, call:

```ts
const dealt = dealSessionAssignments(session, sessionGame, random, clock)
if (accept(dealt) && dealt.ok) {
  openAssignmentStageIfVisible(dealt.session, sessionGame)
}
```

Update export copy to say that exported files include facilitator notes and private assignments.

- [x] **Step 6: Run tracker, gate, import, and print-contract tests**

Run: `npm test -- src/app/components/GameMasterAssignments.test.tsx src/app/App.test.tsx src/app/ImportSession.test.tsx src/styles/print-contract.test.ts`

Expected: PASS, and print assertions must not find assignment tables or secret role labels.

- [x] **Step 7: Commit the facilitator increment**

```bash
git add src/app/components/GameMasterAssignments.tsx src/app/components/GameMasterAssignments.test.tsx src/app/components/TrackerView.tsx src/app/App.tsx src/app/App.test.tsx src/styles/global.css
git commit -m "feat: add gated game master assignments"
```

---

### Task 7: Opt Veilquorum into digital assignments and document the contract

**Files:**
- Modify: `games/veilquorum/game.md`
- Modify: `src/games/catalog.test.ts`
- Modify: `docs/game-format.md`
- Modify: `docs/architecture.md`
- Modify: `README.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: the completed parser, session, reveal, and Game Master features.
- Produces: one bundled opt-in game and complete author/user documentation.

- [x] **Step 1: Add a failing bundled-game assertion**

In `catalog.test.ts`, assert:

```ts
expect(veilquorum.assignments).toEqual({
  method: 'shuffle',
  visibility: { players: 'own', gameMaster: 'all' },
})
```

Run: `npm test -- src/games/catalog.test.ts`

Expected: FAIL because Veilquorum has not opted in.

- [x] **Step 2: Add the assignment block and update Veilquorum rules**

Add after `role_distributions`:

```yaml
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
```

Rewrite setup so the default procedure is digital pass-the-device dealing, the Game Master is explicitly outside the named roster, and physical suit markers remain an optional equivalent. Explain that the tracker hides digital assignments outside deliberate reveal/GM views and that session exports are private.

- [x] **Step 3: Update the complete game-format example and reference sections**

In `docs/game-format.md`, add `assignments` to the top-level table and document:

```yaml
assignments:
  method: shuffle
  visibility:
    players: own # own | all | none
    game_master: all # all | none
```

State the distribution prerequisite, each visibility behavior, legacy-session compatibility, immutable roster, role-field mirroring/suppression, and export confidentiality. Remove statements saying the application never assigns or reveals roles.

- [x] **Step 4: Update architecture, README, and roadmap**

Document the exact flow:

```text
validated roles + distribution + policy
  -> pure shuffled assignments
  -> version-1 local session
  -> player reveal or public/none branch
  -> gated optional GM overview
```

State that secrets are local but readable by anyone with device-storage or exported-file access. In the roadmap, record this as the next completed increment without claiming deployment or live verification.

- [x] **Step 5: Run bundled-game, parser, and formatting checks**

Run: `npm test -- src/games/catalog.test.ts src/games/parse.test.ts`

Run: `npx prettier --check games/veilquorum/game.md docs/game-format.md docs/architecture.md README.md docs/roadmap.md`

Expected: both commands PASS.

- [x] **Step 6: Commit the example and documentation increment**

```bash
git add games/veilquorum/game.md src/games/catalog.test.ts docs/game-format.md docs/architecture.md README.md docs/roadmap.md
git commit -m "docs: publish digital role dealing guidance"
```

---

### Task 8: Run mutation-focused review and the complete release gate

**Files:**
- Modify only files whose behavior fails the checks below.

**Interfaces:**
- Consumes: all completed increments.
- Produces: release-gate evidence for the final handoff.

- [x] **Step 1: Run the assignment mutation checklist mentally against tests**

Confirm a test fails for each mutation:

```text
players: own accidentally renders the next role
hide uses CSS instead of unmounting secret content
Game Master table mounts before spoiler confirmation
shuffle accepts 1 or a negative value
one player receives no assignment
one role count differs from the distribution
Game Master is added to the role pool
add/remove succeeds after dealing
role field remains editable after dealing
import preview includes a role ID or label
a no-policy game enters assignment UI
```

Add one focused failing test first for any uncovered mutation, watch it fail, then make the minimal production change and watch it pass.

- [x] **Step 2: Run focused assignment and UI suites**

Run: `npm test -- src/assignments/deal.test.ts src/sessions/operations.test.ts src/sessions/validate.test.ts src/app/components/PlayerAssignmentView.test.tsx src/app/components/GameMasterAssignments.test.tsx src/app/App.test.tsx src/app/ImportSession.test.tsx`

Expected: PASS with no warnings.

- [x] **Step 3: Run the complete release gate**

Run: `npm run ci`

Expected: lint, format check, typecheck, all tests, production build, and static artifact verification PASS.

- [x] **Step 4: Inspect the final diff and repository state**

Run: `git diff --check`

Run: `git status --short`

Run: `git log --oneline -10`

Expected: no whitespace errors; only intentional uncommitted verification fixes, if any; feature commits appear in task order.

- [ ] **Step 5: Commit any verification-only fixes**

If Step 3 required a test-first correction, stage only the files changed for that correction and commit:

```bash
git commit -m "fix: close assignment verification gaps"
```

If no files changed, do not create an empty commit.
