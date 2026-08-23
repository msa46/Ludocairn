# Browser-Authored Custom Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people author, validate, save, run, import, export, and share complete version-1 Ludocairn games entirely in the browser.

**Architecture:** Keep raw `game.md` source canonical, reuse the existing parser as the only validation authority, and add focused source, repository, lifecycle, and portability modules beneath a three-view Game Studio. Merge valid custom records with bundled games at runtime while guarding saved-session compatibility and keeping every custom-game operation local to the browser.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest and Testing Library, YAML 2, DOMPurify/Marked, browser `localStorage`, and `fflate` 0.8.3 for client-side DEFLATE.

**Spec:** `docs/superpowers/specs/2026-08-23-browser-authored-custom-games-design.md`

## Global Constraints

- Node.js must remain `>=22.22.2 <23`; npm must remain version 10 or newer.
- Custom games use the existing version-1 Markdown/YAML schema; do not add a second schema or unsupported game behavior.
- Raw game source is canonical across storage, paste, file import/export, and URL sharing.
- No backend, account, telemetry, runtime network dependency, ownership field, author field, or license field may be introduced.
- All source entry paths reject UTF-8 content larger than 1,048,576 bytes before parsing; decompression must stop once that output limit is crossed.
- Share URLs use `#share-game=v1.<payload>` and must not be offered above 8,000 total URL characters.
- Bundled games remain read-only and cannot be shadowed by custom IDs.
- A saved custom ID is immutable; updates and deletion must not invalidate or strand saved sessions silently.
- Existing session JSON remains unchanged and never embeds custom game source.
- Use test-driven development: create one failing behavior test, observe the expected failure, implement the minimum, and rerun before the next behavior.
- Do not commit generated `dist/` output.

---

### Task 1: Canonical source serializer and source limits

**Files:**
- Create: `src/games/source.ts`
- Create: `src/games/source.test.ts`

**Interfaces:**
- Consumes: `GameDefinition` and `parseGameSource(source, sourceName)`.
- Produces: `MAX_GAME_SOURCE_BYTES`, `gameSourceFitsLimit(source)`, `createGameTemplate()`, `serializeGameSource(game)`, and `sourceHasFrontmatterComments(source)`.

- [ ] **Step 1: Write failing serializer and limit tests**

```ts
it('serializes every version-1 branch into parseable canonical source', () => {
  const source = serializeGameSource(fullGame)
  const reparsed = parseGameSource(source, 'custom/full-game/game.md')
  expect(reparsed).toMatchObject({
    ok: true,
    game: { ...fullGame, source: 'custom/full-game/game.md' },
  })
  expect(source).toContain('game_master: all')
  expect(source).toContain('# Full Game\n')
})

it('uses one UTF-8 byte limit for templates, paste, storage, and shares', () => {
  expect(gameSourceFitsLimit('é'.repeat(524_288))).toBe(true)
  expect(gameSourceFitsLimit('é'.repeat(524_289))).toBe(false)
})

it('creates a valid minimal editable template', () => {
  expect(parseGameSource(createGameTemplate(), 'custom/new-game/game.md')).toMatchObject({
    ok: true,
    game: { id: 'new-game', fields: [], roles: [] },
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the expected missing-module failure**

Run: `npm test -- src/games/source.test.ts`

Expected: FAIL because `src/games/source.ts` and its exports do not exist.

- [ ] **Step 3: Implement deterministic source generation**

Use `yaml.stringify` with a plain snake-case source object. Omit optional schema sections when empty, map `gameMaster` back to `game_master`, and append normalized Markdown after a closing delimiter:

```ts
export const MAX_GAME_SOURCE_BYTES = 1_048_576

export function gameSourceFitsLimit(source: string): boolean {
  return new TextEncoder().encode(source).byteLength <= MAX_GAME_SOURCE_BYTES
}

export function serializeGameSource(game: GameDefinition): string {
  const frontmatter = {
    schema_version: 1,
    id: game.id,
    name: game.name,
    summary: game.summary,
    deck: game.deck,
    players: game.players,
    ...(game.roles.length ? { roles: game.roles.map(serializeRole) } : {}),
    ...(game.roleDistributions.length
      ? { role_distributions: game.roleDistributions }
      : {}),
    ...(game.assignments
      ? {
          assignments: {
            method: 'shuffle',
            visibility: {
              players: game.assignments.visibility.players,
              game_master: game.assignments.visibility.gameMaster,
            },
          },
        }
      : {}),
    session: serializeSessionDefinition(game),
  }
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n\n${game.rulesMarkdown.trimStart()}`
}
```

Add `sourceHasFrontmatterComments` by examining only the YAML between delimiters for lines matching optional whitespace followed by `#`. Keep `GameDefinition.source` as the diagnostic source name, not the raw canonical source.

- [ ] **Step 4: Run source tests and existing parser/catalog tests**

Run: `npm test -- src/games/source.test.ts src/games/parse.test.ts src/games/catalog.test.ts`

Expected: PASS with no diagnostics or console warnings.

- [ ] **Step 5: Commit the source foundation**

```bash
git add src/games/source.ts src/games/source.test.ts
git commit -m "feat: serialize canonical custom game source"
```

---

### Task 2: Versioned custom-game repositories and corrupt-record recovery

**Files:**
- Create: `src/storage/game-repository.ts`
- Create: `src/storage/local-game-storage.ts`
- Create: `src/storage/memory-game-storage.ts`
- Create: `src/storage/game-repository.test.ts`

**Interfaces:**
- Consumes: `parseGameSource`, `gameSourceFitsLimit`, browser `Storage`.
- Produces: `GAME_KEY_PREFIX`, `GameRepository`, `GameRepositoryRecord`, `GameLoadResult`, `GameSaveResult`, `keyForGame(id)`, `LocalStorageGameRepository`, and `MemoryGameRepository`.

- [ ] **Step 1: Write failing repository contract tests**

```ts
it('round-trips canonical source and sorts valid records by name then ID', () => {
  const repository = new MemoryGameRepository()
  expect(repository.save(alphaSource)).toMatchObject({ ok: true })
  expect(repository.save(zuluSource)).toMatchObject({ ok: true })
  expect(repository.list().map((record) => record.id)).toEqual(['alpha', 'zulu'])
  expect(repository.load('alpha')).toMatchObject({
    ok: true,
    game: { id: 'alpha' },
    source: alphaSource,
  })
})

it('keeps malformed, oversized, and key-mismatched source recoverable', () => {
  const repository = new MemoryGameRepository({
    initial: {
      [keyForGame('broken')]: '{not yaml',
      [keyForGame('wrong-key')]: alphaSource,
    },
  })
  expect(repository.list()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'broken', ok: false, raw: '{not yaml' }),
      expect.objectContaining({ id: 'wrong-key', ok: false, raw: alphaSource }),
    ]),
  )
})

it('reports blocked reads and writes without replacing a prior record', () => {
  const storage = throwingStorage()
  const repository = new LocalStorageGameRepository(storage)
  expect(repository.list()[0]).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-storage.read-failed' },
  })
  expect(repository.save(alphaSource)).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-storage.write-failed' },
  })
})
```

- [ ] **Step 2: Run the repository test and verify RED**

Run: `npm test -- src/storage/game-repository.test.ts`

Expected: FAIL because the repository contracts and implementations are absent.

- [ ] **Step 3: Implement parsing and repository contracts**

```ts
export const GAME_KEY_PREFIX = 'ludocairn.game.v1.'

export type GameLoadResult =
  | { readonly ok: true; readonly game: GameDefinition; readonly source: string }
  | { readonly ok: false; readonly diagnostic: GameStorageDiagnostic; readonly raw?: string }

export type GameRepositoryRecord = GameLoadResult & { readonly id: string }

export interface GameRepository {
  list(): readonly GameRepositoryRecord[]
  load(id: string): GameLoadResult
  save(source: string): GameSaveResult
  remove(id: string): GameSaveResult
  raw(id: string): string | undefined
}
```

`parseStoredGame` must reject oversize source before parsing, parse with source name `custom/<expected-id>/game.md`, and compare the parsed ID with `expectedId`. Define separate diagnostic codes for invalid source, oversized source, key mismatch, not found, read failure, and write failure.

- [ ] **Step 4: Implement local and memory repositories**

Both repositories enumerate only `GAME_KEY_PREFIX` keys. `save(source)` parses first, then writes exactly once under `keyForGame(parsed.game.id)`. `list()` returns valid records sorted by `game.name.localeCompare`, then ID, followed by invalid records sorted by ID. The memory repository supports `initial`, `failReads`, and `failWrites` test options.

- [ ] **Step 5: Run repository and session-storage regression tests**

Run: `npm test -- src/storage/game-repository.test.ts src/storage/repository.test.ts`

Expected: PASS; session repository behavior remains unchanged.

- [ ] **Step 6: Commit custom-game persistence**

```bash
git add src/storage/game-repository.ts src/storage/local-game-storage.ts src/storage/memory-game-storage.ts src/storage/game-repository.test.ts
git commit -m "feat: persist custom games locally"
```

---

### Task 3: Runtime catalog merge and session-safe lifecycle checks

**Files:**
- Create: `src/games/manage.ts`
- Create: `src/games/manage.test.ts`
- Modify: `src/storage/repository.ts`

**Interfaces:**
- Consumes: bundled `GameDefinition[]`, `GameRepositoryRecord[]`, `RepositoryRecord[]`, `parseGameSource`, and `validateSession`.
- Produces: `mergeGameCatalog`, `reviewGameSave`, `findGameUsage`, and `reviewGameDeletion`.

- [ ] **Step 1: Write failing merge, update, and deletion tests**

```ts
it('keeps bundled order and appends valid custom games by repository order', () => {
  expect(mergeGameCatalog([bundled], customRecords).games.map((game) => game.id)).toEqual([
    'bundled',
    'alpha',
    'zulu',
  ])
})

it('rejects bundled collisions and changing an existing custom ID', () => {
  expect(reviewGameSave(bundledSource, context)).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-save.bundled-collision' },
  })
  expect(reviewGameSave(renamedSource, { ...context, originalId: 'alpha' })).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-save.id-changed' },
  })
})

it('rejects revisions and deletion when readable or identifiable raw sessions use the game', () => {
  expect(reviewGameSave(incompatibleAlphaSource, contextWithAlphaSession)).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-save.incompatible-sessions', sessionIds: ['session-1'] },
  })
  expect(reviewGameDeletion('alpha', contextWithCorruptAlphaSession)).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-delete.sessions-use-game' },
  })
})
```

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `npm test -- src/games/manage.test.ts`

Expected: FAIL because `src/games/manage.ts` does not exist.

- [ ] **Step 3: Expose safe raw session identification**

Add this read-only helper without weakening normal session validation:

```ts
export function gameIdFromStoredSession(raw: string): string | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null &&
      typeof (value as Record<string, unknown>).gameId === 'string'
      ? ((value as Record<string, unknown>).gameId as string)
      : undefined
  } catch {
    return undefined
  }
}
```

- [ ] **Step 4: Implement merge and preflight checks**

```ts
export function reviewGameSave(
  source: string,
  context: {
    readonly originalId?: string
    readonly bundledIds: ReadonlySet<string>
    readonly customRecords: readonly GameRepositoryRecord[]
    readonly sessionRecords: readonly RepositoryRecord[]
  },
): GameSaveReview
```

Parse and size-check first. Reject a bundled collision, a changed `originalId`, or a new custom collision. For an update, validate every readable referencing session with the candidate game. Treat session enumeration read failures as a hard stop. `findGameUsage` must inspect readable sessions directly and invalid records through `raw` plus `gameIdFromStoredSession`.

Use these exact result contracts so the Studio and import review share the same
preflight behavior:

```ts
export type GameSaveReview =
  | { readonly ok: true; readonly game: GameDefinition; readonly source: string }
  | { readonly ok: false; readonly diagnostic: GameSaveDiagnostic }

export type GameDeletionReview =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: GameDeletionDiagnostic }

export function mergeGameCatalog(
  bundled: readonly GameDefinition[],
  records: readonly GameRepositoryRecord[],
): {
  readonly games: readonly GameDefinition[]
  readonly customIds: ReadonlySet<string>
  readonly recovery: readonly GameRepositoryRecord[]
}
```

- [ ] **Step 5: Run lifecycle, parser, and session repository tests**

Run: `npm test -- src/games/manage.test.ts src/storage/repository.test.ts src/sessions/validate.test.ts`

Expected: PASS with update and delete guards proven.

- [ ] **Step 6: Commit lifecycle safety**

```bash
git add src/games/manage.ts src/games/manage.test.ts src/storage/repository.ts src/storage/repository.test.ts
git commit -m "feat: guard custom game lifecycle"
```

---

### Task 4: Portable game files and compressed share fragments

**Files:**
- Create: `src/files/game-files.ts`
- Create: `src/files/game-files.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: canonical source helpers, `parseGameSource`, and `fflate`.
- Produces: `parseGameFile`, `gameDownloadName`, `createGameDownload`, `createGameShareUrl`, `parseGameShareHash`, `SHARE_URL_LIMIT`, and `ShareCodecDiagnostic`.

- [ ] **Step 1: Install the pinned compression dependency**

Run: `npm install --save-exact fflate@0.8.3`

Expected: `package.json` and `package-lock.json` record exactly `0.8.3`; no other dependency changes.

- [ ] **Step 2: Write failing file and share-codec tests**

```ts
it('round-trips Unicode canonical source through a versioned fragment', () => {
  const shared = createGameShareUrl(cafeSource, 'https://example.test/app/')
  expect(shared.ok).toBe(true)
  if (!shared.ok) return
  expect(shared.url).toContain('#share-game=v1.')
  expect(parseGameShareHash(new URL(shared.url).hash)).toMatchObject({
    ok: true,
    source: cafeSource,
    game: { id: 'cafe-game' },
  })
})

it('rejects unsupported, corrupt, oversized-output, and overlong links', () => {
  expect(parseGameShareHash('#share-game=v2.abc')).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-share.unsupported-version' },
  })
  expect(parseGameShareHash(corruptHash)).toMatchObject({ ok: false })
  expect(createGameShareUrl(longValidSource, longBaseUrl)).toMatchObject({
    ok: false,
    diagnostic: { code: 'game-share.url-too-long' },
  })
})

it('creates an exact UTF-8 Markdown download', async () => {
  const download = createGameDownload(cafeGame, cafeSource)
  expect(download.filename).toBe('cafe-game.ludocairn-game.md')
  expect(download.blob.type).toBe('text/markdown;charset=utf-8')
  expect(await download.blob.text()).toBe(cafeSource)
})
```

- [ ] **Step 3: Run codec tests and verify RED**

Run: `npm test -- src/files/game-files.test.ts`

Expected: FAIL because the game portability module is missing.

- [ ] **Step 4: Implement file parsing, filename sanitation, and downloads**

`parseGameFile` must enforce the one-mebibyte UTF-8 limit and return a preview containing name, summary, deck, player range, schema version, role count, and field count. `gameDownloadName` must use the existing session filename sanitation style but end in `.ludocairn-game.md`.

- [ ] **Step 5: Implement a bounded DEFLATE/base64url codec**

Use `zlibSync(strToU8(source))` for encoding. Convert bytes to base64 in bounded chunks before applying URL-safe substitutions. Decode base64url strictly. Use streaming `Unzlib` output handling and throw an oversize diagnostic as soon as accumulated output exceeds `MAX_GAME_SOURCE_BYTES`; do not call `unzlibSync` on untrusted payloads.

```ts
export const SHARE_URL_LIMIT = 8_000

export type ShareResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: ShareCodecDiagnostic }

export function createGameShareUrl(source: string, baseUrl: string): ShareResult
export function parseGameShareHash(hash: string): GameFileResult
```

- [ ] **Step 6: Run portability and parser tests**

Run: `npm test -- src/files/game-files.test.ts src/games/source.test.ts src/games/parse.test.ts`

Expected: PASS, including Unicode and decompression-boundary cases.

- [ ] **Step 7: Commit portable game files**

```bash
git add package.json package-lock.json src/files/game-files.ts src/files/game-files.test.ts
git commit -m "feat: export and share custom games"
```

---

### Task 5: Runtime custom catalog and stable session resolution

**Files:**
- Create: `src/app/useGameStore.ts`
- Create: `src/app/useGameStore.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/components/CatalogView.tsx`

**Interfaces:**
- Consumes: `GameRepository`, `mergeGameCatalog`, bundled games, and the existing `SessionRepository`.
- Produces: `useGameStore(repository, bundledGames)`, merged catalog rendering, and custom-game-aware session resolution.

- [ ] **Step 1: Write failing store and App integration tests**

```tsx
it('loads a stored custom game into the catalog', async () => {
  const gameRepository = new MemoryGameRepository({
    initial: { [keyForGame('custom-game')]: customSource },
  })
  render(<App games={bundledGames} gameRepository={gameRepository} />)
  expect(screen.getByRole('heading', { name: 'Custom Game' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Open Custom Game' }))
  expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument()
})

it('resolves a saved custom-game session after refresh', async () => {
  const gameRepository = new MemoryGameRepository({
    initial: { [keyForGame('custom-game')]: customSource },
  })
  const sessionRepository = new MemorySessionRepository((id) => {
    const loaded = gameRepository.load(id)
    return loaded.ok ? loaded.game : undefined
  })
  sessionRepository.save(customSession)
  window.history.replaceState({}, '', '/?session=custom-session')
  render(
    <App
      games={bundledGames}
      gameRepository={gameRepository}
      repository={sessionRepository}
    />,
  )
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Custom Friday' }),
  ).toBeInTheDocument()
})

it('does not let a custom record shadow a bundled game', () => {
  render(<App games={bundledGames} gameRepository={collisionRepository} />)
  expect(screen.getAllByRole('heading', { name: 'Veilquorum' })).toHaveLength(1)
  expect(screen.getByText(/custom game ID conflicts/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused App/store tests and verify RED**

Run: `npm test -- src/app/useGameStore.test.tsx src/app/App.test.tsx`

Expected: FAIL because `gameRepository` and the custom catalog store do not exist.

- [ ] **Step 3: Implement the custom game store**

```ts
export function useGameStore(
  repository: GameRepository,
  bundledGames: readonly GameDefinition[],
) {
  const [revision, setRevision] = useState(0)
  const records = useMemo(() => repository.list(), [repository, revision])
  const catalog = useMemo(
    () => mergeGameCatalog(bundledGames, records),
    [bundledGames, records],
  )
  return { ...catalog, records, refresh: () => setRevision((value) => value + 1) }
}
```

The default App repository is `LocalStorageGameRepository(window.localStorage)`. Add optional `gameRepository?: GameRepository` injection. Construct the default session resolver so each lookup checks bundled games and then `gameRepository.load(id)`; this keeps a stable repository capable of resolving games saved after App initialization.

- [ ] **Step 4: Render custom catalog identity and recovery diagnostics**

Extend `CatalogView` props with a `customGameIds: ReadonlySet<string>` and `gameRecovery: ReactNode`. Label custom cards “Custom game” and preserve bundled numbering/order. Do not add mutation actions until Task 11.

- [ ] **Step 5: Run App, catalog, session import, and session-store tests**

Run: `npm test -- src/app/useGameStore.test.tsx src/app/App.test.tsx src/app/ImportSession.test.tsx src/app/useSessionStore.test.tsx`

Expected: PASS; bundled and custom session resolution both work.

- [ ] **Step 6: Commit runtime catalog integration**

```bash
git add src/app/useGameStore.ts src/app/useGameStore.test.tsx src/app/App.tsx src/app/App.test.tsx src/app/components/CatalogView.tsx
git commit -m "feat: load custom games into the catalog"
```

---

### Task 6: File, paste, and share-link review before save

**Files:**
- Create: `src/app/components/ImportGame.tsx`
- Create: `src/app/ImportGame.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/CatalogView.tsx`

**Interfaces:**
- Consumes: `parseGameFile`, `parseGameShareHash`, `reviewGameSave`, `GameRepository`, and session records.
- Produces: `ImportGame` review UI and App handling for `#share-game=v1.<payload>`.

- [ ] **Step 1: Write failing paste/file review tests**

```tsx
it('reviews pasted source before saving and then opens its rules', async () => {
  renderApp()
  fireEvent.click(screen.getByRole('button', { name: 'Paste game source' }))
  fireEvent.change(screen.getByLabelText('Complete game source'), {
    target: { value: customSource },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review game' }))
  const review = screen.getByRole('region', { name: 'Review game import' })
  expect(within(review).getByText('Custom Game')).toBeInTheDocument()
  expect(gameRepository.list()).toHaveLength(0)
  fireEvent.click(within(review).getByRole('button', { name: 'Save custom game' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Custom Game' })).toBeInTheDocument()
})

it('accepts one Markdown file and rejects other extensions or oversized input', async () => {
  expect(screen.getByLabelText('Game Markdown file')).toHaveAttribute(
    'accept',
    '.md,.ludocairn-game.md,text/markdown',
  )
  uploadGame('game.json', customSource)
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a Markdown game file')
})
```

- [ ] **Step 2: Write failing share-fragment review test**

```tsx
it('reviews a shared game and clears the fragment only after a successful save', async () => {
  window.history.replaceState({}, '', '/#share-game=' + sharePayload)
  renderApp()
  expect(await screen.findByRole('region', { name: 'Review shared game' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save custom game' }))
  expect(window.location.hash).toBe('')
  expect(screen.getByRole('heading', { level: 1, name: 'Custom Game' })).toBeInTheDocument()
})
```

- [ ] **Step 3: Run import UI tests and verify RED**

Run: `npm test -- src/app/ImportGame.test.tsx`

Expected: FAIL because `ImportGame` and App share-fragment routing are absent.

- [ ] **Step 4: Implement a shared review state machine**

`ImportGame` owns `idle | paste | review-valid | review-invalid` state. File, paste, and share paths all produce the same preview structure. Confirmation calls `reviewGameSave`, passing the existing custom ID as `originalId` when the import is an update, then `repository.save(source)`, then `onSaved(game.id)`. Invalid input keeps raw source and exposes **Repair in Game Studio** through `onRepair(source)`. A failed preflight or write stays on review and keeps source intact.

```ts
interface ImportGameProps {
  readonly sharedHash?: string
  readonly bundledIds: ReadonlySet<string>
  readonly customRecords: readonly GameRepositoryRecord[]
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly repository: GameRepository
  readonly onSaved: (id: string) => void
  readonly onRepair: (source: string) => void
}
```

- [ ] **Step 5: Integrate hash review without sending or prematurely clearing the fragment**

App reads `window.location.hash` on first render and `hashchange`. It passes a decoded share result into `ImportGame`, navigates nowhere until confirmation, and uses `history.replaceState` to remove the fragment only after `repository.save` succeeds. `onRepair` stores the raw draft in App memory and opens `?studio=repair`; Task 7 consumes that state without putting invalid source in local storage.

- [ ] **Step 6: Run import, App, and portability tests**

Run: `npm test -- src/app/ImportGame.test.tsx src/app/App.test.tsx src/files/game-files.test.ts`

Expected: PASS for paste, file, shared review, update review, bundled collision, and save failure.

- [ ] **Step 7: Commit game import and shared review**

```bash
git add src/app/components/ImportGame.tsx src/app/ImportGame.test.tsx src/app/App.tsx src/app/components/CatalogView.tsx
git commit -m "feat: review imported and shared games"
```

---

### Task 7: Game Studio shell, source editing, preview, and guarded save

**Files:**
- Create: `src/app/components/GameStudio.tsx`
- Create: `src/app/GameStudio.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/RulesView.tsx`

**Interfaces:**
- Consumes: `createGameTemplate`, `parseGameSource`, `renderRules`, `RoleGuide`, `reviewGameSave`, and `GameRepository`.
- Produces: `GameStudio` with `guided | source | preview` views and `?studio=new` / `?studio=<id>` routes.

- [ ] **Step 1: Write failing new/edit/source diagnostics tests**

```tsx
it('opens a valid template, retains invalid source, and shows the last valid preview', () => {
  openNewStudio()
  fireEvent.click(screen.getByRole('tab', { name: 'Source' }))
  const editor = screen.getByLabelText('Complete game source')
  fireEvent.change(editor, { target: { value: '---\nid: Broken' } })
  expect(screen.getByRole('alert')).toHaveTextContent('frontmatter')
  fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
  expect(screen.getByText('Preview shows the last valid draft')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'New Game' })).toBeInTheDocument()
})

it('keeps a saved ID read-only and rejects an incompatible session revision', () => {
  openExistingStudio('custom-game')
  expect(screen.getByLabelText('Game ID')).toBeDisabled()
  replaceSource(incompatibleSource)
  fireEvent.click(screen.getByRole('button', { name: 'Save game' }))
  expect(screen.getByRole('alert')).toHaveTextContent('saved session')
  expect(gameRepository.load('custom-game')).toMatchObject({ source: originalSource })
})
```

- [ ] **Step 2: Write the failing dirty-navigation test**

```tsx
it('confirms in-app navigation and registers beforeunload while dirty', () => {
  openNewStudio()
  editSource(validChangedSource)
  expect(beforeUnloadListener).toBeDefined()
  fireEvent.click(screen.getByRole('link', { name: 'All games' }))
  expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
})
```

- [ ] **Step 3: Run Studio tests and verify RED**

Run: `npm test -- src/app/GameStudio.test.tsx`

Expected: FAIL because the Studio and routes do not exist.

- [ ] **Step 4: Implement Studio state and source/preview tabs**

```ts
interface GameStudioProps {
  readonly initialSource: string
  readonly originalId?: string
  readonly bundledIds: ReadonlySet<string>
  readonly customRecords: readonly GameRepositoryRecord[]
  readonly sessionRecords: readonly RepositoryRecord[]
  readonly onSave: (source: string) => GameSaveResult
  readonly onSaved: (id: string) => void
  readonly onCancel: () => void
}
```

Keep `source`, `lastValid`, `savedSource`, `activeView`, and confirmation state separate. Parse on source changes. Preview uses `lastValid.game`. Save requires current valid source, successful `reviewGameSave`, and successful repository write. The Guided tab is initially a valid read-only summary until Tasks 8–10 replace it with controls.

- [ ] **Step 5: Add route integration and edit entry point**

App resolves `?studio=new` to `createGameTemplate()`, `?studio=repair` to the raw in-memory source received from `ImportGame.onRepair`, and `?studio=<encoded-id>` through the custom repository only. Refreshing a repair-only route without in-memory source returns to the catalog with a recovery message. `RulesView` receives an optional `onEdit`; show **Edit custom game** only for custom games.

- [ ] **Step 6: Run Studio, App, rules, and lifecycle tests**

Run: `npm test -- src/app/GameStudio.test.tsx src/app/App.test.tsx src/games/manage.test.ts src/games/render.test.ts`

Expected: PASS for new, repair, edit, diagnostics, guarded save, and navigation protection.

- [ ] **Step 7: Commit the Studio shell**

```bash
git add src/app/components/GameStudio.tsx src/app/GameStudio.test.tsx src/app/App.tsx src/app/components/RulesView.tsx
git commit -m "feat: add custom game source studio"
```

---

### Task 8: Guided identity, session-flow, and rules editing

**Files:**
- Create: `src/app/components/GuidedGameEditor.tsx`
- Create: `src/app/components/GuidedGameEditor.test.tsx`
- Modify: `src/app/components/GameStudio.tsx`

**Interfaces:**
- Consumes: valid `GameDefinition`, `serializeGameSource`, and a source-changing callback.
- Produces: `GuidedGameEditor({ game, idLocked, onChange })` covering identity, phases, rounds, and rules.

- [ ] **Step 1: Write failing identity and rules tests**

```tsx
it('edits identity and rules and emits valid canonical source', () => {
  renderGuided(minimalGame)
  fireEvent.change(screen.getByLabelText('Game name'), { target: { value: 'River Council' } })
  fireEvent.change(screen.getByLabelText('Rules Markdown'), { target: { value: '# River Council\n\nPlay.' } })
  const parsed = parseGameSource(latestSource(), 'custom/river-council/game.md')
  expect(parsed).toMatchObject({
    ok: true,
    game: { name: 'River Council', rulesMarkdown: '# River Council\n\nPlay.' },
  })
})
```

- [ ] **Step 2: Write failing phase/round ordering tests**

```tsx
it('adds, reorders, and removes phases and configures an initial round', () => {
  renderGuided(minimalGame)
  fireEvent.click(screen.getByRole('button', { name: 'Add phase' }))
  setPhase(0, 'night', 'Night')
  fireEvent.click(screen.getByRole('button', { name: 'Add phase' }))
  setPhase(1, 'day', 'Day')
  fireEvent.click(screen.getByRole('button', { name: 'Move Day up' }))
  fireEvent.click(screen.getByLabelText('Track rounds'))
  fireEvent.change(screen.getByLabelText('Initial round'), { target: { value: '2' } })
  expect(parseLatest()).toMatchObject({
    ok: true,
    game: { phases: [{ id: 'day' }, { id: 'night' }], initialPhase: 'day', round: { enabled: true, initial: 2 } },
  })
})
```

- [ ] **Step 3: Write the failing YAML-comment disclosure test**

```tsx
it('warns before the first guided edit would normalize YAML comments', () => {
  openRepairStudio(commentedSource)
  fireEvent.click(screen.getByRole('tab', { name: 'Guided' }))
  fireEvent.change(screen.getByLabelText('Game name'), { target: { value: 'Changed' } })
  expect(screen.getByRole('dialog', { name: 'Normalize source formatting?' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue with guided editing' }))
  expect(currentSource()).not.toContain('# keep this note')
})
```

- [ ] **Step 4: Run guided base tests and verify RED**

Run: `npm test -- src/app/components/GuidedGameEditor.test.tsx`

Expected: FAIL because the guided editor is absent.

- [ ] **Step 5: Implement immutable guided updates**

Render labeled controls for ID, name, summary, deck, player bounds, phases, initial phase, rounds, and rules. Every accepted control change builds a new `GameDefinition`, serializes it, and passes source to `onChange`. Keep temporary numeric input strings locally so clearing a number does not coerce it to zero; show an inline error until it becomes a valid integer.

- [ ] **Step 6: Run guided and Studio synchronization tests**

Run: `npm test -- src/app/components/GuidedGameEditor.test.tsx src/app/GameStudio.test.tsx`

Expected: PASS; Source reflects guided changes and Preview reflects the same parsed game.

- [ ] **Step 7: Commit guided base editing**

```bash
git add src/app/components/GuidedGameEditor.tsx src/app/components/GuidedGameEditor.test.tsx src/app/components/GameStudio.tsx
git commit -m "feat: guide custom game basics"
```

---

### Task 9: Guided roles, card selectors, distributions, and assignments

**Files:**
- Create: `src/app/components/RoleEditor.tsx`
- Create: `src/app/components/RoleEditor.test.tsx`
- Create: `src/app/components/DistributionEditor.tsx`
- Create: `src/app/components/DistributionEditor.test.tsx`
- Modify: `src/app/components/GuidedGameEditor.tsx`

**Interfaces:**
- Consumes: `RoleDefinition[]`, `RoleDistribution[]`, `AssignmentDefinition`, deck, and player bounds.
- Produces: controlled `RoleEditor` and `DistributionEditor` components that emit complete immutable values.

- [ ] **Step 1: Write failing role and selector tests**

```tsx
it('authors repeatable roles with every selector property', () => {
  renderRoleEditor([])
  fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
  setRoleIdentity(0, { id: 'oracle', label: 'Oracle', team: 'Light', summary: 'Reads the signal.' })
  fireEvent.click(screen.getByLabelText('Oracle uses a card marker'))
  setCardMarker(0, {
    label: 'Red court card',
    ids: 'standard-52:hearts:king',
    suits: 'hearts, diamonds',
    ranks: 'king, queen',
    arcana: '',
    tags: 'red, face',
  })
  expect(latestRoles()[0]).toMatchObject({
    id: 'oracle',
    card: { selector: { ids: ['standard-52:hearts:king'], suits: ['hearts', 'diamonds'], ranks: ['king', 'queen'], tags: ['red', 'face'] } },
  })
})
```

- [ ] **Step 2: Write failing distribution and dealing tests**

```tsx
it('requires every role count, supports remaining, and enables visibility', () => {
  renderDistributionEditor(twoRoles, { min: 5, max: 8 })
  fireEvent.click(screen.getByRole('button', { name: 'Add distribution band' }))
  setBand(0, { min: 5, max: 8, oracle: '1', villager: 'remaining' })
  enableAssignments({ players: 'own', gameMaster: 'all' })
  expect(latestDefinition()).toMatchObject({
    roleDistributions: [{ players: { min: 5, max: 8 }, counts: { oracle: 1, villager: 'remaining' } }],
    assignments: { method: 'shuffle', visibility: { players: 'own', gameMaster: 'all' } },
  })
})
```

- [ ] **Step 3: Run role/distribution tests and verify RED**

Run: `npm test -- src/app/components/RoleEditor.test.tsx src/app/components/DistributionEditor.test.tsx`

Expected: FAIL because both editors are absent.

- [ ] **Step 4: Implement role operations without guessing dependencies**

Split comma-separated selector controls by comma, trim values, and omit empty arrays. Add/remove/move roles. Before a rename or removal that affects a role field, distribution, or assignment, emit a blocking dependency message listing the affected section; do not rewrite those references automatically.

- [ ] **Step 5: Implement distributions and assignment controls**

Render one count control per current role for every band. Keep incomplete band values local and emit only a fully typed candidate. Disable assignment controls until roles and a complete distribution exist. Render visibility selects with the exact schema values `own|all|none` and `all|none`.

- [ ] **Step 6: Run role, distribution, parser, assignment, and Studio tests**

Run: `npm test -- src/app/components/RoleEditor.test.tsx src/app/components/DistributionEditor.test.tsx src/games/parse.test.ts src/assignments/deal.test.ts src/app/GameStudio.test.tsx`

Expected: PASS for both deck types, dependency blocking, ordered bands, and valid digital dealing.

- [ ] **Step 7: Commit guided role configuration**

```bash
git add src/app/components/RoleEditor.tsx src/app/components/RoleEditor.test.tsx src/app/components/DistributionEditor.tsx src/app/components/DistributionEditor.test.tsx src/app/components/GuidedGameEditor.tsx
git commit -m "feat: guide custom roles and dealing"
```

---

### Task 10: Guided full tracker-field editing

**Files:**
- Create: `src/app/components/FieldEditor.tsx`
- Create: `src/app/components/FieldEditor.test.tsx`
- Modify: `src/app/components/GuidedGameEditor.tsx`

**Interfaces:**
- Consumes: `PlayerFieldDefinition[]` and declared roles.
- Produces: `FieldEditor({ fields, roles, onChange })` supporting all five field variants.

- [ ] **Step 1: Write one failing test for every field type**

```tsx
it.each([
  ['boolean', { default: true }],
  ['choice', { choices: ['steady', 'daring'], default: 'steady' }],
  ['number', { default: 2, min: 0, max: 10, step: 2 }],
  ['text', { default: 'note', multiline: true }],
  ['role', { default: 'oracle' }],
] as const)('authors a valid %s tracker field', (type, expected) => {
  renderFieldEditor([], oracleRole)
  addAndConfigureField(type)
  expect(latestFields()[0]).toMatchObject({ id: `${type}-field`, type, ...expected })
})
```

- [ ] **Step 2: Write failing constraint and ordering tests**

```tsx
it('reports duplicate IDs, invalid defaults, numeric bounds, and missing role defaults', () => {
  renderFieldEditor(existingFields, [])
  configureDuplicateAndInvalidFields()
  expect(screen.getByText('Field IDs must be unique.')).toBeInTheDocument()
  expect(screen.getByText('Default must be one of the choices.')).toBeInTheDocument()
  expect(screen.getByText('Minimum cannot exceed maximum.')).toBeInTheDocument()
  expect(screen.getByText('Add a role before using a role field.')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run field editor tests and verify RED**

Run: `npm test -- src/app/components/FieldEditor.test.tsx`

Expected: FAIL because `FieldEditor` does not exist.

- [ ] **Step 4: Implement discriminated controls and local draft values**

Each row owns a draft matching its selected type. Changing type replaces only type-specific properties with valid defaults: boolean `false`, choice `choices: ['option']` / default `option`, number `0`, text `''` / non-multiline, and role with the first role ID. If no role exists, keep the row visibly invalid and do not emit canonical source until repaired. Add remove/move controls with accessible names.

- [ ] **Step 5: Run field, source round-trip, tracker, and Studio tests**

Run: `npm test -- src/app/components/FieldEditor.test.tsx src/games/source.test.ts src/app/components/PlayerFieldControl.test.tsx src/app/GameStudio.test.tsx`

Expected: PASS for every field branch and generated tracker compatibility.

- [ ] **Step 6: Commit full tracker authoring**

```bash
git add src/app/components/FieldEditor.tsx src/app/components/FieldEditor.test.tsx src/app/components/GuidedGameEditor.tsx
git commit -m "feat: guide custom tracker fields"
```

---

### Task 11: Catalog management, recovery, export, sharing, and session guidance

**Files:**
- Create: `src/app/components/CustomGameActions.tsx`
- Create: `src/app/components/GameRecoveryCard.tsx`
- Create: `src/app/ManageCustomGames.test.tsx`
- Modify: `src/app/components/CatalogView.tsx`
- Modify: `src/app/components/ImportSession.tsx`
- Modify: `src/app/components/TrackerView.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `createGameDownload`, `createGameShareUrl`, `reviewGameDeletion`, custom repository records, and session records.
- Produces: edit/export/share/delete controls, raw-source recovery, and custom-session portability copy.

- [ ] **Step 1: Write failing management and guard tests**

```tsx
it('exports exact source and creates a copyable share link for a custom card', async () => {
  renderCatalogWithCustomGame()
  fireEvent.click(screen.getByRole('button', { name: 'Export Custom Game' }))
  expect(downloadAnchor.download).toBe('custom-game.ludocairn-game.md')
  expect(await capturedBlob.text()).toBe(customSource)
  fireEvent.click(screen.getByRole('button', { name: 'Share Custom Game' }))
  expect(screen.getByLabelText('Share link')).toHaveValue(expect.stringContaining('#share-game=v1.'))
})

it('blocks deletion while a saved session uses the game', () => {
  renderCatalogWithCustomSession()
  fireEvent.click(screen.getByRole('button', { name: 'Delete Custom Game' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Friday Table')
  expect(gameRepository.load('custom-game')).toMatchObject({ ok: true })
})
```

- [ ] **Step 2: Write failing corrupt recovery and portability-copy tests**

```tsx
it('downloads or deletes recoverable raw custom source', async () => {
  renderCatalogWithBrokenGame()
  expect(screen.getByRole('heading', { name: 'Custom games needing attention' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Download raw source' }))
  expect(await capturedBlob.text()).toBe(brokenRaw)
})

it('warns that a custom game must accompany session export and missing-game import', () => {
  openCustomTracker()
  expect(screen.getByText(/export the custom game too/i)).toBeInTheDocument()
  importMissingCustomSession()
  expect(screen.getByRole('alert')).toHaveTextContent('Import the custom game first')
})
```

- [ ] **Step 3: Run management tests and verify RED**

Run: `npm test -- src/app/ManageCustomGames.test.tsx`

Expected: FAIL because management and recovery components do not exist.

- [ ] **Step 4: Implement explicit catalog actions**

`CustomGameActions` receives a valid record and callbacks. Export uses an object URL and revokes it after the synthetic click. Share renders a read-only labeled input plus **Copy link**; if clipboard writing rejects, preserve the selectable URL and report that it can be copied manually. Overlong links show the exact export fallback. Delete requires name-confirmation, then `reviewGameDeletion`, then repository removal and store refresh.

- [ ] **Step 5: Implement corrupt-record recovery**

`GameRecoveryCard` shows the diagnostic, a raw-source download when `raw` exists, and a two-step delete whose accessible description includes the storage ID. Read-failure sentinel records cannot be deleted because their target is unknown.

- [ ] **Step 6: Add custom-session portability guidance**

Pass `isCustomGame` to `TrackerView` and `ImportSession`. The tracker export region says the game file must also be exported. For `import.missing-game`, render “If this is a custom game, import the custom game first, then retry the session.” Do not change serialized session contents.

- [ ] **Step 7: Run management, session import/export, and recovery tests**

Run: `npm test -- src/app/ManageCustomGames.test.tsx src/app/ImportSession.test.tsx src/files/session-files.test.ts src/app/App.test.tsx`

Expected: PASS for export, clipboard fallback, overlong share, safe deletion, recovery, and portability guidance.

- [ ] **Step 8: Commit custom-game management**

```bash
git add src/app/components/CustomGameActions.tsx src/app/components/GameRecoveryCard.tsx src/app/ManageCustomGames.test.tsx src/app/components/CatalogView.tsx src/app/components/ImportSession.tsx src/app/components/TrackerView.tsx src/app/App.tsx
git commit -m "feat: manage and recover custom games"
```

---

### Task 12: Responsive Studio craft, documentation, and complete verification

**Files:**
- Modify: `src/styles/global.css`
- Create: `src/styles/game-studio-contract.test.ts`
- Modify: `README.md`
- Modify: `Bots.md`
- Modify: `games/README.md`
- Modify: `docs/game-format.md`
- Modify: `docs/architecture.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: all completed custom-game flows.
- Produces: production-responsive Game Studio styling, updated human/AI authoring guidance, and final verification evidence.

- [ ] **Step 1: Write failing responsive and print-isolation contracts**

```ts
it('keeps the Studio single-column by default and splits editor/preview only on wide screens', () => {
  expect(css).toMatch(/\.game-studio-workbench\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  expect(css).toMatch(/@media\s*\(min-width:\s*64rem\)[\s\S]*\.game-studio-workbench\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s)
})

it('hides authoring controls from printed rules', () => {
  const printCss = css.slice(css.indexOf('@media print'))
  expect(printCss).toMatch(/\.game-studio[^}]*display:\s*none\s*!important/s)
})
```

- [ ] **Step 2: Run the style contract and verify RED**

Run: `npm test -- src/styles/game-studio-contract.test.ts`

Expected: FAIL because Studio layout selectors are not styled.

- [ ] **Step 3: Implement the editorial workbench styling**

Add `.game-studio`, `.game-studio-tabs`, `.game-studio-workbench`, `.guided-editor`, `.editor-section`, `.repeatable-editor`, `.source-editor`, `.studio-preview`, `.custom-game-badge`, and `.custom-game-actions` rules. Use existing paper, ink, accent, moss, line, spacing, focus, and button tokens. Default every grid to `minmax(0, 1fr)`, allow code/source regions to scroll internally, and add the two-column workbench only at `64rem`. Preserve reduced-motion and print contracts.

- [ ] **Step 4: Rewrite `Bots.md` around browser and repository paths**

Lead with a choice between **Make a browser game** and **Contribute a bundled game**. The browser path must instruct an assistant to gather mechanics, emit exactly one complete fenced `game.md`, tell the person to paste it or save it with `.ludocairn-game.md`, and omit `RIGHTS.md`/PR steps. Retain the existing rights and verification requirements only under the bundled-contribution path. State that Ludocairn does not claim, approve, moderate, or verify custom content.

- [ ] **Step 5: Update user and architecture documentation**

Document local custom-game storage and loss boundaries, create/edit/import/export/share workflows, the 8,000-character URL fallback, the one-mebibyte source limit, custom-session dependency, and offline behavior in `README.md`. Update the author and format guides to mention browser acceptance of the same canonical source. Add `ludocairn.game.v1.*` and share fragments to the architecture privacy/data-flow description. Mark browser-authored custom games implemented in the roadmap only after verification succeeds.

- [ ] **Step 6: Run focused UI and documentation checks**

Run: `npm test -- src/styles/game-studio-contract.test.ts src/app/GameStudio.test.tsx src/app/ImportGame.test.tsx src/app/ManageCustomGames.test.tsx`

Expected: PASS with no React act warnings, console errors, or narrow-layout contract failures.

- [ ] **Step 7: Run the complete verification gate**

Run: `npm run ci`

Expected: formatting, ESLint, strict TypeScript, all Vitest suites, production build, and static artifact verification all exit 0. Confirm `git status --short` contains no generated `dist/` changes.

- [ ] **Step 8: Perform the production-preview checklist**

Run: `npm run preview -- --host 127.0.0.1`

In the browser, verify: full-schema creation; Guided/Source/Preview synchronization; refresh restore; session creation and restore; exact file export; pasted and selected-file review; share-link review and fragment removal; update and deletion guards; corrupt recovery; offline reopen after the shell is cached; keyboard-only navigation; 375-pixel viewport without page overflow; and printed rules without Studio controls. Record any native download, clipboard, print-dialog, or offline boundary that the environment cannot inspect.

- [ ] **Step 9: Commit styling and documentation**

```bash
git add src/styles/global.css src/styles/game-studio-contract.test.ts README.md Bots.md games/README.md docs/game-format.md docs/architecture.md docs/roadmap.md
git commit -m "docs: ship browser-authored custom games"
```

- [ ] **Step 10: Re-run the final gate after the commit**

Run: `npm run ci && git status --short`

Expected: all commands exit 0 and the worktree is clean.
