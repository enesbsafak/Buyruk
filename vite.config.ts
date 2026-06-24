import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

function devCsp() {
  return {
    name: 'buyruk-dev-csp',
    apply: 'serve' as const,
    transformIndexHtml(html: string) {
      return html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
    }
  }
}

// Renderer is built to ./dist, Electron main/preload to ./dist-electron.
// `base: './'` makes asset URLs relative so the production build loads over file://.
export default defineConfig({
  base: './',
  plugins: [
    devCsp(),
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart({ startup }) {
          void startup(['.'])
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            // Vite 8 bundles with Rolldown, and vite-plugin-electron reads
            // `rolldownOptions` (dropping `rollupOptions`) on Vite 8+. Putting
            // `external` here keeps node-pty's native .node binaries out of the
            // bundle so they load from node_modules (app.asar.unpacked) at runtime.
            rolldownOptions: {
              external: ['node-pty', 'electron-updater', 'pg']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    })
  ],
  build: {
    outDir: 'dist',
    // Monaco is intentionally bundled for offline Electron use.
    chunkSizeWarningLimit: 4096
  },
  server: {
    port: 5173
  }
})
