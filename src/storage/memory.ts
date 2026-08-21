import type { Session } from '../sessions/model'
import {
  keyForSession,
  notFound,
  parseStoredSession,
  SESSION_KEY_PREFIX,
  type GameResolver,
  type LoadResult,
  type RemoveResult,
  type RepositoryRecord,
  type SaveResult,
  type SessionRepository,
} from './repository'

interface MemoryRepositoryOptions {
  readonly initial?: Readonly<Record<string, string>>
  readonly failWrites?: boolean
}

export class MemorySessionRepository implements SessionRepository {
  readonly #records: Map<string, string>
  readonly #resolveGame: GameResolver
  readonly #failWrites: boolean

  constructor(
    resolveGame: GameResolver,
    options: MemoryRepositoryOptions = {},
  ) {
    this.#resolveGame = resolveGame
    this.#records = new Map(Object.entries(options.initial ?? {}))
    this.#failWrites = options.failWrites ?? false
  }

  list(): readonly RepositoryRecord[] {
    return [...this.#records.entries()]
      .filter(([key]) => key.startsWith(SESSION_KEY_PREFIX))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, raw]) => ({
        id: key.slice(SESSION_KEY_PREFIX.length),
        ...parseStoredSession(raw, this.#resolveGame),
      }))
  }

  load(id: string): LoadResult {
    const raw = this.#records.get(keyForSession(id))
    return raw === undefined
      ? notFound(id)
      : parseStoredSession(raw, this.#resolveGame)
  }

  save(session: Session): SaveResult {
    if (this.#failWrites) return writeFailure()
    this.#records.set(keyForSession(session.id), JSON.stringify(session))
    return { ok: true }
  }

  remove(id: string): RemoveResult {
    if (this.#failWrites) return writeFailure()
    this.#records.delete(keyForSession(id))
    return { ok: true }
  }

  raw(id: string): string | undefined {
    return this.#records.get(keyForSession(id))
  }
}

function writeFailure(): SaveResult {
  return {
    ok: false,
    diagnostic: {
      code: 'storage.write-failed',
      message: 'Injected memory storage failure.',
    },
  }
}
