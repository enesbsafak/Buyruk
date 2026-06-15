import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// Renderer is built to ./dist, Electron main/preload to ./dist-electron.
// `base: './'` makes asset URLs relative so the production build loads over file://.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // node-pty is a native module; never bundle it.
              external: ['node-pty', 'electron-updater']
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
