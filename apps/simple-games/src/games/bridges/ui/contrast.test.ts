/**
 * The sea and what lies on it (docs/BRIDGES_RULES.md §13). The board is no
 * longer the island paper: it is one step below it — the title's --accent-soft
 * in the light theme, the series' --surface-recessed in the dark one — and the
 * bridges, the selection, the finished islands and the outlines are drawn on
 * that. The stylesheet writes no colour of its own (bridges.css names only the
 * shared tokens), so this measures the tokens it names, from src/ui/styles.css,
 * against the sea in each theme. WCAG's 3:1 floor for graphical objects
 * (docs/BRAND.md「コントラスト」) is the gate; the rest are pins on the text of
 * the stylesheet, which jsdom cannot compute, for the mistakes the survey
 * (2026-10-29) listed: the wash painted in the sea's own colour, the rim lost
 * by a state rule that sets `box-shadow` alone, a press that moves the Quick
 * Rules figure, and a lifted disc that leaves its selection ring behind.
 *
 * The sea is declared the way the other boards declare a palette: in the two
 * blocks at the top of the stylesheet (`:root` and `:root[data-theme='dark']`).
 * Here those blocks hold aliases of shared tokens only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/bridges/ui/bridges.css'), 'utf8');
const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

type Rgba = readonly [number, number, number, number];

/** The body of the first rule whose header starts at a line start so, braces balanced. */
function body(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    if (source[at] === '}' && --depth === 0) return source.slice(open + 1, at);
  }
  throw new Error(`${header} is not closed`);
}

/** #rrggbb or rgba(r, g, b, a) as [r, g, b, a]. */
function colour(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(value);
  expect(rgba, `not a colour: ${value}`).not.toBeNull();
  return [Number(rgba![1]), Number(rgba![2]), Number(rgba![3]), Number(rgba![4])];
}

/** Every `--name: colour;` in a block of src/ui/styles.css. */
function tokens(block: string): Map<string, Rgba> {
  const out = new Map<string, Rgba>();
  for (const match of block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6}|rgba\([^)]*\))\s*;/gi)) {
    out.set(match[1]!, colour(match[2]!));
  }
  return out;
}

/** WCAG 2 relative luminance of an opaque colour. */
function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `fg` laid over an opaque `bg` at its own alpha times `opacity`. */
function over(fg: Rgba, bg: Rgba, opacity = 1): Rgba {
  const alpha = fg[3] * opacity;
  return [0, 1, 2].map((at) => fg[at]! * alpha + bg[at]! * (1 - alpha)) as unknown as Rgba;
}

const THEMES = [
  {
    name: 'light',
    base: ':root {',
    accent: ":root[data-game='bridges'],",
    sea: ':root {',
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='bridges'],",
    sea: ":root[data-theme='dark'] {",
  },
] as const;

/** The series tokens of a theme: the base block, then the title's accent over it. */
function palette(theme: (typeof THEMES)[number]): Map<string, Rgba> {
  return new Map([
    ...tokens(body(sharedCss, theme.base)),
    ...tokens(body(sharedCss, theme.accent)),
  ]);
}

/** The token a declaration of `prop` in the rule at `header` names first. */
function tokenOf(header: string, prop: string): string {
  const rule = body(gameCss, header);
  const declaration = new RegExp(`(?:^|[\\s;])${prop}:([^;]*);`).exec(rule);
  expect(declaration, `${prop} under ${header}`).not.toBeNull();
  const named = /var\((--[\w-]+)\)/.exec(declaration![1]!);
  expect(named, `a token in ${prop} under ${header}`).not.toBeNull();
  return named![1]!;
}

/** The alpha a rule declares in `prop` (opacity or fill-opacity); 1 when it declares none. */
function opacityOf(header: string, prop = 'opacity'): number {
  const found = new RegExp(`(?:^|[\\s;])${prop}:\\s*([\\d.]+)\\s*;`).exec(body(gameCss, header));
  return found ? Number(found[1]) : 1;
}

function pick(tokensOfTheme: Map<string, Rgba>, name: string): Rgba {
  const value = tokensOfTheme.get(name);
  expect(value, name).toBeDefined();
  return value!;
}

/** The sea of a theme: the token --bg-water aliases there, and its colour. */
function sea(theme: (typeof THEMES)[number]): { token: string; colour: Rgba } {
  const alias = /--bg-water:\s*var\((--[\w-]+)\)\s*;/.exec(body(gameCss, theme.sea));
  expect(alias, `--bg-water under ${theme.sea}`).not.toBeNull();
  return { token: alias![1]!, colour: pick(palette(theme), alias![1]!) };
}

describe('the sea (docs/BRIDGES_RULES.md §13)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 5);
  });

  it('writes no colour of its own: the sea is two shared tokens', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i);
    // color-mix() is past the Chromium 88 floor.
    expect(code).not.toMatch(/color-mix\(/);
    expect(sea(THEMES[0]).token).toBe('--accent-soft');
    expect(sea(THEMES[1]).token).toBe('--surface-recessed');
  });

  it('paints the board with the sea, and nothing else under the islands', () => {
    expect(tokenOf('.bg-board {', 'background')).toBe('--bg-water');
    expect(tokenOf('.bg-board {', 'background')).not.toBe('--surface');
  });

  it('declares the sea in the two blocks at the top of the file, and nowhere else', () => {
    // The shape Chess and Gem Swap use: the light block, then the dark one, before any rule.
    expect(code.trimStart()).toMatch(
      /^:root \{[^}]*\}\s*:root\[data-theme='dark'\] \{[^}]*\}\s*\.bg-board-scroll \{/,
    );
    for (const theme of THEMES) {
      const declared = [...body(gameCss, theme.sea).matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
      expect(declared, theme.name).toEqual(['--bg-water', '--bg-water-edge']);
    }
    expect([...code.matchAll(/--bg-water(?:-edge)?:/g)]).toHaveLength(4);
  });

  it('keeps the collection’s board frame in its order, with the recess wall after it', () => {
    const frame = body(gameCss, '.bg-board {').replace(/\s+/g, ' ');
    // Thickness first, paper edge, outer line, soft shadow: the recipe the other boards share.
    expect(frame).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft), inset 0 2px 0 var(--bg-water-edge);',
    );
  });

  for (const theme of THEMES) {
    describe(theme.name, () => {
      const water = sea(theme).colour;
      const colours = palette(theme);

      // [mark, rule, the property that names its colour]; a rule's own opacity counts.
      const marks = [
        ['a bridge', '.bg-bridge {', 'stroke'],
        [
          'the selection ring',
          '.bg-island-selected .bg-ring,\n.bg-island-target .bg-ring {',
          'border',
        ],
        ['an island’s outline', '.bg-disc {', 'border'],
        ['a finished island', '.bg-island-complete .bg-disc {', 'background'],
        ['an over-filled island’s ring', '.bg-island-over .bg-disc {', 'border-color'],
        ['the keyboard focus ring', '.bg-island:focus-visible {', 'box-shadow'],
        ['a candidate line', '.bg-candidate {', 'stroke'],
      ] as const;

      for (const [mark, header, prop] of marks) {
        it(`clears 3:1 against the sea: ${mark}`, () => {
          const drawn = over(pick(colours, tokenOf(header, prop)), water, opacityOf(header));
          expect(contrast(drawn, water), mark).toBeGreaterThanOrEqual(3);
        });
      }

      it('keeps the faint grid of water dots visible (at least the old --line dots, 1.41 / 1.33)', () => {
        // The alpha is on the fill, not on the element: 144 circles must not each be a group.
        expect(body(gameCss, '.bg-dot {')).not.toMatch(/(?:^|[\s;])opacity:/);
        const dot = over(
          pick(colours, tokenOf('.bg-dot {', 'fill')),
          water,
          opacityOf('.bg-dot {', 'fill-opacity'),
        );
        expect(contrast(dot, water)).toBeGreaterThanOrEqual(1.4);
      });

      it('shows the solved wash, which must not be the sea’s own colour', () => {
        const wash = tokenOf('.bg-board::after {', 'background');
        expect(wash).not.toBe(sea(theme).token);
        const peak = /30%\s*\{\s*opacity:\s*([\d.]+)\s*;/.exec(
          body(gameCss, '@keyframes bg-solved-wash {'),
        );
        expect(peak, 'the 30% keyframe').not.toBeNull();
        const painted = over(pick(colours, wash), water, Number(peak![1]));
        expect(contrast(painted, water)).toBeGreaterThanOrEqual(1.3);
      });
    });
  }
});

describe('the island’s height (docs/BRIDGES_RULES.md §13)', () => {
  /** Top-level comma count of a value: layers = commas + 1. */
  function layers(value: string): number {
    let depth = 0;
    let commas = 0;
    for (const char of value) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) commas++;
    }
    return commas + 1;
  }

  it('gives the disc a rim and a shadow, and each state swaps one value of the same two layers', () => {
    const values = [...code.matchAll(/--bg-lift:\s*([^;]+);/g)].map((match) => match[1]!);
    // Resting, selected, pressed: a state changes --bg-lift and nothing else about the
    // disc's shadow, so the rim comes first and the soft shadow second in all of them.
    expect(values).toHaveLength(3);
    for (const value of values) expect(layers(value)).toBe(2);
    expect(body(gameCss, '.bg-disc {')).toMatch(/box-shadow:\s*var\(--bg-lift\);/);
  });

  it('keeps the rim when a disc is over its number', () => {
    const shadow = /box-shadow:\s*([^;]+);/.exec(body(gameCss, '.bg-island-over .bg-disc {'));
    expect(shadow, 'the over rule’s box-shadow').not.toBeNull();
    expect(shadow![1]!.trim().startsWith('var(--bg-lift)')).toBe(true);
  });

  it('lifts a selected island and sinks a pressed one, on buttons only', () => {
    expect(body(gameCss, '.bg-island {')).toMatch(/--bg-rise:\s*0;/);
    expect(body(gameCss, '.bg-island-selected {')).toMatch(/--bg-rise:\s*-0\.03;/);
    // The Quick Rules figure draws its islands as spans: touching the picture must not move them.
    expect(body(gameCss, 'button.bg-island:active {')).toMatch(/--bg-rise:\s*0\.02;/);
    expect(code).not.toMatch(/(^|\n)\.bg-island:active/);
    expect(code.indexOf('.bg-island-selected {')).toBeLessThan(
      code.indexOf('button.bg-island:active {'),
    );
    // The pressed rim (none) replaces the selected one on the disc.
    expect(code.indexOf('.bg-island-selected .bg-disc {')).toBeLessThan(
      code.indexOf('button.bg-island:active .bg-disc {'),
    );
  });

  it('moves the disc and its ring by the same rise, so they stay concentric', () => {
    // The ring's border sits 0.13 cell outside the disc (1.1 against 0.84 across): a disc
    // that rose alone would meet the ring's inner edge on a 28–31px cell.
    const rise = /transform:\s*translateY\(calc\(var\(--bg-cell\) \* var\(--bg-rise\)\)\);/;
    expect(body(gameCss, '.bg-disc {')).toMatch(rise);
    expect(body(gameCss, '.bg-ring {')).toMatch(rise);
    expect(body(gameCss, '.bg-ring {')).toMatch(/transition:\s*transform 0\.12s ease;/);
  });

  it('puts the lift and the press in the disc’s one transition, and ends both under Reduced Motion', () => {
    const transition = /transition:([^;]+);/.exec(body(gameCss, '.bg-disc {'));
    expect(transition![1]).toContain('transform 0.12s');
    expect(transition![1]).toContain('box-shadow 0.12s');
    const flat = code.replace(/\s+/g, ' ');
    // The disc's and the ring's transitions end together, in the OS setting and the app's.
    expect(flat).toContain(
      '@media (prefers-reduced-motion: reduce) { .bg-disc, .bg-ring { transition: none; }',
    );
    expect(flat).toContain(
      ":root[data-reduced-motion='true'] .bg-disc, :root[data-reduced-motion='true'] .bg-ring { transition: none; }",
    );
  });
});
