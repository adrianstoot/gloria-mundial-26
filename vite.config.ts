import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const pagesBase = mode === 'pages' ? '/gloria-mundial-26/' : '/'
  const publicAssetBase = {
    name: 'gm26-public-asset-base',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (mode !== 'pages' || !id.endsWith('.css')) return null
      return {
        code: code
          .replaceAll("url('/assets/", `url('${pagesBase}assets/`)
          .replaceAll('url("/assets/', `url("${pagesBase}assets/`),
        map: null,
      }
    },
  }

  return {
    base: pagesBase,
    plugins: [
      publicAssetBase,
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon.svg'],
        manifest: {
          name: 'Gloria Mundial 26',
          short_name: 'GM26',
          description: 'Simulador de seleccionador para la gran campaña internacional de 2026.',
          theme_color: '#07111f',
          background_color: '#050b14',
          display: 'standalone',
          orientation: 'landscape',
          start_url: pagesBase,
          scope: pagesBase,
          icons: [
            { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,ogg,mp3}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: { port: 4173 },
    preview: { port: 4173 },
  }
})
