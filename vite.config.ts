import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/cut-tracker/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,woff2,png}'] },
      manifest: {
        name: 'Cut Tracker',
        short_name: 'Cut',
        description: 'A daily logbook for a weight cut and what comes after.',
        display: 'standalone',
        background_color: '#e1251b',
        theme_color: '#e1251b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
