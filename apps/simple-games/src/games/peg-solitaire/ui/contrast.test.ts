/**
 * The board draws its marks straight on --surface (peg-solitaire.css): the
 * pegs in the accent, the pit rims and the target ring in --ink-soft, the
 * landing dot in --ink. The stylesheet promises each clears 3:1 there in
 * both themes — the WCAG floor for graphical objects (docs/BRAND.md
 * 「コントラスト」) — so that is measured here from the stylesheets rather
 * than trusted to a comment (the same approach as mancala/ui/contrast.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/peg-solitaire/ui/peg-solitaire.css'), 'utf8');

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
  { name: 'light', base: ':root {', accent: ":root[data-game='peg-solitaire']," },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='peg-solitaire'],",
  },
] as const;

describe('the board’s marks on --surface (docs/BRAND.md「コントラスト」)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('writes no colour of its own — every mark is a shared token', () => {
    expect(gameCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  for (const theme of THEMES) {
    it(`clears 3:1 for the peg, the rim, the ring and the dot (${theme.name})`, () => {
      const base = tokens(sharedCss, theme.base);
      const accent = tokens(sharedCss, theme.accent).get('--accent');
      const surface = base.get('--surface')!;
      expect(accent, 'the title accent').toBeDefined();
      expect(contrast(accent!, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(base.get('--ink-soft')!, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(base.get('--ink')!, surface)).toBeGreaterThanOrEqual(3);
      // The dot sits inside the pit: it must read on the pit's fill too.
      expect(contrast(base.get('--ink')!, base.get('--surface-recessed')!)).toBeGreaterThanOrEqual(
        3,
      );
    });
  }
});
