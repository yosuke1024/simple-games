/**
 * Paddle Rally writes no colour of its own (docs/PADDLE_RALLY_RULES.md, Visual
 * presentation): the court, both paddles and the ball are drawn in the shared
 * tokens, so nothing here is "game content" in the sense of css-split.md. What
 * the stylesheet promises, and a comment cannot keep, is how those tokens are
 * paired: the three moving shapes clear 3:1 against the court (WCAG's floor
 * for graphical objects) in both themes, the dark opponent weighs the same as
 * the player's paddle, and the light comes from above on both themes — the
 * ball's glint is lighter than the ball, its contact shadow darker than the
 * court, and the paddle edge is a lit top line in light but, in dark where
 * --surface is darker than both paddles, a shade moved to the lower edge.
 *
 * Measured here from the stylesheets rather than trusted to a comment (the
 * same approach as mancala/ui/contrast.test.ts). The tokens are read from
 * src/ui/styles.css and the token each rule picks from paddle-rally.css, so
 * moving the CPU back to --ink in dark, the edge back to a --surface line on
 * the top edge, or the ball's shadow onto a lighter token fails here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/paddle-rally/ui/paddle-rally.css'), 'utf8');
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

/** The declarations of the title accent block: `:root[data-game='paddle-rally'],` opens it. */
function accentBlock(selector: string): string {
  const start = sharedCss.indexOf(`\n${selector},`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  return sharedCss.slice(sharedCss.indexOf('{', start) + 1, sharedCss.indexOf('}', start));
}

function accent(selector: string): string {
  const value = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(accentBlock(selector))?.[1];
  expect(value, `--accent under ${selector}`).toBeDefined();
  return value!.toLowerCase();
}

/** --accent-ring is an rgba(), which the #rrggbb token reader cannot take. */
function accentRing(selector: string): { colour: string; alpha: number } {
  const match = /--accent-ring:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\s*;/.exec(
    accentBlock(selector),
  );
  expect(match, `--accent-ring under ${selector}`).not.toBeNull();
  const hex = [match![1]!, match![2]!, match![3]!]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('');
  return { colour: `#${hex}`, alpha: Number(match![4]) };
}

/** The value one property takes in the rule with exactly this selector, if the rule says. */
function declared(selector: string, property: string): string | undefined {
  const start = gameCss.indexOf(`\n${selector} {`);
  if (start < 0) return undefined;
  const body = gameCss.slice(gameCss.indexOf('{', start) + 1, gameCss.indexOf('}', start));
  return new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
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

/** `top` laid over `bottom` at this alpha, as the stroke-opacity / opacity rules paint it. */
function blend(top: string, bottom: string, alpha: number): string {
  const channel = (at: number) =>
    Math.round(
      parseInt(top.slice(at, at + 2), 16) * alpha +
        parseInt(bottom.slice(at, at + 2), 16) * (1 - alpha),
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

const THEMES = [
  { name: 'light', root: ':root', accent: ":root[data-game='paddle-rally']", prefix: '' },
  {
    name: 'dark',
    root: ":root[data-theme='dark']",
    accent: ":root[data-theme='dark'][data-game='paddle-rally']",
    prefix: ":root[data-theme='dark'] ",
  },
] as const;

describe('the board’s pairs of shared tokens (docs/PADDLE_RALLY_RULES.md, Visual presentation)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    const base = tokens(sharedCss, theme.root);
    const token = (name: string): string => {
      const value = name === 'accent' ? accent(theme.accent) : base.get(`--${name}`);
      expect(value, `--${name} under ${theme.root}`).toBeDefined();
      return value!;
    };
    /** The token a rule names with var(--x): the theme's own rule first, then the base rule. */
    const picks = (selector: string, property: string): string => {
      const value =
        declared(`${theme.prefix}${selector}`, property) ?? declared(selector, property);
      const name = /^var\(--([\w-]+)\)$/.exec(value ?? '')?.[1];
      expect(name, `${property} of ${selector} under ${theme.root}`).toBeDefined();
      return name!;
    };

    const court = [token('surface'), token('paper')];
    const player = token(picks('.pr-player,\n.pr-ball', 'fill'));
    const cpu = token(picks('.pr-cpu', 'fill'));

    for (const [what, colour] of [
      ['the ball and the player’s paddle', player],
      ['the CPU’s paddle', cpu],
    ] as const) {
      it(`${what} clear 3:1 on both ends of the court (${theme.name})`, () => {
        for (const end of court) {
          // Printed for docs/PADDLE_RALLY_RULES.md; the gate is the 3:1 below.
          console.info(
            `[paddle-rally contrast] ${theme.name} ${what} on ${end}: ${contrast(colour, end).toFixed(2)}`,
          );
          expect(contrast(colour, end), `${what} on ${end}`).toBeGreaterThanOrEqual(3);
        }
      });
    }

    it(`the two paddles weigh about the same, so the rival does not out-shout the player (${theme.name})`, () => {
      console.info(
        `[paddle-rally contrast] ${theme.name} player vs CPU: ${contrast(player, cpu).toFixed(2)}`,
      );
      // Light measures 1.15, dark 1.16; --ink in dark would be about 2.8.
      expect(contrast(player, cpu)).toBeLessThan(1.5);
    });

    it(`the edge line is light on the paddle in light and shade in dark (${theme.name})`, () => {
      const edgeToken = picks('.pr-paddle-edge', 'stroke');
      const edge = token(edgeToken);
      const alpha = Number(
        declared(`${theme.prefix}.pr-paddle-edge`, 'opacity') ??
          declared('.pr-paddle-edge', 'opacity'),
      );
      const transform =
        declared(`${theme.prefix}.pr-paddle-edge`, 'transform') ??
        declared('.pr-paddle-edge', 'transform');
      expect(alpha).toBeGreaterThan(0);
      for (const paddle of [player, cpu]) {
        const shown = blend(edge, paddle, alpha);
        console.info(
          `[paddle-rally contrast] ${theme.name} edge ${edge} at ${alpha} on ${paddle}: ${contrast(shown, paddle).toFixed(2)}`,
        );
        // Lit from above: lighter than the paddle in light, darker in dark.
        if (theme.name === 'light') expect(luminance(shown)).toBeGreaterThan(luminance(paddle));
        else expect(luminance(shown)).toBeLessThan(luminance(paddle));
      }
      // The colour alone does not make the dark line a shade: --surface (the
      // groove it used to be) is darker than both paddles too. What turns a
      // groove cut into the top into the shade along the bottom is that the
      // line moves down 4px, and only in dark.
      if (theme.name === 'light') {
        expect(edgeToken).toBe('surface');
        expect(transform).toBeUndefined();
      } else {
        expect(edgeToken).not.toBe('surface');
        expect(transform).toBe('translateY(4px)');
      }
    });

    it(`the ball’s contact shadow is darker than the court it falls on (${theme.name})`, () => {
      const shadeToken = picks('.pr-ball-shade', 'fill');
      if (theme.name === 'light') {
        // The title's own ring colour, a translucent brown laid over the court.
        expect(shadeToken).toBe('accent-ring');
        const ring = accentRing(theme.accent);
        for (const end of court) {
          const shown = blend(ring.colour, end, ring.alpha);
          console.info(
            `[paddle-rally contrast] light shade ${ring.colour} at ${ring.alpha} on ${end}: ${contrast(shown, end).toFixed(2)}`,
          );
          expect(luminance(shown)).toBeLessThan(luminance(end));
        }
      } else {
        // Dark cannot go darker than --paper, which is the court's own lower
        // end (1.2:1 against the upper end) — all the shade there is.
        expect(shadeToken).toBe('paper');
        console.info(
          `[paddle-rally contrast] dark shade ${token('paper')} on ${token('surface')}: ${contrast(token('paper'), token('surface')).toFixed(2)}`,
        );
        expect(luminance(token('paper'))).toBeLessThan(luminance(token('surface')));
      }
    });

    it(`the ball’s glint is lighter than the ball (${theme.name})`, () => {
      const glint = token(picks('.pr-ball-glint', 'stroke'));
      const alpha = Number(declared('.pr-ball-glint', 'stroke-opacity'));
      expect(alpha).toBeGreaterThan(0);
      const shown = blend(glint, player, alpha);
      console.info(
        `[paddle-rally contrast] ${theme.name} glint ${glint} at ${alpha} on the ball: ${contrast(shown, player).toFixed(2)}`,
      );
      expect(luminance(shown)).toBeGreaterThan(luminance(player));
    });
  }

  it('the board wears the collection’s frame, lift first', () => {
    // The same recipe as every other board (docs/BRAND.md): the lift, a paper
    // ring and its hairline, then the title-tinted glow. Order matters — the
    // shadows stack front to back.
    const frame = declared('.pr-board', 'box-shadow')?.replace(/\s+/g, ' ');
    expect(frame).toBe(
      '0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft)',
    );
  });

  it('writes no colour literal anywhere: every colour is a shared token', () => {
    // A literal would be a colour the tests above do not measure, and
    // css-split.md lists this stylesheet on the "writes no colour" side.
    expect(gameCss.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
  });
});
