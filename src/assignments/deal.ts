import type { GameDefinition } from '../games/model'
import { resolveRoleCounts } from '../games/roles'
import type { PlayerAssignment } from '../sessions/model'
import type {
  AssignmentDiagnostic,
  AssignmentResult,
  RandomSource,
} from './model'

function failure(
  code: AssignmentDiagnostic['code'],
  message: string,
  path?: string,
): AssignmentResult {
  return {
    ok: false,
    diagnostic: { code, message, ...(path === undefined ? {} : { path }) },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function dealPlayerAssignments(
  game: GameDefinition,
  playerIds: readonly string[],
  random: RandomSource,
): AssignmentResult {
  const counts = resolveRoleCounts(game, playerIds.length)
  if (!counts) {
    return failure(
      'assignment.unsupported-player-count',
      `${game.name} does not define a role distribution for ${playerIds.length} players.`,
    )
  }

  const pool = counts.flatMap(({ role, count }) =>
    Array.from({ length: count }, () => role.id),
  )
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const sample = random()
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      return failure(
        'assignment.invalid-random',
        'The randomness source must return a finite value from 0 up to but not including 1.',
      )
    }
    const swapIndex = Math.floor(sample * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!]
  }

  return {
    ok: true,
    assignments: playerIds.map((playerId, index) => ({
      playerId,
      roleId: pool[index]!,
    })),
  }
}

export function validatePlayerAssignments(
  game: GameDefinition,
  playerIds: readonly string[],
  value: unknown,
): AssignmentResult {
  if (!Array.isArray(value)) {
    return failure(
      'assignment.invalid-record',
      'Assignments must be an array.',
      'assignments',
    )
  }
  if (value.length !== playerIds.length) {
    return failure(
      'assignment.incorrect-distribution',
      'Assignments must contain exactly one entry for every player.',
      'assignments',
    )
  }

  const knownPlayers = new Set(playerIds)
  const knownRoles = new Set(game.roles.map((role) => role.id))
  const assignedPlayers = new Set<string>()
  const assignments: PlayerAssignment[] = []
  for (const [index, candidate] of value.entries()) {
    const path = `assignments.${index}`
    if (
      !isRecord(candidate) ||
      typeof candidate.playerId !== 'string' ||
      typeof candidate.roleId !== 'string' ||
      Object.keys(candidate).some(
        (key) => key !== 'playerId' && key !== 'roleId',
      )
    ) {
      return failure(
        'assignment.invalid-record',
        'Each assignment must contain only a playerId and roleId.',
        path,
      )
    }
    if (!knownPlayers.has(candidate.playerId)) {
      return failure(
        'assignment.unknown-player',
        `Unknown assigned player "${candidate.playerId}".`,
        `${path}.playerId`,
      )
    }
    if (assignedPlayers.has(candidate.playerId)) {
      return failure(
        'assignment.duplicate-player',
        `Player "${candidate.playerId}" has more than one assignment.`,
        `${path}.playerId`,
      )
    }
    if (!knownRoles.has(candidate.roleId)) {
      return failure(
        'assignment.unknown-role',
        `Unknown assigned role "${candidate.roleId}".`,
        `${path}.roleId`,
      )
    }
    assignedPlayers.add(candidate.playerId)
    assignments.push({
      playerId: candidate.playerId,
      roleId: candidate.roleId,
    })
  }

  const expected = resolveRoleCounts(game, playerIds.length)
  if (!expected) {
    return failure(
      'assignment.unsupported-player-count',
      `${game.name} does not define a role distribution for ${playerIds.length} players.`,
      'assignments',
    )
  }
  const actualCounts = new Map<string, number>()
  for (const assignment of assignments) {
    actualCounts.set(
      assignment.roleId,
      (actualCounts.get(assignment.roleId) ?? 0) + 1,
    )
  }
  if (
    expected.some(
      ({ role, count }) => (actualCounts.get(role.id) ?? 0) !== count,
    )
  ) {
    return failure(
      'assignment.incorrect-distribution',
      'Assigned role counts do not match the game distribution.',
      'assignments',
    )
  }

  return { ok: true, assignments }
}
