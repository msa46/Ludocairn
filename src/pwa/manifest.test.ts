import { describe, expect, it } from 'vitest'

import { pwaManifest } from './manifest'

describe('PWA manifest', () => {
  it('defines the Ludocairn install contract with relative icon URLs', () => {
    expect(pwaManifest).toMatchObject({
      name: 'Ludocairn',
      short_name: 'Ludocairn',
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#25211f',
      background_color: '#f7f1e7',
    })
    expect(pwaManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    )
    expect(pwaManifest.icons.map((icon) => icon.src)).toEqual([
      './icons/ludocairn-192.png',
      './icons/ludocairn-512.png',
      './icons/ludocairn-maskable-512.png',
    ])
  })
})
