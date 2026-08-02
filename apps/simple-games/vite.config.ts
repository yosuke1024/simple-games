/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
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
    // Low-spec devices are a release requirement, and the WebView is the
    // constraint: es2018 syntax parses on 2018-era engines, so an old WebView
    // degrades gracefully instead of white-screening on a SyntaxError. The
    // fully-supported floor is Chromium 88 (2021) — set by the CSS the build
    // does not transpile (aspect-ratio, flex gap) — and is verified on-device
    // per docs/RELEASE_CHECKLIST.md.
    target: 'es2018',
    // Two builds, two directories — never the same one. `cap sync` copies
    // dist/ into android/, so the web build (`--mode web`, the only build
    // that bundles the AdSense integration — docs/ADS_POLICY.md「Web 版」)
    // writes to dist-web/ where Capacitor cannot pick it up by accident.
    // CI greps both artifacts (.github/scripts/check-dist-ads-separation.sh).
    outDir: mode === 'web' ? 'dist-web' : 'dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
