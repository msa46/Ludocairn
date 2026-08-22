# Ludocairn Mobile PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ludocairn optionally installable and usable offline after one successful load, with explicit save-safe updates and repository-subpath-safe static deployment.

**Architecture:** `vite-plugin-pwa` generates a Workbox precache and relative web app manifest from the production asset graph. A focused `src/pwa` boundary adapts service-worker registration into accessible React status UI, while the existing session hook exposes a synchronous save flush that gates update activation. The static verifier proves the manifest, icons, service worker, and offline shell stay inside the deployable artifact.

**Tech Stack:** React 19, strict TypeScript 6, Vite 8, Vitest 4, Testing Library, `vite-plugin-pwa` 1.3.0, Workbox 7.4, CSS safe-area environment variables, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-pwa-design.md`

## Global Constraints

- Keep `base: './'`; every entry, manifest, icon, worker, start, and scope URL must remain safe under a GitHub Pages repository subpath, a fork, or a custom domain.
- Preserve one physical `index.html`; `?game=`, `?session=`, and `?view=` remain the application navigation boundary.
- Cache only built application assets and bundled games. Never cache or transmit `localStorage`, exported session files, third-party URLs, or runtime API responses.
- Require one successful online production load before promising offline behavior.
- Never activate an update automatically while the application is open.
- Flush pending session state before **Update and reload** and refuse activation if that save fails.
- Keep service-worker failure non-fatal: catalog, rules, setup, assignments, tracker, import/export, and print must continue working.
- Use browser-native installation UI; do not implement `beforeinstallprompt` handling.
- Do not claim physical iOS or Android verification from browser emulation.
- Add production behavior only after a focused test has failed for the expected missing behavior.
- Run `npm run ci` before any completion claim.

## Planned file map

- Create `src/app/useSessionStore.test.tsx`: pending-save flush behavior.
- Modify `src/app/useSessionStore.ts`: expose `flushPendingSave(): boolean`.
- Create `src/pwa/manifest.ts` and `.test.ts`: install metadata.
- Create `src/pwa/register.ts` and `.test.ts`: worker lifecycle and checks.
- Create `src/pwa/PwaStatus.tsx` and `.test.tsx`: offline/update/error notice.
- Create `src/pwa/vite-env.d.ts`: virtual registration types.
- Modify `src/app/App.tsx`, its tests, and `src/main.tsx`: compose PWA status with save preparation.
- Modify `vite.config.ts`, `index.html`, `package.json`, and lockfile: generate the PWA.
- Create `public/ludocairn-mark.svg` and three install PNGs.
- Create `scripts/pwa-assets.test.ts`: committed-asset contracts.
- Modify static verifier implementation, tests, and declaration: verify PWA output.
- Modify global CSS and print contract: safe areas, status, standalone, and print.
- Update README, architecture, roadmap, assignment status, and PWA status documents.

---

### Task 1: Flush pending session saves before reload

**Files:**
- Create: `src/app/useSessionStore.test.tsx`
- Modify: `src/app/useSessionStore.ts`

**Interfaces:**
- Consumes: `SessionRepository.save(session)` and existing `accept(result, true)`.
- Produces: `flushPendingSave(): boolean`; true means no pending data remains or the write succeeded.

- [ ] **Step 1: Write failing tests for no-op, success, and failure**

Create a valid minimal `Session`, use `MemorySessionRepository`, and test with `renderHook`:

```tsx
describe('useSessionStore reload preparation', () => {
  it('succeeds without writing when no save is pending', () => {
    const save = vi.spyOn(repository, 'save')
    const { result } = renderHook(() => useSessionStore(repository))
    expect(result.current.flushPendingSave()).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('writes the latest pending session synchronously', () => {
    const { result } = renderHook(() => useSessionStore(repository))
    act(() => result.current.accept({ ok: true, session }, true))
    act(() => expect(result.current.flushPendingSave()).toBe(true))
    expect(repository.load(session.id)).toMatchObject({ ok: true, session })
    expect(result.current.saveStatus).toBe('Saved')
  })

  it('preserves a failed pending save for retry', () => {
    vi.spyOn(repository, 'save')
      .mockReturnValueOnce({
        ok: false,
        diagnostic: { code: 'storage.write', message: 'Storage is full.' },
      })
      .mockReturnValueOnce({ ok: true, session })
    const { result } = renderHook(() => useSessionStore(repository))
    act(() => result.current.accept({ ok: true, session }, true))
    act(() => expect(result.current.flushPendingSave()).toBe(false))
    expect(result.current.saveStatus).toBe('Not saved — Storage is full.')
    act(() => expect(result.current.flushPendingSave()).toBe(true))
  })
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/app/useSessionStore.test.tsx`

Expected: FAIL because `flushPendingSave` is absent.

- [ ] **Step 3: Implement one synchronous flush path**

Keep failed data retryable and reuse `save`:

```ts
const flushPendingSave = useCallback(() => {
  window.clearTimeout(saveTimer.current)
  saveTimer.current = undefined
  const pending = pendingSession.current
  if (!pending) return true
  return save(pending)
}, [save])
```

Clear `pendingSession.current` only after a successful write. Return the new function and use it during unmount cleanup.

- [ ] **Step 4: Run focused regressions**

Run: `npm test -- src/app/useSessionStore.test.tsx src/app/ImportSession.test.tsx src/app/App.test.tsx`

Expected: PASS without act warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/useSessionStore.ts src/app/useSessionStore.test.tsx
git commit -m "feat: flush pending sessions before reload"
```

---

### Task 2: Define install metadata and committed icons

**Files:**
- Create: `src/pwa/manifest.ts`
- Create: `src/pwa/manifest.test.ts`
- Create: `scripts/pwa-assets.test.ts`
- Create: `public/ludocairn-mark.svg`
- Create: `public/icons/ludocairn-192.png`
- Create: `public/icons/ludocairn-512.png`
- Create: `public/icons/ludocairn-maskable-512.png`
- Modify: `index.html`

**Interfaces:**
- Produces: `pwaManifest`, relative install URLs, and exact-size PNG icons.

- [ ] **Step 1: Write failing manifest and asset tests**

Create `src/pwa/manifest.test.ts`:

```ts
expect(pwaManifest).toMatchObject({
  name: 'Ludocairn',
  short_name: 'Ludocairn',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  theme_color: '#25211f',
  background_color: '#f7f1e7',
})
expect(pwaManifest.icons).toEqual(expect.arrayContaining([
  expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
  expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
  expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
]))
```

In `scripts/pwa-assets.test.ts`, read each PNG and parse bytes 16–23 with `Buffer.readUInt32BE` to assert 192x192, 512x512, and 512x512. Assert source `index.html` contains `viewport-fit=cover`, relative Apple touch icon, and theme-color metadata.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/pwa/manifest.test.ts scripts/pwa-assets.test.ts`

Expected: FAIL for the missing module/assets/metadata.

- [ ] **Step 3: Add the manifest literal**

```ts
export const pwaManifest = {
  name: 'Ludocairn',
  short_name: 'Ludocairn',
  description: 'Define, run, track, and print tabletop card games with Ludocairn.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  theme_color: '#25211f',
  background_color: '#f7f1e7',
  icons: [
    { src: './icons/ludocairn-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/ludocairn-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/ludocairn-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} as const
```

- [ ] **Step 4: Create and inspect the original mark**

Use `apply_patch` for a square SVG with warm-paper background, dark rounded card, and three accent cairn stones. Keep the important mark in the central 60% safe zone. Generate committed PNGs with the available image renderer; generate maskable from padded source, not a crop. Inspect SVG and all PNGs before acceptance.

- [ ] **Step 5: Add entry metadata**

Use `width=device-width, initial-scale=1.0, viewport-fit=cover`, then add:

```html
<meta name="theme-color" content="#25211f" />
<link rel="apple-touch-icon" href="./icons/ludocairn-192.png" />
```

The plugin adds the manifest link in Task 3.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/pwa/manifest.test.ts scripts/pwa-assets.test.ts`

```bash
git add src/pwa/manifest.ts src/pwa/manifest.test.ts scripts/pwa-assets.test.ts index.html public
git commit -m "feat: add Ludocairn install metadata"
```

---

### Task 3: Generate the offline application shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `scripts/pwa-assets.test.ts`
- Create: `src/pwa/vite-env.d.ts`

**Interfaces:**
- Consumes: `pwaManifest`, Vite `base: './'`.
- Produces: `manifest.webmanifest`, `sw.js`, Workbox support, and precached local build assets.

- [ ] **Step 1: Add a failing build-output contract**

Extend `pwa-assets.test.ts` to assert an existing `dist/` includes `manifest.webmanifest` and `sw.js`. Run `npm run build` before the test.

Expected RED: both files are missing.

- [ ] **Step 2: Install exact dependency**

Run: `npm install --save-dev --save-exact vite-plugin-pwa@1.3.0`

- [ ] **Step 3: Configure prompt-mode generation**

Keep `react()` first, import `pwaManifest`, and add:

```ts
VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: [
    'ludocairn-mark.svg',
    'icons/ludocairn-192.png',
    'icons/ludocairn-512.png',
    'icons/ludocairn-maskable-512.png',
  ],
  manifest: pwaManifest,
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: false,
    skipWaiting: false,
    globPatterns: ['**/*.{html,js,css,webmanifest,svg,png}'],
    navigateFallback: 'index.html',
  },
})
```

Add `/// <reference types="vite-plugin-pwa/client" />` to `src/pwa/vite-env.d.ts`.

- [ ] **Step 4: Build and verify GREEN**

Run: `npm run build && npm test -- scripts/pwa-assets.test.ts && npm run typecheck`

Expected: PASS; inspect `dist/sw.js` and confirm `index.html` plus hashed app assets occur in the precache.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/pwa/vite-env.d.ts scripts/pwa-assets.test.ts
git commit -m "feat: generate offline application shell"
```

---

### Task 4: Implement the worker lifecycle boundary

**Files:**
- Create: `src/pwa/register.ts`
- Create: `src/pwa/register.test.ts`

**Interfaces:**
- Produces `PwaState`, `PwaController`, and `startPwaRegistration(options)`.
- Consumes an injected worker-registration function, document visibility boundary, and timers.

- [ ] **Step 1: Write failing lifecycle tests**

Cover separately:

```ts
it('reports offline readiness without blocking registration')
it('reports a waiting update and activates only through update()')
it('reports registration errors without throwing')
it('checks immediately, hourly while visible, and on foreground return')
it('does not check while hidden')
it('removes interval and visibility listener on dispose')
```

The activation test must prove `updateSW(true)` is never called at startup and is called exactly once through `controller.update()`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/pwa/register.test.ts`

Expected: FAIL for missing module.

- [ ] **Step 3: Implement the injected controller**

Use these public contracts:

```ts
export type PwaState = 'current' | 'offline-ready' | 'update-available' | 'error'

export interface RegisterWorkerCallbacks {
  readonly onNeedRefresh: () => void
  readonly onOfflineReady: () => void
  readonly onRegistered: (registration?: ServiceWorkerRegistration) => void
  readonly onRegisterError: (error: unknown) => void
}

export interface PwaController {
  readonly update: () => Promise<void>
  readonly dispose: () => void
}
```

`startPwaRegistration` stores the activation function and registration; calls `registration.update()` initially, hourly when visible, and on `visibilitychange` to visible; converts rejections to error state; and makes disposal idempotent.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/pwa/register.test.ts && npm run typecheck`

```bash
git add src/pwa/register.ts src/pwa/register.test.ts
git commit -m "feat: manage explicit PWA updates"
```

---

### Task 5: Add accessible offline and update status UI

**Files:**
- Create: `src/pwa/PwaStatus.tsx`
- Create: `src/pwa/PwaStatus.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- `PwaStatus` consumes `prepareForReload: () => boolean` and an injected `registerWorker` adapter.
- `App` accepts an optional registration adapter; production passes `virtual:pwa-register` without delaying initial render.

- [ ] **Step 1: Write failing component tests**

Capture registration callbacks and cover:

```tsx
it('renders nothing while the installed version is current')
it('shows a dismissible offline-ready status')
it('shows an update action only after onNeedRefresh')
it('flushes pending state before updateSW(true)')
it('refuses activation when reload preparation fails')
it('keeps registration errors non-destructive and dismissible')
it('disposes registration listeners on unmount')
```

For the failure gate, use `prepareForReload={() => false}`, click **Update and reload**, assert `updateSW` was not called, and assert an alert says `Save the session or export it before updating.`

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/pwa/PwaStatus.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement `PwaStatus`**

Register in `useEffect`, dispose on unmount, and render `null` for current state. Render `<section className="pwa-status print-hidden">`; use `role="status"` for offline-ready and `role="alert"` for update/error. Use native buttons named:

- **Update and reload**
- **Not now**
- **Dismiss PWA status**

Call `prepareForReload()` before `controller.update()`. Catch activation rejection and show `The update could not be applied. You can keep using this version.`

- [ ] **Step 4: Integrate without importing sessions into PWA code**

Destructure `flushPendingSave` from `useSessionStore`. Place the status after the header and before main:

```tsx
<PwaStatus
  prepareForReload={flushPendingSave}
  registerWorker={registerWorker}
/>
```

Default the optional App adapter to a no-op current-version implementation for tests/development. In `main.tsx`, adapt `registerSW` from `virtual:pwa-register` to `RegisterWorkerCallbacks` and pass it to `App`; do not await registration.

- [ ] **Step 5: Add application-level non-fatal coverage**

In `App.test.tsx`, inject an adapter that invokes `onRegisterError`. Assert the error notice and **Choose a game** both remain present. Assert the default adapter does not create an update notice.

- [ ] **Step 6: Run focused gates**

Run: `npm test -- src/pwa/PwaStatus.test.tsx src/app/App.test.tsx src/app/useSessionStore.test.tsx && npm run typecheck`

Expected: PASS without console errors, act warnings, or jsdom service-worker access.

- [ ] **Step 7: Commit**

```bash
git add src/pwa/PwaStatus.tsx src/pwa/PwaStatus.test.tsx src/app/App.tsx src/app/App.test.tsx src/main.tsx
git commit -m "feat: prompt for save-safe app updates"
```

---

### Task 6: Harden PWA artifact verification

**Files:**
- Modify: `scripts/verify-static-build.mjs`
- Modify: `scripts/verify-static-build.test.ts`
- Modify: `scripts/verify-static-build.d.mts`

**Interfaces:**
- `verifyStaticBuild()` returns `{ entryAssets, manifest, serviceWorker, precachedShell }`.
- CLI output names the PWA boundaries it verified.

- [ ] **Step 1: Upgrade the synthetic fixture and write failing cases**

Make its valid form create `index.html`, JS, CSS, `manifest.webmanifest`, `sw.js`, and all three icons. Use a manifest matching `pwaManifest` and worker text with an `index.html` precache record. Add separate rejection tests for:

- missing/root-absolute manifest link;
- malformed manifest JSON;
- missing standalone display, colors, 192, 512, or maskable icon;
- root-absolute, remote, traversal, missing, directory, and external-symlink icon paths;
- missing worker or worker without `index.html` precache;
- worker containing HTTP(S) or protocol-relative runtime asset URLs; and
- missing/absolute Apple touch icon.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- scripts/verify-static-build.test.ts`

Expected: FAIL because the verifier only handles JS/CSS entry assets.

- [ ] **Step 3: Implement safe PWA validation**

Extract existing URL decoding, normalization, containment, existence, file-kind, and symlink checks into one helper used for entry and manifest assets. Parse exactly one manifest link and one touch icon. Validate exact manifest members, icon MIME/sizes/purpose, and paths. Resolve root `sw.js`; require an `index.html` precache entry; reject decoded remote runtime strings. Preserve every existing hostile asset test.

- [ ] **Step 4: Update types and CLI**

```ts
export interface StaticBuildVerification {
  readonly entryAssets: readonly string[]
  readonly manifest: string
  readonly serviceWorker: string
  readonly precachedShell: boolean
}
```

Print `Verified PWA entry, manifest, service worker, and N local entry assets.`

- [ ] **Step 5: Run synthetic and real gates**

Run: `npm test -- scripts/verify-static-build.test.ts && npm run build && npm run verify:dist`

Expected: all hostile cases PASS and the real artifact prints the PWA summary.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-static-build.mjs scripts/verify-static-build.test.ts scripts/verify-static-build.d.mts
git commit -m "test: verify installable offline artifact"
```

---

### Task 7: Add safe-area, standalone, print, and status styling

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/styles/print-contract.test.ts`

**Interfaces:**
- Consumes `.pwa-status`, `.pwa-status-actions`, `.app-shell`, and existing variables.
- Produces safe-area spacing, standalone refinement, narrow actions, and print exclusion.

- [ ] **Step 1: Write failing CSS contracts**

```ts
expect(printCss).toMatch(/\.pwa-status[^}]*display:\s*none\s*!important/s)
expect(css).toContain('env(safe-area-inset-top, 0px)')
expect(css).toContain('env(safe-area-inset-right, 0px)')
expect(css).toContain('env(safe-area-inset-bottom, 0px)')
expect(css).toContain('env(safe-area-inset-left, 0px)')
expect(css).toContain('@media (display-mode: standalone)')
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/styles/print-contract.test.ts`

Expected: FAIL for missing selectors.

- [ ] **Step 3: Implement mobile-first presentation**

Use `calc(existing-padding + env(safe-area-inset-*, 0px))` so safe areas add to, rather than replace, current spacing. Style the notice as a high-contrast inset with readable max width and wrapping native-button actions. Stack only when labels would overflow. In standalone mode retain all navigation and add only shell continuity. Add `.pwa-status` to print-hidden selectors. Do not add entry animation.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/styles/print-contract.test.ts src/pwa/PwaStatus.test.tsx src/app/App.test.tsx`

```bash
git add src/styles/global.css src/styles/print-contract.test.ts
git commit -m "feat: add safe-area PWA presentation"
```

---

### Task 8: Document the boundary and reconcile goals

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/roadmap.md`
- Modify: PWA design/plan and assignment design/plan status documents.

**Interfaces:**
- Produces an honest ledger separating implementation, automation, local browser, deployment, and physical-device evidence.

- [ ] **Step 1: Add user guidance**

Document native optional installation, one-online-load requirement, offline bundled games/shell, localStorage privacy, site-data deletion risk, export backup, and explicit save-first updates.

- [ ] **Step 2: Record architecture**

Document manifest/worker generation, precache contents, query fallback, update lifecycle, save gate, cleanup, and the fact service workers cannot intercept localStorage. State there is no runtime data cache or background transfer.

- [ ] **Step 3: Reconcile roadmap and assignments**

Split PWA status into implemented/automated, local-browser, deployed/live, and physical iOS/Android evidence. Check only observed items. Remove stale `automated role assignment` and `private reveals` from later work. Mark the assignment design `Implemented; live release verification pending`; check implementation-plan steps proven by commits/tests and leave live verification open.

- [ ] **Step 4: Update PWA status honestly**

After automated implementation, use `Implemented; local browser, deployment, and physical-device verification pending`. Check implementation boxes only. Do not check evidence not observed.

- [ ] **Step 5: Run docs gate and commit**

Run: `npm run format:check && rg -n "automated role assignment|private reveals" docs/roadmap.md`

Expected: format PASS; stale later-work phrases absent while the delivered section remains.

```bash
git add README.md docs/architecture.md docs/roadmap.md docs/superpowers
git commit -m "docs: publish offline PWA guidance"
```

---

### Task 9: Complete gates and local production-browser verification

**Files:**
- Modify only files whose behavior fails these checks.
- Append evidence to roadmap/status documents only after observation.

**Interfaces:**
- Produces automated and local-browser evidence, not physical-device or production evidence.

- [ ] **Step 1: Run focused suite**

```bash
npm test -- src/app/useSessionStore.test.tsx src/pwa/manifest.test.ts scripts/pwa-assets.test.ts src/pwa/register.test.ts src/pwa/PwaStatus.test.tsx src/app/App.test.tsx src/styles/print-contract.test.ts scripts/verify-static-build.test.ts
```

Expected: PASS without warnings.

- [ ] **Step 2: Run complete gate**

Run: `npm run ci`

Expected: lint, format, strict TypeScript, all tests, build, and PWA verification PASS.

- [ ] **Step 3: Serve production on loopback**

Run: `npm run preview -- --host 127.0.0.1`; open the reported URL in real Chromium. Loopback is a secure service-worker context.

- [ ] **Step 4: Verify install/cache boundaries**

Confirm accepted manifest/icons/standalone/colors; active controlling worker after reload; cache storage contains only app assets; local storage contains sessions but caches contain no names, notes, assignments, or JSON; no off-origin request or application console error.

- [ ] **Step 5: Verify offline routes and restoration**

Create a five-player Veilquorum session, complete private reveals, edit tracker and notes, reach `Saved`, go offline, and reload root, `?game=veilquorum`, saved `?session=<id>`, and `?session=<id>&view=assignments`. Confirm all games and the same unreshuffled local assignment/session state restore.

- [ ] **Step 6: Verify explicit updates**

Serve version A under worker control, then serve a temporary visible version-B build at the same origin. Confirm A shows **Update and reload**, **Not now** keeps A running, pending text is saved, confirmation activates/reloads exactly once, and B appears. Do not commit the temporary marker.

- [ ] **Step 7: Verify responsive/keyboard/print**

At 320 and 1440 CSS pixels, verify safe areas, wrapping actions, and standalone navigation. Use keyboard only for dismissal/update. Confirm print preview omits PWA status.

- [ ] **Step 8: Record only observed evidence**

Record browser/date/viewports/offline routes/update/storage/console/network/keyboard/print results. Mark local-browser complete only; leave deployment and physical devices open.

- [ ] **Step 9: Final clean-tree verification**

```bash
npm run ci
git diff --check
git status --short
git log --oneline -15
```

Expected: CI PASS, no whitespace errors, only intentional evidence docs before commit, and ordered PWA commits.

- [ ] **Step 10: Commit observed local evidence**

```bash
git add docs/roadmap.md docs/superpowers/specs/2026-08-22-mobile-pwa-design.md docs/superpowers/plans/2026-08-22-mobile-pwa.md
git commit -m "docs: record local PWA verification"
```

Do not create this commit if local browser verification did not complete.

## Post-push release boundary

- [ ] Push or integrate through the user's selected path.
- [ ] Confirm CI and Pages deployment for the reviewed commit.
- [ ] Exercise the live repository-subpath PWA and record URL, commit, and date.
- [ ] Verify install, launch, offline reload, update recovery, keyboard/screen-reader behavior, and narrow layouts on representative physical iOS and Android devices.
- [ ] Mark the milestone complete only after production and physical-device evidence exists.
