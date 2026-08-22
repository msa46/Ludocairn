# Ludocairn Mobile PWA Design

**Date:** 2026-08-22

**Status:** Implemented; local browser, deployment, and physical-device
verification pending

**Project:** Ludocairn / Deckwright

## Purpose

Ludocairn is already a browser-only, local-first tabletop toolkit. This
milestone makes the same static application installable and reliably usable
offline after one successful online load. It does not introduce accounts,
cloud storage, analytics, background sync, background transfer of
session/private data, or a second persistence system. While the page is open,
foreground update checks fetch only application-version metadata and assets.

The PWA must remain a normal website when it is not installed. Installation is
optional, the GitHub Pages repository-subpath deployment remains supported,
and private session data remains exclusively in browser `localStorage` unless
the user explicitly exports a session file.

## Product decisions

- Use a generated Workbox service worker through `vite-plugin-pwa` rather than
  maintaining cache revisions and Vite asset hashes by hand.
- Use prompt-style updates. A waiting worker never replaces the running
  application until the user selects **Update and reload**.
- Flush any pending debounced session save before activating an update. If the
  save fails, keep the current application open and explain that the update was
  not applied.
- Precache only the application shell, bundled game content, the manifest, and
  local presentation assets. Do not cache session data, exported files,
  arbitrary external URLs, or runtime API responses.
- Use the existing `index.html` as the offline navigation fallback, including
  URLs that carry `?game=`, `?session=`, or `?view=` query parameters.
- Let browsers provide their native installation UI. Ludocairn will not add a
  custom install promotion or capture `beforeinstallprompt` in this milestone.
- Check for a newer worker after registration, periodically while the page is
  open, and when the document returns to the foreground. These checks must not
  block initial rendering.

## Considered approaches

### Generated service worker with prompt updates — selected

`vite-plugin-pwa` can generate the versioned Workbox precache from Vite's
actual production output and expose a small registration boundary for prompt
updates. This avoids duplicating Vite's asset graph while retaining explicit
application control over activation and reload.

### Custom `injectManifest` service worker

A custom worker would allow specialized runtime caching and fetch routing.
Ludocairn has no runtime API or separately fetched game data, so that control
would add code and update risk without serving a current requirement.

### Hand-written service worker and post-build manifest

The repository could scan `dist/`, generate a cache revision list, and maintain
install, activate, navigation, and cleanup handlers itself. This would avoid a
plugin dependency but recreate established Workbox behavior and couple a
security-sensitive update boundary to custom build tooling.

## Install metadata and visual assets

The generated `manifest.webmanifest` uses paths relative to the deployed
repository root and declares:

- `name`: `Ludocairn`
- `short_name`: `Ludocairn`
- the existing product description
- `id`, `start_url`, and `scope` that resolve to the current deployment root
- `display: standalone`
- the application's dark ink theme color and warm paper background color
- 192-by-192 and 512-by-512 PNG icons
- a 512-by-512 maskable PNG whose important mark stays inside the maskable safe
  zone

The source mark is an original, simple cairn/card symbol created for this
repository. The HTML entry adds a relative manifest link, theme color, an
Apple touch icon, and `viewport-fit=cover` while retaining the current
responsive viewport behavior.

The application uses `env(safe-area-inset-*)` as additive padding around its
outer shell. Unsupported browsers receive the existing spacing through the
fallback value. Standalone display receives only small shell refinements; no
feature or navigation is installation-only.

## Offline cache boundary

The production service worker precaches the built HTML, JavaScript, CSS,
manifest, and icon assets. Bundled game Markdown is already compiled into the
application JavaScript by `import.meta.glob`, so all three games enter the same
versioned precache without a separate data cache.

Navigation requests within the worker's scope fall back to the precached
`index.html`. Workbox's precache matching ignores the application query string
for this shell route, allowing offline reloads of catalog, game, session, and
assignment URLs. Paths outside the deployment scope and HTTP(S) requests to
other origins are not handled or cached by these routes.

`localStorage` operations do not pass through a service worker. The worker
therefore cannot read, cache, transmit, or delete session records. Cache
cleanup removes only obsolete Workbox-owned application caches. Clearing site
data remains capable of removing both installed assets and local sessions, as
it does today.

## Registration and update lifecycle

A focused PWA registration module owns the browser/plugin boundary. It reports
these states to React:

- `current`: no user-facing interruption is required;
- `offline-ready`: the current version finished precaching and can be used
  offline;
- `update-available`: a newer worker is installed and waiting; or
- `error`: registration or activation failed without breaking the application.

Browsers without service-worker support silently retain the normal website and
the `current` state; there is no `unsupported` or `registering` UI state.

React shows a compact, accessible status notice for `offline-ready`,
`update-available`, and `error`. The offline-ready confirmation may be
dismissed. The update notice remains until the user updates, dismisses it for
the current page lifetime, or leaves the page. Dismissing does not activate the
worker; a later foreground or periodic check may present a newly detected
version again only if the registration boundary reports a new waiting worker.

Selecting **Update and reload** performs this sequence:

1. Ask the session store to synchronously flush its pending debounced save.
2. If no save is pending or the save succeeds, tell the waiting worker to skip
   waiting and reload once it controls the page.
3. If the save fails, leave the current worker and UI active, expose the
   existing storage diagnostic, and allow the user to retry or export their
   session.
4. If activation fails, keep the page usable and show a non-destructive update
   error.

The registration module triggers `registration.update()` after initial
registration, every 60 minutes while visible, and when `visibilitychange`
returns the document to `visible`. Timers and listeners are removed on React
unmount. Development mode does not register a production service worker.

## Application boundaries

- `vite.config.ts` owns PWA build configuration, manifest metadata, Workbox
  precache selection, and navigation fallback behavior.
- `src/pwa` owns registration types, plugin adaptation, update checks, and the
  React status/update notice.
- `src/app/useSessionStore.ts` owns flushing pending session saves and returns
  a boolean result suitable for reload preparation.
- `src/app/App.tsx` composes the PWA notice with the existing application shell
  and supplies the save-before-reload callback.
- `scripts/verify-static-build.mjs` verifies the PWA artifact without executing
  a browser.
- Documentation owns the manual platform verification record and any remaining
  device-specific limitations.

The PWA module must not import session models, repositories, or game content.
It receives only a `prepareForReload: () => boolean` callback from the
application.

## Error handling and recovery

- Unsupported service workers silently preserve the existing website journey.
- Registration failures produce an optional status message but never hide the
  catalog, rules, setup, assignment, or tracker UI.
- An offline first visit cannot work because no worker has installed yet; the
  documentation states that one successful online load is required.
- A failed precache leaves the previous active worker and caches intact.
- A failed pending-session save prevents update activation.
- A user can dismiss an update notice and continue on the current version.
- A stale worker never interprets or migrates session records. Session and game
  schema validators remain authoritative after any reload.
- If the next version cannot load after activation, normal browser reload and
  site-data recovery remain available; session export is recommended before
  deliberate site-data clearing.

## Static artifact verification

The existing verifier expands its entry-asset model to recognize and validate
the manifest link in addition to JavaScript and CSS. The complete production
artifact must prove:

- `index.html` references a relative manifest and relative Apple touch icon;
- the manifest, service worker, icons, HTML, JavaScript, and CSS exist as real
  files below `dist/` after symlink resolution;
- the manifest uses relative or same-scope values for `id`, `start_url`,
  `scope`, and every icon;
- the manifest declares standalone display, theme/background colors, and both
  required icon sizes including a maskable icon;
- the service worker contains a generated precache manifest with an HTML shell
  and no HTTP(S) runtime asset URLs;
- entry and manifest references cannot escape the artifact directory through
  absolute paths, traversal, encoding, entities, or symlinks; and
- the original static identity and relative JavaScript/CSS checks continue to
  pass.

The verifier returns a structured summary of checked entry assets so its
command-line output can name the PWA boundary it verified.

## Testing strategy

Test-driven implementation covers:

- session-store flushing with no pending save, a successful pending save, and
  a failed pending save;
- registration state transitions and non-fatal unsupported/error behavior;
- initial, hourly, and foreground update checks with listener/timer cleanup;
- the update notice remaining unmounted until an update is available;
- update activation only after successful reload preparation;
- no activation when the session save fails;
- accessible status semantics, dismissal, and reduced-motion-compatible UI;
- relative manifest/icon entry references and malformed-reference rejection;
- manifest install metadata, icon coverage, and repository-subpath safety;
- generated service-worker presence, offline shell precaching, and absence of
  remote runtime assets; and
- the complete existing application, game, assignment, storage, import/export,
  print, build, and static gates.

Production-artifact exercise uses a local HTTPS-capable or loopback preview in
a real Chromium browser to verify registration, installability signals,
offline catalog/game/session reload, update prompting, keyboard access, and
narrow/wide safe-area layouts. Browser emulation is useful evidence but is not
recorded as physical iOS or Android verification.

## Documentation and release verification

README and architecture documentation explain installation, the one-online-
load requirement, offline behavior, update prompts, local-session privacy, and
site-data risk. The roadmap marks implementation and automated verification
separately from physical-device and production verification.

Release closure requires:

1. `npm run ci` passing from a clean working tree;
2. local production-artifact exercise in a real browser;
3. push and successful GitHub Actions CI/Pages deployment;
4. live repository-subpath verification of install metadata, offline behavior,
   and the explicit update boundary where practical; and
5. representative physical iOS and Android checks before marking those
   platform-specific roadmap items complete.

## Out of scope

These boundaries are listed only to prevent the PWA milestone from silently
expanding; no additional product work is proposed for them:

- Accounts, authentication, or cloud synchronization
- Analytics, telemetry, advertising, or background transfer of session/private
  data
- Push notifications, background sync, or periodic background sync
- Runtime caching of third-party resources or APIs
- Custom install prompts or forced installation
- Session migration inside the service worker
- Automatic update activation while a user is running a session
- Native application packaging or app-store distribution
