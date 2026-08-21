# Deckwright Foundation Design

- Status: approved; foundation increment implemented
- Date: 2026-08-20

> Historical note: the project adopted the Ludocairn name on 2026-08-21. This
> foundation record retains the name used when it was approved.

## Objective

Establish a coherent, documented foundation for Deckwright before application
implementation. Deckwright will be an open-source static web application for
defining, reading, tracking, saving, and printing tabletop card games.

## Constraints

- The production site is fully static and deployable to GitHub Pages.
- No backend, database, account, authentication, or cloud service is required.
- Game authors write Markdown and structured metadata, not JavaScript.
- Application and domain logic use TypeScript.
- Important parsing, deck, selector, session, and serialization behavior is
  covered by automated tests.
- Accessibility, narrow screens, and printing are first-milestone concerns.
- The first milestone excludes networking, real-time collaboration, arbitrary
  scripts, complex rules automation, AI generation, and marketplaces.

## Chosen approach

Use Vite, React, and TypeScript as a single-document browser application. Vite
bundles repository-hosted Markdown games and emits static files. GitHub Actions
checks and deploys `dist/` to GitHub Pages. A relative Vite base supports the
main repository, forks, and custom domains without hard-coded asset roots.

Avoid path-based SPA routing in the first milestone. A public game selection
may appear in a root-page query parameter. URL fragments remain reserved for a
future versioned, size-limited sharing format for private local state.

## Domain boundaries

The card domain owns complete standard and tarot deck data plus structured
selectors. The game-definition domain owns frontmatter parsing, schema-version
dispatch, validation, normalized definitions, diagnostics, and safe Markdown
rendering. The session domain owns state and pure transformations. A storage
interface separates persistence from domain logic. React coordinates views and
calls these domains without reimplementing their rules.

These boundaries and their data flow are specified in
[`docs/architecture.md`](../../architecture.md).

## Game format

Each game entry is `games/<game-id>/game.md`. Version 1 requires identity,
summary, deck, player constraints, round configuration, and an ordered list of
player fields. Phases are optional. Player fields are a discriminated union of
boolean, choice, number, and text definitions, each with a validated default.

Roles, statuses, counters, and notes use these generic field types. Version 1
does not add automation or special-purpose role and card-group engines. The
complete draft and compatibility policy are specified in
[`docs/game-format.md`](../../game-format.md).

## Session and persistence model

A session records its own ID, the game ID and schema version, players and field
values, optional phase, optional round, shared notes, and timestamps. Creation
copies field defaults from a validated game. All mutations pass through pure,
validated transformations.

Stored documents contain an independent `storageVersion`. Loading validates
untrusted browser data and returns recoverable diagnostics for malformed or
unsupported records. The initial browser adapter uses local storage; an
in-memory adapter supports tests. Subjective player knowledge is deferred until
its real requirements are understood.

## Examples

Three repository games validate the abstraction during implementation:

- Card Mafia exercises phases, rounds, role choices, alive state, votes, and
  notes with the standard deck.
- Higher or Lower exercises the standard deck and simple score/counter fields.
- Tarot Journey exercises the tarot deck, text notes, choices, and rounds.

They demonstrate configuration and tracking rather than automatic rule
enforcement.

## Quality strategy

Tests verify exact deck composition and stable IDs; selector behavior;
frontmatter parsing and schema diagnostics; all included game fixtures; session
defaults and pure transformations; storage serialization and recovery; and
core accessible component flows. CI runs checks before building and deploying.

Raw HTML and author-supplied code are disabled. Imported and stored data are
untrusted. UI controls use semantic elements, labels, visible focus, and
non-color status cues. Narrow layouts retain all operations. Print layouts
remove editing chrome and remain readable in grayscale.

## Delivery

Implementation is split into foundation, content engine, local tracker, and
release-hardening increments. Their exact outcomes and combined first-milestone
acceptance criteria are specified in [`docs/roadmap.md`](../../roadmap.md).

## Accepted tradeoffs

- Client-rendered rules are simpler than introducing Astro or a custom static
  page generator, at the cost of independently indexable rule pages.
- Root-document navigation is reliable on GitHub Pages, at the cost of clean
  path URLs in the first milestone.
- Local storage is sufficient and easy to inspect, at the cost of limited size
  and transactions; the adapter prevents it from becoming a domain dependency.
- Strict schemas catch author mistakes, at the cost of requiring explicit
  schema evolution for new metadata.
- Four generic player fields validate the model with real games before special
  role, status, and counter abstractions are considered.

## Decision records

- [`0001-vite-react-typescript.md`](../../decisions/0001-vite-react-typescript.md)
- [`0002-markdown-game-format.md`](../../decisions/0002-markdown-game-format.md)
- [`0003-local-state-and-url-boundaries.md`](../../decisions/0003-local-state-and-url-boundaries.md)

## Completion boundary

This design task ends with documentation. It does not scaffold dependencies,
create React components, define executable schemas, add example game fixtures,
or add deployment workflows. Those changes require a separately reviewed
implementation plan.
