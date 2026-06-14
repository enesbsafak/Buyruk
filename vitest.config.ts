import { defineConfig } from 'vitest/config'

// Standalone config so tests don't load the Electron plugin from vite.config.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
