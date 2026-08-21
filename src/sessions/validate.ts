import type { GameDefinition } from '../games/model'
import type { Session, SessionDiagnostic, SessionResult } from './model'
import { fieldValueIsValid } from './operations'

function failure(
  code: SessionDiagnostic['code'],
  message: string,
  path?: string,
): SessionResult {
  return {
    ok: false,
    diagnostic: { code, message, ...(path ? { path } : {}) },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value
}

export function validateSession(
  value: unknown,
  game: GameDefinition,
): SessionResult {
  if (!isRecord(value)) {
    return failure('session.invalid-record', 'Session must be an object.')
  }

  if (value.storageVersion !== 1) {
    return failure(
      'session.unsupported-storage-version',
      'Session storage version is not supported.',
      'storageVersion',
    )
  }
  if (!isNonBlankString(value.id)) {
    return failure('session.invalid-record', 'Session ID is required.', 'id')
  }
  if (!isNonBlankString(value.name)) {
    return failure(
      'session.invalid-record',
      'Session name is required.',
      'name',
    )
  }
  if (value.gameId !== game.id) {
    return failure(
      'session.game-mismatch',
      'Session belongs to a different game.',
      'gameId',
    )
  }
  if (value.gameSchemaVersion !== game.schemaVersion) {
    return failure(
      'session.incompatible-game-version',
      'Session was created for an incompatible game version.',
      'gameSchemaVersion',
    )
  }
  if (typeof value.notes !== 'string') {
    return failure(
      'session.invalid-record',
      'Session notes must be text.',
      'notes',
    )
  }
  if (!isIsoTimestamp(value.createdAt)) {
    return failure(
      'session.invalid-date',
      'Session creation date must be an ISO timestamp.',
      'createdAt',
    )
  }
  if (!isIsoTimestamp(value.updatedAt)) {
    return failure(
      'session.invalid-date',
      'Session update date must be an ISO timestamp.',
      'updatedAt',
    )
  }
  if (!Array.isArray(value.players)) {
    return failure(
      'session.invalid-record',
      'Session players must be an array.',
      'players',
    )
  }

  const playerIds = new Set<string>()
  for (const [playerIndex, player] of value.players.entries()) {
    const playerPath = `players.${playerIndex}`
    if (!isRecord(player)) {
      return failure(
        'session.invalid-record',
        'Each player must be an object.',
        playerPath,
      )
    }
    if (!isNonBlankString(player.id)) {
      return failure(
        'session.invalid-record',
        'Player ID is required.',
        `${playerPath}.id`,
      )
    }
    if (playerIds.has(player.id)) {
      return failure(
        'session.duplicate-player-id',
        `Player ID "${player.id}" is duplicated.`,
        `${playerPath}.id`,
      )
    }
    playerIds.add(player.id)
    if (!isNonBlankString(player.name)) {
      return failure(
        'session.invalid-record',
        'Player name is required.',
        `${playerPath}.name`,
      )
    }
    if (!isRecord(player.fields)) {
      return failure(
        'session.invalid-record',
        'Player fields must be an object.',
        `${playerPath}.fields`,
      )
    }

    const knownFields = new Map(game.fields.map((field) => [field.id, field]))
    for (const fieldId of Object.keys(player.fields)) {
      if (!knownFields.has(fieldId)) {
        return failure(
          'session.unknown-field',
          `Unknown field "${fieldId}".`,
          `${playerPath}.fields.${fieldId}`,
        )
      }
    }
    for (const field of game.fields) {
      const fieldPath = `${playerPath}.fields.${field.id}`
      if (!Object.hasOwn(player.fields, field.id)) {
        return failure(
          'session.invalid-record',
          `Required field "${field.id}" is missing.`,
          fieldPath,
        )
      }
      if (!fieldValueIsValid(field, player.fields[field.id])) {
        return failure(
          'session.invalid-field-value',
          `Value does not conform to field "${field.id}".`,
          fieldPath,
        )
      }
    }
  }

  if (
    game.phases.length > 0 &&
    (!isNonBlankString(value.currentPhase) ||
      !game.phases.some((phase) => phase.id === value.currentPhase))
  ) {
    return failure(
      'session.invalid-phase',
      'Session phase is not declared by the game.',
      'currentPhase',
    )
  }
  if (
    game.round.enabled &&
    (!Number.isInteger(value.round) || (value.round as number) < 1)
  ) {
    return failure(
      'session.invalid-round',
      'Session round must be a positive integer.',
      'round',
    )
  }

  return { ok: true, session: value as unknown as Session }
}
