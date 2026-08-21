# Game Definition Format

## Purpose

A Ludocairn game definition combines machine-readable YAML frontmatter with
human-readable Markdown rules. Authors should be able to create and review a
game in a normal text editor and contribute it through a pull request without
writing application code.

The first format is intentionally small. It describes tracker state and deck
references; it does not automate rules, assign cards, run scripts, or model
private player knowledge.

## File location

Each repository-hosted game has one entry file:

```text
games/<game-id>/game.md
```

The directory name and frontmatter `id` must match. IDs use lowercase ASCII
letters, digits, and single hyphens, start with a letter, and remain stable
after publication.

Each game also requires an adjacent rights record:

```text
games/<game-id>/RIGHTS.md
```

It records authorship, license, provenance, sources for any permitted reused
material, and the date and scope of exact/confusing-similarity name screening.
Repository examples are original Ludocairn content under the MIT License.
Name screens are preliminary conflict checks, not legal opinions, registration
claims, or guarantees of freedom to use; databases and unregistered market use
can change.

## Complete example

```markdown
---
schema_version: 1
id: example-game
name: Example Game
summary: A neutral example showing every version 1 field type.
deck: standard-52

players:
  min: 5
  max: 16

session:
  phases:
    - id: night
      label: Night
    - id: day
      label: Day
  initial_phase: night

  round:
    enabled: true
    initial: 1

  player_fields:
    - id: active
      label: Active
      type: boolean
      default: true

    - id: role
      label: Role
      type: choice
      choices:
        - first
        - second
        - third
      default: first

    - id: score
      label: Score
      type: number
      default: 0
      min: 0
      step: 1

    - id: notes
      label: Notes
      type: text
      default: ""
      multiline: true
---

# Example Game

Place the rules after the closing frontmatter delimiter.
```

## Version 1 metadata

### Top-level fields

| Field | Required | Meaning |
| --- | --- | --- |
| `schema_version` | yes | Integer format version; version 1 requires `1`. |
| `id` | yes | Stable game ID matching its directory. |
| `name` | yes | Human-readable game name. |
| `summary` | yes | Plain-text catalog description. |
| `deck` | yes | `standard-52` or `tarot`. |
| `players` | yes | Supported player-count constraints. |
| `session` | yes | Tracker configuration. |

Unknown fields are rejected in version 1. This catches misspellings and keeps
extensions deliberate.

### Player constraints

`players.min` is an integer of at least 1. `players.max` is optional and, when
present, must be an integer greater than or equal to `min`. The UI warns when a
session is outside the recommended range but does not delete players or block
an existing session from opening.

### Phases and rounds

`session.phases` is an optional non-empty list of `{ id, label }` objects. Phase
IDs follow the same syntax as game IDs and are unique within a game. If phases
are present, `session.initial_phase` is required and must reference one of
them. If phases are absent, `initial_phase` is not allowed.

`session.round` is required. When `enabled` is `true`, `initial` is a positive
integer. When `enabled` is `false`, `initial` is omitted and no round control
appears.

### Player fields

`session.player_fields` is an ordered list. Field IDs are unique within the
game and use the same syntax as game IDs. Every field has `id`, `label`,
`type`, and a type-appropriate `default`.

#### Boolean

```yaml
- id: alive
  label: Alive
  type: boolean
  default: true
```

The default is a YAML boolean.

#### Choice

```yaml
- id: role
  label: Role
  type: choice
  choices: [villager, mafia, detective]
  default: villager
```

`choices` contains at least one unique ID. The default must be one of those
IDs. Version 1 displays a humanized choice ID; separate choice labels can be
added in a later schema version if real games require them.

#### Number

```yaml
- id: score
  label: Score
  type: number
  default: 0
  min: 0
  max: 20
  step: 1
```

`min` and `max` are optional finite numbers. `step` is optional and must be
greater than zero. The default must satisfy the declared bounds. A number
field serves both direct number entry and counter controls.

#### Text

```yaml
- id: notes
  label: Notes
  type: text
  default: ""
  multiline: true
```

`multiline` defaults to `false`. Text is plain text, not Markdown or HTML.

## Markdown rules

Everything after the closing `---` is the rule document. Version 1 supports
standard Markdown headings, paragraphs, emphasis, lists, tables, and links.
Raw HTML, embedded images, and executable content are not supported. Deferring
game-owned assets avoids defining an incomplete asset discovery, validation,
and privacy policy before examples demonstrate the need.

## Deck selectors

Selectors are structured YAML objects used where later versions of the format
need a subset of cards. The version 1 selector data model supports these
optional properties:

```yaml
ids: [standard-52:hearts:queen]
suits: [hearts, diamonds]
ranks: [queen, king]
arcana: [major]
tags: [court]
```

Values within a property are alternatives. Populated properties combine with
logical AND. An empty selector is invalid. A selector property that does not
apply to the selected deck is invalid. Version 1 game metadata does not yet
attach selectors to automated behavior; the model is defined and tested for
future explicit capabilities.

## Compatibility rules

- Parsers dispatch on `schema_version` before interpreting other fields.
- Unsupported versions fail with a clear diagnostic; they are never guessed.
- Published IDs are stable identifiers rather than translated display text.
- Schema changes that invalidate an existing valid game require a new version.
- Adding optional behavior may remain in the same version only when old files
  retain identical meaning.

Game schema versions and saved-session storage versions are separate. A game
definition configures new trackers; an exported or stored session contains the
game ID/schema version plus concrete player state and is validated against the
currently bundled game before it can be restored or imported.

## Authoring and verification

1. Choose a stable lowercase ID and create `games/<game-id>/game.md`.
2. Copy the structure above, using only the field types and optional controls
   required by the game.
3. Write complete, self-contained rules after the frontmatter. Do not embed raw
   HTML, JavaScript, images, or remote widgets.
4. Add the adjacent `RIGHTS.md` before treating the title as public.
5. Run `npm run ci`. The repository contract discovers every bundled game,
   validates the schema, rejects duplicate IDs, and checks required rights
   records.

The current catalog demonstrates the format with
[`Veilquorum`](../games/veilquorum/game.md) (all four field types plus phases),
[`Rillward Gambit`](../games/rillward-gambit/game.md) (score/streak/stance
tracking), and [`Sereinfolio`](../games/sereinfolio/game.md) (tarot reflection
text and tone tracking).
