import { zlibSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../games/model'
import { MAX_GAME_SOURCE_BYTES } from '../games/source'
import {
  createGameDownload,
  createGameShareUrl,
  gameDownloadName,
  parseGameFile,
  parseGameShareHash,
  SHARE_URL_LIMIT,
} from './game-files'

const cafeSource = `---
schema_version: 1
id: cafe-game
name: Café Game ☕
summary: A déjà vu game for Søren and 星.
deck: standard-52
players: { min: 2, max: 4 }
session:
  round: { enabled: false }
  player_fields:
    - id: note
      label: Note
      type: text
      default: Café ☕
      multiline: true
---

# Café Game ☕

Play déjà vu with Søren and 星.
`

const cafeGame: GameDefinition = {
  schemaVersion: 1,
  id: 'cafe-game',
  name: 'Café Game ☕',
  summary: 'A déjà vu game for Søren and 星.',
  deck: 'standard-52',
  players: { min: 2, max: 4 },
  roles: [],
  roleDistributions: [],
  phases: [],
  round: { enabled: false },
  fields: [
    {
      id: 'note',
      label: 'Note',
      type: 'text',
      default: 'Café ☕',
      multiline: true,
    },
  ],
  rulesMarkdown: '# Café Game ☕\n\nPlay déjà vu with Søren and 星.\n',
  source: 'custom/cafe-game/game.md',
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

describe('game files', () => {
  it('parses a valid source into a non-sensitive review preview', () => {
    expect(parseGameFile(cafeSource)).toMatchObject({
      ok: true,
      source: cafeSource,
      game: { id: 'cafe-game' },
      preview: {
        name: 'Café Game ☕',
        summary: 'A déjà vu game for Søren and 星.',
        deck: 'standard-52',
        players: { min: 2, max: 4 },
        schemaVersion: 1,
        roleCount: 0,
        fieldCount: 1,
      },
    })
  })

  it('rejects source that exceeds the one-mebibyte UTF-8 limit before parsing', () => {
    expect(
      parseGameFile('é'.repeat(MAX_GAME_SOURCE_BYTES / 2 + 1)),
    ).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-file.oversized-source' },
    })
  })

  it('round-trips Unicode canonical source through a versioned fragment', () => {
    const shared = createGameShareUrl(cafeSource, 'https://example.test/app/')

    expect(shared.ok).toBe(true)
    if (!shared.ok) return
    expect(shared.url).toContain('#share-game=v1.')
    expect(parseGameShareHash(new URL(shared.url).hash)).toMatchObject({
      ok: true,
      source: cafeSource,
      game: { id: 'cafe-game' },
    })
  })

  it('rejects unsupported, corrupt, oversized-output, and overlong links', () => {
    const corruptHash = '#share-game=v1.not-valid-zlib'
    const oversizedSource = `${cafeSource}${'x'.repeat(MAX_GAME_SOURCE_BYTES)}`
    const oversizedHash = `#share-game=v1.${base64Url(zlibSync(strToU8(oversizedSource)))}`
    const longBaseUrl = `https://example.test/${'a'.repeat(SHARE_URL_LIMIT)}`

    expect(parseGameShareHash('#share-game=v2.abc')).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-share.unsupported-version' },
    })
    expect(parseGameShareHash(corruptHash)).toMatchObject({ ok: false })
    expect(parseGameShareHash(oversizedHash)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-share.oversized-source' },
    })
    expect(createGameShareUrl(cafeSource, longBaseUrl)).toMatchObject({
      ok: false,
      diagnostic: { code: 'game-share.url-too-long' },
    })
  })

  it('creates an exact UTF-8 Markdown download', async () => {
    const download = createGameDownload(cafeGame, cafeSource)

    expect(download.filename).toBe('cafe-game.ludocairn-game.md')
    expect(download.blob.type).toBe('text/markdown;charset=utf-8')
    expect(await download.blob.text()).toBe(cafeSource)
  })

  it('uses the existing session filename sanitation style for game downloads', () => {
    expect(gameDownloadName({ ...cafeGame, name: '  déjà/vu -- 星  ' })).toBe(
      'deja-vu.ludocairn-game.md',
    )
    expect(gameDownloadName({ ...cafeGame, name: '☕' })).toBe(
      'game.ludocairn-game.md',
    )
  })
})
