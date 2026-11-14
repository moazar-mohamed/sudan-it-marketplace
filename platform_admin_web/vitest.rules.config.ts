import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // One emulator database: keep the files/tests strictly sequential.
    fileParallelism: false,
  },
});
