import { describe, expect, it } from 'vitest'

import { parseGameSource } from './parse'

const validSource = `---
schema_version: 1
id: veilquorum
name: Veilquorum
summary: Find the quiet signal before the trail goes dark.
deck: standard-52
players:
  min: 4
  max: 12
roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
role_distributions:
  - players: { min: 4, max: 6 }
    counts: { echo: 1, drifter: 1, wayfinder: remaining }
  - players: { min: 7, max: 9 }
    counts: { echo: 1, drifter: 2, wayfinder: remaining }
  - players: { min: 10, max: 12 }
    counts: { echo: 1, drifter: 3, wayfinder: remaining }
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
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
      type: role
      default: wayfinder
    - id: signals
      label: Signals
      type: number
      default: 0
      min: 0
      max: 9
      step: 1
    - id: clue
      label: Clue
      type: text
      default: ""
      multiline: true
---

# Veilquorum

Original rules live here.
`

function replaceOnce(search: string, replacement: string): string {
  return validSource.replace(search, replacement)
}

describe('parseGameSource', () => {
  it('normalizes a complete version 1 game definition', () => {
    const result = parseGameSource(validSource, 'fixture/game.md')

    expect(result).toEqual({
      ok: true,
      game: {
        schemaVersion: 1,
        id: 'veilquorum',
        name: 'Veilquorum',
        summary: 'Find the quiet signal before the trail goes dark.',
        deck: 'standard-52',
        players: { min: 4, max: 12 },
        roles: [
          {
            id: 'echo',
            label: 'Echo',
            team: 'Quorum',
            summary: 'Privately tests one active player.',
            card: { label: 'Heart', selector: { suits: ['hearts'] } },
          },
          {
            id: 'drifter',
            label: 'Drifter',
            team: 'Drifters',
            summary: 'Quietly reduces the quorum.',
            card: { label: 'Spade', selector: { suits: ['spades'] } },
          },
          {
            id: 'wayfinder',
            label: 'Wayfinder',
            team: 'Quorum',
            summary: 'Identifies the Drifters.',
            card: {
              label: 'Club or diamond',
              selector: { suits: ['clubs', 'diamonds'] },
            },
          },
        ],
        roleDistributions: [
          {
            players: { min: 4, max: 6 },
            counts: { echo: 1, drifter: 1, wayfinder: 'remaining' },
          },
          {
            players: { min: 7, max: 9 },
            counts: { echo: 1, drifter: 2, wayfinder: 'remaining' },
          },
          {
            players: { min: 10, max: 12 },
            counts: { echo: 1, drifter: 3, wayfinder: 'remaining' },
          },
        ],
        assignments: {
          method: 'shuffle',
          visibility: { players: 'own', gameMaster: 'all' },
        },
        phases: [
          { id: 'night', label: 'Night' },
          { id: 'day', label: 'Day' },
        ],
        initialPhase: 'night',
        round: { enabled: true, initial: 1 },
        fields: [
          { id: 'active', label: 'Active', type: 'boolean', default: true },
          {
            id: 'role',
            label: 'Role',
            type: 'role',
            default: 'wayfinder',
          },
          {
            id: 'signals',
            label: 'Signals',
            type: 'number',
            default: 0,
            min: 0,
            max: 9,
            step: 1,
          },
          {
            id: 'clue',
            label: 'Clue',
            type: 'text',
            default: '',
            multiline: true,
          },
        ],
        rulesMarkdown: '# Veilquorum\n\nOriginal rules live here.\n',
        source: 'fixture/game.md',
      },
    })
  })

  it('normalizes absent role data to empty arrays', () => {
    const source = replaceOnce(
      `roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
role_distributions:
  - players: { min: 4, max: 6 }
    counts: { echo: 1, drifter: 1, wayfinder: remaining }
  - players: { min: 7, max: 9 }
    counts: { echo: 1, drifter: 2, wayfinder: remaining }
  - players: { min: 10, max: 12 }
    counts: { echo: 1, drifter: 3, wayfinder: remaining }
assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
`,
      '',
    ).replace(
      `      type: role
      default: wayfinder`,
      `      type: choice
      choices: [wayfinder, drifter, echo]
      default: wayfinder`,
    )
    const result = parseGameSource(source, 'legacy/game.md')

    expect(result).toMatchObject({
      ok: true,
      game: { roles: [], roleDistributions: [] },
    })
  })

  it.each([
    {
      name: 'unsupported schema version',
      source: replaceOnce('schema_version: 1', 'schema_version: 2'),
      code: 'schema.unsupported-version',
    },
    {
      name: 'unknown top-level property',
      source: replaceOnce('deck: standard-52', 'deck: standard-52\nextra: true'),
      code: 'schema.unknown-property',
    },
    {
      name: 'invalid stable ID',
      source: replaceOnce('id: veilquorum', 'id: Veil_Quorum'),
      code: 'schema.invalid-id',
    },
    {
      name: 'duplicate field ID',
      source: replaceOnce('id: signals', 'id: active'),
      code: 'schema.duplicate-field-id',
    },
    {
      name: 'choice default outside choices',
      source: validSource.replace(
        `      type: role
      default: wayfinder`,
        `      type: choice
      choices: [wayfinder, drifter, echo]
      default: stranger`,
      ),
      code: 'schema.invalid-default',
    },
    {
      name: 'missing initial phase target',
      source: replaceOnce('initial_phase: night', 'initial_phase: dusk'),
      code: 'schema.initial-phase-missing',
    },
    {
      name: 'non-positive initial round',
      source: replaceOnce('initial: 1', 'initial: 0'),
      code: 'schema.invalid-round',
    },
  ])('reports $name with a stable diagnostic', ({ source, code }) => {
    const result = parseGameSource(source, 'broken/game.md')

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code, source: 'broken/game.md' }],
    })
  })

  it.each([
    ['duplicate role ID', 'id: drifter', 'id: echo', 'schema.invalid-value', 'roles.1.id'],
    ['empty role summary', 'summary: Quietly reduces the quorum.', 'summary: ""', 'schema.invalid-value', 'roles.1.summary'],
    ['unknown suit', '[spades]', '[stars]', 'schema.invalid-value', 'roles.1.card.selector.suits'],
    ['role default missing', 'default: wayfinder', 'default: stranger', 'schema.invalid-default', 'session.player_fields.1.default'],
    ['overlapping bands', 'players: { min: 7, max: 9 }', 'players: { min: 6, max: 9 }', 'schema.invalid-value', 'role_distributions.1.players'],
    ['missing role count', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1, drifter: 1 }', 'schema.invalid-value', 'role_distributions.0.counts'],
    ['multiple remaining roles', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: remaining, drifter: 1, wayfinder: remaining }', 'schema.invalid-value', 'role_distributions.0.counts'],
  ])('%s is rejected', (_name, search, replacement, code, path) => {
    const result = parseGameSource(replaceOnce(search, replacement), 'broken/game.md')

    expect(result).toMatchObject({ ok: false, diagnostics: [{ code, path }] })
  })

  it.each([
    ['an uncovered supported player count', 'players: { min: 7, max: 9 }', 'players: { min: 8, max: 9 }', 'schema.invalid-value', 'role_distributions.1.players'],
    ['a multi-player fixed-only band', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1, drifter: 1, wayfinder: 2 }', 'schema.invalid-value', 'role_distributions.0.counts'],
    ['a negative count', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: -1, drifter: 1, wayfinder: remaining }', 'schema.invalid-value', 'role_distributions.0.counts.echo'],
    ['a fractional count', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1.5, drifter: 1, wayfinder: remaining }', 'schema.invalid-value', 'role_distributions.0.counts.echo'],
    ['an unknown count key', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1, drifter: 1, wayfinder: remaining, stranger: 0 }', 'schema.invalid-value', 'role_distributions.0.counts.stranger'],
    ['an unknown role property', 'id: echo', 'id: echo\n    extra: true', 'schema.unknown-property', 'roles.0.extra'],
    ['an unknown card property', 'label: Heart', 'label: Heart\n      extra: true', 'schema.unknown-property', 'roles.0.card.extra'],
    ['an unknown distribution property', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }', 'counts: { echo: 1, drifter: 1, wayfinder: remaining }\n    extra: true', 'schema.unknown-property', 'role_distributions.0.extra'],
    ['an unknown assignment method', 'method: shuffle', 'method: ordered', 'schema.invalid-value', 'assignments.method'],
    ['an unknown player visibility', 'players: own', 'players: team', 'schema.invalid-value', 'assignments.visibility.players'],
    ['an unknown game master visibility', 'game_master: all', 'game_master: own', 'schema.invalid-value', 'assignments.visibility.game_master'],
    ['an unknown assignment property', 'method: shuffle', 'method: shuffle\n  extra: true', 'schema.unknown-property', 'assignments.extra'],
    ['an unknown visibility property', 'players: own', 'players: own\n    extra: true', 'schema.unknown-property', 'assignments.visibility.extra'],
  ])('%s is rejected with a stable path', (_name, search, replacement, code, path) => {
    const result = parseGameSource(replaceOnce(search, replacement), 'broken/game.md')

    expect(result).toMatchObject({ ok: false, diagnostics: [{ code, path }] })
  })

  it('rejects distributions without roles', () => {
    const source = replaceOnce(
      `roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
`,
      '',
    ).replace('      type: role', '      type: choice\n      choices: [wayfinder, drifter, echo]')
    const result = parseGameSource(source, 'broken/game.md')

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'schema.invalid-value', path: 'role_distributions' }],
    })
  })

  it('rejects assignments without roles or distributions', () => {
    const withoutRoles = replaceOnce(
      `roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
role_distributions:
  - players: { min: 4, max: 6 }
    counts: { echo: 1, drifter: 1, wayfinder: remaining }
  - players: { min: 7, max: 9 }
    counts: { echo: 1, drifter: 2, wayfinder: remaining }
  - players: { min: 10, max: 12 }
    counts: { echo: 1, drifter: 3, wayfinder: remaining }
`,
      '',
    ).replace(
      `      type: role
      default: wayfinder`,
      `      type: choice
      choices: [wayfinder, drifter, echo]
      default: wayfinder`,
    )
    const withoutDistributions = validSource.replace(
      /role_distributions:\n(?:  .+\n|    .+\n)+(?=assignments:)/,
      '',
    )

    expect(parseGameSource(withoutRoles, 'broken/game.md')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'schema.invalid-value', path: 'assignments' }],
    })
    expect(
      parseGameSource(withoutDistributions, 'broken/game.md'),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'schema.invalid-value', path: 'assignments' }],
    })
  })

  it('rejects a role field without roles', () => {
    const source = replaceOnce(
      `roles:
  - id: echo
    label: Echo
    team: Quorum
    summary: Privately tests one active player.
    card:
      label: Heart
      selector: { suits: [hearts] }
  - id: drifter
    label: Drifter
    team: Drifters
    summary: Quietly reduces the quorum.
    card:
      label: Spade
      selector: { suits: [spades] }
  - id: wayfinder
    label: Wayfinder
    team: Quorum
    summary: Identifies the Drifters.
    card:
      label: Club or diamond
      selector: { suits: [clubs, diamonds] }
role_distributions:
  - players: { min: 4, max: 6 }
    counts: { echo: 1, drifter: 1, wayfinder: remaining }
  - players: { min: 7, max: 9 }
    counts: { echo: 1, drifter: 2, wayfinder: remaining }
  - players: { min: 10, max: 12 }
    counts: { echo: 1, drifter: 3, wayfinder: remaining }
`,
      '',
    )
    const result = parseGameSource(
      source.replace(
        `assignments:
  method: shuffle
  visibility:
    players: own
    game_master: all
`,
        '',
      ),
      'broken/game.md',
    )

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'schema.invalid-default', path: 'session.player_fields.1.default' }],
    })
  })

  it('reports malformed YAML instead of throwing', () => {
    const result = parseGameSource(
      '---\nplayers: [unterminated\n---\n# Rules\n',
      'broken-yaml/game.md',
    )

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'frontmatter.invalid', source: 'broken-yaml/game.md' },
      ],
    })
  })

  it('reports a missing frontmatter boundary', () => {
    const result = parseGameSource('# Rules only\n', 'rules-only/game.md')

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: 'frontmatter.invalid',
          message: 'Game source must begin with a YAML frontmatter block.',
          source: 'rules-only/game.md',
        },
      ],
    })
  })
})
