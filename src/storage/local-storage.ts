import type { Session } from '../sessions/model'
import {
  errorMessage,
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
  type StorageDiagnostic,
} from './repository'

export class LocalStorageSessionRepository implements SessionRepository {
  readonly #storage: Storage
  readonly #resolveGame: GameResolver

  constructor(storage: Storage, resolveGame: GameResolver) {
    this.#storage = storage
    this.#resolveGame = resolveGame
  }

  list(): readonly RepositoryRecord[] {
    try {
      const records: RepositoryRecord[] = []
      for (let index = 0; index < this.#storage.length; index += 1) {
        const key = this.#storage.key(index)
        if (!key?.startsWith(SESSION_KEY_PREFIX)) continue
        const raw = this.#storage.getItem(key)
        if (raw === null) continue
        records.push({
          id: key.slice(SESSION_KEY_PREFIX.length),
          ...parseStoredSession(raw, this.#resolveGame),
        })
      }
      return records.sort((left, right) => left.id.localeCompare(right.id))
    } catch (error) {
      return [{ id: '', ok: false, diagnostic: readFailure(error) }]
    }
  }

  load(id: string): LoadResult {
    try {
      const raw = this.#storage.getItem(keyForSession(id))
      return raw === null
        ? notFound(id)
        : parseStoredSession(raw, this.#resolveGame)
    } catch (error) {
      return { ok: false, diagnostic: readFailure(error) }
    }
  }

  save(session: Session): SaveResult {
    try {
      this.#storage.setItem(keyForSession(session.id), JSON.stringify(session))
      return { ok: true }
    } catch (error) {
      return { ok: false, diagnostic: writeFailure(error) }
    }
  }

  remove(id: string): RemoveResult {
    try {
      this.#storage.removeItem(keyForSession(id))
      return { ok: true }
    } catch (error) {
      return { ok: false, diagnostic: writeFailure(error) }
    }
  }

  raw(id: string): string | undefined {
    try {
      return this.#storage.getItem(keyForSession(id)) ?? undefined
    } catch {
      return undefined
    }
  }
}

function readFailure(error: unknown): StorageDiagnostic {
  return {
    code: 'storage.read-failed',
    message: errorMessage(error, 'Browser storage could not be read.'),
  }
}

function writeFailure(error: unknown): StorageDiagnostic {
  return {
    code: 'storage.write-failed',
    message: errorMessage(error, 'Browser storage could not be updated.'),
  }
}
