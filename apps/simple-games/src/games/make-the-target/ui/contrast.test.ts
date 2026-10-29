/**
 * What the target's accent ground and the recess promise
 * (docs/MAKE_THE_TARGET_RULES.md §1, §12): the target is drawn on
 * `--accent-soft`, its number in `--ink`, its frame and mark in `--accent`;
 * the made target is `--accent-ink` on `--accent`. BRAND.md's contrast holds
 * in both themes — 4.5:1 for the text, WCAG's 3:1 for the frame and the mark,
 * which are graphical objects. The numbers are measured here from the
 * stylesheets rather than trusted to a comment (the same approach as
 * chess/ui/contrast.test.ts and gem-swap/ui/contrast.test.ts).
 *
 * This game writes no colour value of its own: the one property it declares,
 * `--tg-dent` (the shade inside a used-up slot), is an alias of two shared
 * tokens in two blocks at the top of make-the-target.css. The edges, the lift
 * and the recess carry no meaning — what a tile is, and that a slot is used up,
 * are told by the digits and their absence — so they have no 3:1 to clear.
 * What is pinned instead is where the light comes from: in both themes the
 * lower lip is lighter than the hole's floor and the shade is darker, each by
 * a floor of its own (a recess that has lost its depth is still "darker", so
 * the sign alone would let it go). The tile's digits, which sit on the face's
 * gradient and on the pressed ground, are held to 4.5:1 as well.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/make-the-target/ui/make-the-target.css'), 'utf8');

/** The body of the first rule whose selector (list) begins with this header, at a line start. */
function body(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

/** The custom properties a rule body declares, as written. */
function properties(rule: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of rule.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim());
  }
  return out;
}

const THEMES = [
  {
    name: 'light',
    base: ':root {',
    accent: ":root[data-game='make-the-target'],",
    game: ':root {',
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='make-the-target'],",
    game: ":root[data-theme='dark'] {",
  },
] as const;

/** Every shared token the game sees in this theme: the series base, then the title's accent over it. */
function themeTokens(theme: (typeof THEMES)[number]): Map<string, string> {
  return new Map([
    ...properties(body(sharedCss, theme.base)),
    ...properties(body(sharedCss, theme.accent)),
  ]);
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A `#rrggbb` or `rgba(r, g, b, a)` value as written in the shared tokens. */
function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/i.exec(value);
  expect(fn, `an unreadable colour: ${value}`).not.toBeNull();
  return { r: +fn![1]!, g: +fn![2]!, b: +fn![3]!, a: fn![4] === undefined ? 1 : +fn![4]! };
}

/** `top` laid over an opaque `ground`. */
function over(top: Rgba, ground: Rgba): Rgba {
  const mix = (t: number, g: number) => Math.round(t * top.a + g * (1 - top.a));
  return { r: mix(top.r, ground.r), g: mix(top.g, ground.g), b: mix(top.b, ground.b), a: 1 };
}

/** WCAG 2 relative luminance. */
function luminance({ r, g, b }: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('the target and the recess (docs/MAKE_THE_TARGET_RULES.md §12, BRAND.md「コントラスト」)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast(parse('#000000'), parse('#ffffff'))).toBeCloseTo(21, 5);
  });

  it('writes no colour value anywhere in the stylesheet', () => {
    // Comments may name a colour; a declaration may not. The two blocks at the
    // top hold aliases (below), so there is nothing to exempt.
    const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(
      code.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/gi) ?? [],
    ).toEqual([]);
  });

  it('declares --tg-dent only as an alias of shared tokens, in two blocks before any rule', () => {
    // Everything the board draws comes after the two blocks, so a reader finds
    // the game's own properties in one place (the same shape as gem-swap.css).
    const firstRule = gameCss.indexOf('\n.tg-play {');
    expect(firstRule).toBeGreaterThan(-1);
    for (const theme of THEMES) {
      expect(gameCss.indexOf(`\n${theme.game}`), `${theme.game} comes first`).toBeLessThan(
        firstRule,
      );
      const declared = properties(body(gameCss, theme.game));
      expect([...declared.keys()], `the only property under ${theme.game}`).toEqual(['--tg-dent']);
      const alias = /^var\((--[\w-]+)\)$/.exec(declared.get('--tg-dent')!);
      expect(alias, `--tg-dent under ${theme.game} is an alias`).not.toBeNull();
      expect(
        themeTokens(theme).has(alias![1]!),
        `${alias![1]} exists in the ${theme.name} theme`,
      ).toBe(true);
    }
  });

  for (const theme of THEMES) {
    const tokens = themeTokens(theme);
    const token = (name: string): Rgba => {
      const value = tokens.get(name);
      expect(value, `${name} in the ${theme.name} theme`).toBeDefined();
      return parse(value!);
    };

    it(`keeps the target's number, frame and mark readable on its ground (${theme.name})`, () => {
      const ground = token('--accent-soft');
      const number = contrast(token('--ink'), ground);
      const frame = contrast(token('--accent'), ground);
      const outside = contrast(token('--accent'), token('--paper'));
      // Printed for docs/MAKE_THE_TARGET_RULES.md §12; the gates are below.
      console.info(
        `[make-the-target contrast] ${theme.name}: number ${number.toFixed(2)}, frame and mark on the ground ${frame.toFixed(2)}, frame on the paper ${outside.toFixed(2)}`,
      );
      expect(number).toBeGreaterThanOrEqual(4.5);
      expect(frame).toBeGreaterThanOrEqual(3);
      expect(outside).toBeGreaterThanOrEqual(3);
    });

    it(`keeps the made target's number on the accent face (${theme.name})`, () => {
      const made = contrast(token('--accent-ink'), token('--accent'));
      console.info(`[make-the-target contrast] ${theme.name}: made ${made.toFixed(2)}`);
      expect(made).toBeGreaterThanOrEqual(4.5);
    });

    it(`keeps a tile's and an operator's number readable on the key face, at rest and pressed (${theme.name})`, () => {
      // The face is a gradient from --surface (top) to --paper (bottom), and a
      // press swaps it for --surface-recessed; the ink is held against all
      // three, since which one is weakest depends on the theme.
      const ink = token('--ink');
      const bottom = contrast(ink, token('--paper'));
      const pressed = contrast(ink, token('--surface-recessed'));
      console.info(
        `[make-the-target contrast] ${theme.name}: ink on the face's lower end ${bottom.toFixed(2)}, on the pressed ground ${pressed.toFixed(2)}`,
      );
      expect(contrast(ink, token('--surface'))).toBeGreaterThanOrEqual(4.5);
      expect(bottom).toBeGreaterThanOrEqual(4.5);
      expect(pressed).toBeGreaterThanOrEqual(4.5);
    });

    it(`lights the recess from the top: lip lighter than the floor, shade darker, each by enough to see (${theme.name})`, () => {
      const floor = token('--surface-recessed');
      const lip = token('--surface');
      const alias = /^var\((--[\w-]+)\)$/.exec(
        properties(body(gameCss, theme.game)).get('--tg-dent')!,
      )![1]!;
      const shade = over(token(alias), floor);
      const lipRatio = contrast(lip, floor);
      const shadeRatio = contrast(shade, floor);
      console.info(
        `[make-the-target contrast] ${theme.name}: lip on the floor ${lipRatio.toFixed(2)}, shade on the floor ${shadeRatio.toFixed(2)}`,
      );
      expect(luminance(lip), 'lip against floor').toBeGreaterThan(luminance(floor));
      expect(luminance(shade), 'shade against floor').toBeLessThan(luminance(floor));
      // The recess carries no meaning, but this is the least it must keep to
      // read as a hole at all. The dark theme sits right at the bottom of
      // the scale (the shade is --paper, 1.08:1), the light one well above.
      expect(lipRatio, 'lip against floor, by enough').toBeGreaterThanOrEqual(1.08);
      expect(shadeRatio, 'shade against floor, by enough').toBeGreaterThanOrEqual(1.05);
    });
  }
});
