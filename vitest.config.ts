import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/e2e/**'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    fileParallelism: false,
    hookTimeout: 30_000,
    passWithNoTests: true,
    reporters: ['default'],
    testTimeout: 30_000,
  },
});
