import {
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

interface MemoryGameRepositoryOptions {
  readonly initial?: Readonly<Record<string, string>>
  readonly failReads?: boolean
  readonly failWrites?: boolean
}

export class MemoryGameRepository implements GameRepository {
  readonly #records: Map<string, string>
  readonly #failReads: boolean
  readonly #failWrites: boolean

  constructor(options: MemoryGameRepositoryOptions = {}) {
    this.#records = new Map(Object.entries(options.initial ?? {}))
    this.#failReads = options.failReads ?? false
    this.#failWrites = options.failWrites ?? false
  }

  list(): readonly GameRepositoryRecord[] {
    if (this.#failReads)
      return [{ id: '', ok: false, diagnostic: readFailure() }]

    const records = [...this.#records.entries()]
      .filter(([key]) => key.startsWith(GAME_KEY_PREFIX))
      .map(([key, raw]) => {
        const id = key.slice(GAME_KEY_PREFIX.length)
        return { id, ...parseStoredGame(raw, id) }
      })
    return sortRecords(records)
  }

  load(id: string): GameLoadResult {
    if (this.#failReads) return { ok: false, diagnostic: readFailure() }

    const raw = this.#records.get(keyForGame(id))
    return raw === undefined ? gameNotFound(id) : parseStoredGame(raw, id)
  }

  save(source: string): GameSaveResult {
    const parsed = parseStoredGame(source)
    if (!parsed.ok) return { ok: false, diagnostic: parsed.diagnostic }
    if (this.#failWrites) return writeFailure()

    this.#records.set(keyForGame(parsed.game.id), source)
    return { ok: true }
  }

  remove(id: string): GameSaveResult {
    if (this.#failWrites) return writeFailure()

    this.#records.delete(keyForGame(id))
    return { ok: true }
  }

  raw(id: string): string | undefined {
    return this.#failReads ? undefined : this.#records.get(keyForGame(id))
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

function readFailure(): GameStorageDiagnostic {
  return {
    code: 'game-storage.read-failed',
    message: 'Injected memory storage failure.',
  }
}

function writeFailure(): GameSaveResult {
  return {
    ok: false,
    diagnostic: {
      code: 'game-storage.write-failed',
      message: 'Injected memory storage failure.',
    },
  }
}
