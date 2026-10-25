import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { target: 'es2018', outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['web/**/*.test.ts'],
    execArgv: 'localStorage' in globalThis ? ['--no-experimental-webstorage'] : [],
  },
});
