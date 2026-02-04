import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'shared/__tests__/**/*.{test,spec}.ts',
      'server/__tests__/**/*.{test,spec}.ts',
      'client/src/**/*.{test,spec}.ts',
    ],
    exclude: ['**/node_modules/**', '**/.git/**'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@server': path.resolve(import.meta.dirname, 'server'),
    },
  },
});
