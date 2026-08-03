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
    // The size gate reads this to prove no game chunk is statically reachable
    // from the home's entry (scripts/bundle-size.mjs, issue #26).
    manifest: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // One chunk per game — everything under src/games/<id>/ joins
              // `game-<id>`, so a game is exactly one lazy load and the size
              // gate can budget per title. Two exceptions return null: the
              // zero-import storage/keys.ts leaf (the registry needs it in
              // the entry, and grouping it here would drag the whole game
              // chunk into the home's initial graph) and everything else,
              // which keeps Rolldown's default splitting.
              name: (id: string) => {
                const match = id.match(/[\\/]src[\\/]games[\\/]([^\\/]+)[\\/]/);
                if (!match) return null;
                if (/[\\/]storage[\\/]keys\.ts$/.test(id)) return null;
                return `game-${match[1]}`;
              },
              // Never pull a captured module's dependencies (react, shared
              // ui/storage/services) into the game chunk: the entry needs
              // those, and capturing them would statically chain the entry
              // to every game chunk — the exact thing the gate forbids.
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
