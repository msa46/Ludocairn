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

const validManifest = {
  name: 'Ludocairn',
  short_name: 'Ludocairn',
  description:
    'Define, run, track, and print tabletop card games with Ludocairn.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  theme_color: '#25211f',
  background_color: '#f7f1e7',
  icons: [
    {
      src: './icons/ludocairn-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: './icons/ludocairn-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: './icons/ludocairn-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

const validPwaHead =
  '<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/ludocairn-192.png">'

const validWorker =
  'define(["./workbox-hash"],function(e){e.precacheAndRoute([{url:"index.html",revision:"index-revision"}],{})})'

const validEntryAssets =
  '<script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">'

const validEntryFiles = {
  'assets/app.js': 'console.log("Ludocairn")',
  'assets/app.css': 'body {}',
}

function manifestJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ ...validManifest, ...overrides })
}

function expectedVerification(entryAssets: readonly string[]) {
  return {
    entryAssets,
    manifest: './manifest.webmanifest',
    serviceWorker: 'sw.js',
    precachedShell: true,
  }
}

function createDist(
  indexHtml: string,
  assets: Record<string, string | null> = {},
  options: { branded?: boolean; pwaHead?: string } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'deckwright-static-'))
  temporaryDirectories.push(directory)
  const identity = options.branded === false ? '' : '<title>Ludocairn</title>'
  const pwaHead = options.pwaHead ?? validPwaHead
  writeFileSync(
    join(directory, 'index.html'),
    `${identity}${pwaHead}${indexHtml}`,
  )

  const fixtureAssets: Record<string, string | null> = {
    'manifest.webmanifest': JSON.stringify(validManifest),
    'sw.js': validWorker,
    'icons/ludocairn-192.png': '192 icon',
    'icons/ludocairn-512.png': '512 icon',
    'icons/ludocairn-maskable-512.png': 'maskable icon',
    ...assets,
  }

  for (const [relativePath, contents] of Object.entries(fixtureAssets)) {
    if (contents === null) continue
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

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('recognizes asset attributes across case, spacing, and quote forms', () => {
    const directory = createDist(
      "<script SRC = './assets/app.js'></script><link HREF = ./assets/app.css />",
      {
        'assets/app.js': 'console.log("Deckwright")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('ignores navigational anchor hrefs', () => {
    const directory = createDist(
      '<script src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"><a href="./rules/missing.html">Read the rules</a>',
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('ignores asset-like text inside another tag attribute', () => {
    const directory = createDist(
      `<script src="./assets/app.js" data-example='src="./assets/missing.js"'></script><link rel="stylesheet" href="./assets/app.css">`,
      {
        'assets/app.js': 'console.log("Ludocairn")',
        'assets/app.css': 'body {}',
      },
    )

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('matches manifest and Apple touch icon rel values as case-insensitive tokens', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead:
        '<link href="./manifest.webmanifest" rel="alternate MANIFEST"><link href="./icons/ludocairn-192.png" rel="APPLE-TOUCH-ICON precomposed">',
    })

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it.each([
    {
      label: 'manifest',
      pwaHead:
        '<link-foo rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/ludocairn-192.png">',
      error: 'Static entry document must contain exactly one manifest link.',
    },
    {
      label: 'Apple touch icon',
      pwaHead:
        '<link rel="manifest" href="./manifest.webmanifest"><link-foo rel="apple-touch-icon" href="./icons/ludocairn-192.png">',
      error:
        'Static entry document must contain exactly one Apple touch icon link.',
    },
  ])('does not treat link-foo as a $label link', ({ pwaHead, error }) => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(error)
  })

  it('rejects an entry document without a manifest rel token', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead:
        '<link rel="manifestly" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/ludocairn-192.png">',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document must contain exactly one manifest link.',
    )
  })

  it('rejects multiple manifest links', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead: `${validPwaHead}<link rel="manifest" href="./manifest.webmanifest">`,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document must contain exactly one manifest link.',
    )
  })

  it('rejects a root-absolute manifest link', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead:
        '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/ludocairn-192.png">',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Root-absolute manifest URL is not GitHub Pages safe: /manifest.webmanifest',
    )
  })

  it('rejects malformed manifest JSON', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': '{"name":',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest is not valid JSON: ./manifest.webmanifest',
    )
  })

  it.each([
    { label: 'array', manifest: [] },
    { label: 'null', manifest: null },
    { label: 'string', manifest: 'Ludocairn' },
  ])('rejects a manifest whose JSON root is $label', ({ manifest }) => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': JSON.stringify(manifest),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest must be a JSON object.',
    )
  })

  it.each([
    { member: 'name', value: 42 },
    { member: 'short_name', value: null },
    { member: 'description', value: [] },
    { member: 'id', value: false },
    { member: 'start_url', value: {} },
    { member: 'scope', value: 1 },
    { member: 'display', value: 'browser' },
    { member: 'theme_color', value: '#ffffff' },
    { member: 'background_color', value: undefined },
  ])(
    'rejects an invalid required manifest member $member',
    ({ member, value }) => {
      const directory = createDist(validEntryAssets, {
        ...validEntryFiles,
        'manifest.webmanifest': manifestJson({ [member]: value }),
      })

      expect(() => verifyStaticBuild(directory)).toThrow(
        `Manifest member "${member}"`,
      )
    },
  )

  it('rejects a non-array manifest icons member', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons: {} }),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest member "icons" must be an array.',
    )
  })

  it.each([
    { label: '192x192', removedIndex: 0, purpose: 'any' },
    { label: '512x512', removedIndex: 1, purpose: 'any' },
    { label: 'maskable', removedIndex: 2, purpose: 'maskable' },
  ])(
    'rejects a manifest without its required $label icon',
    ({ removedIndex, label }) => {
      const icons = validManifest.icons.filter(
        (_icon, index) => index !== removedIndex,
      )
      const directory = createDist(validEntryAssets, {
        ...validEntryFiles,
        'manifest.webmanifest': manifestJson({ icons }),
      })

      expect(() => verifyStaticBuild(directory)).toThrow(
        `Manifest must include a ${label}`,
      )
    },
  )

  it('treats icon purpose as a space-separated token list', () => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 2 ? { ...icon, purpose: 'any maskable' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('ignores unknown icon purpose tokens when a recognized token remains', () => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 2 ? { ...icon, purpose: 'maskable vendor-purpose' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('does not accept a substring as the maskable purpose token', () => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 2 ? { ...icon, purpose: 'not-maskable' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest must include a maskable 512x512 PNG icon.',
    )
  })

  it('matches manifest purpose tokens case-sensitively', () => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 2 ? { ...icon, purpose: 'MASKABLE' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest must include a maskable 512x512 PNG icon.',
    )
  })

  it('rejects non-positive manifest icon dimensions', () => {
    const icons = [
      ...validManifest.icons,
      {
        src: './icons/ludocairn-192.png',
        sizes: '0x0',
        type: 'image/png',
        purpose: 'monochrome',
      },
    ]
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Manifest icon 4 member "sizes" is not a valid size token list.',
    )
  })

  it.each(['src', 'sizes', 'type', 'purpose'])(
    'rejects a non-string manifest icon %s member',
    (member) => {
      const icons = validManifest.icons.map((icon, index) =>
        index === 0 ? { ...icon, [member]: 192 } : icon,
      )
      const directory = createDist(validEntryAssets, {
        ...validEntryFiles,
        'manifest.webmanifest': manifestJson({ icons }),
      })

      expect(() => verifyStaticBuild(directory)).toThrow(
        `Manifest icon 1 member "${member}" must be a non-empty string.`,
      )
    },
  )

  it.each([
    {
      label: 'root-absolute',
      src: '/icons/ludocairn-192.png',
      error:
        'Root-absolute manifest icon URL is not GitHub Pages safe: /icons/ludocairn-192.png',
    },
    {
      label: 'HTTP remote',
      src: 'https://example.com/icon.png',
      error:
        'Remote manifest icon URL is not allowed: https://example.com/icon.png',
    },
    {
      label: 'protocol-relative remote',
      src: '//example.com/icon.png',
      error: 'Remote manifest icon URL is not allowed: //example.com/icon.png',
    },
    {
      label: 'traversal',
      src: '%2e%2e/icon.png',
      error:
        'Referenced manifest icon resolves outside the static artifact: %2e%2e/icon.png',
    },
    {
      label: 'missing',
      src: './icons/missing.png',
      error: 'Referenced manifest icon is missing: ./icons/missing.png',
    },
  ])('rejects a $label manifest icon URL', ({ src, error }) => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 0 ? { ...icon, src } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })

    expect(() => verifyStaticBuild(directory)).toThrow(error)
  })

  it('rejects a directory referenced as a manifest icon', () => {
    const icons = validManifest.icons.map((icon, index) =>
      index === 0 ? { ...icon, src: './icons/directory/' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })
    mkdirSync(join(directory, 'icons', 'directory'))

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced manifest icon is not a file: ./icons/directory/',
    )
  })

  it('rejects a manifest icon symlinked outside the artifact', () => {
    const externalAsset = createExternalAsset()
    const icons = validManifest.icons.map((icon, index) =>
      index === 0 ? { ...icon, src: './icons/external.png' } : icon,
    )
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'manifest.webmanifest': manifestJson({ icons }),
    })
    symlinkSync(externalAsset, join(directory, 'icons', 'external.png'))

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced manifest icon resolves outside the static artifact: ./icons/external.png',
    )
  })

  it('rejects an artifact without a root service worker', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': null,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Referenced service worker is missing: sw.js',
    )
  })

  it('rejects a worker without index.html in its Workbox precache', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js':
        '// precacheAndRoute([{url:"index.html"}])\nconst message = "index.html must be cached"; workbox.precacheAndRoute([{url:"assets/app.js",revision:null}], {})',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Service worker does not precache index.html.',
    )
  })

  it('does not treat an index.html URL in Workbox options as a precache entry', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': 'workbox.precacheAndRoute([], {url:"index.html"})',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Service worker does not precache index.html.',
    )
  })

  it('does not treat a nested metadata URL as a precache record URL', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': 'workbox.precacheAndRoute([{metadata:{url:"index.html"}}], {})',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Service worker does not precache index.html.',
    )
  })

  it.each([
    'https://example.com/runtime.js',
    '//example.com/runtime.js',
    'https%3A%2F%2Fexample.com%2Fruntime.js',
  ])('rejects a remote runtime URL in the service worker: %s', (url) => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': `${validWorker}; fetch("${url}")`,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Remote runtime asset URL is not allowed in service worker: ${url}`,
    )
  })

  it('rejects a JavaScript-escaped remote runtime URL in the service worker', () => {
    const encodedUrl = String.raw`\x68ttps:\x2f\x2fexample.com/runtime.js`
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': `${validWorker}; fetch("${encodedUrl}")`,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Remote runtime asset URL is not allowed in service worker: ${encodedUrl}`,
    )
  })

  it.each([
    String.raw`\x01https://example.com/runtime.js`,
    String.raw`\150ttps://example.com/runtime.js`,
  ])(
    'rejects a control-normalized or legacy-octal remote worker URL: %s',
    (encodedUrl) => {
      const directory = createDist(validEntryAssets, {
        ...validEntryFiles,
        'sw.js': `${validWorker}; fetch("${encodedUrl}")`,
      })

      expect(() => verifyStaticBuild(directory)).toThrow(
        `Remote runtime asset URL is not allowed in service worker: ${encodedUrl}`,
      )
    },
  )

  it('rejects a remote literal inside template interpolation', () => {
    const url = 'https://example.com/runtime.js'
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': `${validWorker}; fetch(\`\${"${url}"}\`)`,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      `Remote runtime asset URL is not allowed in service worker: ${url}`,
    )
  })

  it('ignores remote-looking Workbox comments and diagnostic strings', () => {
    const directory = createDist(validEntryAssets, {
      ...validEntryFiles,
      'sw.js': `${validWorker}; /* https://developer.chrome.com/docs/workbox/ */ const warning = "Learn more at https://bit.ly/wb-precache"`,
    })

    expect(verifyStaticBuild(directory)).toEqual(
      expectedVerification(['./assets/app.js', './assets/app.css']),
    )
  })

  it('rejects an entry document without an Apple touch icon rel token', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead:
        '<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-iconish" href="./icons/ludocairn-192.png">',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document must contain exactly one Apple touch icon link.',
    )
  })

  it('rejects multiple Apple touch icon links', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead: `${validPwaHead}<link rel="apple-touch-icon" href="./icons/ludocairn-512.png">`,
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Static entry document must contain exactly one Apple touch icon link.',
    )
  })

  it('rejects a root-absolute Apple touch icon', () => {
    const directory = createDist(validEntryAssets, validEntryFiles, {
      pwaHead:
        '<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/ludocairn-192.png">',
    })

    expect(() => verifyStaticBuild(directory)).toThrow(
      'Root-absolute Apple touch icon URL is not GitHub Pages safe: /icons/ludocairn-192.png',
    )
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

  it.each(['Tab', 'NewLine'])(
    'rejects a browser-remote runtime asset hidden with &%s;',
    (entity) => {
      const url = `h&${entity};ttps://example.com/evil.js`
      const directory = createDist(
        `${validEntryAssets}<script src="${url}"></script>`,
        {
          ...validEntryFiles,
          [`h&${entity};ttps:/example.com/evil.js`]:
            'console.log("browser-remote")',
        },
      )

      expect(() => verifyStaticBuild(directory)).toThrow(
        `Remote runtime asset URL is not allowed: ${url}`,
      )
    },
  )

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
