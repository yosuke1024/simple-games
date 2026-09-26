/**
 * docs/CROWN_GRID_RULES.md §13 promises the ink drawn on a region — a crown, a
 * ×, and the crown that breaks a rule (§5) — clears 4.5:1 against every one of
 * the nine tints, in both themes. That is a number, so it is measured here from
 * the stylesheets rather than trusted to a comment: the broken crown once
 * shipped in the shared --warn, which the comment above the tints never
 * covered, and it read at 2.95:1.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/crown-grid/ui/crown-grid.css'), 'utf8');
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
  { name: 'light', board: '.cg-board', root: ':root' },
  { name: 'dark', board: ":root[data-theme='dark'] .cg-board", root: ":root[data-theme='dark']" },
] as const;

describe('ink on the region tints (§13)', () => {
  // Sanity: the formula gives the textbook ends of the scale.
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('draws the broken crown in the measured warn ink, not the shared --warn', () => {
    const start = gameCss.indexOf('\n.cg-cell-broken .cg-glyph {');
    expect(start).toBeGreaterThan(-1);
    const body = gameCss.slice(gameCss.indexOf('{', start) + 1, gameCss.indexOf('}', start));
    expect(body).toMatch(/color:\s*var\(--cg-warn-ink\)/);
  });

  for (const theme of THEMES) {
    const board = tokens(gameCss, theme.board);
    const shared = tokens(sharedCss, theme.root);
    const tints = Array.from({ length: 9 }, (_, region) => board.get(`--cg-r${region}`));

    it(`declares nine tints and a warn ink (${theme.name})`, () => {
      expect(tints.every((tint) => tint !== undefined)).toBe(true);
      expect(board.get('--cg-warn-ink')).toBeDefined();
      expect(shared.get('--ink')).toBeDefined();
    });

    for (const ink of ['--ink', '--cg-warn-ink'] as const) {
      it(`${ink} clears 4.5:1 on every tint (${theme.name})`, () => {
        const colour = (ink === '--ink' ? shared : board).get(ink)!;
        for (const [region, tint] of tints.entries()) {
          expect(
            contrast(colour, tint!),
            `${ink} ${colour} on region ${region} ${tint}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});
