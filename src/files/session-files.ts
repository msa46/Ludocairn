import type { GameDefinition } from '../games/model'
import type { IdProvider, Session, SessionDiagnostic } from '../sessions/model'
import { validateSession } from '../sessions/validate'

export interface ImportPreview {
  readonly sessionName: string
  readonly gameName: string
  readonly playerCount: number
  readonly updatedAt: string
}

export interface ImportDiagnostic {
  readonly code:
    'import.invalid-json' | 'import.invalid-session' | 'import.missing-game'
  readonly message: string
  readonly cause?: SessionDiagnostic
}

export type ImportResult =
  | {
      readonly ok: true
      readonly session: Session
      readonly preview: ImportPreview
    }
  | { readonly ok: false; readonly diagnostic: ImportDiagnostic }

export type GameResolver = (id: string) => GameDefinition | undefined

export function serializeSession(session: Session): string {
  return JSON.stringify(session, null, 2) + '\n'
}

export function parseSessionFile(
  text: string,
  resolveGame: GameResolver,
): ImportResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: 'import.invalid-json',
        message: 'The selected file is not valid JSON.',
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
      diagnostic: {
        code: 'import.missing-game',
        message: gameId
          ? `The session refers to unavailable game "${gameId}".`
          : 'The session file does not identify a game.',
      },
    }
  }

  const validated = validateSession(value, game)
  if (!validated.ok) {
    return {
      ok: false,
      diagnostic: {
        code: 'import.invalid-session',
        message: validated.diagnostic.message,
        cause: validated.diagnostic,
      },
    }
  }

  return {
    ok: true,
    session: validated.session,
    preview: {
      sessionName: validated.session.name,
      gameName: game.name,
      playerCount: validated.session.players.length,
      updatedAt: validated.session.updatedAt,
    },
  }
}

export function prepareImportedSession(
  session: Session,
  existingIds: ReadonlySet<string>,
  ids: IdProvider,
): Session {
  if (!existingIds.has(session.id)) return session

  let id = ids.next('session')
  while (existingIds.has(id)) id = ids.next('session')
  return { ...session, id }
}
