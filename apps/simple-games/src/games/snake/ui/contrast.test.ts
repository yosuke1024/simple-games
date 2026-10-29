/**
 * The board's colours (docs/SNAKE_RULES.md §13「見た目」). Unlike Chess or Gem
 * Swap, Snake has no colour of its own: the snake is the title's accent, the
 * food the ink, the wall the soft ink, the floor the surface. The one variable
 * in ui/snake.css, `--sn-dent` (the shade under the wall's top and left), is an
 * alias for a shared token, never a value.
 *
 * This holds the file to that and measures what carries meaning from the
 * stylesheets, in both themes, instead of trusting a comment:
 *
 * - snake.css writes no colour literal anywhere (#hex, rgb(), hsl()), and its
 *   two top blocks hold only that alias;
 * - every shape the player reads — the snake, its eyes and ×, the food, the
 *   chosen heading, the wall, the arrows on the keys, the focus ring — clears
 *   3:1 (WCAG's floor for graphical objects) on what it sits on;
 * - the shade is a shade (visible, but far under 3:1: it carries no meaning)
 *   and the dark theme's alias is the token that makes it visible there.
 *
 * Resolved from the app root rather than import.meta.url: these tests run in
 * the jsdom environment, where import.meta.url is an http:// URL.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gameCss = readFileSync(resolve('src/games/snake/ui/snake.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The body of the first rule whose header starts exactly `\n${header}`. */
function ruleBody(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

/** Every `--name: value;` declared in a rule body. */
function customProperties(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim().toLowerCase());
  }
  return out;
}

/** The #rrggbb custom properties of a shared rule. */
function hexTokens(header: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, value] of customProperties(ruleBody(sharedCss, header))) {
    if (/^#[0-9a-f]{6}$/.test(value)) out.set(name, value);
  }
  return out;
}

/** The number a rule gives a property, e.g. `stroke-opacity: 0.3` is 0.3. */
function numberIn(body: string, property: string): number {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([\\d.]+)\\s*;`).exec(body);
  expect(match, `${property} is missing`).not.toBeNull();
  return Number(match![1]);
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

/** `top` laid over `under` at `alpha`, as the renderer composites a stroke-opacity edge. */
function over(top: string, under: string, alpha: number): string {
  const channel = (at: number) =>
    Math.round(
      parseInt(top.slice(at, at + 2), 16) * alpha +
        parseInt(under.slice(at, at + 2), 16) * (1 - alpha),
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

const THEMES = [
  {
    name: 'light',
    base: ':root {',
    accent: ":root[data-game='snake'],",
    game: ':root {',
    dent: '--surface-recessed',
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='snake'],",
    game: ":root[data-theme='dark'] {",
    dent: '--paper',
  },
] as const;

describe('the stylesheet names no colour (docs/SNAKE_RULES.md §13)', () => {
  const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

  it('writes no colour literal', () => {
    expect(code.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(
      code.match(/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? [],
    ).toEqual([]);
  });

  for (const theme of THEMES) {
    it(`declares one alias for a shared token at the top, and nothing else (${theme.name})`, () => {
      const declared = customProperties(ruleBody(gameCss, theme.game));
      expect([...declared.keys()]).toEqual(['--sn-dent']);
      expect(declared.get('--sn-dent')).toBe(`var(${theme.dent})`);
      // The token it points at exists in the shared sheet for this theme.
      expect(hexTokens(theme.base).has(theme.dent), `${theme.dent} under ${theme.base}`).toBe(true);
    });
  }
});

describe('what the player reads clears 3:1 on what it sits on (docs/SNAKE_RULES.md §13)', () => {
  for (const theme of THEMES) {
    const base = hexTokens(theme.base);
    const accent = ruleBody(sharedCss, theme.accent);
    const get = (name: string): string => {
      const value = base.get(name);
      expect(value, `${name} under ${theme.base}`).toBeDefined();
      return value!;
    };
    const accentOf = (name: '--accent' | '--accent-ink'): string => {
      const value = customProperties(accent).get(name);
      expect(value, `${name} under ${theme.accent}`).toMatch(/^#[0-9a-f]{6}$/);
      return value!;
    };

    it(`the snake, the food, the wall and the chosen heading read on the floor (${theme.name})`, () => {
      const floor = get('--surface');
      const pairs: Record<string, string> = {
        'the snake and its head (accent)': accentOf('--accent'),
        'the food and the chosen heading (ink)': get('--ink'),
        'the wall (soft ink)': get('--ink-soft'),
      };
      for (const [what, colour] of Object.entries(pairs)) {
        expect(contrast(colour, floor), `${what} on the floor`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`the eyes and the × read on the head (${theme.name})`, () => {
      expect(contrast(accentOf('--accent-ink'), accentOf('--accent'))).toBeGreaterThanOrEqual(3);
    });

    it(`the arrows on the keys, and the focus ring, read on the whole face of a key (${theme.name})`, () => {
      // The key is a gradient from the surface to the paper, so both ends count.
      for (const face of [get('--surface'), get('--paper')]) {
        expect(contrast(accentOf('--accent'), face), `accent on ${face}`).toBeGreaterThanOrEqual(3);
      }
      // The Start / Resume key is the accent with the accent's ink on it.
      expect(contrast(accentOf('--accent-ink'), accentOf('--accent'))).toBeGreaterThanOrEqual(3);
      // The focus ring is drawn against the page (the paper) around the key.
      expect(contrast(accentOf('--accent'), get('--paper'))).toBeGreaterThanOrEqual(3);
    });

    it(`the shade is visible but carries no meaning, and the edge of a bead reads as an edge (${theme.name})`, () => {
      const floor = get('--surface');
      const dent = get(theme.dent);
      const shade = contrast(dent, floor);
      // A shade, not a mark: seen on a floor, far from the 3:1 a shape needs.
      expect(shade).toBeGreaterThanOrEqual(1.15);
      expect(shade).toBeLessThan(2);
      // The edge is the ink at the stylesheet's opacity over the fill: a step off the fill itself.
      const alpha = numberIn(ruleBody(gameCss, '.sn-flesh,\n.sn-head-shape'), 'stroke-opacity');
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1);
      const edge = over(get('--ink'), accentOf('--accent'), alpha);
      expect(contrast(edge, accentOf('--accent'))).toBeGreaterThanOrEqual(1.2);
    });
  }

  it('the dark theme takes the paper for the shade because the recessed token is too faint there', () => {
    const dark = hexTokens(":root[data-theme='dark'] {");
    const floor = dark.get('--surface')!;
    expect(contrast(dark.get('--surface-recessed')!, floor)).toBeLessThan(1.15);
    expect(contrast(dark.get('--paper')!, floor)).toBeGreaterThanOrEqual(1.15);
  });
});
