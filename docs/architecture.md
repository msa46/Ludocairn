# Architecture

## Goals and constraints

Ludocairn is a browser-only application. Its deployable output must be a set
of static files that GitHub Pages can serve from either a repository subpath,
a fork, or a custom domain. No feature in the first usable milestone may
require server-side rendering, a runtime API, a database, authentication, or
cloud storage.

Game authors write Markdown and YAML rather than JavaScript. Domain behavior
must remain testable without rendering React components. The design supports
explicit game and session import/export plus bounded custom-game fragment
sharing while leaving custom decks for later milestones.

## Technology

The application stack is Vite, React, and strict TypeScript. Vite produces the
static `dist/` artifact. GitHub Actions type-checks, tests, validates
repository-hosted games, builds the application, and deploys that artifact
through GitHub Pages.

Vite uses a relative public base (`base: "./"`). Ludocairn keeps its
first-milestone navigation on one physical `index.html`, so relative assets
work under repository subpaths, renamed forks, and custom domains. Public game
selection uses `?game=<game-id>` and restored sessions use
`?session=<session-id>`. Custom-game sharing uses
`#share-game=v1.<payload>`; fragments are not sent in HTTP requests and remain
outside the single-document query router.

The deployment approach follows the official
[Vite GitHub Pages guidance](https://vite.dev/guide/static-deploy.html) and
[GitHub Pages custom workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## System boundaries

### Card domain

The card domain defines immutable card data, deck factories, and structured
selectors. It does not depend on React, browser storage, Markdown, or session
state.

The common card properties are `id`, `name`, `deckType`, and `tags`.
Discriminated standard-card and tarot-card types add their relevant rank,
suit, and arcana properties. Standard card IDs and tarot card IDs must be
stable because game definitions and saved sessions may refer to them.

The initial selector is a structured object rather than a text query language.
Multiple values for one property are alternatives; different populated
properties are combined. For example, `suits: [hearts, diamonds]` and
`ranks: [queen, king]` selects red queens and kings. The initial selector may
filter by IDs, suits, ranks, arcana, and tags.

### Game-definition domain

Repository games live at `games/<game-id>/game.md`. Vite discovers them at
build time with `import.meta.glob` and bundles their raw source. A parser
separates YAML frontmatter from the Markdown body, validates metadata against
the schema version declared by the game, and returns either a normalized game
definition or structured diagnostics.

Browser-authored games use exactly the same canonical source and parser. Valid
custom records merge into the runtime catalog without shadowing bundled IDs;
bundled games remain read-only. The source is capped at 1,048,576 UTF-8 bytes
at paste, file, storage, and decompressed-share boundaries.

The deploy pipeline validates every bundled game before publishing. Runtime
validation keeps imported files and browser storage behind the same safe
boundary. Raw HTML in Markdown is disabled. Game definitions cannot execute
JavaScript.

Structured role data follows one explicit path. The role domain defines role,
physical card-marker, distribution, semantic role-field values, and the
optional assignment visibility policy. The game parser validates and
normalizes that YAML, including deck-valid selectors and complete player-count
coverage. Rules, setup, tracker, and print views pass the same normalized
definition to the shared read-only role guide.

The guide remains public setup information. When a game opts into digital
assignments, a pure assignment-domain shuffle expands the active distribution
and deals one role ID to each named player. Player visibility can expose only
the current player's role, all roles, or no player screen; Game Master
visibility can independently expose all assignments behind a spoiler gate.
The Game Master is a separate unnamed facilitator, does not consume a player
slot, and never receives a role. The assignment system does not choose exact
physical cards or execute role behavior.

### Session domain

Session state contains a session ID, game identity and schema version, players,
optional immutable player assignments, field values, current phase, current
round, shared session notes, and creation and update timestamps. Pure
transformations implement creation and dealing, adding and removing players,
editing fields, changing phases, and changing the round. Once assignments
exist, roster mutations and direct role-field edits are rejected; role fields
mirror their assigned stable role IDs.

The session domain knows the normalized game definition but does not access
the DOM or `localStorage`. It validates field updates against their definitions
so UI and import code cannot put invalid values into a session.

### Persistence boundary

Separate storage interfaces expose session and custom-game listing, loading,
saving, and deletion. Browser implementations use `localStorage`; tests use
in-memory implementations. Sessions have an independent `storageVersion`,
allowing storage migrations without changing the game-format version. Custom
source uses keys shaped as `ludocairn.game.v1.<game-id>`, and the parsed ID must
match the key suffix.

Loading treats browser data as untrusted. Malformed or unsupported records
produce a recoverable diagnostic instead of crashing the application or being
silently overwritten. Session and player IDs use a stable URL-safe grammar,
and a stored session's embedded ID must match the ID in its storage key;
mismatches retain their raw bytes for recovery.

Session export serializes the validated session as UTF-8 JSON and triggers a
user download. Import reads one selected JSON file in the browser, resolves
its bundled or custom game, validates the complete session, presents a preview,
and only then allows confirmation. An imported ID collision receives a fresh
ID. Files are never uploaded. Confirmation aborts before any write if existing
browser sessions cannot be enumerated safely. Sessions never embed custom game
source, so another browser must import the custom game before its session.
After export, file confidentiality depends on how the user stores and shares
the download.

Custom-game import accepts pasted source or one local Markdown file, validates
it, and presents a review before saving. Export downloads the exact saved
source. Sharing compresses that source into a versioned fragment and is offered
only when the complete URL is at most 8,000 characters; export is the fallback.
Decoded source is bounded before parsing. A successful shared-game save removes
the fragment, while a failure retains it for retry or recovery.

### React application

React coordinates catalog, rules, setup, and tracker views. Components consume
domain functions and normalized data rather than embedding parser, deck, or
persistence rules. Feature code should live with the domain it changes; avoid
generic dumping grounds named `utils`, `types`, or `components`.

The first milestone uses one document rather than client-side path routing.
This avoids GitHub Pages fallback hacks and leaves the fragment namespace to
the explicit custom-game share decoder rather than a hash router.

## Data flow

1. Vite bundles the repository game Markdown sources.
2. The game loader parses and validates them, then merges valid custom records
   from `ludocairn.game.v1.*` into one runtime catalog.
3. Paste, local file import, Studio edits, and `#share-game=v1.*` fragments all
   cross the same bounded parser. Paste and file imports require review before
   saving; valid share fragments render the rulebook first and save only when
   the recipient chooses to play.
4. A user selects a game and reads its shared role guide, when defined,
   alongside the rendered Markdown rules.
5. Session creation applies defaults and, for an assignment-enabled game,
   shuffles the active role distribution across the named players.
6. The visibility policy chooses a pass-the-device reveal, a public assignment
   table, or no player screen. A separately gated Game Master view may expose
   all assignments without creating or naming a Game Master player.
7. The ordinary tracker suppresses editable role controls and locks the roster
   after assignments exist.
8. The storage adapters serialize and validate each state change locally;
   reloading restores assignments without reshuffling them.
9. Explicit exports download canonical game source or validated session state,
   including private assignments. Import validates and previews a local file
   without revealing assignment values before saving it.

No application step sends game source or session state to a backend. A person
may explicitly move custom source through a downloaded file or copied fragment.

## Static artifact and deployment

`npm run ci` is the release gate: formatting, linting, strict types, tests,
production build, and static verification must all pass. The verifier requires
`dist/index.html` to contain the Ludocairn identity and relative JavaScript and
CSS references; rejects root-absolute and HTTP(S) runtime asset references;
rejects document base URLs that could relocate relative assets; and proves each
local entry asset is a real file beneath `dist/`, including after symlink
resolution.

`.github/workflows/ci.yml` runs the gate for pull requests and pushes to
`main`. `.github/workflows/deploy-pages.yml` deploys only from `main` or a
manual dispatch, reruns the gate, configures Pages, uploads only `dist/`, and
grants Pages/id-token write permissions only to the deploy job. The production
URL is not considered verified until that workflow succeeds and the published
repository-subpath build is manually exercised.

### Progressive Web App boundary

`vite-plugin-pwa` generates the relative web app manifest and Workbox service
worker from Vite's production asset graph. The generated worker precaches the
HTML shell, built JavaScript and CSS, manifest, icons, and local presentation
assets. Bundled game Markdown is compiled into the application JavaScript, so
it is available through that same versioned precache; there is no separate
game-data cache.

The worker's navigation fallback is the precached `index.html`. Workbox ignores
the application query string for that shell match, so an installed application
can reload catalog, game, session, and assignment URLs carrying `?game=`,
`?session=`, or `?view=` after one successful online production load. An
offline first visit cannot work. Requests outside the deployment scope and
other origins are not handled or cached by these routes.

The application has no runtime data cache, API cache, background sync, or
background transfer of custom-game/session data. While the page is open, the
registration boundary performs periodic foreground update checks that fetch
only application-version metadata and assets. Service workers do not intercept
`localStorage` operations: they cannot read, cache, transmit, or delete custom
game or session records. Workbox cleanup removes only obsolete Workbox-owned
application caches. Browser site-data clearing can still remove both those
caches and browser-local records, so the export flow remains the user's backup
boundary. Once the shell is cached, custom games remain usable offline because
their source stays in origin `localStorage`, not because Workbox caches it.

PWA registration is isolated in `src/pwa`. A waiting worker never replaces the
running application automatically. The registration boundary checks for
updates at registration, while visible on an hourly interval, and when the
document returns to the foreground. Selecting **Update and reload** first asks
the session store to synchronously flush pending debounced data. Only a
successful flush activates the waiting worker and reloads; a failed save or
activation leaves the current application usable and exposes recovery guidance.
Activation completes only when the browser reports a changed service-worker
controller; a redundant waiting worker or a 30-second activation timeout is an
activation failure. Transient foreground update-check failures are ignored
because the installed version remains usable. Unsupported registration and
registration errors are likewise non-fatal.

## Accessibility, responsive design, and printing

Semantic HTML and native controls are the default. All tracker operations must
be keyboard accessible, have visible focus, and expose programmatic labels.
Color cannot be the only status indicator. Dynamic validation and persistence
messages require appropriate live-region behavior without excessive
announcements.

Layouts start at narrow viewport widths and enhance for larger screens. Tables
may be used only when the information is genuinely tabular and remain usable
without horizontal precision gestures.

Print styles remove navigation and editing controls, expand clipped content,
avoid splitting player records when practical, and provide high-contrast rules
and tracker output. Rules and tracker views must remain understandable in
grayscale.

## Error handling

Errors cross boundaries as structured diagnostics containing a stable code,
a human-readable message, and source context when available. The catalog may
show a development diagnostic for an invalid game, but CI prevents invalid
repository games from reaching production. Storage failures and corrupt saved
sessions keep the rest of the application usable and offer non-destructive
recovery guidance.

## Testing strategy

Unit tests cover complete deck composition, stable and unique IDs, selector
semantics, frontmatter parsing, every schema variant, invalid definitions,
session defaults and transformations, and storage serialization. Fixture tests
validate all example games. Component tests cover the main accessible user
flows. A small production-build check verifies relative asset paths and the
GitHub Pages artifact; end-to-end tests are not the primary domain test layer.

## Security and privacy

Ludocairn does not enable raw HTML in Markdown, evaluate game-authored code,
or trust deserialized data. Custom game source and session data remain in this
browser's local storage unless a user explicitly exports a file or creates and
copies a rulebook share link. Exported JSON contains
player names, field values, facilitator notes, and any private assignments and
must be treated as private table material. Import reads locally, keeps
assignment values out of its preview, and does not transmit the file.
Game share fragments avoid HTTP transmission to the static host, but can still
appear in browser history, screenshots, copied URLs, extensions, and
client-side code. They contain the complete compressed game source needed to
run the game, not only the visible rules and not encryption. Ludocairn has no
backend, account, analytics, moderation, ownership, or approval service.
