import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  base: '/run-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['fonts/**/*', 'icons/**/*'],
      manifest: {
        name: 'RunTracker - AI Running Coach',
        short_name: 'RunTracker',
        description: 'AI-powered running coach with personalized training plans',
        theme_color: '#0A0F0A',
        background_color: '#0A0F0A',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/strava-callback\.html/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache' },
          },
          {
            urlPattern: /\/fonts\//,
            handler: 'CacheFirst',
            options: { cacheName: 'font-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
})
