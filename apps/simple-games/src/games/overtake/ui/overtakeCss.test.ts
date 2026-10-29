/**
 * What jsdom cannot see: the stylesheet itself (docs/OVERTAKE_RULES.md §11
 * 「ライバルの青」, §16「描画」「色の比」). These read `ui/overtake.css` and the
 * shell's tokens (`src/ui/styles.css`) as text:
 *
 * - the rivals' blue is the one colour this file writes: `--ot-rival` in the
 *   light and the dark theme, and nothing else — no other hex, no rgb() /
 *   hsl(), no colour name — with `--ot-rival-ink` naming `var(--surface)`;
 * - the blue clears 3:1 against `--surface` in both themes (a shape on the
 *   board), and the digit drawn on it clears 4.5:1 (small text at 0.55×);
 * - the depth added on 2026-10-29 writes no colour at all: `--ot-verge` (the
 *   off-road) is an alias of `--line` / `--paper`, the thickness under cars is
 *   `--line`, the finish band is ink and `--line`; the board's frame and the
 *   pad keys are the collection's recipes (src/ui/styles.css `.action-btn`).
 *
 * This file keeps its name (the contrast/colour check other games call
 * `ui/contrast.test.ts`): it predates that convention and also holds the
 * rivals' blue checks; docs/OVERTAKE_RULES.md §16 cites it by this name.
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

/** The shared token a `var(--name)` alias points at, or null for anything else. */
function aliasOf(value: string): string | null {
  return /^var\((--[\w-]+)\)$/.exec(value)?.[1] ?? null;
}

/** A declaration's value with its whitespace collapsed, from one rule's body. */
function declaration(body: string, property: string): string {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body);
  expect(match, `${property} is missing`).not.toBeNull();
  return match![1]!.replace(/\s+/g, ' ').trim();
}

const SHELL_TOKEN_THEMES = [
  { name: 'light', selector: ':root', verge: '--line' },
  { name: 'dark', selector: ":root[data-theme='dark']", verge: '--paper' },
] as const;

describe('the off-road, the thickness and the finish band are tokens, not colours (§11「見た目」)', () => {
  for (const theme of SHELL_TOKEN_THEMES) {
    it(`--ot-verge names ${theme.verge} under ${theme.selector}, and the road stands higher (${theme.name})`, () => {
      const alias = token(ruleBody(code, theme.selector), '--ot-verge');
      expect(aliasOf(alias), '--ot-verge is a var() alias, not a colour').toBe(theme.verge);
      const shellTokens = ruleBody(shell, theme.selector);
      const surface = token(shellTokens, '--surface');
      const verge = token(shellTokens, theme.verge);
      const line = token(shellTokens, '--line');
      const ink = token(shellTokens, '--ink');
      // The road (--surface) is the lighter of the two in both themes: the
      // off-road sinks away from it. --line in the dark theme is lighter than
      // the road, which is the direction this alias exists to turn round.
      expect(luminance(verge)).toBeLessThan(luminance(surface));
      // The finish band is ink and --line squares: a checker only if the two
      // differ clearly (a shape on the board, 3:1).
      const checker = contrast(ink, line);
      expect(checker).toBeGreaterThanOrEqual(3);
      console.log(
        `[overtake] depth ${theme.name}: verge ${theme.verge} ${verge} vs road --surface ${surface} = ` +
          `${contrast(verge, surface).toFixed(2)}:1 (verge darker); ` +
          `car thickness --line ${line} vs road = ${contrast(line, surface).toFixed(2)}:1 (texture, carries no meaning); ` +
          `finish checker ink ${ink} vs --line ${line} = ${checker.toFixed(2)}:1`,
      );
    });
  }

  it('adds no animation or transition: the depth is still, so Reduced Motion has nothing to stop', () => {
    expect(code).not.toMatch(/(?:transition|animation|@keyframes)/);
  });
});

describe('the board frame and the pad keys are the collection’s recipes (§11)', () => {
  // The lift first; the same string the other boards carry.
  const FRAME =
    '0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft)';

  for (const selector of ['.ot-canvas', '.ot-figure']) {
    it(`${selector} wears the board frame, and keeps the radius`, () => {
      const body = ruleBody(code, selector);
      expect(declaration(body, 'box-shadow')).toBe(FRAME);
      expect(declaration(body, 'border-radius')).toBe('var(--radius)');
    });
  }

  it('the pad keys use the .action-btn face and step, and on :active fill with the accent and drop the step', () => {
    const shared = ruleBody(shell, '.action-btn');
    const key = ruleBody(code, '.ot-pad-btn');
    for (const property of ['background', 'box-shadow']) {
      expect(declaration(key, property), property).toBe(declaration(shared, property));
    }
    expect(declaration(key, 'background')).toBe('linear-gradient(var(--surface), var(--paper))');
    expect(declaration(key, 'box-shadow')).toBe(
      'inset 0 1px 0 var(--surface), 0 2px 0 var(--line)',
    );
    // The press fills with the accent and the 2px step goes: the sink is the
    // step vanishing, not a shade. The shared key's `inset 0 1px 2px --line` is
    // pale on an accent fill, and --accent-ring is the accent at an alpha, so
    // neither would read; nothing is drawn but the fill.
    const pressed = ruleBody(code, '.ot-pad-btn:active');
    expect(declaration(pressed, 'background')).toBe('var(--accent)');
    expect(declaration(pressed, 'color')).toBe('var(--accent-ink)');
    expect(declaration(pressed, 'box-shadow')).toBe('none');
    // Nothing moves under a captured pointer: the 48px target stays put.
    expect(key).not.toMatch(/transform/);
    expect(pressed).not.toMatch(/transform/);
  });
});
