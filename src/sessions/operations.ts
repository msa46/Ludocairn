import type { GameDefinition, PlayerFieldDefinition } from '../games/model'
import type {
  Clock,
  IdProvider,
  Player,
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

export function fieldValueIsValid(
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
      return false
  }
}

export function createSession(
  game: GameDefinition,
  input: CreateSessionInput,
  clock: Clock,
  ids: IdProvider,
): SessionResult {
  const name = input.name.trim()
  if (!name) {
    return failure(
      'session.invalid-name',
      'Session name cannot be blank.',
      'name',
    )
  }

  const sessionId = ids.next('session')
  const players: Player[] = []
  for (const [index, playerName] of input.playerNames.entries()) {
    const normalizedName = playerName.trim()
    if (!normalizedName) {
      return failure(
        'session.invalid-name',
        'Player name cannot be blank.',
        `players.${index}.name`,
      )
    }
    players.push({
      id: ids.next('player'),
      name: normalizedName,
      fields: defaultFields(game),
    })
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
  if (!fieldValueIsValid(field, value)) {
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
