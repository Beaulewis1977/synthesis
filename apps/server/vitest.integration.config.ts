import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000,
  },
});
