/**
 * The board draws its marks straight on --surface (tangram.css): the pieces
 * in the accent with an ink edge, the silhouette's edge and Easy's inner
 * lines in --ink-soft. The stylesheet promises each clears 3:1 there in both
 * themes — the WCAG floor for graphical objects (docs/BRAND.md「コントラスト」,
 * docs/TANGRAM_RULES.md §10) — so that is measured here from the stylesheets
 * rather than trusted to a comment (the same approach as
 * peg-solitaire/ui/contrast.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/tangram/ui/tangram.css'), 'utf8');

/** The #rrggbb custom properties declared in the first rule whose selector list starts so. */
function tokens(source: string, selector: string): Map<string, string> {
  const start = source.indexOf(`\n${selector}`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out.set(match[1]!, match[2]!.toLowerCase());
  }
  return out;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const THEMES = [
  { name: 'light', base: ':root {', accent: ":root[data-game='tangram']," },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='tangram'],",
  },
] as const;

describe('the board’s marks (docs/BRAND.md「コントラスト」)', () => {
  it('writes no colour of its own — every mark is a shared token', () => {
    expect(gameCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  for (const theme of THEMES) {
    it(`clears 3:1 for the pieces, their edges and the silhouette’s edge (${theme.name})`, () => {
      const base = tokens(sharedCss, theme.base);
      const accent = tokens(sharedCss, theme.accent).get('--accent');
      const surface = base.get('--surface')!;
      const recessed = base.get('--surface-recessed')!;
      expect(accent, 'the title accent').toBeDefined();
      // A piece on the board, and in the tray.
      expect(contrast(accent!, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(accent!, recessed)).toBeGreaterThanOrEqual(3);
      // The ink edge every piece wears, on either ground.
      expect(contrast(base.get('--ink')!, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(base.get('--ink')!, recessed)).toBeGreaterThanOrEqual(3);
      // The silhouette's edge and Easy's inner lines, on the silhouette.
      expect(contrast(base.get('--ink-soft')!, recessed)).toBeGreaterThanOrEqual(3);
    });
  }
});
