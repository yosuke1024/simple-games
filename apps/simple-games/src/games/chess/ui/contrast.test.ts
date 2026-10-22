/**
 * The board's own colours (docs/CHESS_RULES.md §1, §9): two squares and two
 * pieces, light and dark, physical rather than a role, in ui/chess.css. The
 * rules promise each piece reads as a shape on both squares in both themes —
 * WCAG's 3:1 floor for graphical objects — and so does every mark the board
 * draws in the accent, and the keyboard focus ring drawn in the ink. That is
 * measured here from the stylesheets rather than trusted to a comment (the
 * same approach as mancala/ui/contrast.test.ts).
 *
 * A piece is a fill inside an edge of the other colour, a mark is the accent
 * inside a halo ring, and the focus ring is the ink's dots on a halo strip;
 * each passes on a square when either of its two
 * colours clears 3:1 there, and the two colours of each must clear 3:1
 * against each other, so the inner shape is itself visible.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/chess/ui/chess.css'), 'utf8');
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

/** The accent block for this game: `:root[data-game='chess'],` opens it. */
function accent(selector: string): string {
  const start = sharedCss.indexOf(`\n${selector},`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = sharedCss.slice(sharedCss.indexOf('{', start) + 1, sharedCss.indexOf('}', start));
  const value = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(body)?.[1];
  expect(value, `--accent under ${selector}`).toBeDefined();
  return value!.toLowerCase();
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
  { name: 'light', game: ':root', accent: ":root[data-game='chess']" },
  {
    name: 'dark',
    game: ":root[data-theme='dark']",
    accent: ":root[data-theme='dark'][data-game='chess']",
  },
] as const;

/** The series' --ink under the same theme selector, from src/ui/styles.css. */
function ink(selector: string): string {
  const value = tokens(sharedCss, selector).get('--ink');
  expect(value, `--ink under ${selector}`).toBeDefined();
  return value!;
}

describe('the board’s colours (docs/CHESS_RULES.md §9)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    const colours = tokens(gameCss, theme.game);
    const get = (name: string) => {
      const value = colours.get(name);
      expect(value, `${name} under ${theme.game}`).toBeDefined();
      return value!;
    };
    const squares = [get('--ch-square-light'), get('--ch-square-dark')];
    const twoTone = {
      'the white piece': [get('--ch-piece-light'), get('--ch-piece-light-edge')],
      'the black piece': [get('--ch-piece-dark'), get('--ch-piece-dark-edge')],
      'an accent mark': [accent(theme.accent), get('--ch-halo')],
      'the focus ring': [ink(theme.game), get('--ch-halo')],
    };

    for (const [what, [inner, ring]] of Object.entries(twoTone)) {
      it(`${what} reads on both squares (${theme.name})`, () => {
        for (const square of squares) {
          // Printed for docs/CHESS_RULES.md §9; the gate is the 3:1 below.
          console.info(
            `[chess contrast] ${theme.name} ${what} on ${square}: inner ${contrast(inner!, square).toFixed(2)}, ring ${contrast(ring!, square).toFixed(2)}`,
          );
          expect(
            Math.max(contrast(inner!, square), contrast(ring!, square)),
            `${what} on ${square}`,
          ).toBeGreaterThanOrEqual(3);
        }
      });

      it(`${what}'s two colours part at 3:1 (${theme.name})`, () => {
        console.info(
          `[chess contrast] ${theme.name} ${what}: inner vs ring ${contrast(inner!, ring!).toFixed(2)}`,
        );
        expect(contrast(inner!, ring!)).toBeGreaterThanOrEqual(3);
      });
    }

    it(`the two squares are told apart by more than colour alone would need (${theme.name})`, () => {
      // Not a 3:1 promise — a board's squares never are — but the light one
      // must be the lighter, or the corner rule (a1 dark) would be drawn backwards.
      expect(luminance(squares[0]!)).toBeGreaterThan(luminance(squares[1]!));
    });
  }

  it('puts no colour literal anywhere but the two token blocks', () => {
    // Everything after the two blocks reads tokens; a literal there would be
    // a colour the tests above do not measure.
    const darkBlock = gameCss.indexOf("\n:root[data-theme='dark'] {");
    const rest = gameCss.slice(gameCss.indexOf('}', darkBlock) + 1);
    expect(rest.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });
});
