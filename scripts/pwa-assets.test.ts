import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readPngDimensions(path: string) {
  const png = readFileSync(resolve(path))

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  }
}

describe('PWA install assets', () => {
  it('generates the web manifest and service worker in the production build', () => {
    expect(existsSync(resolve('dist/manifest.webmanifest'))).toBe(true)
    expect(existsSync(resolve('dist/sw.js'))).toBe(true)
  })

  it.each([
    ['public/icons/ludocairn-192.png', 192, 192],
    ['public/icons/ludocairn-512.png', 512, 512],
    ['public/icons/ludocairn-maskable-512.png', 512, 512],
  ])('commits %s at %ix%i', (path, width, height) => {
    expect(readPngDimensions(path)).toEqual({
      width,
      height,
    })
  })

  it('sets iOS-safe viewport and relative metadata in the entry document', () => {
    const entryDocument = readFileSync(resolve('index.html'), 'utf8')

    expect(entryDocument).toContain('viewport-fit=cover')
    expect(entryDocument).toContain(
      '<link rel="apple-touch-icon" href="./icons/ludocairn-192.png" />',
    )
    expect(entryDocument).toContain(
      '<meta name="theme-color" content="#25211f" />',
    )
  })
})
