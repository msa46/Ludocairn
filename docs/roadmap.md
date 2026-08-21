# Roadmap

## Delivery strategy

The first usable product milestone is divided into four capability increments.
All four increments are implemented in the release branch and are subject to
the complete `npm run ci` gate plus local production-artifact exercise. The
work follows the approved
[first usable release design](superpowers/specs/2026-08-21-ludocairn-first-usable-release-design.md).

Release publication is intentionally separate from implementation status:

- [x] Complete Task 9 local production-browser release verification at the
  supported browser boundaries, including import confirmation, print actions,
  alert/status semantics, a narrow tracker journey, and a keyboard-only primary
  journey.
- [x] Prepare a fully static GitHub Pages artifact with relative assets.
- [x] Publish from `main`, verify the Pages workflow and repository-subpath
  journey, then record the production URL and verification date.

The first usable release was verified on 2026-08-21 at
[https://msa46.github.io/Deckwright/](https://msa46.github.io/Deckwright/).
The production browser journey rendered all three games, created Veilquorum
session `Production verification` with Ari and Bea, added Cy, advanced to round
2, unchecked Ari, reached `Saved`, and restored all of that state after reload.
It loaded only same-origin GitHub Pages JavaScript, CSS, and favicon assets. No
application-origin console warnings or errors were observed. Accounts, cloud
synchronization, and multiplayer networking are not part of this milestone.

The feature branch was pushed and reviewed at `b164647`. Pull-request creation
could not be used because the local GitHub CLI token had expired and the
GitHub integration returned HTTP 403. Because `origin/main` remained
`a303853`, an ancestor of the reviewed head, `b164647` was safely
fast-forwarded directly to `main`. The
[CI run](https://github.com/msa46/Deckwright/actions/runs/32508019269) and
[Pages deployment](https://github.com/msa46/Deckwright/actions/runs/32508019317)
both succeeded.

Local manual verification reached the export and print action boundaries, but
the browser backend did not surface the export download event and the native
print dialog was not introspected. The downloaded file therefore was not
independently opened in that run; automated tests separately verify export
contents and metadata.

## Structured role guide

- [x] Add optional version 1 role definitions, physical card markers, complete
  player-count distributions, and semantic role fields.
- [x] Show the same accessible, printable role guide in rules, setup, and
  tracker views while keeping role IDs stable in saved sessions.
- [x] Publish Veilquorum as the first structured-role game while keeping
  Rillward Gambit and Sereinfolio roleless.

Automated role assignment, private reveals, and scripted role behavior remain
future work and are outside the structured guide's scope.

The structured role increment was locally release-verified on 2026-08-21 from
the production artifact at 320- and 1440-pixel viewport widths. Veilquorum's
rules, setup, and tracker exposed the same three labeled role definitions; a
five-player tracker resolved 1 Echo, 1 Drifter, and 3 Wayfinders, then updated
at seven players to 1 Echo, 2 Drifters, and 4 Wayfinders. Human-readable role
labels, all field types, phase, round, notes, and saved role IDs survived a
reload. Rillward Gambit and Sereinfolio rendered no empty guide. Both print
actions returned successfully at the browser/system boundary, and the preview
loaded only same-origin JavaScript and CSS with no console warnings or errors.

The closure fixes were published from `main` at `433b3c8`. The
[CI run](https://github.com/msa46/Deckwright/actions/runs/32527013767) and
[Pages deployment](https://github.com/msa46/Deckwright/actions/runs/32527013761)
both succeeded. The live repository-subpath artifact exposed labeled
Team/Card/Purpose definitions for Echo, Drifter, and Wayfinder from the exact
reviewed JavaScript and CSS assets, with no off-origin assets or console
warnings and errors.

## Increment 1: Foundation

Deliver the Vite, React, and TypeScript project; formatting, linting,
type-checking, and test commands; the GitHub Pages build and deployment
workflow; global responsive and print styles; and initial accessibility
conventions.

Acceptance criteria:

- [x] `npm ci`, type-checking, tests, and the production build are automated in
  CI and the same gate is available locally as `npm run ci`.
- [x] The production artifact contains static files only, uses relative assets,
  and is repository-subpath safe.
- [x] A direct load of the project root and a reload with a game query
  parameter use the same physical entry document without an SPA fallback.
- [x] The base document has semantic landmarks, keyboard-visible focus, and a
  print stylesheet.
- [x] The MIT License covers application code and original repository content.

## Increment 2: Content engine

Deliver the standard 52-card and tarot deck models, selectors, version 1 game
schema, Markdown loader and renderer, catalog, and three originally authored
repository games: the social-deduction game Veilquorum, the standard-card
comparison game Rillward Gambit, and the tarot reflection activity
Sereinfolio. Each public name has a dated preliminary screen in its adjacent
rights record under the process in the
[game content rights policy](content-rights.md); those records are not legal
clearance opinions.

Acceptance criteria:

- [x] The standard deck contains exactly 52 unique cards with the expected four
  suits and thirteen ranks.
- [x] The tarot deck contains exactly 78 unique cards: 22 major and 56 minor
  arcana, with documented canonical IDs.
- [x] Selector tests cover IDs, suits, ranks, arcana, tags, and combined
  filters.
- [x] Valid game files parse into normalized definitions; malformed frontmatter,
  unsupported versions, duplicate IDs, and invalid defaults produce structured
  diagnostics.
- [x] CI validates every repository game before deployment.
- [x] The bundled catalog contains exactly `veilquorum`, `rillward-gambit`, and
  `sereinfolio`.
- [x] The catalog opens each example's safely rendered Markdown rules.
- [x] Every repository game has an adjacent rights record documenting
  authorship, MIT licensing, original provenance, and preliminary name-screen
  work. These records are not legal clearance opinions.

## Increment 3: Local session tracker

Deliver session creation, player management, boolean/choice/number/text fields,
phase and round tracking, notes, versioned local persistence, and recovery from
invalid stored data.

Acceptance criteria:

- [x] A user can create a session from any example game.
- [x] Players can be added and removed without reloading, with confirmation
  before removal.
- [x] Every configured field renders an appropriate labeled control and
  initializes from its declared default.
- [x] The current phase can be changed and the round adjusted when enabled.
- [x] A refreshed page restores valid sessions from browser-local storage.
- [x] Invalid or unsupported stored data produces a recoverable message and is
  not silently overwritten.
- [x] Session rename, confirmed deletion, pure transformations, persistence,
  and serialization are covered by tests.

## Increment 4: Print and release hardening

Deliver dedicated print states for rules and trackers, responsive refinements,
keyboard and screen-reader verification, import/export of versioned session
files, contributor documentation, and release checks.

Acceptance criteria:

- [x] Rules and tracker print modes omit interactive chrome, expose current
  values, and remain readable
  in grayscale.
- [x] Manually verify that narrow-screen layouts preserve every operation
  without requiring precise
  horizontal gestures.
- [x] A keyboard-only user can select a game, create a session, add a player, edit
  all field types, change phase and round, and invoke print.
- [x] Sessions export to and import from a validated, versioned JSON file; the
  import is previewed before confirmation and exports are identified as
  private table material.
- [x] The README, contributor guide, game-format reference, and author guide
  allow a contributor to add a valid game without reading application source.

## Later milestones

### Planned mobile PWA milestone

Ludocairn should remain a normal static website while gaining an installable,
mobile-first Progressive Web App mode:

- [ ] Provide a repository-subpath-safe web app manifest, mobile icons, theme
  colors, standalone display metadata, and safe-area-aware layouts.
- [ ] Cache the app shell and bundled games so they remain usable offline after
  one successful load, without caching or transmitting private session data.
- [ ] Preserve the current browser-local session model and make installation
  optional; accounts, analytics, cloud sync, and background data transfer stay
  out of scope.
- [ ] Use an explicit, recoverable service-worker update flow so a stale app
  cannot silently misread newer game definitions or session files.
- [ ] Verify installation, launch, offline reload, update recovery, keyboard and
  screen-reader behavior, and narrow layouts on representative iOS and Android
  browsers while retaining the full non-installed web journey.

Later work may add file sharing, compact fragment sharing for suitably small
state, custom deck definitions, printable role/reference sheets, automated
role assignment, private reveals, scripted role behavior, richer card group
capabilities, and a carefully designed distinction between objective state and
subjective player knowledge.

Accounts, cloud synchronization, multiplayer networking, real-time
collaboration, arbitrary scripts, AI game generation, and a plugin marketplace
remain outside the first release.

## Architectural triggers

Generalize only after examples demonstrate a repeated need:

- Add labeled choice objects when choice IDs cannot produce adequate labels in
  at least two real games.
- Add special role or status concepts only when generic choice/boolean fields
  cannot support several games without duplication or ambiguity.
- Add card-group behavior only with a specific interaction and at least two
  games that require it.
- Add a selector expression language only when the structured selector cannot
  express several necessary selections.
- Replace `localStorage` only if measured session size or transactional needs
  exceed its practical limits.
