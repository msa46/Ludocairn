import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { verifyStaticBuild } from './verify-static-build.mjs'

const temporaryDirectories: string[] = []

function createDist(indexHtml: string, assets: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'deckwright-static-'))
  temporaryDirectories.push(directory)
  writeFileSync(join(directory, 'index.html'), indexHtml)

  for (const [relativePath, contents] of Object.entries(assets)) {
    const outputPath = join(directory, relativePath)
    mkdirSync(join(outputPath, '..'), { recursive: true })
    writeFileSync(outputPath, contents)
  }

  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('verifyStaticBuild', () => {
  it('accepts an index with existing relative assets', () => {
    const directory = createDist(
      '<script type="module" src="./assets/app.js"></script>',
      { 'assets/app.js': 'console.log("Deckwright")' },
    )

    expect(verifyStaticBuild(directory)).toEqual(['./assets/app.js'])
  })

  it('rejects root-absolute asset paths that break repository subpaths', () => {
    const directory = createDist(
      '<script type="module" src="/assets/app.js"></script>',
      { 'assets/app.js': 'console.log("Deckwright")' },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Root-absolute asset URL is not GitHub Pages safe: /assets/app.js',
    )
  })

  it('rejects referenced assets missing from the artifact', () => {
    const directory = createDist(
      '<link rel="stylesheet" href="./assets/app.css" />',
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced asset is missing: ./assets/app.css',
    )
  })
})
