/**
 * docs/HIT_AND_BLOW_RULES.md §10 promises every symbol fill clears 3:1 — the
 * WCAG threshold for graphical objects — against the surface it is drawn on
 * and the page behind it, in both themes. That is a number, so it is measured
 * here from the stylesheets rather than trusted to the comment above the
 * fills: a fill nudged for looks, or a shared token retuned, fails here
 * rather than on somebody's screen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/hit-and-blow/ui/hit-and-blow.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The custom properties declared in the first rule with exactly this selector. */
function tokens(source: string, selector: string): Map<string, string> {
  const start = source.indexOf(`\n${selector} {`);
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
  { name: 'light', selector: ':root' },
  { name: 'dark', selector: ":root[data-theme='dark']" },
] as const;

describe('symbol fills against the ground (§10)', () => {
  // Sanity: the formula gives the textbook ends of the scale.
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('draws every symbol with its own token', () => {
    const symbolTsx = readFileSync(
      resolve('src/games/hit-and-blow/ui/components/Symbol.tsx'),
      'utf8',
    );
    expect(symbolTsx).toContain('fill={`var(--hb-sym-${symbol})`}');
  });

  for (const theme of THEMES) {
    const fills = tokens(gameCss, theme.selector);
    const shared = tokens(sharedCss, theme.selector);
    const symbols = Array.from({ length: 8 }, (_, index) => fills.get(`--hb-sym-${index}`));

    it(`declares eight fills and finds the grounds (${theme.name})`, () => {
      expect(symbols.every((fill) => fill !== undefined)).toBe(true);
      expect(shared.get('--surface')).toBeDefined();
      expect(shared.get('--paper')).toBeDefined();
    });

    for (const ground of ['--surface', '--paper'] as const) {
      it(`every fill clears 3:1 on ${ground} (${theme.name})`, () => {
        const colour = shared.get(ground)!;
        for (const [index, fill] of symbols.entries()) {
          expect(
            contrast(fill!, colour),
            `--hb-sym-${index} ${fill} on ${ground} ${colour}`,
          ).toBeGreaterThanOrEqual(3);
        }
      });
    }

    it(`keeps the eight fills apart from each other (${theme.name})`, () => {
      // Shape carries the symbol; the hue is the second signal and has to be
      // one — no two fills the same colour by accident of an edit.
      expect(new Set(symbols).size).toBe(8);
    });
  }
});
