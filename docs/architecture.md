# Architecture

## Goals and constraints

Ludocairn is a browser-only application. Its deployable output must be a set
of static files that GitHub Pages can serve from either a repository subpath,
a fork, or a custom domain. No feature in the first usable milestone may
require server-side rendering, a runtime API, a database, authentication, or
cloud storage.

Game authors write Markdown and YAML rather than JavaScript. Domain behavior
must remain testable without rendering React components. The design supports
explicit session-file import and export while leaving fragment sharing and
custom decks for later milestones.

## Technology

The application stack is Vite, React, and strict TypeScript. Vite produces the
static `dist/` artifact. GitHub Actions type-checks, tests, validates
repository-hosted games, builds the application, and deploys that artifact
through GitHub Pages.

Vite uses a relative public base (`base: "./"`). Ludocairn keeps its
first-milestone navigation on one physical `index.html`, so relative assets
work under repository subpaths, renamed forks, and custom domains. Public game
selection uses `?game=<game-id>` and restored sessions use
`?session=<session-id>`. URL fragments remain available for future private
state sharing because fragments are not sent in HTTP requests.

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

The deploy pipeline validates every bundled game before publishing. Runtime
validation remains necessary so future imported files can use the same safe
boundary. Raw HTML in Markdown is disabled. Game definitions cannot execute
JavaScript.

Structured role data follows one explicit path. The role domain defines role,
physical card-marker, distribution, and semantic role-field values. The game
parser validates and normalizes that YAML, including deck-valid selectors and
complete player-count coverage. Rules, setup, tracker, and print views then
pass the same normalized definition to the shared read-only role guide. When a
session contains a `type: role` player field, its native select displays role
labels but session operations, local storage, and exports retain the stable
role ID string.

This flow supplies public setup information, not secret game state. The role
guide and selector model never choose exact cards, shuffle or deal a deck,
assign roles to players, reveal private roles, or execute role behavior. Those
actions remain with the facilitator and the physical rules.

### Session domain

Session state contains a session ID, game identity and schema version, players,
field values, current phase, current round, shared session notes, and creation
and update timestamps. Pure transformations implement adding and removing
players, editing fields, changing phases, and changing the round.

The session domain knows the normalized game definition but does not access
the DOM or `localStorage`. It validates field updates against their definitions
so UI and import code cannot put invalid values into a session.

### Persistence boundary

A storage interface exposes session listing, loading, saving, and deletion.
The browser implementation uses `localStorage` for the first milestone; tests
use an in-memory implementation. Every stored document has an independent
`storageVersion`, allowing storage migrations without changing the game-format
version.

Loading treats browser data as untrusted. Malformed or unsupported records
produce a recoverable diagnostic instead of crashing the application or being
silently overwritten. Session and player IDs use a stable URL-safe grammar,
and a stored session's embedded ID must match the ID in its storage key;
mismatches retain their raw bytes for recovery.

Session export serializes the validated session as UTF-8 JSON and triggers a
user download. Import reads one selected JSON file in the browser, resolves
its bundled game, validates the complete session, presents a preview, and only
then allows confirmation. An imported ID collision receives a fresh ID. Files
are never uploaded. Confirmation aborts before any write if existing browser
sessions cannot be enumerated safely. After export, file confidentiality
depends on how the user stores and shares the download.

### React application

React coordinates catalog, rules, setup, and tracker views. Components consume
domain functions and normalized data rather than embedding parser, deck, or
persistence rules. Feature code should live with the domain it changes; avoid
generic dumping grounds named `utils`, `types`, or `components`.

The first milestone uses one document rather than client-side path routing.
This avoids GitHub Pages fallback hacks and prevents a hash router from
claiming the fragment namespace intended for future share data.

## Data flow

1. Vite bundles the repository game Markdown sources.
2. The game loader parses and validates them into a catalog.
3. A user selects a public game and reads its shared role guide, when defined,
   alongside the rendered Markdown rules.
4. Session creation applies defaults from the selected game definition.
5. Role controls display role labels while UI events pass stable role IDs to
   pure session transformations.
6. The storage adapter serializes each validated state change locally.
7. Reloading validates and restores the stored session.
8. An explicit export downloads the validated state; an explicit import
   validates and previews a local file before saving it.

No application step sends session state across the network.

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
or trust deserialized data. Session data remains in this browser's local
storage unless a user performs an explicit export. Exported JSON contains
player names, field values, and facilitator notes and must be treated as
private table material. Import reads locally and does not transmit the file.
Future fragment sharing
must document that fragments avoid server transmission but can still appear in
browser history, screenshots, copied URLs, extensions, and client-side code.
