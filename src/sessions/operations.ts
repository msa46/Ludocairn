import { dealPlayerAssignments } from '../assignments/deal'
import type { RandomSource } from '../assignments/model'
import type { GameDefinition, PlayerFieldDefinition } from '../games/model'
import type {
  Clock,
  IdProvider,
  Player,
  PlayerAssignment,
  Session,
  SessionDiagnostic,
  SessionFieldValue,
  SessionResult,
} from './model'

export interface CreateSessionInput {
  readonly name: string
  readonly playerNames: readonly string[]
}

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

function updated(session: Session, changes: Partial<Session>, clock: Clock) {
  return {
    ok: true as const,
    session: { ...session, ...changes, updatedAt: clock() },
  }
}

function defaultFields(
  game: GameDefinition,
): Record<string, SessionFieldValue> {
  return Object.fromEntries(
    game.fields.map((field) => [field.id, field.default]),
  )
}

function playerById(session: Session, playerId: string): Player | undefined {
  return session.players.find((player) => player.id === playerId)
}

function mirrorAssignedRoles(
  game: GameDefinition,
  players: readonly Player[],
  assignments: readonly PlayerAssignment[],
): readonly Player[] {
  const roleFieldIds = game.fields
    .filter((field) => field.type === 'role')
    .map((field) => field.id)
  if (roleFieldIds.length === 0) return players
  const roleByPlayer = new Map(
    assignments.map((assignment) => [assignment.playerId, assignment.roleId]),
  )
  return players.map((player) => {
    const roleId = roleByPlayer.get(player.id)
    if (!roleId) return player
    return {
      ...player,
      fields: {
        ...player.fields,
        ...Object.fromEntries(roleFieldIds.map((fieldId) => [fieldId, roleId])),
      },
    }
  })
}

function assignmentFailure(
  code: 'session.invalid-assignments' | 'session.unsupported-player-count',
  message: string,
): SessionResult {
  return failure(code, message, 'assignments')
}

export function fieldValueIsValid(
  game: GameDefinition,
  field: PlayerFieldDefinition,
  value: unknown,
): value is SessionFieldValue {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'choice':
      return typeof value === 'string' && field.choices.includes(value)
    case 'number': {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      ) {
        return false
      }
      if (field.step === undefined) return true
      const steps = (value - (field.min ?? 0)) / field.step
      return Math.abs(steps - Math.round(steps)) < Number.EPSILON * 10
    }
    case 'text':
      return typeof value === 'string'
    case 'role':
      return (
        typeof value === 'string' &&
        game.roles.some((role) => role.id === value)
      )
  }
}

export function createSession(
  game: GameDefinition,
  input: CreateSessionInput,
  clock: Clock,
  ids: IdProvider,
  random: RandomSource = Math.random,
): SessionResult {
  const name = input.name.trim()
  if (!name) {
    return failure(
      'session.invalid-name',
      'Session name cannot be blank.',
      'name',
    )
  }

  const normalizedPlayerNames: string[] = []
  for (const [index, playerName] of input.playerNames.entries()) {
    const normalizedName = playerName.trim()
    if (!normalizedName) {
      return failure(
        'session.invalid-name',
        'Player name cannot be blank.',
        `players.${index}.name`,
      )
    }
    normalizedPlayerNames.push(normalizedName)
  }
  if (
    game.assignments &&
    (normalizedPlayerNames.length < game.players.min ||
      (game.players.max !== undefined &&
        normalizedPlayerNames.length > game.players.max))
  ) {
    return failure(
      'session.unsupported-player-count',
      `${game.name} can deal digital assignments only for ${game.players.min}${
        game.players.max === undefined || game.players.max === game.players.min
          ? ''
          : `–${game.players.max}`
      } players.`,
      'players',
    )
  }

  const sessionId = ids.next('session')
  let players: readonly Player[] = normalizedPlayerNames.map((playerName) => ({
    id: ids.next('player'),
    name: playerName,
    fields: defaultFields(game),
  }))
  let assignments: readonly PlayerAssignment[] | undefined
  if (game.assignments) {
    const dealt = dealPlayerAssignments(
      game,
      players.map((player) => player.id),
      random,
    )
    if (!dealt.ok) {
      return assignmentFailure(
        dealt.diagnostic.code === 'assignment.unsupported-player-count'
          ? 'session.unsupported-player-count'
          : 'session.invalid-assignments',
        dealt.diagnostic.message,
      )
    }
    assignments = dealt.assignments
    players = mirrorAssignedRoles(game, players, assignments)
  }

  const timestamp = clock()
  return {
    ok: true,
    session: {
      storageVersion: 1,
      id: sessionId,
      name,
      gameId: game.id,
      gameSchemaVersion: game.schemaVersion,
      players,
      ...(assignments === undefined ? {} : { assignments }),
      ...(game.initialPhase === undefined
        ? {}
        : { currentPhase: game.initialPhase }),
      ...(game.round.enabled ? { round: game.round.initial } : {}),
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

export function addPlayer(
  session: Session,
  game: GameDefinition,
  displayName: string,
  clock: Clock,
  ids: IdProvider,
): SessionResult {
  if (session.assignments) {
    return failure(
      'session.roster-locked',
      'Players cannot be added after digital assignments are dealt.',
    )
  }
  const name = displayName.trim()
  if (!name) {
    return failure('session.invalid-name', 'Player name cannot be blank.')
  }
  const player: Player = {
    id: ids.next('player'),
    name,
    fields: defaultFields(game),
  }
  return updated(session, { players: [...session.players, player] }, clock)
}

export function renamePlayer(
  session: Session,
  playerId: string,
  displayName: string,
  clock: Clock,
): SessionResult {
  if (!playerById(session, playerId)) {
    return failure('session.unknown-player', `Unknown player "${playerId}".`)
  }
  const name = displayName.trim()
  if (!name) {
    return failure('session.invalid-name', 'Player name cannot be blank.')
  }
  return updated(
    session,
    {
      players: session.players.map((player) =>
        player.id === playerId ? { ...player, name } : player,
      ),
    },
    clock,
  )
}

export function removePlayer(
  session: Session,
  playerId: string,
  clock: Clock,
): SessionResult {
  if (session.assignments) {
    return failure(
      'session.roster-locked',
      'Players cannot be removed after digital assignments are dealt.',
    )
  }
  if (!playerById(session, playerId)) {
    return failure('session.unknown-player', `Unknown player "${playerId}".`)
  }
  return updated(
    session,
    { players: session.players.filter((player) => player.id !== playerId) },
    clock,
  )
}

export function updatePlayerField(
  session: Session,
  game: GameDefinition,
  playerId: string,
  fieldId: string,
  value: unknown,
  clock: Clock,
): SessionResult {
  if (!playerById(session, playerId)) {
    return failure('session.unknown-player', `Unknown player "${playerId}".`)
  }
  const field = game.fields.find((candidate) => candidate.id === fieldId)
  if (!field) {
    return failure('session.unknown-field', `Unknown field "${fieldId}".`)
  }
  if (session.assignments && field.type === 'role') {
    return failure(
      'session.assignment-locked',
      'Assigned role fields cannot be edited after digital assignments are dealt.',
    )
  }
  if (!fieldValueIsValid(game, field, value)) {
    return failure(
      'session.invalid-field-value',
      `Value does not conform to field "${fieldId}".`,
    )
  }
  return updated(
    session,
    {
      players: session.players.map((player) =>
        player.id === playerId
          ? { ...player, fields: { ...player.fields, [fieldId]: value } }
          : player,
      ),
    },
    clock,
  )
}

export function dealSessionAssignments(
  session: Session,
  game: GameDefinition,
  random: RandomSource,
  clock: Clock,
): SessionResult {
  if (!game.assignments) {
    return assignmentFailure(
      'session.invalid-assignments',
      `${game.name} does not define digital assignments.`,
    )
  }
  if (session.assignments) {
    return failure(
      'session.assignment-locked',
      'Digital assignments have already been dealt.',
      'assignments',
    )
  }
  const dealt = dealPlayerAssignments(
    game,
    session.players.map((player) => player.id),
    random,
  )
  if (!dealt.ok) {
    return assignmentFailure(
      dealt.diagnostic.code === 'assignment.unsupported-player-count'
        ? 'session.unsupported-player-count'
        : 'session.invalid-assignments',
      dealt.diagnostic.message,
    )
  }
  return updated(
    session,
    {
      assignments: dealt.assignments,
      players: mirrorAssignedRoles(game, session.players, dealt.assignments),
    },
    clock,
  )
}

export function setPhase(
  session: Session,
  game: GameDefinition,
  phaseId: string,
  clock: Clock,
): SessionResult {
  if (!game.phases.some((phase) => phase.id === phaseId)) {
    return failure('session.invalid-phase', `Unknown phase "${phaseId}".`)
  }
  return updated(session, { currentPhase: phaseId }, clock)
}

export function setRound(
  session: Session,
  game: GameDefinition,
  round: number,
  clock: Clock,
): SessionResult {
  if (!game.round.enabled || !Number.isInteger(round) || round < 1) {
    return failure(
      'session.invalid-round',
      'Round must be a positive integer for a game with rounds enabled.',
    )
  }
  return updated(session, { round }, clock)
}

export function adjustRound(
  session: Session,
  game: GameDefinition,
  amount: number,
  clock: Clock,
): SessionResult {
  return setRound(session, game, (session.round ?? 0) + amount, clock)
}

export function updateNotes(
  session: Session,
  notes: string,
  clock: Clock,
): SessionResult {
  return updated(session, { notes }, clock)
}

export function renameSession(
  session: Session,
  displayName: string,
  clock: Clock,
): SessionResult {
  const name = displayName.trim()
  if (!name) {
    return failure('session.invalid-name', 'Session name cannot be blank.')
  }
  return updated(session, { name }, clock)
}

export function getPlayerCountWarning(
  session: Session,
  game: GameDefinition,
): string | undefined {
  const count = session.players.length
  if (count < game.players.min) {
    return `${game.name} recommends at least ${game.players.min} players; this session has ${count}.`
  }
  if (game.players.max !== undefined && count > game.players.max) {
    return `${game.name} recommends at most ${game.players.max} players; this session has ${count}.`
  }
  return undefined
}
