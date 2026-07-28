/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built app loads correctly inside the Capacitor WebView.
  base: './',
  server: {
    // Capacitor copies dist/ into android/; without this, every `cap sync`
    // triggers a spurious page reload during development.
    watch: { ignored: ['**/android/**'] },
    // Reachable from a phone on the same network for quick manual testing.
    host: true,
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
