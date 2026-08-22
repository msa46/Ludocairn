# Guide for AI Game Translators

This file is an operational guide for ChatGPT, coding agents, and other tools
that turn a tabletop game into a Ludocairn contribution. A successful
translation produces the source files from which Ludocairn builds the catalog
entry, readable and printable rules, optional role guide, session setup, local
tracker, and session import/export support.

Ludocairn does **not** generate a PDF file during the build. Its **Print rules**
action opens the browser print dialog; a person can choose **Save as PDF**
there. Do not claim that a PDF was generated unless that browser/system step
was actually completed and the resulting file was inspected.

## Authority and scope

Before authoring, read these files in this order:

1. [`docs/content-rights.md`](docs/content-rights.md) — what content may be
   contributed.
2. [`docs/game-format.md`](docs/game-format.md) — the exact version 1 schema.
3. [`games/README.md`](games/README.md) — the game-authoring workflow.
4. One existing game with similar needs under [`games/`](games/) — a pattern,
   not a source to copy.

Those documents and the parser are authoritative if this guide becomes stale.
Do not modify application code merely to make a new game fit. Version 1 is a
reference document plus a generic local tracker; it does not automate play.

## Required inputs

Establish all of the following before creating repository files:

- the game's mechanics, player range, required deck, setup, turn or round
  sequence, end condition, and edge cases;
- the source and ownership of the supplied material;
- the copyright holder and license under which the resulting contribution may
  be distributed;
- whether the submitted wording, examples, setting, names, and role
  descriptions are original; and
- who will perform and document the required name screen.

If provenance, permission, or licensing is unclear, stop and ask the user. Do
not invent permission, authorship, a license, attribution, search results, or a
search date.

### Translating an existing published game

Game mechanics and procedures may be described independently, but a published
rulebook is not a writing template. Do not copy, translate, lightly rewrite,
or closely paraphrase its text, examples, flavor, characters, role set,
artwork, branding, or layout. Work from the mechanics and write a new,
self-contained explanation from first principles. Do not imply affiliation or
endorsement.

The current bundled-game checks expect repository-hosted content to be
MIT-licensed and to include a complete rights record. Third-party licensed or
public-domain content requires reliable provenance, exact license terms and
attribution, and maintainer approval; do not silently relicense it as MIT.

## Deliverables

For one game, create exactly this source pair:

```text
games/<game-id>/
├── game.md
└── RIGHTS.md
```

`game.md` supplies all user-facing game behavior:

- catalog name and summary;
- player limits and deck type;
- optional structured roles and player-count distributions;
- optional phases and round counter;
- per-player tracker fields; and
- the complete Markdown rulebook.

`RIGHTS.md` records authorship, license, provenance, and dated name-screen
evidence. The site does not display this file, but repository validation
requires it.

Do not manually edit the catalog, React components, generated `dist/` files,
or session storage for an ordinary game contribution. The Vite build discovers
every `games/*/game.md` file automatically.

## Translation workflow

### 1. Model the game before writing YAML

Write a compact mechanics outline:

1. objective and ending;
2. physical materials;
3. setup;
4. repeated play sequence;
5. state that must remain visible between turns;
6. unusual cases and tie resolution; and
7. facilitator responsibilities.

Resolve contradictions and missing cases with the user. Do not fill material
rules gaps by guessing. Keep rules in prose unless the facilitator truly needs
to update the value throughout play.

### 2. Choose a permanent identity

- `id` and directory: lowercase ASCII letters and digits separated by single
  hyphens, beginning with a letter; for example, `river-council`.
- `name`: a human-readable title supported by a recorded name screen.
- `summary`: one plain-text catalog sentence that describes the play loop.
- `deck`: exactly `standard-52` or `tarot`.

The directory name and frontmatter `id` must match. Treat IDs as permanent API
values. Never fabricate name-clearance research; record only searches that
were actually performed, with their real date and scope.

### 3. Map only persistent table state to the tracker

Use the smallest set of fields that makes facilitation easier:

| Need                          | Field type | Typical examples             |
| ----------------------------- | ---------- | ---------------------------- |
| Two-state fact                | `boolean`  | active, ready, protected     |
| One status from a fixed list  | `choice`   | stance, location, condition  |
| One declared structured role  | `role`     | role identity shown by label |
| Score, resource, or counter   | `number`   | score, clues, health         |
| Freeform player-specific text | `text`     | rulings, plans, notes        |

Use `session.phases` only for a small, repeated phase cycle. Enable
`session.round` only when a shared round number matters. The tracker records
values; it does not validate moves, calculate scores, enforce turn order,
shuffle, deal, assign roles, hide information, or determine a winner.

Tracker values are shared facilitator-facing state. Do not model secrets there
unless the game's procedure intentionally makes them visible to the person
running the tracker.

### 4. Add structured roles only when they improve reference

Top-level `roles` create a shared role guide. Each role has a stable ID, label,
purpose summary, optional team, and optional physical card marker. A role card
selector identifies matching cards; it does not choose, reserve, deal, or
privately assign them.

Use `role_distributions` only when every supported table size has a defined
composition. Its ordered, adjacent bands must cover `players.min` through
`players.max` exactly once. Each band names every role. At most one role count
may be `remaining`.

If players need their roles recorded in the tracker, add a `type: role` player
field whose default is a declared role ID. Otherwise the guide can exist
without a role field.

### 5. Write a self-contained rulebook

Everything after the closing frontmatter delimiter is rendered as the rules.
Use ordinary Markdown and a task-oriented structure such as:

```markdown
# Game Name

One paragraph describing the objective and core decision.

## What you need

## Set up

## How to play

### 1. First step

### 2. Second step

## Ending the game

## Edge cases

## Facilitation notes
```

Define special terms before relying on them. State exact card ordering, tie
rules, when tracker values change, what happens when the deck is exhausted,
and how players join or leave if those cases matter. Examples must be newly
written and consistent with the rules.

Version 1 supports headings, paragraphs, emphasis, lists, tables, and links.
Do not add raw HTML, JavaScript, remote widgets, images, executable content, or
secrets.

### 6. Create `game.md`

Use the complete example in [`docs/game-format.md`](docs/game-format.md) as the
schema reference. Start from this minimal skeleton and add only supported
properties:

```markdown
---
schema_version: 1
id: example-game
name: Example Game
summary: A concise sentence describing the game.
deck: standard-52
players:
  min: 2
  max: 6
session:
  round:
    enabled: false
  player_fields: []
---

# Example Game

Write the complete, independently authored rules here.
```

Unknown YAML properties are rejected. YAML types matter: booleans are
`true`/`false`, numbers are unquoted numbers, and text defaults are strings.
Choice defaults must appear in `choices`; role defaults must name a declared
role; numeric defaults must satisfy their bounds; an enabled round requires a
positive `initial`; and phases require a valid `initial_phase`.

### 7. Create `RIGHTS.md`

The headings below are required by repository validation. Replace every
placeholder with verified facts. Never preserve bracketed prompts in a final
contribution.

```markdown
# Example Game Rights Record

## Authorship

[Identify the author and copyright holder.]

## License

[State the applicable license. Bundled original content currently uses the
repository's MIT License.]

## Provenance

[Explain what is original, what general mechanics or common deck facts were
used, and list the source and permission for every reused item.]

## Name clearance

[Record the real YYYY-MM-DD search date, databases and catalogs searched,
queries or variants checked, and results. State that this is a preliminary
screen rather than legal advice or a guarantee.]
```

Follow the fuller policy and existing records; do not treat an example's
specific search claims as reusable boilerplate.

## Validate the contribution

From the repository root, use the supported Node.js 22 and npm 10 environment,
then run:

```bash
npm install
npm run ci
```

Use `npm ci` instead of `npm install` when recreating the exact lockfile
environment. `npm run ci` checks formatting, linting, strict TypeScript,
tests, the production build, the static artifact, all bundled definitions,
and adjacent rights records. Do not work around a diagnostic by weakening the
schema or tests; correct the game source.

Then inspect the production artifact:

```bash
npm run build
npm run preview
```

Open the URL printed by Vite. Do not open `index.html` with a `file://` URL.

## Verify the generated experience

For the new game, confirm all of the following in the browser:

1. Its catalog card shows the intended name, summary, deck, and player range.
2. The rules page renders headings, lists, tables, and links safely and in the
   intended order.
3. The role guide appears only when configured and shows correct teams, card
   markers, purposes, and table-size quantities.
4. Session setup accepts a valid player list and warns appropriately outside
   the recommended range.
5. The tracker contains exactly the configured phases, round control, fields,
   labels, defaults, bounds, and choices.
6. Add/remove player, facilitator notes, local save/restore, export, and import
   still behave as expected for the configured state.
7. Narrow-screen, keyboard-only, and grayscale output remain usable.

### Produce the rulebook PDF

1. Open the game's rules page in the production preview or deployed site.
2. Select **Print rules**.
3. In the browser/system print dialog, choose **Save as PDF**.
4. Review page breaks, headings, tables, role-guide content, grayscale
   contrast, and the absence of navigation or editing controls.
5. Save the file with a clear game-specific name and inspect the saved PDF.

The printable rules include the structured role guide when the game defines
one. **Print tracker** is separate and prints current session state rather than
the rulebook. Print-preview settings and PDF creation occur outside Ludocairn,
so an agent that cannot control or inspect the native dialog must report that
boundary honestly and leave the PDF step for a person.

## Completion checklist for agents

Do not say the game translation is complete until every applicable item is
supported by fresh evidence:

- [ ] Rights, permission, authorship, and license are known and documented.
- [ ] Rule wording and examples were written independently.
- [ ] The game ID matches its directory and all stable IDs are valid.
- [ ] The YAML uses only version 1 properties and the smallest useful tracker.
- [ ] The Markdown rules fully explain setup, play, ending, and edge cases.
- [ ] `RIGHTS.md` contains verified facts and an actual dated name screen.
- [ ] `npm run ci` completes successfully.
- [ ] The production preview was checked for rules, roles, setup, and tracker.
- [ ] Print preview was reviewed; the saved PDF was inspected if one was made.
- [ ] No generated `dist/` files, third-party assets, secrets, or unrelated
      application changes were added.

When handing off, identify the two source files, summarize the tracker mapping,
list the exact verification performed, and disclose anything not performed.
