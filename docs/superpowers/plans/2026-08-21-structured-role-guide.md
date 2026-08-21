# Structured Role Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make roles first-class optional game data and show a validated, printable role/card/distribution guide throughout the Veilquorum rules, setup, and tracker flows without automating private role assignment.

**Architecture:** Extend normalized `GameDefinition` with role and distribution records plus a semantic `role` player field. Focused parser helpers validate card selectors and complete player-count bands; session operations validate role IDs against the owning game; a shared read-only `RoleGuide` renders the same normalized data in rules, setup, tracker, and print contexts.

**Tech Stack:** TypeScript 6, React 19, Vite 8, YAML, Vitest 4, Testing Library, existing card selectors and static GitHub Pages workflow.

**Spec:** `docs/superpowers/specs/2026-08-21-structured-role-guide-design.md`

## Global Constraints

- Roles are optional; Rillward Gambit and Sereinfolio must retain their current meaning and display no empty role guide.
- Cards are physical markers only; do not add dealing, random assignment, private reveals, rule enforcement, accounts, networking, or cloud state.
- Keep `schema_version: 1` and saved-session `storageVersion: 1`; existing Veilquorum role IDs remain `wayfinder`, `drifter`, and `echo` so stored sessions restore without migration.
- Role summaries, team labels, and card labels are plain text. Do not add raw HTML, artwork, third-party imagery, or commercial-game content.
- The role guide must not rely on color alone, must fit a 320 CSS-pixel document without page-level horizontal scrolling, and must appear in rules and tracker print output.
- Continue rejecting unknown schema properties and return one precise diagnostic with a stable source/path.
- Every production change follows a witnessed RED/GREEN test cycle before implementation.

---

### Task 1: Add the role domain and distribution resolver

**Files:**
- Modify: `src/games/model.ts`
- Create: `src/games/roles.ts`
- Test: `src/games/roles.test.ts`
- Modify fixture: `src/files/session-files.test.ts`
- Modify fixture: `src/sessions/operations.test.ts`
- Modify fixture: `src/sessions/validate.test.ts`
- Modify fixture: `src/storage/repository.test.ts`

**Interfaces:**
- Consumes: existing `CardSelector`, `PlayersDefinition`, and `GameDefinition` conventions.
- Produces: `RoleDefinition`, `RoleCardMarker`, `RoleCount`, `RoleDistribution`, `RoleFieldDefinition`, `ResolvedRoleCount`, and `resolveRoleCounts(game, playerCount)`.

- [x] **Step 1: Write failing distribution-resolution tests**

Create `src/games/roles.test.ts` with a complete normalized fixture and observable expectations:

```ts
import { describe, expect, it } from 'vitest'

import type { GameDefinition } from './model'
import { resolveRoleCounts } from './roles'

const game: GameDefinition = {
  schemaVersion: 1,
  id: 'veilquorum',
  name: 'Veilquorum',
  summary: 'Fixture',
  deck: 'standard-52',
  players: { min: 5, max: 12 },
  roles: [
    { id: 'echo', label: 'Echo', team: 'Quorum', summary: 'Tests one player.' },
    { id: 'drifter', label: 'Drifter', team: 'Drifters', summary: 'Thins the quorum.' },
    { id: 'wayfinder', label: 'Wayfinder', team: 'Quorum', summary: 'Finds Drifters.' },
  ],
  roleDistributions: [
    {
      players: { min: 5, max: 6 },
      counts: { echo: 1, drifter: 1, wayfinder: 'remaining' },
    },
    {
      players: { min: 7, max: 9 },
      counts: { echo: 1, drifter: 2, wayfinder: 'remaining' },
    },
    {
      players: { min: 10, max: 12 },
      counts: { echo: 1, drifter: 3, wayfinder: 'remaining' },
    },
  ],
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Rules\n',
  source: 'fixture/game.md',
}

describe('resolveRoleCounts', () => {
  it('derives the remaining role count for the matching player band', () => {
    expect(resolveRoleCounts(game, 8)).toEqual([
      { role: game.roles[0], count: 1 },
      { role: game.roles[1], count: 2 },
      { role: game.roles[2], count: 5 },
    ])
  })

  it('returns undefined outside the supported distributions', () => {
    expect(resolveRoleCounts(game, 4)).toBeUndefined()
    expect(resolveRoleCounts(game, 13)).toBeUndefined()
  })
})
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/games/roles.test.ts`

Expected: FAIL because `RoleDefinition`, normalized `roles`, normalized `roleDistributions`, and `resolveRoleCounts` do not exist.

- [x] **Step 3: Add exact role types to the game model**

Import `CardSelector` into `src/games/model.ts`, add these definitions, add `RoleFieldDefinition` to `PlayerFieldDefinition`, and add normalized arrays to `GameDefinition`:

```ts
export interface RoleCardMarker {
  readonly label: string
  readonly selector: CardSelector
}

export interface RoleDefinition {
  readonly id: string
  readonly label: string
  readonly team?: string
  readonly summary: string
  readonly card?: RoleCardMarker
}

export type RoleCount = number | 'remaining'

export interface RoleDistribution {
  readonly players: Required<PlayersDefinition>
  readonly counts: Readonly<Record<string, RoleCount>>
}

export interface RoleFieldDefinition extends BasePlayerFieldDefinition {
  readonly type: 'role'
  readonly default: string
}

export interface GameDefinition {
  // existing properties remain
  readonly roles: readonly RoleDefinition[]
  readonly roleDistributions: readonly RoleDistribution[]
}
```

Keep `BasePlayerFieldDefinition` non-exported unless another production module truly requires it.

- [x] **Step 4: Implement the pure resolver**

Create `src/games/roles.ts`:

```ts
import type { GameDefinition, RoleDefinition } from './model'

export interface ResolvedRoleCount {
  readonly role: RoleDefinition
  readonly count: number
}

export function resolveRoleCounts(
  game: GameDefinition,
  playerCount: number,
): readonly ResolvedRoleCount[] | undefined {
  const distribution = game.roleDistributions.find(
    ({ players }) =>
      playerCount >= players.min && playerCount <= players.max,
  )
  if (!distribution) return undefined

  const fixed = Object.values(distribution.counts).reduce(
    (total, value) => total + (value === 'remaining' ? 0 : value),
    0,
  )
  return game.roles.map((role) => ({
    role,
    count:
      distribution.counts[role.id] === 'remaining'
        ? playerCount - fixed
        : (distribution.counts[role.id] as number),
  }))
}
```

- [x] **Step 5: Update existing typed fixtures with normalized empty arrays**

Add `roles: []` and `roleDistributions: []` to the direct `GameDefinition`
literals in `src/files/session-files.test.ts`,
`src/sessions/operations.test.ts`, `src/sessions/validate.test.ts`, and
`src/storage/repository.test.ts`. Do not change bundled content yet.

- [x] **Step 6: Run focused and type gates**

Run: `npm test -- src/games/roles.test.ts && npm run typecheck`

Expected: role tests PASS and TypeScript reports no missing normalized role properties.

- [x] **Step 7: Commit the role domain**

```bash
git add src/games/model.ts src/games/roles.ts src/games/roles.test.ts src/files/session-files.test.ts src/sessions/operations.test.ts src/sessions/validate.test.ts src/storage/repository.test.ts
git commit -m "feat: add structured role domain"
```

---

### Task 2: Parse roles, card markers, distributions, and semantic role fields

**Files:**
- Modify: `src/games/parse.ts`
- Modify: `src/games/parse.test.ts`
- Modify: `src/cards/decks.ts` only if a small exported `createDeck(deckType)` helper removes duplicated deck selection; otherwise keep deck selection local to the parser.

**Interfaces:**
- Consumes: Task 1 role types, `CardSelector`, `selectCards`, `createStandardDeck()`, and `createTarotDeck()`.
- Produces: `parseGameSource()` results with normalized `roles`, `roleDistributions`, and `RoleFieldDefinition` values.

- [x] **Step 1: Extend the valid parser fixture and expected normalized result**

In `src/games/parse.test.ts`, place this YAML between `players` and `session` in `validSource`:

```yaml
roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
role_distributions:
  - players: { min: 4, max: 6 }
    counts: { echo: 1, drifter: 1, wayfinder: remaining }
  - players: { min: 7, max: 9 }
    counts: { echo: 1, drifter: 2, wayfinder: remaining }
  - players: { min: 10, max: 12 }
    counts: { echo: 1, drifter: 3, wayfinder: remaining }
```

Change the role player field to:

```yaml
    - id: role
      label: Role
      type: role
      default: wayfinder
```

Update the success expectation with the exact camel-cased normalized role data, selectors, distributions, `type: 'role'`, and empty arrays only for definitions that omit the optional YAML.

- [x] **Step 2: Add table-driven invalid-role parser tests**

Add cases that each mutate `validSource` once and assert the exact diagnostic code and path:

```ts
it.each([
  ['duplicate role ID', 'id: drifter', 'id: echo', 'schema.invalid-value', 'roles.1.id'],
  ['empty role summary', 'summary: Quietly reduces the quorum.', 'summary: ""', 'schema.invalid-value', 'roles.1.summary'],
  ['unknown suit', '[spades]', '[stars]', 'schema.invalid-value', 'roles.1.card.selector.suits'],
  ['role default missing', 'default: wayfinder', 'default: stranger', 'schema.invalid-default', 'session.player_fields.1.default'],
  ['overlapping bands', 'players: { min: 7, max: 9 }', 'players: { min: 6, max: 9 }', 'schema.invalid-value', 'role_distributions.1.players'],
  ['missing role count', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1, drifter: 1 }', 'schema.invalid-value', 'role_distributions.0.counts'],
  ['multiple remaining roles', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: remaining, drifter: 1, wayfinder: remaining }', 'schema.invalid-value', 'role_distributions.0.counts'],
])('%s is rejected', (name, search, replacement, code, path) => {
  const result = parseGameSource(replaceOnce(search, replacement), 'broken/game.md')
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code, path }] })
})
```

Add separate cases for an uncovered supported player count, distributions without roles, a band with fixed counts that cannot exactly fill a multi-player range, a negative/non-integer count, an unknown count key, a role field without roles, and unknown properties inside role/card/distribution objects.

- [x] **Step 3: Run parser tests and verify RED**

Run: `npm test -- src/games/parse.test.ts`

Expected: FAIL because the parser rejects the new top-level properties and does not recognize `type: role`.

- [x] **Step 4: Implement focused parser helpers**

In `src/games/parse.ts`, keep `parseMetadata` orchestration small by adding these internal signatures:

```ts
function parseCardSelector(
  value: unknown,
  deck: DeckType,
  source: string,
  path: string,
): CardSelector | ParseGameResult

function parseRoles(
  value: unknown,
  deck: DeckType,
  source: string,
): readonly RoleDefinition[] | ParseGameResult

function parseRoleDistributions(
  value: unknown,
  roles: readonly RoleDefinition[],
  players: PlayersDefinition,
  source: string,
): readonly RoleDistribution[] | ParseGameResult

function parseFields(
  value: unknown,
  roles: readonly RoleDefinition[],
  source: string,
): readonly PlayerFieldDefinition[] | ParseGameResult
```

`parseCardSelector` must allow only `ids`, `suits`, `ranks`, `arcana`, and `tags`; require non-empty arrays of non-empty strings; call `selectCards` against the selected canonical deck; and translate selector diagnostics to `schema.invalid-value` at the precise selector property path.

`parseRoles` must normalize absent YAML to `[]`, reject an empty declared array, reject unknown properties, trim all labels/summaries/team/card labels, reject duplicate IDs, and freeze nothing beyond existing project conventions.

`parseRoleDistributions` must normalize absence to `[]`, enforce finite complete ordered coverage, require exact role keys, validate integer/`remaining` values, permit at most one `remaining`, and enforce the fixed-only single-count rule from the spec.

Add `roles` and `role_distributions` to the top-level allowlist. Parse players and roles before distributions, then pass roles into field parsing. Add a `role` switch branch that permits only `id`, `label`, `type`, and `default` and validates the default against the role IDs. Update the invalid-type message to list `role`.

- [x] **Step 5: Run parser tests and verify GREEN**

Run: `npm test -- src/games/parse.test.ts`

Expected: all parser tests PASS with exact diagnostic paths.

- [x] **Step 6: Run game-domain regression tests**

Run: `npm test -- src/cards src/games`

Expected: canonical deck, selector, parser, renderer, catalog, and role resolver tests PASS.

- [x] **Step 7: Commit structured role parsing**

```bash
git add src/games/parse.ts src/games/parse.test.ts src/cards/decks.ts
git commit -m "feat: parse structured role guides"
```

Omit `src/cards/decks.ts` from `git add` when it was not changed.

---

### Task 3: Validate semantic role values in sessions without migration

**Files:**
- Modify: `src/sessions/operations.ts`
- Modify: `src/sessions/operations.test.ts`
- Modify: `src/sessions/validate.ts`
- Modify: `src/sessions/validate.test.ts`

**Interfaces:**
- Consumes: `GameDefinition.roles`, `RoleFieldDefinition`, current session storage version 1, and unchanged string-valued `SessionFieldValue`.
- Produces: `fieldValueIsValid(game, field, value)` and compatible creation, mutation, restore, and import validation.

- [x] **Step 1: Write failing operation tests for semantic role values**

Update the operations fixture with roles and a role field. Add assertions:

```ts
expect(fieldValueIsValid(game, roleField, 'echo')).toBe(true)
expect(fieldValueIsValid(game, roleField, 'outsider')).toBe(false)

const updated = updatePlayerField(session, game, 'player-1', 'role', 'echo', clock)
expect(updated).toMatchObject({ ok: true, session: { players: [{ fields: { role: 'echo' } }] } })
```

Keep the existing generic choice test to prove stance/tone behavior is unchanged.

- [x] **Step 2: Write a failing version-1 restoration test**

In `src/sessions/validate.test.ts`, construct a raw storage-version-1 Veilquorum session containing `fields.role: 'echo'` and assert `validateSession(raw, game)` returns `{ ok: true }`. Add a sibling case with `fields.role: 'stranger'` and assert `session.invalid-field-value` at `players.0.fields.role`.

- [x] **Step 3: Run session tests and verify RED**

Run: `npm test -- src/sessions/operations.test.ts src/sessions/validate.test.ts`

Expected: FAIL because `fieldValueIsValid` has no game context and no `role` case.

- [x] **Step 4: Change field validation to receive the owning game**

Change the signature and switch:

```ts
export function fieldValueIsValid(
  game: GameDefinition,
  field: PlayerFieldDefinition,
  value: unknown,
): value is SessionFieldValue {
  switch (field.type) {
    case 'role':
      return (
        typeof value === 'string' &&
        game.roles.some((role) => role.id === value)
      )
    // preserve boolean, choice, number, and text behavior
  }
}
```

Update `updatePlayerField` to call `fieldValueIsValid(game, field, value)` and update `validateSession` identically. Update direct test calls. Do not change serialized session shape or add migrations.

- [x] **Step 5: Run session tests and verify GREEN**

Run: `npm test -- src/sessions/operations.test.ts src/sessions/validate.test.ts`

Expected: all operation and restoration tests PASS.

- [x] **Step 6: Run storage and file compatibility tests**

Run: `npm test -- src/storage src/files`

Expected: stored and imported version-1 sessions continue to validate with unchanged role ID strings.

- [x] **Step 7: Commit semantic session validation**

```bash
git add src/sessions/operations.ts src/sessions/operations.test.ts src/sessions/validate.ts src/sessions/validate.test.ts
git commit -m "feat: validate semantic session roles"
```

---

### Task 4: Render the shared role guide and labeled role controls

**Files:**
- Create: `src/app/components/RoleGuide.tsx`
- Create: `src/app/components/RoleGuide.test.tsx`
- Modify: `src/app/components/RulesView.tsx`
- Modify: `src/app/components/SessionSetup.tsx`
- Modify: `src/app/components/TrackerView.tsx`
- Modify: `src/app/components/PlayerFieldControl.tsx`
- Modify: `src/app/components/PlayerFieldControl.test.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/styles/print-contract.test.ts`

**Interfaces:**
- Consumes: `GameDefinition.roles`, `GameDefinition.roleDistributions`, `resolveRoleCounts(game, playerCount)`, and `RoleFieldDefinition`.
- Produces: `RoleGuide({ game, playerCount?, headingLevel? })`, labeled role selects, responsive role-guide styles, and print-visible guide content.

- [x] **Step 1: Write failing shared-guide component tests**

Create a valid structured-role fixture in `RoleGuide.test.tsx` and assert:

```tsx
render(<RoleGuide game={game} />)
expect(screen.getByRole('heading', { name: 'Role guide' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
expect(screen.getByText('Heart')).toBeInTheDocument()
expect(screen.getByText('Privately tests one active player.')).toBeInTheDocument()
expect(screen.getByRole('table', { name: 'Role quantities by player count' })).toHaveTextContent('5–6')

rerender(<RoleGuide game={game} playerCount={8} />)
expect(screen.getByText('Quantities for 8 players')).toBeInTheDocument()
expect(screen.getByText('5 Wayfinders')).toBeInTheDocument()
```

Add a no-role fixture assertion that the component returns no region or heading.

- [x] **Step 2: Write failing role-control tests**

Extend `PlayerFieldControl.test.tsx` with a role field and roles prop:

```tsx
render(
  <PlayerFieldControl
    field={{ id: 'role', label: 'Role', type: 'role', default: 'wayfinder' }}
    playerName="Ari"
    roles={game.roles}
    value="wayfinder"
    onChange={onChange}
  />,
)
const select = screen.getByRole('combobox', { name: 'Ari — Role' })
expect(select).toHaveDisplayValue('Wayfinder')
fireEvent.change(select, { target: { value: 'echo' } })
expect(onChange).toHaveBeenCalledWith('echo')
```

- [x] **Step 3: Write failing application-placement and print tests**

In `App.test.tsx`, assert Veilquorum shows `Role guide` on rules, setup, and tracker; the tracker guide for five players shows exact resolved counts; adding/removing a player changes the displayed applicable quantity; the Ari role control displays `Echo` while retaining value `echo`; and non-role games expose zero `Role guide` headings.

In `print-contract.test.ts`, assert `.role-guide` is not included in the interactive `display: none` print selectors and that role guide cards/rows use `break-inside: avoid`.

- [x] **Step 4: Run component tests and verify RED**

Run: `npm test -- src/app/components/RoleGuide.test.tsx src/app/components/PlayerFieldControl.test.tsx src/app/App.test.tsx src/styles/print-contract.test.ts`

Expected: FAIL because the guide, role field rendering, placements, and styles do not exist.

- [x] **Step 5: Implement the read-only RoleGuide**

Create `RoleGuide.tsx` with this public interface:

```ts
interface RoleGuideProps {
  readonly game: GameDefinition
  readonly playerCount?: number
  readonly headingLevel?: 2 | 3
}

export function RoleGuide({
  game,
  playerCount,
  headingLevel = 2,
}: RoleGuideProps): ReactElement | null
```

Import `type ReactElement` from `react` in the component.

Return `null` when `game.roles.length === 0`. Render a `.role-guide` section with a dynamic heading element, role articles containing label/team/card/summary, and either:

- a table named `Role quantities by player count` for all bands when
  `playerCount` is absent, deriving a readable minimum–maximum quantity for a
  `remaining` role (for example, `3–4` Wayfinders in the 5–6 band); or
- a `Quantities for N players` list from `resolveRoleCounts` when a band applies; or
- guidance that no published distribution applies when the count is outside the supported bands.

Use text such as `1 Echo` and `5 Wayfinders`; use a local singular/plural helper based on count. Display `No fixed card` for missing card markers.

- [x] **Step 6: Add the guide to rules, setup, and tracker**

Render `<RoleGuide game={game} />` after rules actions and before the Markdown article. Render it after setup guidance and before the form. Render `<RoleGuide game={game} playerCount={session.players.length} />` after tracker error/guidance and before session management/round controls.

Do not wrap the guide in `print-hidden`. Keep DOM order identical between narrow and wide layouts.

- [x] **Step 7: Render semantic role fields with labels**

Add `readonly roles?: readonly RoleDefinition[]` to `PlayerFieldControlProps`. Add a `role` case that renders the same labeled native select pattern as choice fields, but maps `roles` to `<option value={role.id}>{role.label}</option>`. Pass `roles={game.roles}` from `TrackerView`.

Do not humanize role IDs or store labels as values.

- [x] **Step 8: Add responsive and print-safe styles**

In `global.css`, add focused classes:

```css
.role-guide {
  display: grid;
  gap: 1.25rem;
  padding: clamp(1rem, 3vw, 1.75rem);
  border: 1px solid var(--line);
  background: var(--paper);
}

.role-guide-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
}

.role-guide-card,
.role-guide tr {
  break-inside: avoid;
}

.role-guide-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}
```

Use existing typography, borders, muted colors, and spacing. Add no animation or decorative suit-color dependency. In the print media block, preserve the guide border, remove unnecessary background/shadow, and keep role cards/tables from splitting where practical.

- [x] **Step 9: Run component tests and verify GREEN**

Run: `npm test -- src/app/components/RoleGuide.test.tsx src/app/components/PlayerFieldControl.test.tsx src/app/App.test.tsx src/styles/print-contract.test.ts`

Expected: shared guide, semantic select, placement, live quantity, no-role, accessibility, and print tests PASS.

- [x] **Step 10: Commit the role guide UI**

```bash
git add src/app/components/RoleGuide.tsx src/app/components/RoleGuide.test.tsx src/app/components/RulesView.tsx src/app/components/SessionSetup.tsx src/app/components/TrackerView.tsx src/app/components/PlayerFieldControl.tsx src/app/components/PlayerFieldControl.test.tsx src/app/App.test.tsx src/styles/global.css src/styles/print-contract.test.ts
git commit -m "feat: show role guides across sessions"
```

---

### Task 5: Convert Veilquorum, document the format, and verify the release candidate

**Files:**
- Modify: `games/veilquorum/game.md`
- Modify: `src/games/catalog.test.ts`
- Modify: `README.md`
- Modify: `docs/game-format.md`
- Modify: `docs/architecture.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/superpowers/plans/2026-08-21-structured-role-guide.md` (checkboxes only while executing)

**Interfaces:**
- Consumes: the complete structured-role parser, session semantics, and shared UI.
- Produces: the first bundled structured-role game, public authoring instructions, and a locally verified static release candidate.

- [x] **Step 1: Write failing bundled-content assertions**

In `src/games/catalog.test.ts`, locate Veilquorum and assert exact IDs, labels, card selectors, and bands:

```ts
expect(veilquorum.roles.map(({ id, label }) => ({ id, label }))).toEqual([
  { id: 'echo', label: 'Echo' },
  { id: 'drifter', label: 'Drifter' },
  { id: 'wayfinder', label: 'Wayfinder' },
])
expect(veilquorum.roles.find(({ id }) => id === 'echo')?.card).toEqual({
  label: 'Heart',
  selector: { suits: ['hearts'] },
})
expect(veilquorum.roleDistributions).toHaveLength(3)
expect(veilquorum.fields.find(({ id }) => id === 'role')).toMatchObject({
  type: 'role',
  default: 'wayfinder',
})
```

Assert Rillward Gambit and Sereinfolio both have empty normalized role arrays.

- [x] **Step 2: Run the bundled catalog test and verify RED**

Run: `npm test -- src/games/catalog.test.ts`

Expected: FAIL because Veilquorum still declares a generic choice field and prose-only mapping.

- [x] **Step 3: Convert Veilquorum frontmatter**

Add the exact roles and distributions approved in the spec. Preserve the current mapping and bands:

- Echo → heart → fixed count 1;
- Drifter → spade → counts 1, 2, and 3;
- Wayfinder → club or diamond → `remaining`.

Change only the existing role field from `type: choice` plus `choices` to `type: role`. Keep `default: wayfinder`, all other field IDs/defaults, phases, player limits, and rules behavior unchanged.

Edit `Prepare the role cards` prose to introduce the structured guide and avoid treating suits as role names. Retain a complete textual explanation so the Markdown remains understandable outside the application.

- [x] **Step 4: Run catalog and complete component journeys**

Run: `npm test -- src/games/catalog.test.ts src/app/App.test.tsx`

Expected: all three bundled games load, Veilquorum uses structured roles, and every game still reaches its configured tracker.

- [x] **Step 5: Update public and authoring documentation**

Document in `docs/game-format.md`:

- optional `roles` and `role_distributions` YAML with the complete Veilquorum-shaped example;
- role/card/team/summary validation;
- complete ordered distribution coverage and `remaining` semantics;
- `type: role` and its role-ID default;
- compatibility with version 1 games/sessions; and
- the explicit no-dealing/no-private-assignment boundary.

Document the role domain → parser → shared guide → session role-ID flow in `docs/architecture.md`. Mark the structured role guide delivered in `docs/roadmap.md` while leaving automated assignment, private reveals, and scripted role behavior future/out of scope. Add one concise README feature bullet and keep the established legal caveat: bundled content is original; commercial games are not bundled.

- [x] **Step 6: Run focused documentation and formatting checks**

Run: `npm run format:check && git diff --check`

Expected: all changed code, Markdown, and YAML use repository formatting with no whitespace errors.

- [x] **Step 7: Run the full release gate**

Run: `npm run ci`

Expected: ESLint, Prettier, strict TypeScript, all Vitest files, Vite production build, and static artifact verification PASS.

- [x] **Step 8: Serve and manually verify the production artifact**

Run: `npm run preview -- --host 127.0.0.1`

In a browser, verify at 320px and a wide viewport:

1. Veilquorum rules show Echo/Drifter/Wayfinder, teams, heart/spade/club-or-diamond markers, purposes, and all three bands.
2. Setup shows the same guide before player entry.
3. A five-player tracker shows 1 Echo, 1 Drifter, and 3 Wayfinders.
4. Adding players through the 7-player threshold updates the guide to 1 Echo, 2 Drifters, and 4 Wayfinders.
5. Role selects display labels while saving IDs; reload restores the selected role.
6. Rillward Gambit and Sereinfolio show no empty guide.
7. Rules and tracker print actions include the guide and omit interactive chrome.
8. Keyboard navigation reaches every role control and guide content remains exposed to the accessibility tree.
9. No runtime request leaves the preview origin.

Verification record (2026-08-21): the production artifact was exercised at
320 and 1440 CSS pixels. The rules, setup, five-player tracker, seven-player
threshold update, role labels and stored IDs, reload restoration, roleless
games, print actions, accessibility tree, same-origin asset boundary, and
console were checked. The browser backend did not expose the native print
dialog; verification stops at the successful browser/system print boundary,
with automated print-state tests covering rendered values and hidden editing
controls.

- [x] **Step 9: Commit the bundled game and documentation**

```bash
git add games/veilquorum/game.md src/games/catalog.test.ts README.md docs/game-format.md docs/architecture.md docs/roadmap.md docs/superpowers/plans/2026-08-21-structured-role-guide.md
git commit -m "feat: publish Veilquorum role guide"
```

- [x] **Step 10: Request final whole-branch review before integration**

Review the range from the approved spec commit `48aeb20` through the final implementation head against `docs/superpowers/specs/2026-08-21-structured-role-guide-design.md`. Fix every Critical and Important finding through witnessed regression tests and request scoped re-review. Defer only explicitly categorized Minor findings with a recorded rationale.

Review record (2026-08-21): independent whole-range review found no Critical
issues and one Important issue: printed tracker roles exposed stable IDs rather
than human-readable labels. A witnessed regression test now protects the label
output. The review's Minor semantic-structure finding was also resolved by
rendering labeled definition content for team, card, and purpose.

- [x] **Step 11: Finish the branch through the user's selected integration path**

Use `superpowers:verification-before-completion` and `superpowers:finishing-a-development-branch`. Re-run `npm run ci` on the exact head, then offer the required merge/push/keep choices. If the user selects publication, wait for CI and Pages, exercise the repository-subpath production URL, and update README/roadmap evidence only after the deployed guide is verified.

Integration record (2026-08-21): the reviewed closure commits `3011f0b` and
`433b3c8` were fast-forwarded to `main` and pushed. GitHub CI run
`32527013767` and Pages run `32527013761` succeeded. The deployed
repository-subpath artifact rendered the labeled Echo, Drifter, and Wayfinder
definitions from the reviewed asset hashes, loaded only same-origin assets,
and produced no console warnings or errors.
