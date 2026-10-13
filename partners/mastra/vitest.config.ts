import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The mock-parity test reaches the live Atlas AI endpoint when a key is present;
    // 30s covers a cold call without letting a hung request stall the suite.
    testTimeout: 30_000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
