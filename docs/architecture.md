# Architecture

## Goals and constraints

Deckwright is a browser-only application. Its deployable output must be a set
of static files that GitHub Pages can serve from either a repository subpath,
a fork, or a custom domain. No feature in the first usable milestone may
require server-side rendering, a runtime API, a database, authentication, or
cloud storage.

Game authors write Markdown and YAML rather than JavaScript. Domain behavior
must remain testable without rendering React components. The design should
make later import, export, fragment sharing, and custom decks possible without
building those features prematurely.

## Technology

The proposed application stack is Vite, React, and TypeScript. Vite produces
the static `dist/` artifact. A GitHub Actions workflow will type-check, test,
validate repository-hosted games, build the application, and deploy that
artifact through GitHub Pages.

Vite will use a relative public base (`base: "./"`). Deckwright will keep its
first-milestone navigation on one physical `index.html`, so relative assets
work under `/Deckwright/`, renamed forks, and custom domains. Public game
selection may use a query parameter such as `?game=card-mafia`. URL fragments
remain available for future private state sharing because fragments are not
sent in HTTP requests.

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
silently overwritten.

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
3. A user selects a public game and reads its rendered Markdown rules.
4. Session creation applies defaults from the selected game definition.
5. UI events call pure session transformations.
6. The storage adapter serializes each validated state change locally.
7. Reloading validates and restores the stored session.

No step sends session state across the network.

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

Deckwright does not enable raw HTML in Markdown, evaluate game-authored code,
or trust deserialized data. Session data remains on the device unless a user
later performs an explicit export or sharing action. Future fragment sharing
must document that fragments avoid server transmission but can still appear in
browser history, screenshots, copied URLs, extensions, and client-side code.
