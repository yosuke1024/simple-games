/**
 * docs/DOTS_AND_BOXES_RULES.md §10 promises the CPU's colour — its lines and
 * its cross — clears 3:1 against the surface the board is drawn on, in both
 * themes. That is a number, so it is measured here from the stylesheets
 * rather than trusted to a comment (the same shape as Crown Grid's
 * ui/contrast.test.ts).
 *
 * The board sits on the screen's --paper and the result card on --surface, so
 * both are measured.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/dots-and-boxes/ui/dots-and-boxes.css'), 'utf8');
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

describe('the CPU colour against the board (§10)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    it(`clears 3:1 on --paper and --surface (${theme.name})`, () => {
      const cpu = tokens(gameCss, theme.selector).get('--db-cpu');
      const shared = tokens(sharedCss, theme.selector);
      expect(cpu, `--db-cpu is not declared for ${theme.name}`).toBeDefined();
      for (const ground of ['--paper', '--surface'] as const) {
        const colour = shared.get(ground);
        expect(colour, `${ground} is not declared for ${theme.name}`).toBeDefined();
        expect(
          contrast(cpu!, colour!),
          `--db-cpu ${cpu} on ${ground} ${colour}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
