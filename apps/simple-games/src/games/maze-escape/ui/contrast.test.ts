/**
 * The maze is drawn on warm paper, so its colours are game content, not
 * chrome (docs/architecture/css-split.md; docs/MAZE_ESCAPE_RULES.md「Visual
 * presentation」). They are declared in the two blocks at the top of
 * maze-escape.css and nowhere else. This measures, from the stylesheets rather
 * than from a comment, what the rules promise: every mark that carries meaning
 * — the wall, the start ring, the trail, the token, the goal and the hint —
 * clears 3:1 (WCAG's floor for graphical objects, docs/BRAND.md「コントラスト」)
 * on the floor in both themes, and stays there under the board's inner shade
 * and where a wall's cast shadow falls on the floor.
 *
 * What the depth adds — the wall's side face and cast shadow, the tray's shade,
 * the token's gloss and its shadow — carries no meaning (the walls are readable
 * without them), so it has no 3:1 to clear. What is pinned instead is where
 * the light comes from: the side face is darker than the top, the gloss is
 * lighter than the token in both themes, and each cue is visible at all.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/maze-escape/ui/maze-escape.css'), 'utf8');
const boardTsx = readFileSync(resolve('src/games/maze-escape/ui/components/Board.tsx'), 'utf8');
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first block whose header starts so, braces balanced. */
function block(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    if (source[at] === '}' && --depth === 0) return source.slice(open + 1, at);
  }
  throw new Error(`${header} is not closed`);
}

/** The normalised body of the game's rule whose selector list starts a line so. */
const rule = (header: string) => block(gameCss, `\n${header}`).replace(/\s+/g, ' ').trim();

/** Every `--name: value;` declared in a block, values as written. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim().toLowerCase());
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

/** `top` laid over `under` at `alpha`, as the renderer does (both #rrggbb). */
function laid(top: string, under: string, alpha: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `#${[1, 3, 5]
    .map((at) =>
      Math.round(channel(top, at) * alpha + channel(under, at) * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const THEMES = [
  {
    name: 'light',
    base: '\n:root {',
    accent: ":root[data-game='maze-escape'],",
  },
  {
    name: 'dark',
    base: "\n:root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='maze-escape'],",
  },
] as const;

/** The board's tokens, the shared theme tokens and the title's accent for one theme. */
function palette(theme: (typeof THEMES)[number]) {
  const own = declarations(block(gameCss, theme.base));
  const shared = declarations(block(sharedCss, theme.base));
  const accent = declarations(block(sharedCss, `\n${theme.accent}`));
  const colour = (name: string) => {
    const value = own.get(name);
    expect(value, `${name} under ${theme.name}`).toMatch(/^#[0-9a-f]{6}$/);
    return value!;
  };
  const number = (name: string) => {
    const value = Number(own.get(name));
    expect(Number.isFinite(value), `${name} under ${theme.name}`).toBe(true);
    return value;
  };
  /** A token written as `var(--other)`, resolved in the shared tokens. */
  const aliased = (name: string) => {
    const reference = /^var\((--[\w-]+)\)$/.exec(own.get(name) ?? '')?.[1];
    expect(reference, `${name} under ${theme.name}`).toBeDefined();
    const value = shared.get(reference!);
    expect(value, `${reference} under ${theme.name}`).toMatch(/^#[0-9a-f]{6}$/);
    return { reference: reference!, value: value! };
  };
  const sharedColour = (name: string) => {
    const value = accent.get(name) ?? shared.get(name);
    expect(value, `${name} under ${theme.name}`).toMatch(/^#[0-9a-f]{6}$/);
    return value!;
  };
  return { colour, number, aliased, sharedColour };
}

describe('the marks on the floor (docs/MAZE_ESCAPE_RULES.md「Visual presentation」)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    it(`clears 3:1 for the wall, the start ring, the trail and the token on the floor (${theme.name})`, () => {
      const { colour, sharedColour } = palette(theme);
      const floor = colour('--me-floor');
      const marks = {
        'the wall’s top face': colour('--me-wall-top'),
        'the start ring': colour('--me-start'),
        'the trail': colour('--me-trail'),
        'the token': sharedColour('--accent'),
      };
      for (const [what, mark] of Object.entries(marks)) {
        // Printed for docs/MAZE_ESCAPE_RULES.md; the gate is the 3:1 below.
        const ratio = contrast(mark, floor);
        console.info(
          `[maze-escape contrast] ${theme.name} ${what} on the floor: ${ratio.toFixed(2)}`,
        );
        expect(ratio, what).toBeGreaterThanOrEqual(3);
      }
    });

    it(`clears 3:1 for the goal and the hint against their fill (${theme.name})`, () => {
      const { sharedColour } = palette(theme);
      // The flag cloth, the pole and the disc's rim, and the hint's dashed edge,
      // are the accent drawn on --accent-soft.
      const ratio = contrast(sharedColour('--accent'), sharedColour('--accent-soft'));
      console.info(`[maze-escape contrast] ${theme.name} goal and hint: ${ratio.toFixed(2)}`);
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it(`keeps the wall at 3:1 under the tray’s shade at full strength (${theme.name})`, () => {
      // Worst case: the shade laid over the wall and the floor at its whole
      // alpha. The real shadow is at most about two thirds of that, at the edge.
      const { colour, number } = palette(theme);
      const shade = colour('--me-tray-shade');
      const alpha = number('--me-tray-alpha');
      const wall = laid(shade, colour('--me-wall-top'), alpha);
      const floor = laid(shade, colour('--me-floor'), alpha);
      const ratio = contrast(wall, floor);
      console.info(
        `[maze-escape contrast] ${theme.name} wall under the shade: ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it(`keeps the wall’s top and side faces at 3:1 where the cast shadow darkens the floor (${theme.name})`, () => {
      // The cast shadow falls on the floor beside a wall, so that is the ground
      // the wall's edge is read against there; laid at its whole alpha.
      const { colour, number } = palette(theme);
      const shadowed = laid(colour('--me-cast'), colour('--me-floor'), number('--me-cast-alpha'));
      for (const [what, face] of [
        ['top face', colour('--me-wall-top')],
        ['side face', colour('--me-wall-side')],
      ] as const) {
        const ratio = contrast(face, shadowed);
        console.info(
          `[maze-escape contrast] ${theme.name} wall ${what} on the shadowed floor: ${ratio.toFixed(2)}`,
        );
        expect(ratio, what).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe('the light comes from the upper left, in both themes (docs/MAZE_ESCAPE_RULES.md「Visual presentation」)', () => {
  for (const theme of THEMES) {
    it(`darkens the wall’s side face under its lit top face, and shows it (${theme.name})`, () => {
      const { colour } = palette(theme);
      const top = colour('--me-wall-top');
      const side = colour('--me-wall-side');
      expect(luminance(side)).toBeLessThan(luminance(top));
      const ratio = contrast(side, top);
      console.info(
        `[maze-escape contrast] ${theme.name} side face against the top: ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(1.3);
    });

    it(`lets the cast shadow and the tray’s shade show on the floor (${theme.name})`, () => {
      const { colour, number } = palette(theme);
      const floor = colour('--me-floor');
      for (const [shade, alpha] of [
        ['--me-cast', '--me-cast-alpha'],
        ['--me-tray-shade', '--me-tray-alpha'],
      ] as const) {
        const strength = number(alpha);
        expect(strength, alpha).toBeGreaterThan(0);
        expect(strength, alpha).toBeLessThanOrEqual(1);
        expect(luminance(colour(shade)), shade).toBeLessThan(luminance(floor));
        // Printed for the rules document; the gate is that the cue exists at all.
        const ratio = contrast(laid(colour(shade), floor, strength), floor);
        console.info(
          `[maze-escape contrast] ${theme.name} ${shade} at ${strength}: ${ratio.toFixed(2)}`,
        );
        expect(ratio, shade).toBeGreaterThanOrEqual(1.1);
      }
    });

    it(`lights the token’s gloss lighter than the token, never from the accent ink (${theme.name})`, () => {
      const { colour, number, aliased, sharedColour } = palette(theme);
      const gloss = aliased('--me-gloss');
      // The theme's lightest neutral: the surface in the light theme, the ink in the dark one.
      expect(gloss.reference).toBe(theme.name === 'light' ? '--surface' : '--ink');
      const token = sharedColour('--accent');
      expect(luminance(gloss.value)).toBeGreaterThan(luminance(token));
      // --accent-ink is white on the light theme's dark green and near-black on
      // the dark theme's light green: a gloss drawn in it would be a dark crescent.
      expect(gloss.value).not.toBe(sharedColour('--accent-ink'));
      const strength = number('--me-gloss-alpha');
      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1);
      const ratio = contrast(laid(gloss.value, token, strength), token);
      console.info(
        `[maze-escape contrast] ${theme.name} gloss over the token: ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(1.3);
      // The floor-coloured ring round the token still parts it from the floor.
      expect(contrast(token, colour('--me-floor'))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the stylesheet’s own rules (docs/MAZE_ESCAPE_RULES.md「Visual presentation」)', () => {
  it('writes colour only in the two blocks at the top, before any rule', () => {
    const css = withoutComments(gameCss).trim();
    // The two blocks are the first two rules of the file.
    expect(css).toMatch(/^:root \{[^}]*\}\s*:root\[data-theme='dark'\] \{[^}]*\}/);
    let outside = css;
    for (const header of [':root {', ":root[data-theme='dark'] {"]) {
      const body = block(outside, header);
      outside = outside.replace(`${header}${body}}`, '');
    }
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
    // A named colour is a literal too. `transparent` and `currentColor` carry no
    // hue of their own, so they are allowed; a var() is stripped first so a
    // token's own name cannot be mistaken for a colour word.
    const values = outside.replace(/var\([^)]*\)/g, 'var()');
    expect(
      values.match(
        /[\w-]+\s*:[^;{}]*\b(?:white|black|red|green|blue|gr[ae]y|silver|brown|tan|beige|ivory|orange|yellow|purple|pink|gold|navy|teal|maroon|olive|lime|aqua|cyan|magenta|khaki|wheat|bisque|linen|sienna|peru|chocolate|coral|salmon|crimson)\b/gi,
      ) ?? [],
    ).toEqual([]);
  });

  it('declares the same tokens in both blocks, so neither theme falls back', () => {
    const light = [...declarations(block(gameCss, '\n:root {')).keys()].sort();
    const dark = [...declarations(block(gameCss, "\n:root[data-theme='dark'] {")).keys()].sort();
    expect(light.length).toBeGreaterThan(10);
    expect(dark).toEqual(light);
  });

  it('keeps the frame’s lift first, and the depth static and light', () => {
    expect(rule('.me-board {')).toContain(
      'box-shadow: 0 3px 0 var(--me-rim-lift), 0 10px 24px var(--me-drop);',
    );
    // Depth does not animate, and nothing the old Android WebView lacks.
    expect(gameCss).not.toMatch(/\b(?:transition|animation)\s*:/);
    expect(gameCss).not.toMatch(/\bfilter\s*:/);
    expect(gameCss).not.toMatch(/:has\(|color-mix\(|container-type|@container/);
  });

  it('lays the tray’s shade over the board without catching a swipe or a tap', () => {
    const tray = rule('.me-board::after,\n.me-figure::after {');
    expect(tray).toContain('pointer-events: none;');
    expect(tray).toContain('position: absolute;');
    expect(tray).toContain('opacity: var(--me-tray-alpha);');
  });

  it('keeps the tray’s shade short of the start ring on the smallest board', () => {
    const tray = rule('.me-board::after,\n.me-figure::after {');
    const shadow =
      /box-shadow:\s*inset\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(-?[\d.]+)px/.exec(tray);
    expect(shadow, 'the tray’s inset shadow').not.toBeNull();
    const [dx, dy, blur, spread] = shadow!.slice(1).map(Number) as [number, number, number, number];
    // How far in from each edge the shadow is still visible: the band it
    // leaves (offset less spread, from the far side the other way) and its blur.
    const reach = Math.max(
      0,
      dx + spread + blur,
      dy + spread + blur,
      -dx + spread + blur,
      -dy + spread + blur,
    );

    // The smallest board: the compact-height layout's narrowest .me-body (its
    // smallest max-width, less its widest side padding) less the board's border
    // on each side. All read from the stylesheet, so a layout change is noticed.
    const css = withoutComments(gameCss);
    const bodies = [...css.matchAll(/\.me-body\s*\{([^}]*)\}/g)].map((match) => match[1]!);
    const maxWidths = bodies.flatMap((body) => /max-width:\s*(\d+)px/.exec(body)?.[1] ?? []);
    const paddings = bodies.flatMap((body) => {
      const shorthand = /(?:^|[\s;])padding:\s*([^;]+);/.exec(body)?.[1]?.trim().split(/\s+/);
      const inline = /padding-inline:\s*(\d+)px/.exec(body)?.[1];
      return [shorthand ? (shorthand[1] ?? shorthand[0]!) : '0', inline ?? '0'];
    });
    const border = /border:\s*(\d+)px/.exec(rule('.me-board {'))?.[1];
    expect(maxWidths.length, 'the .me-body max-widths').toBeGreaterThan(0);
    expect(border, 'the board’s border width').toBeDefined();
    const inner =
      Math.min(...maxWidths.map(Number)) -
      2 * Math.max(...paddings.map(parseFloat)) -
      2 * Number(border);

    // The ring's outer stroke, in viewBox units from the viewBox's edge: the
    // margin, the gap between the cell's edge and the circle, less half the
    // stroke. The geometry is read from Board.tsx, the stroke from the sheet.
    const margin = Number(/viewBox=\{`-([\d.]+) -[\d.]+ \$\{size \+ [\d.]+\}/.exec(boardTsx)?.[1]);
    const ring = /<circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)" className="me-start"/.exec(
      boardTsx,
    );
    const stroke = Number(/stroke-width:\s*([\d.]+)/.exec(rule('.me-start {'))?.[1]);
    expect(Number.isFinite(margin), 'the viewBox margin').toBe(true);
    expect(ring, 'the start ring in Board.tsx').not.toBeNull();
    expect(Number.isFinite(stroke), 'the start ring’s stroke width').toBe(true);
    const outerEdge = margin + (Number(ring![1]) - Number(ring![2])) - stroke / 2;
    const smallestSize = 9;
    const ringFromEdge = (outerEdge * inner) / (smallestSize + 2 * margin);

    console.info(
      `[maze-escape contrast] tray shade reaches ${reach}px; the start ring's outer stroke is ${ringFromEdge.toFixed(1)}px in (board ${inner}px wide)`,
    );
    expect(inner, 'the smallest board’s inner width').toBeGreaterThan(100);
    // 1px in hand for the blur's faint tail (under 3% of its strength past the reach).
    expect(reach + 1).toBeLessThan(ringFromEdge);
  });

  it('gives the direction keys the shared control-key recipe, flat when unavailable', () => {
    expect(rule('.me-direction {')).toContain(
      'background: linear-gradient(var(--surface), var(--paper));',
    );
    expect(rule('.me-direction {')).toContain(
      'box-shadow: inset 0 1px 0 var(--surface), 0 2px 0 var(--line);',
    );
    expect(rule(".me-direction:active:not([aria-disabled='true']) {")).toContain(
      'box-shadow: inset 0 1px 2px var(--line);',
    );
    expect(rule(".me-direction[aria-disabled='true'] {")).toContain('box-shadow: none;');
  });
});
