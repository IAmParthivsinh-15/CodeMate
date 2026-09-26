/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:5050'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  build: {
    // CodeMirror with four languages is ~700 kB minified; it only loads on /coding pages.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        // Heavy, rarely-changing libraries get their own long-cacheable chunks.
        manualChunks(id) {
          const path = id.split('\\').join('/')
          if (!path.includes('/node_modules/')) return undefined
          const pkg = path.split('/node_modules/').pop()!.split('/')
          const name = pkg[0].startsWith('@') ? `${pkg[0]}/${pkg[1]}` : pkg[0]
          // React must have its own chunk, or Rollup hoists it into whichever vendor chunk imports it first.
          if (['react', 'react-dom', 'scheduler', 'use-sync-external-store'].includes(name)) return 'react'
          if (/^(@codemirror|@lezer|@uiw)\//.test(name) || ['codemirror', 'crelt', 'style-mod', 'w3c-keyname'].includes(name)) return 'editor'
          if (name === 'recharts' || name.startsWith('d3-') || ['victory-vendor', 'decimal.js-light', 'es-toolkit', 'immer', 'reselect', '@reduxjs/toolkit', 'redux', 'react-redux', 'redux-thunk', 'eventemitter3', 'internmap', 'tiny-invariant'].includes(name)) return 'charts'
          if (['react-chessboard', 'chess.js'].includes(name) || name.startsWith('@dnd-kit/')) return 'chess'
          if (['react-markdown', 'unified', 'bail', 'trough', 'devlop', 'vfile', 'vfile-message', 'property-information', 'zwitch', 'ccount'].includes(name) || /^(remark-|mdast-|micromark|hast-|unist-|character-|html-url|estree-util|space-separated|comma-separated|decode-named|trim-lines|is-plain-obj|longest-streak|style-to-|inline-style)/.test(name)) return 'markdown'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
