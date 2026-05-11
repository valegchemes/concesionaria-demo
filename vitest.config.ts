import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Sólo ejecuta unit tests; los tests de integración en tests/api/ requieren servidor real
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/api/**', 'node_modules/**'],
    // Timeout generoso para tests con bcrypt (costo 12)
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/prisma.ts', 'lib/env.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
