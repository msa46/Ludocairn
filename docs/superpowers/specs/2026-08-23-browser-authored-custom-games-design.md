# Browser-Authored Custom Games Design

**Date:** 2026-08-23
**Status:** Approved in conversation; awaiting written-spec review

## Summary

Ludocairn will let people create, edit, preview, save, import, export, and share
complete version-1 game definitions from the web application. Custom games use
the same Markdown file with validated YAML frontmatter as bundled games. A
person can work through a guided full-schema editor, directly edit or paste the
canonical source, or open source produced by an AI assistant following
`Bots.md`.

Custom games remain local-first. The application stores them in browser
`localStorage` and never sends their contents to a backend. People can move a
game through a downloaded UTF-8 Markdown file or, when the compressed payload
is short enough, a share URL whose payload is contained entirely in the URL
fragment.

## Goals

- Create a complete version-1 game without editing the repository.
- Support every current game-schema feature, including structured roles, card
  selectors, role distributions, digital assignments, phases, rounds, and all
  player-field types.
- Make the existing `game.md` syntax the one canonical representation across
  bundled games, browser storage, paste, file import, file export, and share
  links.
- Offer both an accessible guided editor and a complete source editor.
- Safely combine bundled and custom games in the catalog and session flows.
- Preserve the local-first, static-hosting, offline-capable privacy boundary.
- Teach AI assistants to produce browser-importable game source without
  requiring repository access, a rights record, or a pull request.

## Non-goals

- Accounts, cloud synchronization, collaboration, publishing, moderation, or
  a game marketplace.
- An in-app generative-AI service or any runtime AI/network dependency.
- Claiming or recording ownership, authorship, licensing, or rights for custom
  games.
- Extending version 1 to automate turns, role behavior, scoring, or winners.
- Embedding a custom game inside the existing session JSON format.
- Allowing executable content, raw HTML, remote widgets, or game-owned assets.

## Canonical source and validation

The canonical value for a custom game is its complete `game.md` source:
version-1 YAML frontmatter followed by Markdown rules. The existing
`parseGameSource` parser remains the single authority for schema normalization
and validation. Browser authoring must not introduce a second, looser schema.

The guided editor operates on a parsed `GameDefinition`. When a guided value
changes, a deterministic serializer writes a complete canonical source file.
The serializer may normalize YAML indentation, collection style, ordering, and
quoting. It must preserve the rules Markdown text, except for changes made in
the rules control. Comments inside YAML frontmatter are not guaranteed to
survive a guided edit; the interface discloses that before applying the first
guided change to source that contains YAML comments.

The Source view edits the raw canonical source. Each change is parsed for live
diagnostics, but invalid source remains in the editor so the person can repair
it. Invalid source cannot be saved, previewed as the current game, or converted
to guided fields. The last valid preview remains visible and is clearly marked
as older than the invalid draft. Returning from Source to Guided requires the
current source to validate, preventing silent data loss.

Diagnostics show the parser message and schema path when available. The editor
focuses or links to the relevant guided section where a reliable mapping
exists.

## Custom-game repository

Custom games use a separate versioned browser-storage namespace from sessions:

```text
ludocairn.game.v1.<game-id>
```

Each value is the raw UTF-8-compatible source string. The game ID in the key
must equal the parsed frontmatter ID. The repository provides list, load, save,
remove, and raw-source recovery operations with explicit read, validation,
collision, and write diagnostics. Writes use one `localStorage.setItem` call,
so an unsuccessful write leaves the previous record intact.

At startup, the application parses bundled games and custom-game records and
builds one runtime catalog. IDs are globally unique. A custom game cannot use a
bundled ID, and two custom records cannot resolve to the same ID. Bundled games
remain read-only and retain their existing ordering. Valid custom games appear
after them, ordered by game name and then ID.

The runtime game resolver used by session storage, session import, routing,
setup, assignments, and trackers resolves both bundled and valid custom games.
Dependency-injected repositories used by tests continue to be supported.

If a stored value is malformed, unsupported, mismatched with its storage key,
or unreadable, it is excluded from the usable catalog and shown under a
custom-game recovery section. When raw source is readable, the person can
download it or delete the record. No corrupt record is silently rewritten.

## Catalog and lifecycle

The catalog gains a prominent **Create a game** action and a custom-game import
area with **Paste game source** and **Choose game file** entry points.

Custom game cards are visually distinguished without implying lower trust or
quality. They expose:

- open rules;
- edit game;
- export game;
- create share link when eligible; and
- delete game.

Bundled cards expose only their existing read/play actions.

A custom game's ID is permanent after its first save. The edit screen displays
it as read-only. Before saving a revision, the application validates every
saved session that references the game against the proposed definition. The
save is rejected if any session would become invalid, and the error identifies
the affected sessions without changing either the game or the sessions.

Deletion is blocked while any readable saved session references the custom
game. The interface lists the blocking session names and directs the person to
export or delete those sessions first. Corrupt session records that can still
be identified as referring to the game also block deletion. If browser storage
cannot be enumerated safely, deletion stops without writing.

## Game Studio

The Game Studio is a dedicated application route used for new and existing
custom games. It follows the current editorial paper-and-ink visual language.
Desktop layouts may place editing and preview beside each other; narrow layouts
stack them without horizontal page overflow. All controls use semantic labels,
keyboard-operable actions, visible focus states, and inline error associations.

The primary views are **Guided**, **Source**, and **Preview**. Unsaved changes
are tracked across views. Navigation away from a dirty studio uses the
browser's standard unload protection where supported and an in-app confirmation
for application navigation.

### Guided editor sections

1. **Identity**
   - permanent lowercase game ID;
   - name and catalog summary;
   - `standard-52` or `tarot` deck; and
   - minimum and optional maximum player count.
2. **Roles**
   - repeatable role ID, label, optional team, and purpose summary; and
   - optional card-marker label and selector arrays for IDs, suits, ranks,
     arcana, and tags.
3. **Role distributions**
   - ordered player-count bands; and
   - one count for every current role, supporting non-negative integers and at
     most one `remaining` value per band.
4. **Digital dealing**
   - optional shuffled assignments;
   - player visibility of `own`, `all`, or `none`; and
   - Game Master visibility of `all` or `none`.
5. **Session flow**
   - optional repeatable phases and initial phase; and
   - optional round tracking with a positive initial round.
6. **Tracker fields**
   - repeatable stable ID and label;
   - boolean default;
   - choice options and default;
   - number default, optional minimum/maximum, and optional step;
   - text default and multiline setting; or
   - role default tied to a declared role.
7. **Rules**
   - a large Markdown editor; and
   - safely rendered live rule preview using the existing renderer.

Repeatable items support add, remove, and explicit move-up/move-down controls.
Removing or renaming a role, phase, choice, or field immediately reports any
dependent values that must be repaired. The guided editor does not guess how
to rewrite semantic dependencies.

Creating a game starts with a valid minimal version-1 source template rather
than an empty invalid document. A person may immediately switch to Source and
replace the entire template with pasted content.

## Import and review

Game import accepts exactly one local `.md` or `.ludocairn-game.md` file and
reads it entirely in the browser. Paste accepts a complete source string. Both
paths parse before presenting a review screen.

The review displays game name, summary, deck, player range, schema version,
role count, tracker-field count, and validation status. It does not save until
the person confirms. Invalid input shows diagnostics and offers to open the
source in the Studio for repair without putting it in the game repository.

If a valid import uses an existing custom ID, the review is labeled as an
update and uses the same saved-session compatibility checks as Studio editing.
A bundled-ID collision is rejected because bundled games cannot be replaced.

## Export and share links

Export downloads the exact currently saved canonical source as UTF-8 Markdown
with MIME type `text/markdown;charset=utf-8`. Its sanitized filename is:

```text
<game-name>.ludocairn-game.md
```

A custom game with unsaved changes must be saved before the catalog's export
or share actions use it.

Share links encode the saved canonical source using a versioned DEFLATE and
base64url payload in the fragment:

```text
<application-url>#share-game=v1.<payload>
```

Fragment contents are not sent in the HTTP request to the static host. Encoding
and decoding are entirely client-side and remain available offline once the
PWA shell is cached. Invalid versions, malformed payloads, decompression
failures, and invalid decoded game source produce explicit review diagnostics
and never write browser storage.

The application offers a copyable share link only when the complete URL is at
most 8,000 characters. Longer games receive a clear explanation and the export
action as the supported fallback. The 8,000-character threshold is a product
portability limit, not a claim about every browser's maximum URL size.

Opening a valid shared link shows the same import review before saving. The
fragment remains available if saving fails, allowing retry or source recovery.
After successful confirmation, navigation removes the share payload from the
address bar and opens the saved game's rules.

## Session portability

The session JSON schema remains unchanged and continues to reference a game by
ID and schema version. A session export whose game is custom displays a privacy
and portability note that the custom game must also be exported for use in a
different browser. Session import continues to reject unavailable games; the
interface directs the person to import the custom game first.

No automatic game embedding or multi-file archive is added in this increment.

## `Bots.md` authoring workflow

`Bots.md` will distinguish two outputs:

1. **Browser-authored/custom game** — the default for a person who wants to
   play locally. The assistant collaborates on mechanics and produces one
   complete fenced `game.md` source block. The person can paste it into the
   Studio or save it as `.ludocairn-game.md` and import it. No `RIGHTS.md`,
   repository edit, pull request, ownership field, author field, or license
   field is required by this path.
2. **Bundled repository contribution** — the existing maintainer workflow,
   including `RIGHTS.md`, content-rights review, validation, and pull request.

The browser path teaches assistants to ask about objective, materials, setup,
play loop, ending, edge cases, player count, deck, roles, hidden information,
and persistent tracker state before generating source. It directs them to the
authoritative version-1 schema, prohibits unsupported properties and
executable content, and tells them not to claim validation or successful
import without evidence.

The guide must not imply that Ludocairn owns, approves, publishes, moderates,
or verifies user-created content. It may remind users that they are responsible
for what they create or share, without collecting rights metadata.

## Privacy, security, and offline behavior

- Custom source never leaves the device unless the person explicitly exports
  it or shares the generated URL.
- Import and paste read local input only and do not upload it.
- Share payloads use URL fragments and no application telemetry is added.
- Rules continue through the existing Markdown renderer and sanitizer; custom
  games receive no raw-HTML or script exception.
- Parser limits and input-size guards reject source whose UTF-8 encoding is
  larger than 1,048,576 bytes. The same one-mebibyte limit applies to pasted,
  imported, stored, and decompressed share-link source before parsing.
- Browser storage can be cleared, blocked, or exhausted. Catalog and Studio
  copy explains local-only persistence and encourages export backups.
- The service worker caches application code, not custom games. Custom games
  remain in origin `localStorage` and are usable offline after the shell is
  installed.

## Error handling

Every mutation is confirm-then-write. Validation, ID collision, session
compatibility, storage enumeration, and storage write checks occur before the
UI reports success or navigates away. On failure, the current draft remains
available.

Errors use actionable language and preserve recoverable raw input. Expected
error categories include invalid source, unsupported schema, duplicate ID,
bundled collision, incompatible sessions, blocked deletion, invalid file type,
oversized input, unsupported share version, corrupt share payload, storage read
failure, and storage write failure.

## Testing and verification

Implementation follows test-driven development. Required automated coverage
includes:

- deterministic full-schema serialization and parse/serialize round trips;
- custom repository list/load/save/remove, ordering, collisions, key mismatch,
  corrupt-source recovery, and blocked storage behavior;
- merged catalog and resolver behavior for bundled and custom games;
- guided controls for every version-1 schema branch and dependency error;
- Source invalid-draft retention, diagnostics, last-valid preview, and guarded
  Guided transition;
- create, edit, immutable ID, save failure, dirty-navigation, compatible edit,
  and incompatible-session edit flows;
- import by file and paste, review-before-save, invalid repair handoff, update,
  and bundled collision;
- exact UTF-8 export contents, MIME type, and sanitized extension;
- share encode/decode round trip, fragment routing, version rejection,
  corruption, decompression/input limits, 8,000-character cutoff, review, and
  post-save fragment removal;
- delete guards and custom-game recovery actions;
- custom-session export warning and missing-custom-game import guidance;
- keyboard labeling and narrow-layout overflow contracts; and
- regression coverage for bundled games, sessions, assignments, print, PWA,
  and production static-asset boundaries.

Fresh completion evidence requires the complete `npm run ci` gate and a manual
production-preview pass covering creation, guided/source synchronization,
local restore, session creation, export, paste/file import, share review,
offline restore, narrow layout, and browser refresh. Native download and
clipboard boundaries must be reported accurately if the automation environment
cannot inspect them.

## Documentation updates

- Update `README.md` with browser authoring, local storage, export/share
  portability, and session/custom-game dependency guidance.
- Update `games/README.md` and `docs/game-format.md` only where needed to make
  clear that the same source format is accepted by the browser while retaining
  the bundled contribution workflow.
- Rewrite the entry structure of `Bots.md` around the browser and repository
  paths described above.
- Update architecture, privacy, and roadmap documentation to include the new
  custom-game repository and share-fragment boundary.

## Acceptance criteria

A person can create a valid game using every supported version-1 schema
feature, edit the canonical source directly, save it locally, find it in the
catalog after refresh and offline, read its rules, and create and restore a
session from it without repository or backend access.

The same saved source can be downloaded, pasted or imported into another
browser, or reviewed from a share URL when it fits the documented threshold.
Invalid or incompatible content cannot overwrite a valid game or strand a
saved session silently. Bundled games and all existing session behavior remain
functional and read-only game assets retain their current build-time source.
