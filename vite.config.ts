/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Ambiente do build: "prod" (padrão) ou "hml" (homologação).
// Os dois são publicados no mesmo GitHub Pages:
//   prod → https://<usuario>.github.io/time-tracker/
//   hml  → https://<usuario>.github.io/time-tracker/hml/
const appEnv = process.env.VITE_APP_ENV === 'hml' ? 'hml' : 'prod'
const isHml = appEnv === 'hml'
const base = isHml ? '/time-tracker/hml/' : '/time-tracker/'
const themeColor = isHml ? '#bf8700' : '#1f6feb'

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(appEnv),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // O service worker de produção cobre /time-tracker/ inteiro; sem isto ele
        // responderia as páginas de /time-tracker/hml/ com o app de produção.
        navigateFallbackDenylist: isHml ? [] : [/^\/time-tracker\/hml\//],
      },
      manifest: {
        id: base,
        name: isHml ? 'Ponto (HML)' : 'Ponto',
        short_name: isHml ? 'Ponto HML' : 'Ponto',
        description: 'Registro pessoal de entradas e saídas',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: themeColor,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
    {
      name: 'html-theme-color',
      transformIndexHtml: (html) => html.replace('#1f6feb', themeColor),
    },
  ],
  test: {
    environment: 'node',
  },
})
