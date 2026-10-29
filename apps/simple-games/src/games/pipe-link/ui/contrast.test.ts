/**
 * The board's colours (docs/PIPE_LINK_RULES.md §10). Pipe Link owns no colour:
 * ui/pipe-link.css reads the series tokens and the title's accent only, so
 * there is no block of its own to measure — the measure is taken from
 * src/ui/styles.css, for the pairs that carry meaning, in both themes, at
 * WCAG's 3:1 floor for graphical objects. A comment that says "the pipe reads"
 * is not a check: with `css: false` in the test setup nothing rendered can
 * notice a token edit that sinks a pipe into the ground, so this file does.
 *
 * What carries meaning is shape first and colour second (§10): an unlit pipe
 * is an --ink-soft outline round a groove sunk below the ground, a lit one the
 * accent in the same tube. The groove is a depth cue, not a signal — the
 * outline is what defines the tube — so it is asserted to sit below the
 * ground, not to clear 3:1 against it.
 *
 * It also pins the CSS that the look rests on, because a stylesheet edit
 * cannot fail a jsdom render: no colour literal at all, the outline and core
 * colours of both states, the faint wall of a lit pipe, the solved wash painted
 * behind the pipes, the series' board frame with the lift first, and every
 * Reduced Motion route switching off what this look adds. The one thing it pins
 * in the markup is the core drawn twice: the 0.4 wall no longer underlays the
 * core, so a single coat lets a hairline show between tiles at a fractional
 * cell (§10, the seam).
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PipeGlyph } from './components/PipeGlyph';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/pipe-link/ui/pipe-link.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule that opens with exactly this selector. */
function body(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

/**
 * A `#rrggbb` custom property from the shared stylesheet's rule that opens
 * with `opener` — a selector, or the first line of a selector list, whose `{`
 * may be on a later line (the accent blocks).
 */
function token(opener: string, name: string): string {
  const start = sharedCss.indexOf(`\n${opener}`);
  expect(start, `${opener} is missing`).toBeGreaterThan(-1);
  const rule = sharedCss.slice(sharedCss.indexOf('{', start) + 1, sharedCss.indexOf('}', start));
  const value = new RegExp(`${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(rule)?.[1];
  expect(value, `${name} under ${opener}`).toBeDefined();
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
  { name: 'light', base: ':root', accent: ":root[data-game='pipe-link']," },
  {
    name: 'dark',
    base: ":root[data-theme='dark']",
    accent: ":root[data-theme='dark'][data-game='pipe-link'],",
  },
] as const;

describe('the pipes’ colours (docs/PIPE_LINK_RULES.md §10)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    const ground = token(theme.base, '--surface');
    const groove = token(theme.base, '--surface-recessed');
    const outline = token(theme.base, '--ink-soft');
    const accent = token(theme.accent, '--accent');
    const wash = token(theme.accent, '--accent-soft');

    const pairs: Record<string, readonly [string, string]> = {
      // Printed for §10; the gate is the 3:1 below.
      'an unlit pipe’s outline on the ground': [outline, ground],
      'an unlit pipe’s outline against its groove': [outline, groove],
      // The source's dot is parted from a lit pipe by a halo in the ground
      // colour, so this is the pair that separates it too.
      'a lit pipe’s core on the ground': [accent, ground],
      'a lit pipe’s core on the solved wash at its peak': [accent, wash],
    };
    for (const [what, [a, b]] of Object.entries(pairs)) {
      it(`${what} clears 3:1 (${theme.name})`, () => {
        console.info(`[pipe-link contrast] ${theme.name} ${what}: ${contrast(a, b).toFixed(2)}`);
        expect(contrast(a, b)).toBeGreaterThanOrEqual(3);
      });
    }

    it(`sinks the groove below the ground (${theme.name})`, () => {
      console.info(
        `[pipe-link contrast] ${theme.name} groove against the ground: ${contrast(groove, ground).toFixed(2)}`,
      );
      expect(luminance(groove)).toBeLessThan(luminance(ground));
    });
  }
});

describe('the stylesheet the look rests on (docs/PIPE_LINK_RULES.md §10)', () => {
  it('writes no colour literal — every colour is a token', () => {
    expect(code.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
  });

  it('sinks an unlit pipe’s core and thins a lit pipe’s outline to a wall', () => {
    // The outline tokens are what the 3:1 pairs above measure, so a rename to
    // a fainter token would pass the pairs and sink the pipe into the ground.
    expect(body(code, '.pn-tile')).toContain('--pn-edge: var(--ink-soft);');
    expect(body(code, '.pn-tile-lit')).toContain('--pn-edge: var(--accent);');
    expect(body(code, '.pn-tile')).toContain('--pn-core: var(--surface-recessed);');
    expect(body(code, '.pn-tile-lit')).toContain('--pn-core: var(--accent);');
    // One group at 0.4, not 0.4 on each shape, so overlaps do not darken it.
    expect(body(code, '.pn-tile-lit .pn-pipe-edge')).toContain('opacity: 0.4;');
    expect(body(code, '.pn-pipe-edge')).toContain('fill: var(--pn-edge);');
    expect(body(code, '.pn-pipe-core')).toContain('fill: var(--pn-core);');
  });

  it('keeps the series’ board frame, the lift first so it shows, under an inner bottom edge', () => {
    const shadow = body(code, '.pn-board').replace(/\s+/g, ' ');
    expect(shadow).toContain(
      'inset 0 -3px 0 var(--surface-recessed), 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft)',
    );
    // The Quick Rules figure is the board, smaller: the same frame without the glow.
    expect(body(code, '.pn-figure').replace(/\s+/g, ' ')).toContain(
      'inset 0 -3px 0 var(--surface-recessed), 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line);',
    );
  });

  it('paints the solved wash behind the pipes, at full strength at its peak', () => {
    // `::before` paints first and the tiles after it; an `::after` would fade
    // the pipes the player has just finished.
    expect(code).not.toMatch(/\.pn-board(-solved)?::after/);
    expect(body(code, '.pn-board::before')).toContain('background: var(--accent-soft);');
    expect(body(code, '.pn-board-solved::before')).toContain('animation: pn-solved-wash');
    const peak = /@keyframes pn-solved-wash\s*\{[\s\S]*?30%\s*\{\s*opacity:\s*([\d.]+);/.exec(code);
    expect(peak?.[1]).toBe('1');
  });

  it('switches the turn, the light and the wash off under every Reduced Motion route', () => {
    const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selectors: match[1]!.split(',').map((selector) => selector.trim()),
      body: match[2]!.replace(/\s+/g, ' ').trim(),
    }));
    const has = (selectors: string[], declaration: string): boolean =>
      rules.some((rule) => rule.selectors.join() === selectors.join() && rule.body === declaration);

    const root = ":root[data-reduced-motion='true']";
    const moving = ['.pn-pipes', '.pn-pipe-edge', '.pn-pipe-core'];
    // The board's own useReducedMotion class, the OS preference, the app setting.
    expect(
      has(
        moving.map((part) => `.pn-board-still ${part}`),
        'transition: none;',
      ),
    ).toBe(true);
    expect(has(moving, 'transition: none;')).toBe(true);
    expect(
      has(
        moving.map((part) => `${root} ${part}`),
        'transition: none;',
      ),
    ).toBe(true);
    expect(has(['.pn-board-solved::before'], 'animation: none;')).toBe(true);
    expect(has([`${root} .pn-board-solved::before`], 'animation: none;')).toBe(true);
  });
});

describe('the tile’s drawing (docs/PIPE_LINK_RULES.md §10)', () => {
  afterEach(cleanup);

  it('lays the core down twice over one edge, so no hairline shows between fractional tiles', () => {
    for (const lit of [false, true]) {
      const { container, unmount } = render(
        createElement(PipeGlyph, { type: 'elbow', turns: 1, lit }),
      );
      const edges = container.querySelectorAll('.pn-pipe-edge');
      const cores = container.querySelectorAll('.pn-pipe-core');
      expect(edges).toHaveLength(1);
      expect(cores).toHaveLength(2);
      // The same shapes in both coats, so the second lands exactly on the first.
      expect(cores[1]!.innerHTML).toBe(cores[0]!.innerHTML);
      expect(cores[0]!.innerHTML).toBe(edges[0]!.innerHTML);
      unmount();
    }
  });
});
