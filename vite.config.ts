import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- The app project compiles a tooling test that imports this no-emit config.
// @ts-ignore The app project compiles a tooling test that imports this no-emit config.
import { pwaManifest } from './src/pwa/manifest.ts'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'ludocairn-mark.svg',
        'icons/ludocairn-192.png',
        'icons/ludocairn-512.png',
        'icons/ludocairn-maskable-512.png',
      ],
      manifest: { ...pwaManifest, icons: [...pwaManifest.icons] },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{html,js,css,webmanifest,svg,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
})
