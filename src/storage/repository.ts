import type { GameDefinition } from '../games/model'
import type { Session, SessionDiagnostic } from '../sessions/model'
import { validateSession } from '../sessions/validate'

export const SESSION_KEY_PREFIX = 'ludocairn.session.v1.'

export type GameResolver = (id: string) => GameDefinition | undefined

export interface StorageDiagnostic {
  readonly code:
    | 'storage.invalid-json'
    | 'storage.invalid-session'
    | 'storage.missing-game'
    | 'storage.not-found'
    | 'storage.read-failed'
    | 'storage.write-failed'
  readonly message: string
  readonly cause?: SessionDiagnostic
}

export type LoadResult =
  | { readonly ok: true; readonly session: Session }
  | {
      readonly ok: false
      readonly diagnostic: StorageDiagnostic
      readonly raw?: string
    }

export type RepositoryRecord = LoadResult & { readonly id: string }

export type SaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: StorageDiagnostic }

export type RemoveResult = SaveResult

export interface SessionRepository {
  list(): readonly RepositoryRecord[]
  load(id: string): LoadResult
  save(session: Session): SaveResult
  remove(id: string): RemoveResult
  raw(id: string): string | undefined
}

export function keyForSession(id: string): string {
  return `${SESSION_KEY_PREFIX}${id}`
}

export function errorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message
  ) {
    return error.message
  }
  return fallback
}

export function parseStoredSession(
  raw: string,
  resolveGame: GameResolver,
): LoadResult {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'storage.invalid-json',
        message: 'Saved session is not valid JSON.',
      },
    }
  }

  const record =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  const gameId =
    record && typeof record.gameId === 'string' ? record.gameId : undefined
  const game = gameId === undefined ? undefined : resolveGame(gameId)
  if (!game) {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'storage.missing-game',
        message: gameId
          ? `Saved session refers to unavailable game "${gameId}".`
          : 'Saved session does not identify a game.',
      },
    }
  }

  const validated = validateSession(value, game)
  if (!validated.ok) {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'storage.invalid-session',
        message: validated.diagnostic.message,
        cause: validated.diagnostic,
      },
    }
  }
  return validated
}

export function notFound(id: string): LoadResult {
  return {
    ok: false,
    diagnostic: {
      code: 'storage.not-found',
      message: `No saved session with ID "${id}" was found.`,
    },
  }
}
