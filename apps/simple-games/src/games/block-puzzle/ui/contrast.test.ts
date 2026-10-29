/**
 * The board's colours (docs/BLOCK_PUZZLE_RULES.md §12), measured from the
 * stylesheets rather than trusted to a comment — the same approach as
 * chess/ui/contrast.test.ts and gem-swap/ui/contrast.test.ts.
 *
 * The four piece pigments are game content and live in the two blocks at the
 * top of ui/block-puzzle.css (docs/BRAND.md「盤面が自前の色階調を持つ場合の
 * 例外」); tone 1 is the series accent. Every pair that carries meaning is held
 * to WCAG's 3:1 for graphical objects in both themes:
 *
 * - a filled cell's face against an empty cell (--surface) and against the
 *   board's groove (--surface-recessed) — taken against open (§1, §12);
 * - the carried piece's ring against the groove and an empty cell (§3);
 * - the blocked piece's ink ring, at the cell's opacity, against the groove;
 * - the carried piece's ring against its own fill where it crosses a lit line.
 *
 * The lit line itself is a lift in brightness, not a 3:1 mark; it is held to
 * the lift the accent already shipped with (1.55 in the dark theme).
 *
 * Translucent layers are composited the way a browser paints them: each layer
 * over what is under it, per channel, rounded to 8 bits.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/block-puzzle/ui/block-puzzle.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

const LIGHT_BLOCK = '\n:root {';
const DARK_BLOCK = "\n:root[data-theme='dark'] {";
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(/gi;

/** The body of the first rule whose header starts so, braces balanced. */
function block(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `${header.trim()} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    if (source[at] === '}' && --depth === 0) return source.slice(open + 1, at);
  }
  throw new Error(`${header.trim()} is not closed`);
}

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** The custom properties a block declares, values as written. */
function declarations(source: string, header: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of stripComments(block(source, header)).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim());
  }
  return out;
}

type Rgba = readonly [number, number, number, number];

function parseColour(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`not a colour this test reads: ${value}`);
}

/** `top` painted over an opaque `under`, at `top`'s alpha times `opacity`. */
function over(top: Rgba, under: Rgba, opacity = 1): Rgba {
  const a = top[3] * opacity;
  const mix = (at: 0 | 1 | 2) => Math.round(top[at] * a + under[at] * (1 - a));
  return [mix(0), mix(1), mix(2), 1];
}

/** WCAG 2 relative luminance. */
function luminance(colour: Rgba): number {
  const [r, g, b] = [0, 1, 2].map((at) => {
    const channel = colour[at]! / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** CIE76 ΔE between two opaque colours (D65). */
function deltaE(a: Rgba, b: Rgba): number {
  const lab = (colour: Rgba) => {
    const [r, g, b2] = [0, 1, 2].map((at) => {
      const c = colour[at]! / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const xyz = [
      (0.4124 * r! + 0.3576 * g! + 0.1805 * b2!) / 0.95047,
      0.2126 * r! + 0.7152 * g! + 0.0722 * b2!,
      (0.0193 * r! + 0.1192 * g! + 0.9505 * b2!) / 1.08883,
    ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116));
    return [116 * xyz[1]! - 16, 500 * (xyz[0]! - xyz[1]!), 200 * (xyz[1]! - xyz[2]!)];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}

const THEMES = [
  {
    name: 'light',
    // Highest priority first. The game declares only --bp-* names, so the
    // game and the series never compete for one.
    scopes: [
      [gameCss, LIGHT_BLOCK],
      [sharedCss, "\n:root[data-game='block-puzzle'],"],
      [sharedCss, LIGHT_BLOCK],
    ],
  },
  {
    name: 'dark',
    // The dark blocks override what they redeclare; the rest comes from :root.
    scopes: [
      [gameCss, DARK_BLOCK],
      [gameCss, LIGHT_BLOCK],
      [sharedCss, "\n:root[data-theme='dark'][data-game='block-puzzle'],"],
      [sharedCss, DARK_BLOCK],
      [sharedCss, LIGHT_BLOCK],
    ],
  },
] as const;

/** A token's colour in a theme, following var() through the game, accent and base blocks. */
function themeResolver(theme: (typeof THEMES)[number]) {
  const scopes = theme.scopes.map(([source, header]) => declarations(source, header));
  const raw = (name: string): string => {
    for (const scope of scopes) {
      const value = scope.get(name);
      if (value !== undefined) return value;
    }
    throw new Error(`${name} is not declared for the ${theme.name} theme`);
  };
  const colour = (name: string): Rgba => {
    const value = raw(name);
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    return reference ? colour(reference[1]!) : parseColour(value);
  };
  return colour;
}

/** The opacity a rule sets, as written in the stylesheet. */
function opacityOf(header: string): number {
  const value = /(?:^|;|\s)opacity:\s*([\d.]+)\s*;/.exec(
    stripComments(block(gameCss, header)),
  )?.[1];
  expect(value, `opacity in ${header.trim()}`).toBeDefined();
  return Number(value);
}

const TONES = [1, 2, 3, 4, 5] as const;

describe('where colour is written (docs/architecture/css-split.md)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast(parseColour('#000000'), parseColour('#ffffff'))).toBeCloseTo(21, 5);
  });

  it('opens with the two token blocks, before any other rule', () => {
    const light = gameCss.indexOf(LIGHT_BLOCK);
    const dark = gameCss.indexOf(DARK_BLOCK);
    expect(light).toBeGreaterThan(-1);
    expect(stripComments(gameCss.slice(0, light)).trim()).toBe('');
    const lightEnd = gameCss.indexOf('}', light);
    expect(dark).toBeGreaterThan(lightEnd);
    expect(stripComments(gameCss.slice(lightEnd + 1, dark)).trim()).toBe('');
  });

  it('writes the eight pigments as hex, four per theme, and nothing else as hex', () => {
    expect(gameCss.match(/#[0-9a-f]{3,8}\b/gi)).toHaveLength(8);
    for (const header of [LIGHT_BLOCK, DARK_BLOCK]) {
      const hex = [...declarations(gameCss, header).entries()].filter(([, value]) =>
        value.startsWith('#'),
      );
      expect(hex.map(([name]) => name)).toEqual([
        '--bp-tone-2',
        '--bp-tone-3',
        '--bp-tone-4',
        '--bp-tone-5',
      ]);
    }
  });

  it('puts no colour literal anywhere but the two token blocks', () => {
    const light = gameCss.indexOf(LIGHT_BLOCK);
    const darkEnd = gameCss.indexOf('}', gameCss.indexOf(DARK_BLOCK));
    expect(gameCss.slice(0, light).match(COLOUR_LITERAL) ?? []).toEqual([]);
    expect(gameCss.slice(darkEnd + 1).match(COLOUR_LITERAL) ?? []).toEqual([]);
  });

  it('paints tone 1 in the accent and leaves any tone past 5 to fall back to it', () => {
    expect(stripComments(block(gameCss, '\n.bp-tone-1 {')).trim()).toBe(
      '--bp-face: var(--accent);',
    );
    for (const tone of [2, 3, 4, 5]) {
      expect(stripComments(block(gameCss, `\n.bp-tone-${tone} {`)).trim()).toBe(
        `--bp-face: var(--bp-tone-${tone});`,
      );
    }
    for (const tone of [6, 7, 8, 9]) expect(gameCss).not.toContain(`.bp-tone-${tone}`);
    for (const header of ['\n.bp-cell-filled {', '\n.bp-piece-cell-filled {']) {
      expect(block(gameCss, header)).toContain('background: var(--bp-face, var(--accent));');
    }
  });
});

for (const theme of THEMES) {
  const colour = themeResolver(theme);
  const surface = colour('--surface');
  const groove = colour('--surface-recessed');
  const accent = colour('--accent');
  const face = (tone: number) => (tone === 1 ? accent : colour(`--bp-tone-${tone}`));

  describe(`the board’s colours, ${theme.name} theme (docs/BLOCK_PUZZLE_RULES.md §12)`, () => {
    it('reads every filled face against an empty cell and against the groove at 3:1', () => {
      for (const tone of TONES) {
        const onSurface = contrast(face(tone), surface);
        const onGroove = contrast(face(tone), groove);
        // Printed for docs/BLOCK_PUZZLE_RULES.md §12; the gate is the 3:1 below.
        console.info(
          `[block-puzzle contrast] ${theme.name} tone ${tone}: surface ${onSurface.toFixed(2)}, groove ${onGroove.toFixed(2)}`,
        );
        expect(onSurface, `tone ${tone} on --surface`).toBeGreaterThanOrEqual(3);
        expect(onGroove, `tone ${tone} on --surface-recessed`).toBeGreaterThanOrEqual(3);
      }
    });

    it('lifts every face under the lit line’s veil at least as far as the accent shipped with', () => {
      expect(block(gameCss, '\n.bp-cell-filled.bp-cell-will-clear {')).toContain(
        'linear-gradient(var(--bp-veil), var(--bp-veil))',
      );
      const veil = colour('--bp-veil');
      for (const tone of TONES) {
        const lift = contrast(over(veil, face(tone)), face(tone));
        console.info(
          `[block-puzzle contrast] ${theme.name} tone ${tone}: lit lift ${lift.toFixed(2)}`,
        );
        expect(lift, `tone ${tone} lit`).toBeGreaterThanOrEqual(1.55);
      }
    });

    it('draws the carried piece’s ring at 3:1 against the groove and an empty cell', () => {
      expect(block(gameCss, '\n.bp-cell-ghost {')).toContain('inset 0 0 0 2px var(--accent)');
      expect(contrast(accent, groove)).toBeGreaterThanOrEqual(3);
      expect(contrast(accent, surface)).toBeGreaterThanOrEqual(3);
    });

    it('draws the blocked piece’s ink ring at 3:1 against the groove, at the cell’s opacity', () => {
      expect(block(gameCss, '\n.bp-cell-ghost-blocked {')).toContain(
        'inset 0 0 0 2px var(--ink-soft)',
      );
      const opacity = opacityOf('\n.bp-cell-ghost-blocked {');
      const ring = over(colour('--ink-soft'), groove, opacity);
      const ratio = contrast(ring, groove);
      console.info(
        `[block-puzzle contrast] ${theme.name} blocked ring at ${opacity}: groove ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it('keeps the carried piece’s ring at 3:1 against its own fill on a lit line', () => {
      const rule = block(gameCss, '\n.bp-cell-ghost.bp-cell-will-clear {');
      expect(rule).toContain('background-color: var(--accent-ring);');
      expect(rule).toContain('linear-gradient(var(--bp-veil-ghost), var(--bp-veil-ghost))');
      expect(rule).toContain('inset 0 0 0 2px var(--bp-lit-ring)');
      // The ghost's fill is translucent over the board's groove, then veiled.
      const fill = over(colour('--bp-veil-ghost'), over(colour('--accent-ring'), groove));
      const ratio = contrast(colour('--bp-lit-ring'), fill);
      console.info(`[block-puzzle contrast] ${theme.name} lit ghost ring: ${ratio.toFixed(2)}`);
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it('keeps the pigments off the warning colour and out of the accent’s family', () => {
      // Not a contrast floor: --warn marks a broken rule elsewhere in the
      // series, and the piece in hand is the accent, so a pigment near either
      // would say something it does not mean. 17.7 is Gem Swap's orange from
      // --warn, the closest the series has accepted.
      for (const tone of [2, 3, 4, 5]) {
        const fromWarn = deltaE(face(tone), colour('--warn'));
        const fromAccent = deltaE(face(tone), accent);
        console.info(
          `[block-puzzle contrast] ${theme.name} tone ${tone}: ΔE warn ${fromWarn.toFixed(1)}, accent ${fromAccent.toFixed(1)}`,
        );
        expect(fromWarn, `tone ${tone} from --warn`).toBeGreaterThanOrEqual(17.7);
        expect(fromAccent, `tone ${tone} from --accent`).toBeGreaterThanOrEqual(25);
      }
    });
  });
}

describe('the board’s frame and motion (docs/BLOCK_PUZZLE_RULES.md §12)', () => {
  const flat = (text: string) => stripComments(text).replace(/\s+/g, ' ').trim();

  it('wears the collection’s board frame, the lift listed first', () => {
    expect(flat(block(gameCss, '\n.bp-board {'))).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
  });

  it('stops the placement’s easing and the clear under both Reduced Motion switches', () => {
    const media = flat(block(gameCss, '@media (prefers-reduced-motion: reduce)'));
    expect(media).toContain('.bp-board .bp-cell { transition: none; }');
    expect(media).toMatch(/\.bp-board \.bp-cell-clearing \{ animation: none; \}/);
    expect(flat(gameCss)).toContain(
      ":root[data-reduced-motion='true'] .bp-cell { transition: none; }",
    );
    expect(flat(gameCss)).toContain(
      ":root[data-reduced-motion='true'] .bp-cell-clearing { animation: none; }",
    );
  });
});
