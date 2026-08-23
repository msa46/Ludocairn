# Guide for AI Game Authors

Start by asking the person which outcome they want:

1. **Make a browser game** — create a custom game they can paste into or
   import into Ludocairn, without changing this repository.
2. **Contribute a bundled game** — add a reviewed game and rights record to
   the repository through the contributor workflow.

Do not mix the two paths. A browser game does not require `RIGHTS.md`, a pull
request, or author, owner, or license metadata. Ludocairn does not claim,
approve, publish, moderate, or verify custom content; the person creating or
sharing it remains responsible for it.

Ludocairn does **not** generate a PDF during its build. **Print rules** opens
the browser print dialog, where a person may choose **Save as PDF**. Never
claim that a PDF was generated unless that native step completed and the saved
file was inspected.

## Make a browser game

Use this path by default when someone wants a game to play locally.

### 1. Gather the game before writing

Ask for and resolve:

- the objective, player range, physical materials, and whether the deck is a
  standard 52-card deck or tarot deck;
- setup, the repeated turn/round/phase loop, ending and winner conditions,
  tie handling, deck exhaustion, players joining/leaving, and other edge cases;
- any roles, teams, physical card markers, player-count-specific role counts,
  hidden information, and whether Ludocairn should deal roles digitally;
- persistent facilitator state worth tracking per player, plus shared phases,
  round number, and notes; and
- enough original rule wording and examples to make the result self-contained.

Do not guess a material rule. Ask. Do not copy, translate, lightly rewrite, or
closely paraphrase a published rulebook, examples, flavor, characters,
branding, artwork, or layout.

### 2. Map the mechanics to the version 1 schema

Read [`docs/game-format.md`](docs/game-format.md) as the authoritative schema.
Use only these top-level properties:

- required `schema_version: 1`, stable `id`, `name`, `summary`, `deck`,
  `players`, and `session`;
- optional `roles`, `role_distributions`, and `assignments`.

Use the complete reference to validate every applicable branch. In particular,
check these rejection-relevant constraints rather than relying on the shorter
example below:

- IDs start with a lowercase ASCII letter and contain lowercase letters,
  digits, and single hyphens only. IDs are unique in their scope.
- `name` and `summary` are non-empty strings after trimming.
- `deck` is exactly `standard-52` or `tarot`. `players.min` is a positive
  integer; optional `players.max` is not below it.
- Every role has `id`, `label`, and `summary`, with optional `team` and an
  optional card `{ label, selector }`. A selector uses one or more of `ids`,
  `suits`, `ranks`, `arcana`, or `tags`, and every selector value must be valid
  for the chosen deck. Populated selector properties combine with logical AND,
  and the complete combination must select at least one card.
- Role-distribution bands require roles and a finite maximum player count.
  Ordered adjacent bands cover every supported count exactly once. Every band
  names every role; counts are non-negative integers or one `remaining` value.
  Fixed counts cannot exceed the band minimum; without `remaining`, a
  single-count band's fixed values must fill that table exactly.
- Digital dealing requires roles plus complete distributions. Use only
  `method: shuffle`; `visibility.players` is `own`, `all`, or `none`, and
  `visibility.game_master` is `all` or `none`.
- Optional `session.phases` is a non-empty ordered list of objects with unique
  `id` values and non-empty `label` values. It requires a matching
  `session.initial_phase`. Omit both when the game has no phases.
- `session.round` is required. Use `{ enabled: false }`, or use
  `{ enabled: true, initial: <positive integer> }`.
- `session.player_fields` is an ordered list of unique field IDs, and every
  field label is a non-empty string after trimming. A `boolean` default is a
  Boolean; a `choice` has unique, non-empty stable-ID values in `choices` and a
  default in that list; a `role` default names a declared role and has no
  `choices`; a `number` has a finite default within optional `min`/`max` and an
  optional positive `step`; a `text` has a string default and optional Boolean
  `multiline`.
- Everything after the closing `---` is complete Markdown rules. Raw HTML,
  JavaScript, remote widgets, embedded images, executable content, and secrets
  are unsupported.

Use the smallest tracker that supports facilitation. The tracker records
state; it does not enforce turns, execute roles, calculate outcomes, choose
cards, or decide a winner. Shared tracker fields are not a safe place for
player secrets. If digital dealing is enabled, use its visibility policy.

### 3. Emit one complete source file

Return exactly one fenced `game.md` block containing the complete canonical
file: opening frontmatter delimiter, all required frontmatter and chosen
optional branches, closing delimiter, and self-contained rules. Do not split
the source across multiple fences and do not emit a partial skeleton. A
minimal valid shape is:

```game.md
---
schema_version: 1
id: example-game
name: Example Game
summary: A concise sentence describing the play loop.
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

Write the complete rules here, including setup, play, ending, and edge cases.
```

Before handing it off, validate the entire source against every applicable
constraint in [`docs/game-format.md`](docs/game-format.md). Unknown YAML keys
are rejected. YAML types matter. Do not say Ludocairn accepted or validated
the game unless you actually observed its review screen reporting valid input.

### 4. Tell the player how to use it

After the single source fence, describe both real browser workflows with their
exact interface labels.

To paste directly into Game Studio:

1. Open Ludocairn and choose **Create a game**.
2. Choose the **Source** tab and paste the complete source into **Complete game
   source**.
3. Optionally use **Preview**, then choose **Save game**. A validation error
   keeps the draft in Source for repair; a successful save opens its rules.

To import and review before saving:

1. In the catalog's **Import a custom game** section, either select a saved
   `.md` or `.ludocairn-game.md` file with **Game Markdown file**, or choose
   **Paste game source** and paste into **Complete game source**.
2. Choose **Review game** for pasted source. File selection proceeds to the
   same review when its local read completes.
3. Check the validation result and game summary, then choose **Save custom
   game**. Invalid input can instead be opened with **Repair in Game Studio**.

After saving, the custom game's catalog card exposes game-specific buttons
such as **Export Example Game** and **Share Example Game**. Use Export for an
exact portable Markdown backup or Share for a fragment link. If the complete
link would exceed 8,000 characters, export and send the
`.ludocairn-game.md` file instead.

Custom games are stored only in that browser profile. Clearing site data,
switching browser/device/origin, private-browsing cleanup, storage blocking,
or profile loss can remove them. A session that uses a custom game needs that
game installed first in any other browser. Export both before moving. Game
source larger than 1,048,576 UTF-8 bytes (1 MiB) is rejected. After the PWA
shell has been cached once online, locally stored custom games remain usable
offline; the service-worker cache does not back them up.

## Contribute a bundled game

Use this path only when the person explicitly wants the game shipped in the
repository catalog.

### Authority and required inputs

Read these files in order:

1. [`docs/content-rights.md`](docs/content-rights.md)
2. [`docs/game-format.md`](docs/game-format.md)
3. [`games/README.md`](games/README.md)
4. One mechanically similar game under [`games/`](games/) as a structural
   pattern, never as wording to copy.

Establish the source and ownership of all supplied material, the copyright
holder, the distribution license, whether wording and examples are original,
and who will perform the dated name screen. If provenance, permission, or
licensing is unclear, stop and ask. Never invent permission, authorship,
license, attribution, search results, or dates.

Third-party or public-domain material requires reliable provenance, exact
license terms and attribution, and maintainer approval. Do not silently
relicense it as MIT or imply affiliation or endorsement.

### Repository deliverables

Create exactly:

```text
games/<game-id>/
├── game.md
└── RIGHTS.md
```

The directory and frontmatter ID must match. Treat the ID as permanent.
`game.md` follows the same complete schema and rule-writing process as the
browser path. `RIGHTS.md` must contain verified facts under all of these
headings:

```markdown
# Example Game Rights Record

## Authorship

[Verified author and copyright-holder facts.]

## License

[Exact compatible distribution license.]

## Provenance

[Original work, general mechanics/common facts, and every permitted source.]

## Name clearance

[Real date, databases/catalogs, queries/variants, results, and the preliminary
screen disclaimer.]
```

Do not edit the catalog, React components, `dist/`, or browser storage for an
ordinary contribution. The build discovers `games/*/game.md` automatically.

### Validate and inspect the contribution

From the repository root, using supported Node.js 22 and npm 10, run:

```bash
npm install
npm run ci
```

Use `npm ci` instead when recreating the lockfile exactly. The gate checks
formatting, linting, strict TypeScript, tests, the production build, every
bundled definition, and adjacent rights records. Correct the source rather
than weakening validation.

Then run `npm run build` and `npm run preview`. In the production artifact,
verify catalog facts; safely rendered rules; role guide and distributions;
assignment visibility and Game Master separation; valid/out-of-range setup;
tracker fields, defaults, phases, and round; add/remove, notes, save/restore,
export/import; narrow layout; keyboard operation; and grayscale print output.

Submit `games/<game-id>/game.md` and its adjacent `RIGHTS.md` through a pull
request. Summarize the mechanics and tracker mapping, link the verified rights
and name-screen evidence, and include exact CI and preview results. Do not claim
that the pull request was created, reviewed, merged, or published without
evidence from that repository operation.

For a PDF, choose **Print rules**, then **Save as PDF** in the native dialog.
Inspect page breaks, headings, tables, role-guide content, grayscale contrast,
and absence of controls. If the environment cannot inspect the dialog or saved
file, state that boundary and leave the step to a person.

### Bundled-contribution completion checklist

- [ ] Rights, permission, authorship, license, provenance, and a real dated
      name screen are documented.
- [ ] Rule wording and examples are independently written.
- [ ] Directory, game ID, and all stable IDs are valid and consistent.
- [ ] The full version 1 schema validates with the smallest useful tracker.
- [ ] Rules completely cover setup, play, ending, and edge cases.
- [ ] `npm run ci` exits successfully.
- [ ] The production preview, narrow layout, keyboard path, and print boundary
      were checked and accurately reported.
- [ ] No generated `dist/`, third-party assets, secrets, or unrelated changes
      were added.

When handing off a bundled contribution, identify both source files, summarize
the tracker mapping, list exact verification evidence, and disclose anything
not performed.
