import { parse } from 'yaml'

import type {
  Diagnostic,
  GameDefinition,
  ParseGameResult,
  PhaseDefinition,
  PlayerFieldDefinition,
  PlayersDefinition,
  RoundDefinition,
} from './model'

type UnknownRecord = Record<string, unknown>

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function failure(
  source: string,
  code: Diagnostic['code'],
  message: string,
  path?: string,
): ParseGameResult {
  return {
    ok: false,
    diagnostics: [{ code, message, source, ...(path ? { path } : {}) }],
  }
}

function unknownProperty(
  value: UnknownRecord,
  allowed: readonly string[],
): string | undefined {
  return Object.keys(value).find((key) => !allowed.includes(key))
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parsePlayers(
  value: unknown,
  source: string,
): PlayersDefinition | ParseGameResult {
  if (!isRecord(value)) {
    return failure(
      source,
      'schema.invalid-value',
      'players must be an object.',
      'players',
    )
  }
  const extra = unknownProperty(value, ['min', 'max'])
  if (extra) {
    return failure(
      source,
      'schema.unknown-property',
      `Unknown property "players.${extra}".`,
      `players.${extra}`,
    )
  }
  if (!Number.isInteger(value.min) || (value.min as number) < 1) {
    return failure(
      source,
      'schema.invalid-value',
      'players.min must be a positive integer.',
      'players.min',
    )
  }
  if (
    value.max !== undefined &&
    (!Number.isInteger(value.max) || (value.max as number) < (value.min as number))
  ) {
    return failure(
      source,
      'schema.invalid-value',
      'players.max must be an integer greater than or equal to players.min.',
      'players.max',
    )
  }

  return {
    min: value.min as number,
    ...(value.max === undefined ? {} : { max: value.max as number }),
  }
}

function parsePhases(
  value: unknown,
  source: string,
): readonly PhaseDefinition[] | ParseGameResult {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length === 0) {
    return failure(
      source,
      'schema.invalid-value',
      'session.phases must be a non-empty array when present.',
      'session.phases',
    )
  }

  const phases: PhaseDefinition[] = []
  for (const [index, candidate] of value.entries()) {
    const path = `session.phases.${index}`
    if (!isRecord(candidate)) {
      return failure(
        source,
        'schema.invalid-value',
        'Each phase must be an object.',
        path,
      )
    }
    const extra = unknownProperty(candidate, ['id', 'label'])
    if (extra) {
      return failure(
        source,
        'schema.unknown-property',
        `Unknown property "${path}.${extra}".`,
        `${path}.${extra}`,
      )
    }
    if (!validId(candidate.id)) {
      return failure(
        source,
        'schema.invalid-id',
        'Phase IDs must be lowercase stable identifiers.',
        `${path}.id`,
      )
    }
    if (!nonEmptyString(candidate.label)) {
      return failure(
        source,
        'schema.invalid-value',
        'Phase labels must be non-empty strings.',
        `${path}.label`,
      )
    }
    if (phases.some((phase) => phase.id === candidate.id)) {
      return failure(
        source,
        'schema.duplicate-phase-id',
        `Duplicate phase ID "${candidate.id}".`,
        `${path}.id`,
      )
    }
    phases.push({ id: candidate.id, label: candidate.label.trim() })
  }
  return phases
}

function parseRound(
  value: unknown,
  source: string,
): RoundDefinition | ParseGameResult {
  if (!isRecord(value)) {
    return failure(
      source,
      'schema.invalid-round',
      'session.round must be an object.',
      'session.round',
    )
  }
  const extra = unknownProperty(value, ['enabled', 'initial'])
  if (extra) {
    return failure(
      source,
      'schema.unknown-property',
      `Unknown property "session.round.${extra}".`,
      `session.round.${extra}`,
    )
  }
  if (value.enabled === true) {
    if (!Number.isInteger(value.initial) || (value.initial as number) < 1) {
      return failure(
        source,
        'schema.invalid-round',
        'An enabled round requires a positive integer initial value.',
        'session.round.initial',
      )
    }
    return { enabled: true, initial: value.initial as number }
  }
  if (value.enabled === false && value.initial === undefined) {
    return { enabled: false }
  }
  return failure(
    source,
    'schema.invalid-round',
    'A disabled round must omit initial.',
    'session.round',
  )
}

function parseField(
  value: unknown,
  index: number,
  source: string,
): PlayerFieldDefinition | ParseGameResult {
  const path = `session.player_fields.${index}`
  if (!isRecord(value)) {
    return failure(
      source,
      'schema.invalid-value',
      'Each player field must be an object.',
      path,
    )
  }
  if (!validId(value.id)) {
    return failure(
      source,
      'schema.invalid-id',
      'Field IDs must be lowercase stable identifiers.',
      `${path}.id`,
    )
  }
  if (!nonEmptyString(value.label)) {
    return failure(
      source,
      'schema.invalid-value',
      'Field labels must be non-empty strings.',
      `${path}.label`,
    )
  }

  const base = { id: value.id, label: value.label.trim() }
  switch (value.type) {
    case 'boolean': {
      const extra = unknownProperty(value, ['id', 'label', 'type', 'default'])
      if (extra) {
        return failure(
          source,
          'schema.unknown-property',
          `Unknown property "${path}.${extra}".`,
          `${path}.${extra}`,
        )
      }
      if (typeof value.default !== 'boolean') {
        return failure(
          source,
          'schema.invalid-default',
          'A boolean field default must be true or false.',
          `${path}.default`,
        )
      }
      return { ...base, type: 'boolean', default: value.default }
    }
    case 'choice': {
      const extra = unknownProperty(value, [
        'id',
        'label',
        'type',
        'choices',
        'default',
      ])
      if (extra) {
        return failure(
          source,
          'schema.unknown-property',
          `Unknown property "${path}.${extra}".`,
          `${path}.${extra}`,
        )
      }
      if (
        !Array.isArray(value.choices) ||
        value.choices.length === 0 ||
        !value.choices.every(validId) ||
        new Set(value.choices).size !== value.choices.length
      ) {
        return failure(
          source,
          'schema.invalid-value',
          'Choice values must be unique stable identifiers.',
          `${path}.choices`,
        )
      }
      if (
        typeof value.default !== 'string' ||
        !value.choices.includes(value.default)
      ) {
        return failure(
          source,
          'schema.invalid-default',
          'A choice default must name one declared choice.',
          `${path}.default`,
        )
      }
      return {
        ...base,
        type: 'choice',
        choices: value.choices,
        default: value.default,
      }
    }
    case 'number': {
      const extra = unknownProperty(value, [
        'id',
        'label',
        'type',
        'default',
        'min',
        'max',
        'step',
      ])
      if (extra) {
        return failure(
          source,
          'schema.unknown-property',
          `Unknown property "${path}.${extra}".`,
          `${path}.${extra}`,
        )
      }
      if (
        !finiteNumber(value.default) ||
        (value.min !== undefined && !finiteNumber(value.min)) ||
        (value.max !== undefined && !finiteNumber(value.max)) ||
        (value.step !== undefined &&
          (!finiteNumber(value.step) || value.step <= 0)) ||
        (finiteNumber(value.min) && value.default < value.min) ||
        (finiteNumber(value.max) && value.default > value.max) ||
        (finiteNumber(value.min) &&
          finiteNumber(value.max) &&
          value.min > value.max)
      ) {
        return failure(
          source,
          'schema.invalid-default',
          'A number default and constraints must be finite and compatible.',
          `${path}.default`,
        )
      }
      return {
        ...base,
        type: 'number',
        default: value.default,
        ...(value.min === undefined ? {} : { min: value.min as number }),
        ...(value.max === undefined ? {} : { max: value.max as number }),
        ...(value.step === undefined ? {} : { step: value.step as number }),
      }
    }
    case 'text': {
      const extra = unknownProperty(value, [
        'id',
        'label',
        'type',
        'default',
        'multiline',
      ])
      if (extra) {
        return failure(
          source,
          'schema.unknown-property',
          `Unknown property "${path}.${extra}".`,
          `${path}.${extra}`,
        )
      }
      if (
        typeof value.default !== 'string' ||
        (value.multiline !== undefined && typeof value.multiline !== 'boolean')
      ) {
        return failure(
          source,
          'schema.invalid-default',
          'A text default must be text and multiline must be boolean.',
          `${path}.default`,
        )
      }
      return {
        ...base,
        type: 'text',
        default: value.default,
        multiline: value.multiline ?? false,
      }
    }
    default:
      return failure(
        source,
        'schema.invalid-value',
        'Field type must be boolean, choice, number, or text.',
        `${path}.type`,
      )
  }
}

function parseFields(
  value: unknown,
  source: string,
): readonly PlayerFieldDefinition[] | ParseGameResult {
  if (!Array.isArray(value)) {
    return failure(
      source,
      'schema.invalid-value',
      'session.player_fields must be an array.',
      'session.player_fields',
    )
  }
  const fields: PlayerFieldDefinition[] = []
  for (const [index, candidate] of value.entries()) {
    const parsed = parseField(candidate, index, source)
    if ('ok' in parsed) return parsed
    if (fields.some((field) => field.id === parsed.id)) {
      return failure(
        source,
        'schema.duplicate-field-id',
        `Duplicate field ID "${parsed.id}".`,
        `session.player_fields.${index}.id`,
      )
    }
    fields.push(parsed)
  }
  return fields
}

function parseMetadata(
  metadata: unknown,
  rulesMarkdown: string,
  source: string,
): ParseGameResult {
  if (!isRecord(metadata)) {
    return failure(
      source,
      'frontmatter.invalid',
      'YAML frontmatter must contain an object.',
    )
  }
  const extra = unknownProperty(metadata, [
    'schema_version',
    'id',
    'name',
    'summary',
    'deck',
    'players',
    'session',
  ])
  if (extra) {
    return failure(
      source,
      'schema.unknown-property',
      `Unknown property "${extra}".`,
      extra,
    )
  }
  if (metadata.schema_version !== 1) {
    return failure(
      source,
      'schema.unsupported-version',
      'Only game schema version 1 is supported.',
      'schema_version',
    )
  }
  if (!validId(metadata.id)) {
    return failure(
      source,
      'schema.invalid-id',
      'Game IDs must be lowercase stable identifiers.',
      'id',
    )
  }
  if (!nonEmptyString(metadata.name) || !nonEmptyString(metadata.summary)) {
    return failure(
      source,
      'schema.invalid-value',
      'Game name and summary must be non-empty strings.',
      'name',
    )
  }
  if (metadata.deck !== 'standard-52' && metadata.deck !== 'tarot') {
    return failure(
      source,
      'schema.invalid-value',
      'Game deck must be standard-52 or tarot.',
      'deck',
    )
  }

  const players = parsePlayers(metadata.players, source)
  if ('ok' in players) return players
  if (!isRecord(metadata.session)) {
    return failure(
      source,
      'schema.invalid-value',
      'session must be an object.',
      'session',
    )
  }
  const session = metadata.session
  const sessionExtra = unknownProperty(session, [
    'phases',
    'initial_phase',
    'round',
    'player_fields',
  ])
  if (sessionExtra) {
    return failure(
      source,
      'schema.unknown-property',
      `Unknown property "session.${sessionExtra}".`,
      `session.${sessionExtra}`,
    )
  }
  const phases = parsePhases(session.phases, source)
  if ('ok' in phases) return phases
  if (phases.length > 0) {
    if (
      typeof session.initial_phase !== 'string' ||
      !phases.some((phase) => phase.id === session.initial_phase)
    ) {
      return failure(
        source,
        'schema.initial-phase-missing',
        'initial_phase must name one declared phase.',
        'session.initial_phase',
      )
    }
  } else if (session.initial_phase !== undefined) {
    return failure(
      source,
      'schema.initial-phase-missing',
      'initial_phase is not allowed without phases.',
      'session.initial_phase',
    )
  }
  const round = parseRound(session.round, source)
  if ('ok' in round) return round
  const fields = parseFields(session.player_fields, source)
  if ('ok' in fields) return fields

  const game: GameDefinition = {
    schemaVersion: 1,
    id: metadata.id,
    name: metadata.name.trim(),
    summary: metadata.summary.trim(),
    deck: metadata.deck,
    players,
    roles: [],
    roleDistributions: [],
    phases,
    ...(phases.length === 0
      ? {}
      : { initialPhase: session.initial_phase as string }),
    round,
    fields,
    rulesMarkdown,
    source,
  }
  return { ok: true, game }
}

export function parseGameSource(
  rawSource: string,
  source: string,
): ParseGameResult {
  const normalized = rawSource.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) {
    return failure(
      source,
      'frontmatter.invalid',
      'Game source must begin with a YAML frontmatter block.',
    )
  }
  const closingIndex = normalized.indexOf('\n---\n', 4)
  if (closingIndex === -1) {
    return failure(
      source,
      'frontmatter.invalid',
      'Game frontmatter must end with a closing delimiter.',
    )
  }

  const yamlSource = normalized.slice(4, closingIndex)
  const rulesMarkdown = normalized.slice(closingIndex + 5).replace(/^\n/, '')
  try {
    return parseMetadata(parse(yamlSource), rulesMarkdown, source)
  } catch {
    return failure(
      source,
      'frontmatter.invalid',
      'Game frontmatter is not valid YAML.',
    )
  }
}
