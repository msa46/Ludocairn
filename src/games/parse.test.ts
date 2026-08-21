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
      choices: [wayfinder, drifter, echo]
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
            type: 'choice',
            choices: ['wayfinder', 'drifter', 'echo'],
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
      source: replaceOnce('default: wayfinder', 'default: stranger'),
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
