/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // '@/' is the app root. Games sit three or four folders deep, so shared
    // imports would otherwise be long chains of '../'.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Relative base so the built app loads correctly inside the Capacitor WebView.
  base: './',
  server: {
    // Capacitor copies dist/ into android/; without this, every `cap sync`
    // triggers a spurious page reload during development.
    watch: { ignored: ['**/android/**'] },
    // Reachable from a phone on the same network for quick manual testing.
    host: true,
    // Honor an externally assigned port (e.g. a preview harness) over 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
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
