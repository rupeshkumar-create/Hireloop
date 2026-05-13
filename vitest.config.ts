import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
