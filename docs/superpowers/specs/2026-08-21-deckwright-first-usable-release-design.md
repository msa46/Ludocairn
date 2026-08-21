# Deckwright First Usable Release Design

- Status: approved
- Date: 2026-08-21
- Supersedes: the post-foundation implementation sequence in the foundation
  design where this document is more specific

## Purpose

Deliver the first genuinely usable Deckwright release as a fully static,
facilitator-oriented tabletop game reference and session tracker. A user can
choose an included game, read and print its rules, start a local session, add
players, track game-defined fields and time state, reload the session, and
import or export it without an account or backend.

The release validates the abstraction with three independently authored games:
a social-deduction game, a standard-card comparison game, and a tarot
reflection game. Their public names and stable IDs are selected only after the
name-clearance process defined in
[`docs/content-rights.md`](../../content-rights.md) is recorded.

## Approved product decisions

- Deliver a domain-backed vertical slice rather than a hard-coded prototype or
  an engine-only increment.
- Make the first tracker a shared-device facilitator tool with one
  authoritative session state.
- Complete the social-deduction flow first, then add the standard-card and
  tarot examples through the same interfaces.
- Reuse only unprotected game mechanics and common deck facts. All built-in
  rule text, examples, roles, presentation, and rights records are original
  Deckwright content released under MIT.
- Keep the initial schema explicit and small. Do not add arbitrary scripts,
  automated rules, special-purpose role concepts, or a selector language.

## Goals

The release includes:

1. Standard 52-card and 78-card tarot domain models.
2. Structured card selectors.
3. Version 1 Markdown and YAML game definitions.
4. A build-time validated catalog with three original games.
5. Safe rules rendering and rules printing.
6. Local session creation and management.
7. Player add, rename, remove, and configurable field editing.
8. Optional phase and round tracking plus shared session notes.
9. Versioned local persistence with recoverable failure states.
10. Versioned JSON session import and export.
11. Responsive, keyboard-accessible, screen-reader-considerate tracker views.
12. Tracker printing and GitHub Pages deployment verification.

## Non-goals

The release does not include accounts, authentication, networked multiplayer,
cloud synchronization, real-time collaboration, private per-player screens,
subjective knowledge graphs, automatic dealing, hidden role distribution,
winner calculation, scripted rules, AI generation, plugins, custom deck
authoring, or URL-fragment session sharing.

## Delivery strategy

Implementation proceeds as one vertical product sequence:

1. Establish card, game, session, and storage boundaries with focused tests.
2. Deliver one complete social-deduction flow from catalog through persisted
   facilitator tracking.
3. Add the standard-card and tarot examples to validate the same boundaries.
4. Add print modes, import/export, accessibility hardening, and release checks.
5. Deploy and manually verify the production GitHub Pages site.

Each stage must preserve a passing `npm run ci` gate. The social-deduction
slice is an intermediate checkpoint, not a redefinition of release completion.

## Architecture

### Card domain

`src/cards/` owns immutable card data, deck factories, and selector behavior.
It has no React, storage, Markdown, or browser dependencies.

A base card exposes `id`, `name`, `deckType`, and `tags`. Standard cards add a
rank and suit. Tarot cards discriminate major and minor arcana; minor cards
also expose a suit and rank. IDs are stable data contracts:

- standard cards follow `standard-52:<suit>:<rank>`;
- major arcana follow `tarot:major:<canonical-name>`; and
- minor arcana follow `tarot:minor:<suit>:<rank>`.

The standard deck contains four suits and thirteen ranks, exactly 52 unique
cards. The tarot deck contains 22 major and 56 minor arcana, exactly 78 unique
cards. Tarot content uses canonical card names and original plain-text labels;
no third-party deck imagery or guidebook interpretation is bundled.

The selector is a structured object with optional `ids`, `suits`, `ranks`,
`arcana`, and `tags` arrays. Values within one property are logical OR;
populated properties combine with logical AND. Empty selectors and properties
that cannot apply to the selected deck are invalid.

### Game-definition domain

`src/games/` owns schema validation, frontmatter parsing, catalog loading,
Markdown rendering, diagnostics, and bundled-game verification. Vite loads
`games/*/game.md` as raw source with `import.meta.glob`.

Version 1 metadata contains:

- `schema_version`, `id`, `name`, `summary`, and `deck`;
- `players.min` and optional `players.max`;
- optional ordered phases with an `initial_phase` when phases exist;
- required round configuration, enabled with a positive initial value or
  explicitly disabled; and
- an ordered list of boolean, choice, number, and text player fields.

Unknown fields are rejected. IDs are lowercase stable identifiers and unique
within their scope. Defaults must conform to their field type and declared
constraints. The parser returns a normalized definition or structured
diagnostics containing a stable code, message, and source context.

Markdown supports headings, paragraphs, emphasis, lists, tables, and links.
Raw HTML, images, embedded widgets, and executable content are disabled. The
renderer sanitizes output even when parser configuration already excludes raw
HTML, preserving a defense-in-depth boundary for future imported games.

Every bundled game directory also contains `RIGHTS.md`. CI verifies its
presence alongside the game definition. The record contains authorship,
license, provenance, and documented name-clearance results.

### Session domain

`src/sessions/` owns versioned session state and pure validated transformations.
It does not access React, the DOM, files, or `localStorage`.

A session contains:

- `storageVersion`, session ID, display name, game ID, and game schema version;
- player records with stable IDs, display names, and field-value maps;
- optional current phase and round matching the game definition;
- shared facilitator notes; and
- creation and update timestamps.

Creation copies defaults from the normalized game. Operations add, rename, and
remove players; update a field; change phase; set or adjust a round; update
shared notes; and rename the session. Every operation validates against the
associated game definition and returns a new state or a structured diagnostic.
The React layer never writes arbitrary values directly into session state.

The player count may temporarily fall outside the game's recommended range.
The UI warns but does not delete players or make an existing session
unopenable. Player deletion requires confirmation because it discards that
player's field values.

### Persistence and files

`src/storage/` defines a session repository interface for list, load, save,
and delete. The browser adapter uses `localStorage`; tests use an in-memory
implementation. Stored documents use an independent `storageVersion`, so game
schema changes and persistence migrations remain separate.

Reads treat stored JSON as untrusted. Malformed or unsupported records are
reported without being overwritten. A user may leave the record untouched,
download its raw representation for recovery, or explicitly delete it.

Every valid in-memory session change triggers a save. A concise status region
communicates saving, saved, and failed states. If storage is unavailable or
quota is exceeded, the current in-memory session remains usable and the UI
states clearly that recent changes are not persisted.

Export produces a UTF-8 JSON file containing one validated, versioned session.
Import parses and validates a selected local file, shows a non-mutating preview
of its game and session metadata, and saves only after explicit confirmation.
The referenced bundled game and schema version must be available and compatible.
An imported session ID that already exists is assigned a new ID rather than
silently replacing local data.

### React application

`src/app/` coordinates catalog, rules, setup, tracker, print, import, and
session-management views. Domain behavior stays in its owning modules.

The app continues to use one physical `index.html`. View selection uses query
parameters:

- `?game=<game-id>` opens a bundled game's rules; and
- `?session=<session-id>` opens a local session.

Invalid or missing identifiers return the user to a usable catalog view with a
diagnostic. No client-side path fallback or hash router is introduced. URL
fragments remain reserved for a future, explicitly designed sharing format.

## User journey

### Catalog

The home view lists the three bundled games and locally saved sessions. A game
card shows its name, summary, deck, and supported player range. A saved-session
card shows its name, game, player count, and last-updated time.

### Rules

Selecting a game opens safely rendered rules with game metadata, a `Start
session` action, and `Print rules`. The rules remain useful without starting a
session.

### Session setup

The facilitator names the session, adds player names, sees player-range
guidance, and starts with the definition's phase, round, and field defaults.
Duplicate display names are allowed because stable internal IDs distinguish
players.

### Tracker

Phase and round controls appear before the player collection. Each player
record renders one labeled native control per configured field:

- checkbox for boolean;
- select for choice;
- numeric input plus accessible increment/decrement controls for number; and
- input or textarea for text.

Shared notes and persistence status remain easy to find. Narrow screens use
stacked player cards. Wider screens may use a compact grid when it improves
scanability, without changing semantic order or requiring horizontal precision
gestures.

### Session management

The facilitator can return to the catalog, resume a saved session, rename it,
export it, print the tracker, or delete it after confirmation. Import is
available from the catalog and always previews before committing data.

## Built-in examples

Working concept labels are used in design and planning; they are not published
game names or stable IDs. Before each game file is committed, its original
public name and ID must pass and record the preliminary clearance workflow in
`docs/content-rights.md`.

### Social-deduction example

The first vertical slice uses the standard deck as a physical facilitator aid.
It exercises alternating phases, rounds, an active/inactive boolean, an
original role or faction choice, a numeric vote or suspicion counter, and
facilitator notes. It explains a complete original hidden-role game without
automated role assignment or rules enforcement.

### Standard-card comparison example

The second example uses the standard deck and demonstrates a simpler game with
score or streak counters, a small choice field, optional notes, and rounds. It
validates that the tracker is not coupled to social-deduction concepts.

### Tarot reflection example

The third example uses the tarot deck for an original, non-divinatory
reflection or storytelling activity. It exercises text fields, choices,
rounds, and original prompts without reproducing any deck-specific artwork or
guidebook meanings.

## Error handling and recovery

- Invalid bundled games fail validation in CI and cannot be deployed.
- Imported session data is untrusted and cannot mutate local state until
  validation and user confirmation succeed.
- Diagnostics identify the boundary, stable error code, human-readable reason,
  and source field or record when available.
- Unknown game definitions, sessions, and URL identifiers preserve a usable
  route back to the catalog.
- Storage write failures preserve in-memory work and expose the unsaved state.
- Corrupt stored records are neither guessed nor silently overwritten.
- Unsupported versions provide an export-or-delete recovery path.
- File read and download failures remain local and do not disable unrelated
  catalog or tracker behavior.

## Accessibility, responsive design, and print

Use semantic landmarks, headings, fieldsets, labels, buttons, inputs, selects,
and status regions. All actions work by keyboard with visible focus. Color is
never the only state cue. Dynamic status announcements are concise and avoid
announcing every keystroke as a save event.

At narrow widths, every operation remains available without fine horizontal
gestures. Touch targets and spacing support tablet use at a table. Player
records avoid ambiguous unlabeled columns.

Rules and tracker print modes hide navigation, editing controls, save status,
and destructive actions. They expand clipped content, avoid splitting player
records when practical, include document titles and essential game/session
context, and remain readable in grayscale.

## Security and privacy

No session data leaves the browser unless the user explicitly exports a file.
Deckwright has no analytics, remote API, account, or third-party runtime. Game
Markdown cannot execute code or raw HTML. Imported files and stored JSON are
validated before use. Downloaded exports may contain private facilitator notes,
so the export UI warns the user to handle them accordingly.

## Testing strategy

### Domain tests

- exact standard and tarot deck composition, stable IDs, uniqueness, and tags;
- selector IDs, suits, ranks, arcana, tags, combinations, and invalid cases;
- all game field variants, defaults, constraints, versions, duplicate IDs,
  unknown properties, frontmatter failures, and structured diagnostics;
- Markdown sanitization and allowed rendered structures;
- every bundled game definition and adjacent rights record;
- session defaults, player operations, each field update, phase and round
  changes, notes, timestamps, and rejected mutations; and
- serialization, restoration, version rejection, corrupt records, ID collision
  behavior, and storage failures.

### Component tests

Cover accessible flows from catalog to rules, setup, tracker, persistence,
resume, deletion confirmation, import preview, export, and error recovery. Query
by roles and accessible names rather than implementation selectors.

### Release verification

`npm run ci` remains the authoritative automated gate. Production verification
also confirms relative asset URLs and repository-subpath loading. Before
release, manually verify keyboard-only operation, narrow and wide layouts,
rules print preview, tracker print preview, import/export round-trip, refresh
restoration, and the deployed GitHub Pages URL.

## Acceptance criteria

The first usable release is complete only when all of the following are true:

- the standard deck has 52 and tarot deck has 78 unique validated cards;
- structured selectors and invalid-selector diagnostics are tested;
- all three original games pass schema and rights-record validation;
- the catalog opens each game's safely rendered and printable rules;
- a facilitator can create a session for every game and manage players;
- all four player field types initialize and edit correctly;
- configured phase, round, and shared notes controls work;
- valid sessions automatically persist and restore after refresh;
- corrupt and unsupported stored data remains recoverable;
- validated session JSON exports and imports through a preview flow;
- rules and tracker print views are readable and omit interactive chrome;
- keyboard and narrow-screen journeys retain every required operation;
- the full local and GitHub Actions gates pass; and
- the published GitHub Pages site is manually exercised through the complete
  catalog-to-restored-session journey.

Passing an intermediate vertical slice does not satisfy these release criteria
until the other two examples, print, import/export, and deployed verification
are also complete.
