import { describe, expect, it } from 'vitest'

import { LocalStorageGameRepository } from './local-game-storage'
import { MemoryGameRepository } from './memory-game-storage'
import { keyForGame } from './game-repository'

const alphaSource = `---
schema_version: 1
id: alpha
name: Alpha Game
summary: First fixture.
deck: standard-52
players:
  min: 1
session:
  round:
    enabled: false
  player_fields: []
---

# Alpha Game
`

const zuluSource = `---
schema_version: 1
id: zulu
name: Zulu Game
summary: Last fixture.
deck: standard-52
players:
  min: 1
session:
  round:
    enabled: false
  player_fields: []
---

# Zulu Game
`

function throwingStorage(): Storage {
  return {
    get length() {
      throw new DOMException('blocked')
    },
    getItem() {
      throw new DOMException('blocked')
    },
    setItem() {
      throw new DOMException('blocked')
    },
  } as unknown as Storage
}

describe('MemoryGameRepository', () => {
  it('round-trips canonical source and sorts valid records by name then ID', () => {
    const repository = new MemoryGameRepository()

    expect(repository.save(alphaSource)).toMatchObject({ ok: true })
    expect(repository.save(zuluSource)).toMatchObject({ ok: true })
    expect(repository.list().map((record) => record.id)).toEqual([
      'alpha',
      'zulu',
    ])
    expect(repository.load('alpha')).toMatchObject({
      ok: true,
      game: { id: 'alpha' },
      source: alphaSource,
    })
  })

  it('keeps malformed, oversized, and key-mismatched source recoverable', () => {
    const oversized = 'é'.repeat(524_289)
    const repository = new MemoryGameRepository({
      initial: {
        [keyForGame('broken')]: '{not yaml',
        [keyForGame('oversized')]: oversized,
        [keyForGame('wrong-key')]: alphaSource,
      },
    })

    expect(repository.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'broken', ok: false, raw: '{not yaml' }),
        expect.objectContaining({ id: 'oversized', ok: false, raw: oversized }),
        expect.objectContaining({
          id: 'wrong-key',
          ok: false,
          raw: alphaSource,
        }),
      ]),
    )
    expect(repository.load('oversized')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.oversized-source' },
    })
    expect(repository.load('wrong-key')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.key-mismatch' },
    })
    expect(repository.list().map((record) => record.id)).toEqual([
      'broken',
      'oversized',
      'wrong-key',
    ])
  })

  it('does not replace a prior record when saving invalid source', () => {
    const repository = new MemoryGameRepository({
      initial: { [keyForGame('alpha')]: alphaSource },
    })

    expect(repository.save('{not yaml')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.invalid-source' },
    })
    expect(repository.raw('alpha')).toBe(alphaSource)
  })

  it('reports blocked writes without storing a record', () => {
    const repository = new MemoryGameRepository({ failWrites: true })

    expect(repository.save(alphaSource)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.write-failed' },
    })
    expect(repository.raw('alpha')).toBeUndefined()
  })

  it('reports injected read failures', () => {
    const repository = new MemoryGameRepository({ failReads: true })

    expect(repository.list()[0]).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.read-failed' },
    })
    expect(repository.load('alpha')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.read-failed' },
    })
  })
})

describe('LocalStorageGameRepository', () => {
  it('reports blocked reads and writes without replacing a prior record', () => {
    const repository = new LocalStorageGameRepository(throwingStorage())

    expect(repository.list()[0]).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.read-failed' },
    })
    expect(repository.save(alphaSource)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-storage.write-failed' },
    })
  })

  it('enumerates only custom-game keys', () => {
    const storage = window.localStorage
    storage.clear()
    storage.setItem('unrelated', alphaSource)
    const repository = new LocalStorageGameRepository(storage)

    expect(repository.save(alphaSource)).toEqual({ ok: true })
    expect(repository.list().map((record) => record.id)).toEqual(['alpha'])
  })
})
