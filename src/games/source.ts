import { stringify } from 'yaml'

import type {
  GameDefinition,
  PlayerFieldDefinition,
  RoleDefinition,
  RoundDefinition,
} from './model'

export const MAX_GAME_SOURCE_BYTES = 1_048_576

export function gameSourceFitsLimit(source: string): boolean {
  return new TextEncoder().encode(source).byteLength <= MAX_GAME_SOURCE_BYTES
}

function serializeRole(role: RoleDefinition) {
  return {
    id: role.id,
    label: role.label,
    ...(role.team === undefined ? {} : { team: role.team }),
    summary: role.summary,
    ...(role.card === undefined
      ? {}
      : { card: { label: role.card.label, selector: role.card.selector } }),
  }
}

function serializeField(field: PlayerFieldDefinition) {
  switch (field.type) {
    case 'boolean':
      return { id: field.id, label: field.label, type: field.type, default: field.default }
    case 'choice':
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        choices: field.choices,
        default: field.default,
      }
    case 'number':
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        default: field.default,
        ...(field.min === undefined ? {} : { min: field.min }),
        ...(field.max === undefined ? {} : { max: field.max }),
        ...(field.step === undefined ? {} : { step: field.step }),
      }
    case 'text':
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        default: field.default,
        multiline: field.multiline,
      }
    case 'role':
      return { id: field.id, label: field.label, type: field.type, default: field.default }
  }
}

function serializeRound(round: RoundDefinition) {
  return round.enabled ? { enabled: true, initial: round.initial } : { enabled: false }
}

function serializeSessionDefinition(game: GameDefinition) {
  return {
    ...(game.phases.length
      ? {
          phases: game.phases.map((phase) => ({ id: phase.id, label: phase.label })),
          initial_phase: game.initialPhase,
        }
      : {}),
    round: serializeRound(game.round),
    player_fields: game.fields.map(serializeField),
  }
}

export function serializeGameSource(game: GameDefinition): string {
  const frontmatter = {
    schema_version: 1,
    id: game.id,
    name: game.name,
    summary: game.summary,
    deck: game.deck,
    players: game.players,
    ...(game.roles.length ? { roles: game.roles.map(serializeRole) } : {}),
    ...(game.roleDistributions.length
      ? { role_distributions: game.roleDistributions }
      : {}),
    ...(game.assignments
      ? {
          assignments: {
            method: 'shuffle',
            visibility: {
              players: game.assignments.visibility.players,
              game_master: game.assignments.visibility.gameMaster,
            },
          },
        }
      : {}),
    session: serializeSessionDefinition(game),
  }
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n\n${game.rulesMarkdown.trimStart()}`
}

export function createGameTemplate(): string {
  return serializeGameSource({
    schemaVersion: 1,
    id: 'new-game',
    name: 'New Game',
    summary: 'Describe your game.',
    deck: 'standard-52',
    players: { min: 1 },
    roles: [],
    roleDistributions: [],
    phases: [],
    round: { enabled: false },
    fields: [],
    rulesMarkdown: '# New Game\n\nWrite your rules here.\n',
    source: 'template',
  })
}

export function sourceHasFrontmatterComments(source: string): boolean {
  const normalized = source.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) return false
  const closingIndex = normalized.indexOf('\n---\n', 4)
  if (closingIndex === -1) return false
  return normalized
    .slice(4, closingIndex)
    .split('\n')
    .some((line) => /^\s*#/.test(line))
}
