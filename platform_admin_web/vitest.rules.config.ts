import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20000,
    // One emulator database: keep the files/tests strictly sequential.
    fileParallelism: false,
  },
});
