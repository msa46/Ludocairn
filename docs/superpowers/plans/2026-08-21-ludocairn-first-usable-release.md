# Ludocairn First Usable Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project to the preliminarily screened Ludocairn name and deliver a tested, static GitHub Pages application for reading three original card games and running persistent facilitator-led sessions.

**Architecture:** Pure TypeScript modules own cards, game definitions, sessions, storage, and files; React coordinates catalog, rules, setup, and tracker views. Vite imports bundled Markdown at build time and emits one relative-path `index.html`; browser state stays in `localStorage`, with explicit JSON import/export and no backend or runtime network dependency.

**Tech Stack:** Node.js 22.22.2, npm, Vite 8.2.2, React 19.2.8, TypeScript 6.0.3, Vitest 4.1.11, Testing Library, YAML 2.9.0, Marked 18.0.10, DOMPurify 3.4.14, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md`

## Global Constraints

- The production site is fully static and deployable to GitHub Pages with `base: './'` and one physical `index.html`.
- No backend, database, account, authentication, analytics, remote API, third-party runtime, path router, or URL-fragment sharing is introduced.
- All application and domain logic uses strict TypeScript; domain modules do not import React or access the DOM.
- All built-in rules, examples, roles, prompts, presentation, and rights records are original repository content licensed under MIT.
- Public game names and IDs are used only after the dated clearance record required by `docs/content-rights.md` is present.
- Raw HTML, images, embedded widgets, and executable Markdown are disabled; rendered Markdown is sanitized.
- Stored and imported JSON is untrusted, versioned, validated, and never silently overwritten.
- Player deletion, session deletion, and import collision handling are explicit; storage failures preserve the in-memory session.
- Accessibility, 20rem-wide screens, keyboard operation, grayscale print, and rules/tracker print modes are release requirements.
- `npm run ci` is the authoritative automated gate and must pass after every task.

## Planned file map

| Path | Responsibility |
| --- | --- |
| `README.md`, `CONTRIBUTING.md`, `index.html`, `package.json` | Public Ludocairn identity and setup metadata. |
| `docs/content-rights.md`, `docs/name-clearance.md`, `docs/decisions/0006-ludocairn-name.md` | Naming policy, dated evidence, and rename decision. |
| `docs/superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md` | Approved release behavior under the new product name. |
| `src/cards/model.ts`, `src/cards/decks.ts`, `src/cards/select.ts` | Immutable card types, canonical decks, and structured selectors. |
| `src/games/model.ts`, `src/games/parse.ts`, `src/games/render.ts`, `src/games/catalog.ts` | Validated game definitions, diagnostics, safe Markdown, and bundled catalog. |
| `games/*/game.md`, `games/*/RIGHTS.md` | Three original games and adjacent provenance/name records. |
| `src/sessions/model.ts`, `src/sessions/operations.ts`, `src/sessions/validate.ts` | Versioned session state and pure validated transformations. |
| `src/storage/repository.ts`, `src/storage/memory.ts`, `src/storage/local-storage.ts` | Repository boundary plus test and browser adapters. |
| `src/files/session-files.ts` | Validated UTF-8 session import/export and collision-safe import preparation. |
| `src/app/App.tsx`, `src/app/useSessionStore.ts` | URL-driven view coordination and persistence lifecycle. |
| `src/app/components/*.tsx` | Catalog, rules, setup, tracker, field controls, recovery, and import preview. |
| `src/styles/global.css` | Responsive visual system, focus states, and print modes. |
| `scripts/verify-bundled-games.test.ts`, `scripts/repository-docs.test.ts` | Repository-level game/rights/name and documentation contracts. |

---

### Task 1: Adopt the Ludocairn identity and record the preliminary clearance

**Files:**
- Create: `docs/name-clearance.md`
- Create: `docs/decisions/0006-ludocairn-name.md`
- Rename: `docs/superpowers/specs/2026-08-21-deckwright-first-usable-release-design.md` to `docs/superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md`
- Modify: `README.md`, `CONTRIBUTING.md`, `index.html`, `package.json`, `package-lock.json`, `src/app/App.tsx`, `src/app/App.test.tsx`, `docs/architecture.md`, `docs/content-rights.md`, `docs/game-format.md`, `docs/roadmap.md`, `docs/decisions/*.md`, `docs/superpowers/specs/*.md`, `docs/superpowers/plans/*.md`, `games/README.md`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: the approved replacement name `Ludocairn` and the screening performed on 2026-08-21.
- Produces: public product name `Ludocairn`, npm package name `ludocairn`, and a dated record that clearly distinguishes preliminary screening from legal advice.

- [x] **Step 1: Write a failing rendered-identity test**

Extend the real application component test so it verifies the user-visible product name in the rendered banner. A regression that leaves the old public identity in the application will make this test fail.

```ts
expect(screen.getByRole('banner')).toHaveTextContent('Ludocairn')
```

- [x] **Step 2: Run the focused test and verify the old identity fails it**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the rendered banner still uses `Deckwright`.

- [x] **Step 3: Record the screening evidence and rename current material**

Write `docs/name-clearance.md` with the date, query, scope, zero-result outcomes for USPTO Wordmark, EUIPO eSearch, exact and fuzzy TMview, general web, GitHub, npm, and PyPI, and `.com`/`.org` WHOIS availability at the time checked. Include this exact limitation:

```md
This is a preliminary conflict screen, not a legal opinion or a guarantee of
registrability or freedom to use. Trademark rights may arise without an exact
database match, database coverage changes, and domain availability can change.
Obtain professional clearance before material commercial investment.
```

Create decision `0006` with status `accepted`, the `Ludocairn` spelling, pronunciation `LOO-doh-kairn`, rationale (`ludo` for play plus `cairn` for a durable guide marker), known tradeoff (the invented word needs a short descriptive tagline), and the decision not to claim a registered mark.

Rename the current spec, replace current product references, set `package.json` and lockfile package names to `ludocairn`, change the document title and metadata description, and render `Ludocairn` in the app wordmark. Preserve Git history and the historical foundation records; add a short supersession note to those historical files rather than rewriting their original titles. Verify current public files with `rg -n '\bDeckwright\b' README.md CONTRIBUTING.md index.html src/app docs/architecture.md docs/content-rights.md docs/game-format.md docs/roadmap.md games/README.md`; expected output is empty.

- [x] **Step 4: Run identity and full gates**

Run: `npm test -- src/app/App.test.tsx && npm run ci`

Expected: PASS, with the static artifact still using only relative asset URLs.

- [x] **Step 5: Commit the identity decision**

```bash
git add README.md CONTRIBUTING.md index.html package.json package-lock.json src/app docs games/README.md
git commit -m "docs: adopt Ludocairn identity"
```

---

### Task 2: Build canonical card decks and structured selectors

**Files:**
- Create: `src/cards/model.ts`
- Create: `src/cards/decks.ts`
- Create: `src/cards/select.ts`
- Test: `src/cards/decks.test.ts`
- Test: `src/cards/select.test.ts`

**Interfaces:**
- Consumes: no application or browser state.
- Produces: `Card`, `StandardCard`, `TarotCard`, `DeckType`, `createStandardDeck(): readonly StandardCard[]`, `createTarotDeck(): readonly TarotCard[]`, `CardSelector`, and `selectCards(deck, selector): SelectionResult`.

- [x] **Step 1: Write failing deck-composition tests**

```ts
expect(createStandardDeck()).toHaveLength(52)
expect(new Set(createStandardDeck().map((card) => card.id))).toHaveProperty(
  'size',
  52,
)
expect(createTarotDeck()).toHaveLength(78)
expect(createTarotDeck().filter((card) => card.arcana === 'major')).toHaveLength(
  22,
)
expect(createTarotDeck().filter((card) => card.arcana === 'minor')).toHaveLength(
  56,
)
```

- [x] **Step 2: Run the deck test and verify missing modules fail it**

Run: `npm test -- src/cards/decks.test.ts`

Expected: FAIL with unresolved imports from `./decks` and `./model`.

- [x] **Step 3: Implement immutable types and generated canonical decks**

Use literal tuples for four standard suits, thirteen standard ranks, 22 major arcana names, four tarot suits, and fourteen minor ranks. Generate IDs exactly as `standard-52:<suit>:<rank>`, `tarot:major:<slug>`, and `tarot:minor:<suit>:<rank>`. Freeze each card and returned array; assign useful tags such as `red`, `black`, `face`, `number`, `major`, and `minor` without artwork or interpretive tarot text.

- [x] **Step 4: Run deck tests and verify they pass**

Run: `npm test -- src/cards/decks.test.ts`

Expected: PASS for counts, IDs, uniqueness, discriminants, and tags.

- [x] **Step 5: Write failing selector tests**

Cover ID, suit, rank, arcana, and tag filters; OR within a property; AND between properties; unknown values; empty selectors; and inapplicable properties.

```ts
expect(
  selectCards(createStandardDeck(), {
    suits: ['hearts'],
    ranks: ['ace', 'king'],
  }),
).toMatchObject({ ok: true, cards: expect.any(Array) })
expect(selectCards(createStandardDeck(), {})).toMatchObject({
  ok: false,
  diagnostic: { code: 'selector.empty' },
})
expect(
  selectCards(createStandardDeck(), { arcana: ['major'] }),
).toMatchObject({
  ok: false,
  diagnostic: { code: 'selector.inapplicable-property' },
})
```

- [x] **Step 6: Implement selector validation and matching**

Define `SelectionResult` as a discriminated union. Reject empty arrays, unknown values, and properties unsupported by the deck before filtering. Return `selector.no-matches` when a valid selector selects nothing.

- [x] **Step 7: Run the card domain and full gates**

Run: `npm test -- src/cards && npm run ci`

Expected: PASS.

- [x] **Step 8: Commit the card domain**

```bash
git add src/cards
git commit -m "feat: add canonical card domains"
```

---

### Task 3: Parse, validate, render, and load bundled games

**Files:**
- Create: `src/games/model.ts`
- Create: `src/games/parse.ts`
- Create: `src/games/render.ts`
- Create: `src/games/catalog.ts`
- Test: `src/games/parse.test.ts`
- Test: `src/games/render.test.ts`
- Test: `src/games/catalog.test.ts`
- Modify: `package.json`, `package-lock.json`, `docs/game-format.md`, `src/vite-env.d.ts`

**Interfaces:**
- Consumes: raw `games/*/game.md` strings from `import.meta.glob`.
- Produces: `GameDefinition`, four discriminated `PlayerFieldDefinition` variants, `Diagnostic`, `parseGameSource(source, context): ParseGameResult`, `renderRules(markdown): string`, and `loadBundledGames(): CatalogResult`.

- [x] **Step 1: Install the exact parsing dependencies**

Run: `npm install --save-exact yaml@2.9.0 marked@18.0.10 dompurify@3.4.14`

Expected: `package.json` and `package-lock.json` contain exact versions.

- [x] **Step 2: Write failing schema tests using one valid definition and one case per diagnostic**

The valid fixture must include phases, an initial phase, enabled round state, and boolean, choice, number, and text fields. Assert normalized defaults. Add focused invalid fixtures for `schema.unsupported-version`, `schema.unknown-property`, `schema.invalid-id`, `schema.duplicate-field-id`, `schema.invalid-default`, `schema.initial-phase-missing`, `schema.invalid-round`, and `frontmatter.invalid`.

```ts
const result = parseGameSource(validSource, 'fixture/game.md')
expect(result).toMatchObject({
  ok: true,
  game: {
    schemaVersion: 1,
    id: 'veilquorum',
    fields: [
      { type: 'boolean', default: true },
      { type: 'choice', default: 'wayfinder' },
      { type: 'number', default: 0 },
      { type: 'text', default: '' },
    ],
  },
})
```

- [x] **Step 3: Run parser tests and verify missing implementation fails**

Run: `npm test -- src/games/parse.test.ts`

Expected: FAIL with unresolved imports.

- [x] **Step 4: Implement explicit version-1 validation**

Split only a leading `---` YAML block, parse it with `YAML.parse`, require plain objects, reject unknown keys at every level, and normalize snake_case YAML to camelCase TypeScript. Use a discriminated union for the four field types. Return every diagnostic as `{ code, message, source, path? }`; never throw for author input.

- [x] **Step 5: Write and run failing Markdown safety tests**

```ts
const html = renderRules(
  '# Safe\n\n<script>alert(1)</script>\n\n![remote](https://example.com/x.png)',
)
expect(html).toContain('<h1>Safe</h1>')
expect(html).not.toContain('<script')
expect(html).not.toContain('<img')
```

Run: `npm test -- src/games/render.test.ts`

Expected: FAIL before `renderRules` exists.

- [x] **Step 6: Implement restricted Marked rendering plus DOMPurify sanitization**

Configure Marked so raw HTML is escaped or omitted and image tokens render no element. Sanitize with an allow-list for headings, paragraphs, emphasis, strong text, lists, tables, code, blockquotes, and anchors; allow only `href`, `title`, and safe `rel` attributes. Force external links to `rel="noreferrer noopener"`.

- [x] **Step 7: Implement the build-time catalog and tests**

Use `import.meta.glob('/games/*/game.md', { eager: true, query: '?raw', import: 'default' })`. Parse in sorted source-path order, reject duplicate game IDs, and return either a frozen game array or diagnostics. Add a test-only `buildCatalog(sources: Record<string, string>)` export so duplicate and malformed catalogs do not depend on Vite glob fixtures.

- [x] **Step 8: Document exact YAML version-1 syntax and run gates**

Update `docs/game-format.md` with a structurally equivalent neutral fixture and a table of field-specific keys and defaults. Do not publish a candidate game name before its separate clearance task.

Run: `npm test -- src/games && npm run ci`

Expected: PASS.

- [x] **Step 9: Commit the game-definition engine**

```bash
git add package.json package-lock.json docs/game-format.md src/games src/vite-env.d.ts
git commit -m "feat: add validated game definitions"
```

---

### Task 4: Author and verify the first original game

**Files:**
- Create: `games/veilquorum/game.md`
- Create: `games/veilquorum/RIGHTS.md`
- Create: `scripts/verify-bundled-games.test.ts`
- Modify: `games/README.md`

**Interfaces:**
- Consumes: version-1 game schema and the name-clearance policy.
- Produces: catalog game ID `veilquorum`, a complete original social-deduction rules document, and a reusable repository verification contract for all bundled games.

- [x] **Step 1: Complete and record the public-name screen**

Search exact and confusingly similar uses of the proposed title in USPTO, EUIPO, TMview/BOIP coverage, general web search, BoardGameGeek search, GitHub, npm, and common app stores. Reject `Signal Cairn` because the fused form appears in a commercial naming catalog and `Cairn` is active in software and games. Adopt `Veilquorum` only after its exact web/catalog/registry searches and TMview fuzzy search return no result. Record the date, query scope, result summary, authorship `Ludocairn contributors`, provenance `original work using unprotected mechanics and common standard-deck facts`, and MIT license in `RIGHTS.md`.

- [x] **Step 2: Write a failing bundled-game contract test**

Discover `games/*/game.md`, assert each adjacent `RIGHTS.md` exists and contains `Authorship`, `License`, `Provenance`, `Name clearance`, and an ISO date, then pass every source through `buildCatalog` and expect no diagnostics.

```ts
expect(result).toMatchObject({ ok: true })
expect(result.ok && result.games.map((game) => game.id)).toContain(
  'veilquorum',
)
```

- [x] **Step 3: Run the repository game test and verify it fails**

Run: `npm test -- scripts/verify-bundled-games.test.ts`

Expected: FAIL because `veilquorum` does not exist.

- [x] **Step 4: Author the complete original game and rights record**

Use alternating `night` and `day` phases, round `1`, active/inactive boolean, original `wayfinder`/`drifter`/`echo` role choice, numeric `signals` counter with minimum `0`, and text `clue` field. Write original setup, objective, phase, vote, resolution, tie, elimination, end, and facilitation rules. Use a standard deck only as a physical randomizer/marker and do not mention or imitate a commercial game title, character set, setting, or wording.

- [x] **Step 5: Run bundled-game and full gates**

Run: `npm test -- scripts/verify-bundled-games.test.ts && npm run ci`

Expected: PASS with exactly one bundled game.

- [x] **Step 6: Commit the first game**

```bash
git add games scripts/verify-bundled-games.test.ts
git commit -m "feat: add original Veilquorum game"
```

---

### Task 5: Implement versioned session state and pure operations

**Files:**
- Create: `src/sessions/model.ts`
- Create: `src/sessions/validate.ts`
- Create: `src/sessions/operations.ts`
- Test: `src/sessions/operations.test.ts`
- Test: `src/sessions/validate.test.ts`

**Interfaces:**
- Consumes: normalized `GameDefinition`.
- Produces: `Session`, `Player`, `SessionDiagnostic`, `createSession(game, input, clock, ids)`, `addPlayer`, `renamePlayer`, `removePlayer`, `updatePlayerField`, `setPhase`, `setRound`, `adjustRound`, `updateNotes`, `renameSession`, and `validateSession(value, game)`.

- [x] **Step 1: Write failing creation and mutation tests**

Inject deterministic `clock(): string` and `ids.next(kind): string`; never mock global time or randomness. Assert copied field defaults, stable player IDs, immutable returns, updated timestamps, duplicate display names, and preservation of the previous object.

```ts
const created = createSession(game, {
  name: 'Friday table',
  playerNames: ['Ari', 'Ari'],
}, clock, ids)
expect(created).toMatchObject({
  ok: true,
  session: {
    storageVersion: 1,
    gameId: game.id,
    currentPhase: game.initialPhase,
    round: 1,
  },
})
```

- [x] **Step 2: Run the focused tests and verify missing modules fail**

Run: `npm test -- src/sessions`

Expected: FAIL with unresolved imports.

- [x] **Step 3: Implement session types, validation, and pure operations**

Every operation returns `{ ok: true, session } | { ok: false, diagnostic }`. Validate field values by field discriminant, reject unknown player/field/phase IDs, enforce number min/max/step and choice membership, and require nonblank session/player display names. Allow player counts outside recommendations; export `getPlayerCountWarning(session, game): string | undefined` instead of rejecting them.

- [x] **Step 4: Add malformed and unsupported-version validation tests**

Cover non-object JSON values, missing keys, unsupported `storageVersion`, incompatible `gameSchemaVersion`, invalid dates, duplicate player IDs, unknown fields, invalid phase/round, and field values that no longer conform to the bundled game.

- [x] **Step 5: Run session and full gates**

Run: `npm test -- src/sessions && npm run ci`

Expected: PASS.

- [x] **Step 6: Commit the session domain**

```bash
git add src/sessions
git commit -m "feat: add validated session state"
```

---

### Task 6: Deliver catalog, rules, setup, persistence, and the facilitator tracker

**Files:**
- Create: `src/storage/repository.ts`
- Create: `src/storage/memory.ts`
- Create: `src/storage/local-storage.ts`
- Create: `src/app/useSessionStore.ts`
- Create: `src/app/components/CatalogView.tsx`
- Create: `src/app/components/RulesView.tsx`
- Create: `src/app/components/SessionSetup.tsx`
- Create: `src/app/components/TrackerView.tsx`
- Create: `src/app/components/PlayerFieldControl.tsx`
- Create: `src/app/components/RecoveryCard.tsx`
- Test: `src/storage/repository.test.ts`
- Test: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`, `src/styles/global.css`

**Interfaces:**
- Consumes: bundled catalog, rendered rules, session operations, and `SessionRepository`.
- Produces: query views `?game=<id>` and `?session=<id>`, automatic persistence status, recovery cards, and a complete Veilquorum journey.

- [x] **Step 1: Define repository behavior with failing memory-adapter tests**

Define `SessionRepository` methods `list(): RepositoryRecord[]`, `load(id): LoadResult`, `save(session): SaveResult`, `remove(id): RemoveResult`, and `raw(id): string | undefined`. Test valid round trips, corrupt raw records, unsupported versions, deletion, and injected save failures. A corrupt load result must retain the raw string.

- [x] **Step 2: Implement memory and localStorage adapters**

Use key prefix `ludocairn.session.v1.`. Enumerate only prefixed keys, validate each value through the game resolver supplied to the adapter, never overwrite malformed data during reads, and convert browser security/quota exceptions into `storage.read-failed` or `storage.write-failed` diagnostics.

- [x] **Step 3: Write a failing accessible end-to-end component test**

Render `App` with an in-memory repository, deterministic clock/IDs, and a history adapter. Drive the UI by roles: open Veilquorum, start a session, enter two players, edit role/signals/active/clue, change phase/round/notes, return home, resume the saved session, and assert all values persist.

```ts
await user.click(screen.getByRole('link', { name: /Veilquorum/ }))
await user.click(screen.getByRole('button', { name: 'Start session' }))
await user.type(screen.getByLabelText('Session name'), 'Friday table')
await user.type(screen.getByLabelText('Player 1 name'), 'Ari')
await user.click(screen.getByRole('button', { name: 'Create session' }))
expect(screen.getByRole('heading', { name: 'Friday table' })).toBeVisible()
```

- [x] **Step 4: Implement URL coordination and catalog/rules/setup views**

Read only `game` and `session` query parameters. Use anchor navigation so links remain copyable and testable; invalid IDs show an alert plus a catalog action. Render sanitized rules in a semantic `article`; implement `Print rules` with `window.print`. Setup accepts a session name and dynamic player-name inputs, shows min/max guidance, and creates state only after domain validation.

- [x] **Step 5: Implement tracker controls and automatic saves**

Render phase and round before player cards. Use native checkbox, select, number input with named decrement/increment buttons, and labeled input/textarea. Confirm player removal with a `<dialog>` or an accessible inline confirmation region. Save every valid mutation through `useSessionStore`, debounce text saves by 300ms, and expose `Saving`, `Saved`, or `Not saved — <reason>` in a polite status region without discarding in-memory changes.

- [x] **Step 6: Implement responsive and recovery UI**

Stack player cards at 20rem; at 64rem use a grid only while preserving DOM order. Ensure 44px action targets, visible focus, non-color error labels, and no horizontal precision gestures. Recovery cards for corrupt/unsupported records provide `Download raw record` and a separately confirmed `Delete unreadable record` action.

- [x] **Step 7: Run storage, component, accessibility, and full gates**

Run: `npm test -- src/storage src/app && npm run ci`

Expected: PASS for the complete catalog-to-resumed-session flow.

- [x] **Step 8: Commit the social vertical slice**

```bash
git add src/storage src/app src/styles/global.css
git commit -m "feat: deliver facilitator session tracker"
```

---

### Task 7: Add original standard-card and tarot games through the same engine

**Files:**
- Create: `games/rillward-gambit/game.md`
- Create: `games/rillward-gambit/RIGHTS.md`
- Create: `games/sereinfolio/game.md`
- Create: `games/sereinfolio/RIGHTS.md`
- Modify: `src/app/App.test.tsx`, `scripts/verify-bundled-games.test.ts`, `docs/roadmap.md`

**Interfaces:**
- Consumes: unchanged game schema, catalog, session, and tracker interfaces.
- Produces: three-game catalog IDs `veilquorum`, `rillward-gambit`, and `sereinfolio` without game-specific application logic.

- [x] **Step 1: Complete and record both public-name screens**

For `Rillward Gambit` and `Sereinfolio`, repeat the exact and confusing-similarity searches required in Task 4. Record each scope and result in its adjacent `RIGHTS.md`; replace a conflicted title before public use. `Vellum Constellation` and `Quillora Mosaic` were screened and rejected before `Sereinfolio` was adopted.

- [x] **Step 2: Extend failing catalog and flow tests**

Assert exactly three unique bundled IDs. Parameterize a setup test over all three games and assert each reaches a tracker with its configured controls. Add explicit assertions that Rillward Gambit exposes score/streak/stance/notes fields and that Sereinfolio exposes reflection text, tone choice, round, and prompt notes.

- [x] **Step 3: Run focused tests and verify missing games fail them**

Run: `npm test -- scripts/verify-bundled-games.test.ts src/app/App.test.tsx`

Expected: FAIL with only one catalog game.

- [x] **Step 4: Author Rillward Gambit**

Write an original standard-card comparison game with a complete setup, turn, comparison, tie, scoring, end, and facilitation procedure. Configure round tracking plus numeric score and streak, a `steady`/`bold`/`reset` stance choice, and optional text notes. Do not reproduce published rulebook prose or branding.

- [x] **Step 5: Author Sereinfolio**

Write an original non-divinatory tarot reflection/storytelling activity with a complete setup, draw, observation, prompt, sharing, pass, round, and close procedure. Use only canonical card names and original prompts; configure reflection text, `quiet`/`curious`/`vivid` tone choice, round state, and notes. Include no imagery or copied guidebook meanings.

- [x] **Step 6: Run the three-game and full gates**

Run: `npm test -- scripts/verify-bundled-games.test.ts src/app/App.test.tsx && npm run ci`

Expected: PASS with exactly three games and no app code branching on a game ID.

- [x] **Step 7: Commit the examples**

```bash
git add games src/app/App.test.tsx scripts/verify-bundled-games.test.ts docs/roadmap.md
git commit -m "feat: add three original game examples"
```

---

### Task 8: Add safe session files, import preview, export, and print modes

**Files:**
- Create: `src/files/session-files.ts`
- Test: `src/files/session-files.test.ts`
- Create: `src/app/components/ImportSession.tsx`
- Test: `src/app/ImportSession.test.tsx`
- Modify: `src/app/components/CatalogView.tsx`, `src/app/components/TrackerView.tsx`, `src/app/App.test.tsx`, `src/styles/global.css`
- Create: `src/styles/print-contract.test.ts`

**Interfaces:**
- Consumes: session validator, catalog resolver, repository, browser `File` and download APIs.
- Produces: `serializeSession(session): string`, `parseSessionFile(text, resolveGame): ImportResult`, `prepareImportedSession(session, existingIds, ids): Session`, preview-before-save import UI, JSON export, rules print, and tracker print.

- [x] **Step 1: Write failing file-boundary tests**

Assert stable pretty JSON with trailing newline, UTF-8-safe text, malformed JSON diagnostics, unsupported storage/game versions, missing game, invalid fields, and ID collision reassignment without mutation.

```ts
expect(parseSessionFile('{broken', resolveGame)).toMatchObject({
  ok: false,
  diagnostic: { code: 'import.invalid-json' },
})
expect(prepareImportedSession(session, new Set([session.id]), ids).id).not.toBe(
  session.id,
)
```

- [x] **Step 2: Implement serialization, parsing, and collision preparation**

Use `JSON.stringify(session, null, 2) + '\n'`; parse inside `try/catch`, resolve the bundled game before validation, and return preview data containing only session name, game name, player count, and updated time. Never call a repository from this module.

- [x] **Step 3: Write failing import/export component tests**

Upload a valid local `File`, assert preview appears before repository mutation, confirm import, and assert the saved session opens. Test cancel, malformed file, missing game, and collision reassignment. Stub `URL.createObjectURL`, `URL.revokeObjectURL`, and anchor click for export; assert the privacy warning mentions facilitator notes.

- [x] **Step 4: Implement import preview and export actions**

Accept only one `.json` file, read as text, show non-mutating metadata and diagnostics, and require an explicit `Import session` confirmation. Export through a UTF-8 `Blob` named from a sanitized session name plus `.ludocairn-session.json`; revoke the object URL after click.

- [x] **Step 5: Write and satisfy print-contract tests**

Assert CSS contains `@media print`, `.rules-print` and `.tracker-print` selectors, hides `.print-hidden`, navigation, editing, save state, and destructive controls, sets monochrome output, and applies `break-inside: avoid` to player records.

- [x] **Step 6: Run file, print, component, and full gates**

Run: `npm test -- src/files src/app/ImportSession.test.tsx src/styles/print-contract.test.ts && npm run ci`

Expected: PASS.

- [x] **Step 7: Commit portability and print behavior**

```bash
git add src/files src/app src/styles/global.css src/styles/print-contract.test.ts
git commit -m "feat: add session files and print modes"
```

---

### Task 9: Verify, document, publish, and exercise the GitHub Pages release

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `docs/game-format.md`, `docs/roadmap.md`
- Modify: `scripts/verify-static-build.test.ts`, `scripts/verify-static-build.mjs`
- Verify without modification: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: the complete release and existing GitHub Pages workflow.
- Produces: contributor/user instructions, a verified static artifact, pushed feature branch, reviewed integration into `main`, and a manually exercised production URL.

- [x] **Step 1: Extend the static artifact contract before changing release docs**

Assert `dist/index.html` contains relative JS/CSS assets, contains `Ludocairn`, contains no `http://` or `https://` runtime asset/script references, and that every referenced local asset exists beneath `dist/`.

- [x] **Step 2: Update user and contributor documentation**

Document `npm install`, `npm run dev`, `npm run ci`, GitHub Pages deployment, local-only privacy, session export/import, print behavior, the three games, game authoring, rights records, and the preliminary nature of name screening. Mark every implemented roadmap item complete without claiming future multiplayer or cloud features.

- [x] **Step 3: Run automated release verification**

Run: `npm run ci`

Expected: lint, formatting, types, all tests, production build, and static artifact verification PASS.

- [ ] **Step 4: Run local browser release checks**

Serve the production artifact and exercise, at narrow and wide widths, catalog → each rules page → new session → all field types → refresh restoration → export → import preview/confirm → print rules → print tracker. Repeat the primary journey using only the keyboard and inspect the accessibility tree for labels, landmarks, alerts, and status regions.

- [ ] **Step 5: Push the feature branch and review integration**

Run: `git push -u origin codex/first-usable-release`

Expected: the remote branch is created and GitHub Actions passes. Review the full diff against the approved spec, then merge or fast-forward to `main` only with the user's existing authorization for this release workflow.

- [ ] **Step 6: Verify GitHub Pages production**

Wait for the Pages workflow to report success. Open the environment URL from the workflow output, hard-refresh under the repository subpath, and repeat the catalog-to-restored-session journey. Confirm no network requests are made except same-origin static files.

- [ ] **Step 7: Record the production URL and commit any evidence-only documentation**

Add the final Pages URL and verification date to `README.md` and `docs/roadmap.md`, rerun `npm run ci`, commit those documentation changes, and push `main`.
