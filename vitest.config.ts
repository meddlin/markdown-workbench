import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./testSupport/vscodeMock.ts', import.meta.url)),
    },
  },
  test: {
    coverage: {
      all: true,
      exclude: ['src/**/*.test.ts', 'testSupport/**', 'out/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
