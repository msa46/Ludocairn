import type { Diagnostic, GameDefinition } from '../games/model'
import { parseGameSource } from '../games/parse'
import { gameSourceFitsLimit } from '../games/source'

export const GAME_KEY_PREFIX = 'ludocairn.game.v1.'

export interface GameStorageDiagnostic {
  readonly code:
    | 'game-storage.invalid-source'
    | 'game-storage.oversized-source'
    | 'game-storage.key-mismatch'
    | 'game-storage.not-found'
    | 'game-storage.read-failed'
    | 'game-storage.write-failed'
  readonly message: string
  readonly cause?: readonly Diagnostic[]
}

export type GameLoadResult =
  | {
      readonly ok: true
      readonly game: GameDefinition
      readonly source: string
    }
  | {
      readonly ok: false
      readonly diagnostic: GameStorageDiagnostic
      readonly raw?: string
    }

export type GameRepositoryRecord = GameLoadResult & { readonly id: string }

export type GameSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: GameStorageDiagnostic }

export interface GameRepository {
  list(): readonly GameRepositoryRecord[]
  load(id: string): GameLoadResult
  save(source: string): GameSaveResult
  remove(id: string): GameSaveResult
  raw(id: string): string | undefined
}

export function keyForGame(id: string): string {
  return `${GAME_KEY_PREFIX}${id}`
}

export function parseStoredGame(
  raw: string,
  expectedId?: string,
): GameLoadResult {
  if (!gameSourceFitsLimit(raw)) {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'game-storage.oversized-source',
        message: 'Saved game source exceeds the 1 MiB limit.',
      },
    }
  }

  const parsed = parseGameSource(
    raw,
    `custom/${expectedId ?? 'unsaved'}/game.md`,
  )
  if (!parsed.ok) {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'game-storage.invalid-source',
        message:
          parsed.diagnostics[0]?.message ?? 'Saved game source is invalid.',
        cause: parsed.diagnostics,
      },
    }
  }

  if (expectedId !== undefined && parsed.game.id !== expectedId) {
    return {
      ok: false,
      raw,
      diagnostic: {
        code: 'game-storage.key-mismatch',
        message: `Saved game ID "${parsed.game.id}" does not match its browser storage key "${expectedId}".`,
      },
    }
  }

  return { ok: true, game: parsed.game, source: raw }
}

export function gameNotFound(id: string): GameLoadResult {
  return {
    ok: false,
    diagnostic: {
      code: 'game-storage.not-found',
      message: `No saved game with ID "${id}" was found.`,
    },
  }
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
