/**
 * What jsdom cannot see: the stylesheet itself (docs/OVERTAKE_RULES.md §11
 * 「ライバルの青」, §16「描画」「色の比」). These read `ui/overtake.css` and the
 * shell's tokens (`src/ui/styles.css`) as text:
 *
 * - the rivals' blue is the one colour this file writes: `--ot-rival` in the
 *   light and the dark theme, and nothing else — no other hex, no rgb() /
 *   hsl(), no colour name — with `--ot-rival-ink` naming `var(--surface)`;
 * - the blue clears 3:1 against `--surface` in both themes (a shape on the
 *   board), and the digit drawn on it clears 4.5:1 (small text at 0.55×).
 *
 * Contrast here is arithmetic on the declared colours (WCAG 2 relative
 * luminance), not a measurement of a rendered page. The ratios are printed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root (src/test/styles.test.ts explains why).
const css = readFileSync(resolve('src/games/overtake/ui/overtake.css'), 'utf8');
const shell = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The source with its comments blanked out: prose may say "blue". */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of one top-level rule, found by its exact selector line. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

/** A custom property's value inside one block. */
function token(block: string, name: string): string {
  const match = new RegExp(`(?:^|[\\s;])${name}:\\s*([^;]+);`).exec(block);
  expect(match, `${name} is missing`).not.toBeNull();
  return match![1]!.trim();
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
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

/** CSS Color 4 named colours: none may appear as a value here. */
const NAMED = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen
darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink
indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral
lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
whitesmoke yellow yellowgreen`.split(/\s+/);

const THEMES = [
  { name: 'light', selector: ':root', blue: '#2453a8' },
  { name: 'dark', selector: ":root[data-theme='dark']", blue: '#5b9cf0' },
] as const;

describe('the only colour overtake.css writes is the rivals’ blue (§11)', () => {
  it('writes exactly two colour literals: the light and the dark --ot-rival', () => {
    const literals = [...code.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
    expect(literals).toEqual(THEMES.map((t) => t.blue));
    const declarations = [...code.matchAll(/(--[\w-]+|[\w-]+):\s*#[0-9a-f]{3,8}\b/gi)].map(
      (m) => m[1],
    );
    expect(declarations).toEqual(['--ot-rival', '--ot-rival']);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
    const values = [...code.matchAll(/:\s*([^;{}]+);/g)].map((m) => m[1]!.toLowerCase());
    for (const value of values) {
      for (const word of value.match(/[a-z-]+/g) ?? []) {
        expect(NAMED, `colour name in "${value}"`).not.toContain(word);
      }
    }
  });

  for (const theme of THEMES) {
    it(`declares --ot-rival and --ot-rival-ink under ${theme.selector}`, () => {
      const block = ruleBody(code, theme.selector);
      expect(token(block, '--ot-rival').toLowerCase()).toBe(theme.blue);
      expect(token(block, '--ot-rival-ink')).toBe('var(--surface)');
    });
  }

  it('rings the rivals on the progress bar in the same blue', () => {
    expect(ruleBody(code, '.ot-progress-rival')).toMatch(
      /border:\s*1\.5px solid var\(--ot-rival\);/,
    );
  });
});

describe('the blue reads on the road, and the digit reads on the blue (§11, WCAG 2)', () => {
  for (const theme of THEMES) {
    it(`clears 3:1 against --surface and 4.5:1 for the digit (${theme.name})`, () => {
      const blue = token(ruleBody(code, theme.selector), '--ot-rival');
      const shellTokens = ruleBody(shell, `${theme.selector}`);
      const ink = token(ruleBody(code, theme.selector), '--ot-rival-ink');
      const named = /^var\(--(surface|ink)\)$/.exec(ink);
      expect(named, '--ot-rival-ink names --surface or --ink').not.toBeNull();
      const surface = token(shellTokens, '--surface');
      const digitColour = token(shellTokens, `--${named![1]}`);
      const shape = contrast(blue, surface);
      const digit = contrast(digitColour, blue);
      console.log(
        `[overtake] rival blue ${theme.name}: ${blue} vs --surface ${surface} = ${shape.toFixed(2)}:1; ` +
          `digit ${ink} (${digitColour}) on ${blue} = ${digit.toFixed(2)}:1`,
      );
      expect(shape).toBeGreaterThanOrEqual(3);
      expect(digit).toBeGreaterThanOrEqual(4.5);
    });
  }
});
