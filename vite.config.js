import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const pwaConfig = {
  registerType: 'autoUpdate',
  devOptions: { enabled: false },
  manifest: {
    name: '漫途 - 骑行 & 旅行攻略', short_name: '漫途',
    description: '骑行路线规划 & 旅行攻略',
    theme_color: '#0f6e56', background_color: '#f0f6f4', display: 'standalone', orientation: 'portrait',
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    runtimeCaching: [
      { urlPattern: /^https:\/\/restapi\.amap\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'amap-api', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } } },
      { urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'elevation-api', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } } },
    ],
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    base: env.VITE_BASE || '/',
    plugins: [vue(), VitePWA(pwaConfig)]
  }
})
