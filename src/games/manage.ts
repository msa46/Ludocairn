import type { GameDefinition } from './model'
import { parseGameSource } from './parse'
import { gameSourceFitsLimit } from './source'
import type { GameRepositoryRecord } from '../storage/game-repository'
import {
  gameIdFromStoredSession,
  type RepositoryRecord,
} from '../storage/repository'
import { validateSession } from '../sessions/validate'

export type GameSaveDiagnostic =
  | {
      readonly code: 'game-save.oversized-source'
      readonly message: string
    }
  | {
      readonly code: 'game-save.invalid-source'
      readonly message: string
    }
  | {
      readonly code: 'game-save.bundled-collision'
      readonly message: string
    }
  | {
      readonly code: 'game-save.id-changed'
      readonly message: string
    }
  | {
      readonly code: 'game-save.custom-collision'
      readonly message: string
    }
  | {
      readonly code: 'game-save.session-enumeration-failed'
      readonly message: string
    }
  | {
      readonly code: 'game-save.incompatible-sessions'
      readonly message: string
      readonly sessionIds: readonly string[]
    }

export type GameDeletionDiagnostic =
  | {
      readonly code: 'game-delete.session-enumeration-failed'
      readonly message: string
    }
  | {
      readonly code: 'game-delete.sessions-use-game'
      readonly message: string
      readonly sessionIds: readonly string[]
    }

export type GameSaveReview =
  | { readonly ok: true; readonly game: GameDefinition; readonly source: string }
  | { readonly ok: false; readonly diagnostic: GameSaveDiagnostic }

export type GameDeletionReview =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: GameDeletionDiagnostic }

export interface GameSaveContext {
  readonly originalId?: string
  readonly bundledIds: ReadonlySet<string>
  readonly customRecords: readonly GameRepositoryRecord[]
  readonly sessionRecords: readonly RepositoryRecord[]
}

export function mergeGameCatalog(
  bundled: readonly GameDefinition[],
  records: readonly GameRepositoryRecord[],
): {
  readonly games: readonly GameDefinition[]
  readonly customIds: ReadonlySet<string>
  readonly recovery: readonly GameRepositoryRecord[]
} {
  const games = [...bundled]
  const customIds = new Set<string>()
  const bundledIds = new Set(bundled.map((game) => game.id))
  const recovery: GameRepositoryRecord[] = []

  for (const record of records) {
    if (
      !record.ok ||
      bundledIds.has(record.game.id) ||
      customIds.has(record.game.id)
    ) {
      recovery.push(record)
      continue
    }
    games.push(record.game)
    customIds.add(record.game.id)
  }

  return { games, customIds, recovery }
}

export function findGameUsage(
  gameId: string,
  records: readonly RepositoryRecord[],
): readonly RepositoryRecord[] {
  return records.filter((record) =>
    record.ok
      ? record.session.gameId === gameId
      : record.raw !== undefined && gameIdFromStoredSession(record.raw) === gameId,
  )
}

function sessionEnumerationFailed(
  records: readonly RepositoryRecord[],
): boolean {
  return records.some(
    (record) => !record.ok && record.diagnostic.code === 'storage.read-failed',
  )
}

export function reviewGameSave(
  source: string,
  context: GameSaveContext,
): GameSaveReview {
  if (!gameSourceFitsLimit(source)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.oversized-source',
        message: 'Game source exceeds the 1 MiB limit.',
      },
    }
  }

  const parsed = parseGameSource(
    source,
    `custom/${context.originalId ?? 'unsaved'}/game.md`,
  )
  if (!parsed.ok) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.invalid-source',
        message: parsed.diagnostics[0]?.message ?? 'Game source is invalid.',
      },
    }
  }

  const { game } = parsed
  if (context.bundledIds.has(game.id)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.bundled-collision',
        message: `Game ID "${game.id}" belongs to a bundled game.`,
      },
    }
  }
  if (context.originalId !== undefined && context.originalId !== game.id) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.id-changed',
        message: 'The ID of an existing custom game cannot be changed.',
      },
    }
  }
  if (
    context.originalId === undefined &&
    context.customRecords.some((record) => record.id === game.id)
  ) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.custom-collision',
        message: `A custom game with ID "${game.id}" already exists.`,
      },
    }
  }
  if (sessionEnumerationFailed(context.sessionRecords)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-save.session-enumeration-failed',
        message: 'Saved sessions could not be read, so this game cannot be updated safely.',
      },
    }
  }

  if (context.originalId !== undefined) {
    const incompatibleSessionIds = findGameUsage(
      game.id,
      context.sessionRecords,
    )
      .filter((record) => !record.ok || !validateSession(record.session, game).ok)
      .map((record) => record.id)
    if (incompatibleSessionIds.length > 0) {
      return {
        ok: false,
        diagnostic: {
          code: 'game-save.incompatible-sessions',
          message: 'This revision is incompatible with saved sessions.',
          sessionIds: incompatibleSessionIds,
        },
      }
    }
  }

  return { ok: true, game, source }
}

export function reviewGameDeletion(
  gameId: string,
  sessionRecords: readonly RepositoryRecord[],
): GameDeletionReview {
  if (sessionEnumerationFailed(sessionRecords)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-delete.session-enumeration-failed',
        message: 'Saved sessions could not be read, so this game cannot be deleted safely.',
      },
    }
  }

  const sessionIds = findGameUsage(gameId, sessionRecords).map(
    (record) => record.id,
  )
  if (sessionIds.length > 0) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-delete.sessions-use-game',
        message: 'This game is still used by saved sessions.',
        sessionIds,
      },
    }
  }
  return { ok: true }
}
