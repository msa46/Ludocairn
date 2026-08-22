export const pwaManifest = {
  name: 'Ludocairn',
  short_name: 'Ludocairn',
  description: 'Define, run, track, and print tabletop card games with Ludocairn.',
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
} as const
