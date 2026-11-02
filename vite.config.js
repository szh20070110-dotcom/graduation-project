import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.js'],
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/domain/**/*.js'],
      all: true,
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 80
      }
    }
  }
})