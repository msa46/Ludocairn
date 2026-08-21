import type { Diagnostic, GameDefinition } from './model'
import { parseGameSource } from './parse'

export type CatalogResult =
  | { readonly ok: true; readonly games: readonly GameDefinition[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

interface ParsedSource {
  readonly path: string
  readonly directoryId?: string
  readonly game: GameDefinition
}

function gameDirectoryId(path: string): string | undefined {
  return /\/games\/([^/]+)\/game\.md$/.exec(path)?.[1]
}

export function buildCatalog(
  sources: Readonly<Record<string, string>>,
): CatalogResult {
  const parsedSources: ParsedSource[] = []
  const diagnostics: Diagnostic[] = []

  for (const [path, source] of Object.entries(sources).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const parsed = parseGameSource(source, path)
    if (!parsed.ok) {
      diagnostics.push(...parsed.diagnostics)
      continue
    }
    parsedSources.push({
      path,
      directoryId: gameDirectoryId(path),
      game: parsed.game,
    })
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics }

  const seenIds = new Set<string>()
  for (const parsed of parsedSources) {
    if (seenIds.has(parsed.game.id)) {
      return {
        ok: false,
        diagnostics: [
          {
            code: 'catalog.duplicate-id',
            message: `Duplicate game ID "${parsed.game.id}".`,
            source: parsed.path,
            path: 'id',
          },
        ],
      }
    }
    seenIds.add(parsed.game.id)
  }

  for (const parsed of parsedSources) {
    if (parsed.directoryId !== parsed.game.id) {
      return {
        ok: false,
        diagnostics: [
          {
            code: 'catalog.path-id-mismatch',
            message: `Game ID "${parsed.game.id}" must match directory "${parsed.directoryId ?? 'unknown'}".`,
            source: parsed.path,
            path: 'id',
          },
        ],
      }
    }
  }

  return {
    ok: true,
    games: Object.freeze(parsedSources.map(({ game }) => game)),
  }
}

const bundledSources = import.meta.glob('/games/*/game.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

export function loadBundledGames(): CatalogResult {
  return buildCatalog(bundledSources)
}

