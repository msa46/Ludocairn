import {
  errorMessage,
  GAME_KEY_PREFIX,
  gameNotFound,
  keyForGame,
  parseStoredGame,
  type GameLoadResult,
  type GameRepository,
  type GameRepositoryRecord,
  type GameSaveResult,
  type GameStorageDiagnostic,
} from './game-repository'

export class LocalStorageGameRepository implements GameRepository {
  readonly #storage: Storage

  constructor(storage: Storage) {
    this.#storage = storage
  }

  list(): readonly GameRepositoryRecord[] {
    try {
      const records: GameRepositoryRecord[] = []
      for (let index = 0; index < this.#storage.length; index += 1) {
        const key = this.#storage.key(index)
        if (!key?.startsWith(GAME_KEY_PREFIX)) continue
        const raw = this.#storage.getItem(key)
        if (raw === null) continue
        const id = key.slice(GAME_KEY_PREFIX.length)
        records.push({ id, ...parseStoredGame(raw, id) })
      }
      return sortRecords(records)
    } catch (error) {
      return [{ id: '', ok: false, diagnostic: readFailure(error) }]
    }
  }

  load(id: string): GameLoadResult {
    try {
      const raw = this.#storage.getItem(keyForGame(id))
      return raw === null ? gameNotFound(id) : parseStoredGame(raw, id)
    } catch (error) {
      return { ok: false, diagnostic: readFailure(error) }
    }
  }

  save(source: string): GameSaveResult {
    const parsed = parseStoredGame(source)
    if (!parsed.ok) return { ok: false, diagnostic: parsed.diagnostic }

    try {
      this.#storage.setItem(keyForGame(parsed.game.id), source)
      return { ok: true }
    } catch (error) {
      return { ok: false, diagnostic: writeFailure(error) }
    }
  }

  remove(id: string): GameSaveResult {
    try {
      this.#storage.removeItem(keyForGame(id))
      return { ok: true }
    } catch (error) {
      return { ok: false, diagnostic: writeFailure(error) }
    }
  }

  raw(id: string): string | undefined {
    try {
      return this.#storage.getItem(keyForGame(id)) ?? undefined
    } catch {
      return undefined
    }
  }
}

function sortRecords(
  records: readonly GameRepositoryRecord[],
): GameRepositoryRecord[] {
  const valid = records
    .filter((record) => record.ok)
    .sort(
      (left, right) =>
        left.game.name.localeCompare(right.game.name) ||
        left.id.localeCompare(right.id),
    )
  const invalid = records
    .filter((record) => !record.ok)
    .sort((left, right) => left.id.localeCompare(right.id))
  return [...valid, ...invalid]
}

function readFailure(error: unknown): GameStorageDiagnostic {
  return {
    code: 'game-storage.read-failed',
    message: errorMessage(error, 'Browser storage could not be read.'),
  }
}

function writeFailure(error: unknown): GameStorageDiagnostic {
  return {
    code: 'game-storage.write-failed',
    message: errorMessage(error, 'Browser storage could not be updated.'),
  }
}
