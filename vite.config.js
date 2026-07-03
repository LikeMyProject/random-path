import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const pwaConfig = {
  registerType: 'autoUpdate',
  devOptions: { enabled: false },
  manifest: {
    name: 'RandomPath - 随机骑行路线', short_name: 'RandomPath',
    description: '小沫陪哥哥一起探索骑行路线',
    theme_color: '#f08ca4', background_color: '#fef6f8', display: 'standalone', orientation: 'portrait',
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

export default defineConfig({ base: '/random-path/', plugins: [vue(), VitePWA(pwaConfig)] })
