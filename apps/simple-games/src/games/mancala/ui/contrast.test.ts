/**
 * The CPU's seat colour is this game's own (mancala.css), and it draws the
 * CPU's store ring, its seat mark and its flash straight on --surface. The
 * stylesheet promises it clears 3:1 there in both themes — the WCAG floor for
 * graphical objects — so that is measured here from the stylesheets rather
 * than trusted to a comment (the same approach as crown-grid/ui/contrast.test.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/mancala/ui/mancala.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The #rrggbb custom properties declared in the first rule with exactly this selector. */
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

describe('the CPU seat colour (docs/MANCALA_RULES.md §1)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const selector of [':root', ":root[data-theme='dark']"]) {
    it(`clears 3:1 against --surface (${selector})`, () => {
      const cpu = tokens(gameCss, selector).get('--mc-cpu');
      const surface = tokens(sharedCss, selector).get('--surface');
      expect(cpu, `--mc-cpu under ${selector}`).toBeDefined();
      expect(surface, `--surface under ${selector}`).toBeDefined();
      expect(contrast(cpu!, surface!)).toBeGreaterThanOrEqual(3);
    });
  }
});
