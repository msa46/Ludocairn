import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { verifyStaticBuild } from './verify-static-build.mjs'

const temporaryDirectories: string[] = []

function createDist(
  indexHtml: string,
  assets: Record<string, string> = {},
  options: { branded?: boolean } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'deckwright-static-'))
  temporaryDirectories.push(directory)
  const identity = options.branded === false ? '' : '<title>Ludocairn</title>'
  writeFileSync(join(directory, 'index.html'), `${identity}${indexHtml}`)

  for (const [relativePath, contents] of Object.entries(assets)) {
    const outputPath = join(directory, relativePath)
    mkdirSync(join(outputPath, '..'), { recursive: true })
    writeFileSync(outputPath, contents)
  }

  return directory
}

function createExternalAsset() {
  const directory = mkdtempSync(join(tmpdir(), 'deckwright-external-'))
  temporaryDirectories.push(directory)
  const assetPath = join(directory, 'external.js')
  writeFileSync(assetPath, 'console.log("outside Deckwright")')

  return assetPath
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('verifyStaticBuild', () => {
  it('accepts a branded index with existing relative JavaScript and CSS assets', () => {
    const directory = createDist(
      '<script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">',
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual([
      './assets/app.js',
      './assets/app.css',
    ])
  })

  it('recognizes asset attributes across case, spacing, and quote forms', () => {
    const directory = createDist(
      "<script SRC = './assets/app.js'></script><link HREF = ./assets/app.css />",
      {
        'assets/app.js': 'console.log("Deckwright")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual([
      './assets/app.js',
      './assets/app.css',
    ])
  })

  it('ignores navigational anchor hrefs', () => {
    const directory = createDist(
      '<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"><a href="./rules/missing.html">Read the rules</a>',
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual([
      './assets/app.js',
      './assets/app.css',
    ])
  })

  it('ignores asset-like text inside another tag attribute', () => {
    const directory = createDist(
      `<script src="./assets/app.js" data-example='src="./assets/missing.js"'></script><link rel="stylesheet" href="./assets/app.css">`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual([
      './assets/app.js',
      './assets/app.css',
    ])
  })

  it('rejects an entry document without the Ludocairn identity', () => {
    const directory = createDist(
      '<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">',
      {
        'assets/app.js': 'console.log("app")',
        'assets/app.css': 'body {}',
      },
      { branded: false },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document does not contain the Ludocairn identity.',
    )
  })

  it('rejects an entry document without a relative JavaScript asset', () => {
    const directory = createDist(
      '<link rel="stylesheet" href="./assets/app.css">',
      { 'assets/app.css': 'body {}' },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document does not reference a relative JavaScript asset.',
    )
  })

  it('rejects an entry document without a relative CSS asset', () => {
    const directory = createDist('<script src="./assets/app.js"></script>', {
      'assets/app.js': 'console.log("Ludocairn")',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document does not reference a relative CSS asset.',
    )
  })

  it.each([
    'http://example.com/app.js',
    'https://example.com/app.css',
    '//example.com/app.js',
  ])('rejects remote runtime asset URL %s', (url) => {
    const directory = createDist(
      `<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"><script src="${url}"></script>`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Remote runtime asset URL is not allowed: ${url}`,
    )
  })

  it('rejects an ASCII-control-normalized remote runtime asset URL', () => {
    const url = 'ht\ntps://example.com/evil.js'
    const directory = createDist(
      `<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"><script src="${url}"></script>`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Remote runtime asset URL is not allowed: ${url}`,
    )
  })

  it('rejects a remote document base that relocates relative assets', () => {
    const baseUrl = 'https://example.com/'
    const directory = createDist(
      `<base href="${baseUrl}"><script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Document base URL is not allowed: ${baseUrl}`,
    )
  })

  it('rejects a remote document base after a base tag without href', () => {
    const baseUrl = 'https://example.com/'
    const directory = createDist(
      `<base target="_blank"><base href="${baseUrl}"><script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Document base URL is not allowed: ${baseUrl}`,
    )
  })

  it.each([
    { label: 'empty', url: '' },
    { label: 'query-only', url: '?cache=1' },
    { label: 'fragment-only', url: '#module' },
  ])('rejects $label asset references', ({ url }) => {
    const directory = createDist(`<script src="${url}"></script>`)
    const displayUrl = url || '(empty)'

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Invalid local asset URL: ${displayUrl}`,
    )
  })

  it('rejects root-absolute asset paths that break repository subpaths', () => {
    const directory = createDist(
      "<script type='module' src='/assets/app.js'></script>",
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

  it('rejects a directory referenced as an asset', () => {
    const directory = createDist('<script src="./assets/"></script>')
    mkdirSync(join(directory, 'assets'))

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced asset is not a file: ./assets/',
    )
  })

  it('rejects existing assets resolved outside the artifact directory', () => {
    const externalAsset = createExternalAsset()
    const externalDirectory = basename(dirname(externalAsset))
    const directory = createDist(
      `<script src="../${externalDirectory}/external.js"></script>`,
    )

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Referenced asset resolves outside the static artifact: ../${externalDirectory}/external.js`,
    )
  })

  it.each([
    { label: 'backslash traversal', url: '..\\escape.js' },
    { label: 'percent-encoded traversal', url: '%2e%2e/escape.js' },
    { label: 'entity-encoded traversal', url: '&#46;&#46;/escape.js' },
  ])('rejects browser-normalized $label', ({ url }) => {
    const directory = createDist(`<script src="${url}"></script>`, {
      [url]: 'console.log("not browser-safe")',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Referenced asset resolves outside the static artifact: ${url}`,
    )
  })

  it('rejects symlinked assets that resolve outside the artifact directory', () => {
    const externalAsset = createExternalAsset()
    const directory = createDist('<script src="./assets/external.js"></script>')
    mkdirSync(join(directory, 'assets'))
    symlinkSync(externalAsset, join(directory, 'assets', 'external.js'))

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced asset resolves outside the static artifact: ./assets/external.js',
    )
  })

  it('rejects an artifact without an entry document', () => {
    const directory = mkdtempSync(join(tmpdir(), 'deckwright-static-'))
    temporaryDirectories.push(directory)

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Static entry document is missing: ${join(directory, 'index.html')}`,
    )
  })
})
