import { strFromU8, strToU8, Unzlib, zlibSync } from 'fflate'

import type { Diagnostic, GameDefinition } from '../games/model'
import { parseGameSource } from '../games/parse'
import { gameSourceFitsLimit, MAX_GAME_SOURCE_BYTES } from '../games/source'

const SHARE_FRAGMENT_PREFIX = 'share-game='
const SHARE_VERSION = 'v1'
const BASE64_CHUNK_BYTES = 24_576
const INFLATE_INPUT_CHUNK_BYTES = 64
const ADLER_MODULUS = 65_521

export const SHARE_URL_LIMIT = 8_000
export const GAME_MARKDOWN_FILE_ACCEPT = '.md,.ludocairn-game.md,text/markdown'

export function isGameMarkdownFileName(name: string): boolean {
  return name.toLowerCase().endsWith('.md')
}

export interface GameFilePreview {
  readonly name: string
  readonly summary: string
  readonly deck: GameDefinition['deck']
  readonly players: GameDefinition['players']
  readonly schemaVersion: GameDefinition['schemaVersion']
  readonly roleCount: number
  readonly fieldCount: number
}

export interface GameFileDiagnostic {
  readonly code: 'game-file.oversized-source' | 'game-file.invalid-source'
  readonly message: string
  readonly cause?: readonly Diagnostic[]
}

export interface ShareCodecDiagnostic {
  readonly code:
    | 'game-share.unsupported-version'
    | 'game-share.invalid-fragment'
    | 'game-share.invalid-payload'
    | 'game-share.decompression-failed'
    | 'game-share.oversized-source'
    | 'game-share.source-too-large'
    | 'game-share.url-too-long'
  readonly message: string
}

export type GameFileResult =
  | {
      readonly ok: true
      readonly source: string
      readonly game: GameDefinition
      readonly preview: GameFilePreview
    }
  | {
      readonly ok: false
      readonly diagnostic: GameFileDiagnostic | ShareCodecDiagnostic
    }

export type ShareResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: ShareCodecDiagnostic }

export interface GameDownload {
  readonly filename: string
  readonly blob: Blob
}

function gamePreview(game: GameDefinition): GameFilePreview {
  return {
    name: game.name,
    summary: game.summary,
    deck: game.deck,
    players: game.players,
    schemaVersion: game.schemaVersion,
    roleCount: game.roles.length,
    fieldCount: game.fields.length,
  }
}

export function parseGameFile(source: string): GameFileResult {
  if (!gameSourceFitsLimit(source)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-file.oversized-source',
        message: 'Game source exceeds the 1 MiB limit.',
      },
    }
  }

  const parsed = parseGameSource(source, 'imported-game.md')
  if (!parsed.ok) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-file.invalid-source',
        message: parsed.diagnostics[0]?.message ?? 'Game source is invalid.',
        cause: parsed.diagnostics,
      },
    }
  }

  return {
    ok: true,
    source,
    game: parsed.game,
    preview: gamePreview(parsed.game),
  }
}

export function gameDownloadName(game: GameDefinition): string {
  const filename =
    game.name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'game'
  return `${filename}.ludocairn-game.md`
}

export function createGameDownload(
  game: GameDefinition,
  source: string,
): GameDownload {
  return {
    filename: gameDownloadName(game),
    blob: new Blob([source], { type: 'text/markdown;charset=utf-8' }),
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let base64 = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)
    let binary = ''
    for (const byte of chunk) binary += String.fromCharCode(byte)
    base64 += btoa(binary)
  }
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(payload: string): Uint8Array {
  if (
    payload.length === 0 ||
    payload.length > SHARE_URL_LIMIT ||
    payload.length % 4 === 1 ||
    !/^[A-Za-z0-9_-]+$/.test(payload)
  ) {
    throw new Error('Invalid base64url payload.')
  }

  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  if (bytesToBase64Url(bytes) !== payload) {
    throw new Error('Invalid base64url payload.')
  }
  return bytes
}

class OversizedShareSourceError extends Error {}
class InvalidZlibStreamError extends Error {}

interface Adler32State {
  readonly a: number
  readonly b: number
}

interface UnzlibInternals {
  readonly p: Uint8Array
  readonly s: { readonly f?: number; readonly p: number }
}

function appendBytes(
  left: Uint8Array<ArrayBufferLike>,
  right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBufferLike> {
  const combined = new Uint8Array(left.length + right.length)
  combined.set(left)
  combined.set(right, left.length)
  return combined
}

function updateAdler32(
  { a: initialA, b: initialB }: Adler32State,
  bytes: Uint8Array,
): Adler32State {
  let a = initialA
  let b = initialB
  for (let index = 0; index < bytes.length; index += 1) {
    a += bytes[index]
    b += a
    if (index % 5_552 === 5_551) {
      a %= ADLER_MODULUS
      b %= ADLER_MODULUS
    }
  }
  return { a: a % ADLER_MODULUS, b: b % ADLER_MODULUS }
}

function adler32Value({ a, b }: Adler32State): number {
  return ((b << 16) | a) >>> 0
}

function trailerChecksum(trailer: Uint8Array): number {
  return (
    ((trailer[0] << 24) |
      (trailer[1] << 16) |
      (trailer[2] << 8) |
      trailer[3]) >>>
    0
  )
}

function hasCompleteDeflateStream(stream: Unzlib): boolean {
  const { p, s } = stream as unknown as UnzlibInternals
  return s.f === 1 && p.length === (s.p === 0 ? 0 : 1)
}

function inflateWithinSourceLimit(compressed: Uint8Array): string {
  const chunks: Uint8Array[] = []
  let length = 0
  let checksum: Adler32State = { a: 1, b: 0 }
  const stream = new Unzlib((chunk) => {
    length += chunk.length
    if (length > MAX_GAME_SOURCE_BYTES) throw new OversizedShareSourceError()
    chunks.push(chunk)
    checksum = updateAdler32(checksum, chunk)
  })
  let trailer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
  for (
    let offset = 0;
    offset < compressed.length;
    offset += INFLATE_INPUT_CHUNK_BYTES
  ) {
    trailer = appendBytes(
      trailer,
      compressed.subarray(offset, offset + INFLATE_INPUT_CHUNK_BYTES),
    )
    if (trailer.length > 4) {
      stream.push(trailer.subarray(0, -4), false)
      trailer = trailer.slice(-4)
    }
  }
  if (trailer.length !== 4) throw new InvalidZlibStreamError()
  stream.push(trailer, true)
  if (!hasCompleteDeflateStream(stream)) throw new InvalidZlibStreamError()
  if (adler32Value(checksum) !== trailerChecksum(trailer)) {
    throw new InvalidZlibStreamError()
  }

  const sourceBytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    sourceBytes.set(chunk, offset)
    offset += chunk.length
  }
  return strFromU8(sourceBytes)
}

export function createGameShareUrl(
  source: string,
  baseUrl: string,
): ShareResult {
  if (!gameSourceFitsLimit(source)) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-share.source-too-large',
        message: 'Game source exceeds the 1 MiB limit and cannot be shared.',
      },
    }
  }

  const payload = bytesToBase64Url(zlibSync(strToU8(source)))
  const url = `${baseUrl.split('#', 1)[0]}#${SHARE_FRAGMENT_PREFIX}${SHARE_VERSION}.${payload}`
  if (url.length > SHARE_URL_LIMIT) {
    return {
      ok: false,
      diagnostic: {
        code: 'game-share.url-too-long',
        message:
          'This game is too large for a share link. Export its Markdown file instead.',
      },
    }
  }
  return { ok: true, url }
}

function shareFailure(
  code: ShareCodecDiagnostic['code'],
  message: string,
): GameFileResult {
  return { ok: false, diagnostic: { code, message } }
}

export function parseGameShareHash(hash: string): GameFileResult {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment.startsWith(SHARE_FRAGMENT_PREFIX)) {
    return shareFailure(
      'game-share.invalid-fragment',
      'This link does not contain a shared game.',
    )
  }

  const encoded = fragment.slice(SHARE_FRAGMENT_PREFIX.length)
  const separator = encoded.indexOf('.')
  const version = separator === -1 ? encoded : encoded.slice(0, separator)
  if (version !== SHARE_VERSION) {
    return shareFailure(
      'game-share.unsupported-version',
      `Shared game version "${version}" is not supported.`,
    )
  }
  if (separator === -1) {
    return shareFailure(
      'game-share.invalid-payload',
      'This shared game link is missing its payload.',
    )
  }

  try {
    return parseGameFile(
      inflateWithinSourceLimit(base64UrlToBytes(encoded.slice(separator + 1))),
    )
  } catch (error) {
    if (error instanceof OversizedShareSourceError) {
      return shareFailure(
        'game-share.oversized-source',
        'Shared game source exceeds the 1 MiB limit.',
      )
    }
    if (
      error instanceof Error &&
      error.message === 'Invalid base64url payload.'
    ) {
      return shareFailure(
        'game-share.invalid-payload',
        'This shared game link has an invalid payload.',
      )
    }
    return shareFailure(
      'game-share.decompression-failed',
      'This shared game link could not be decompressed.',
    )
  }
}
