/**
 * The gems are drawn straight on --surface (gem-swap.css): the six gem
 * colours, the selection ring in the accent, the focus ring in --ink. The
 * stylesheet promises each clears 3:1 there in its theme — the WCAG floor for
 * graphical objects (docs/BRAND.md「コントラスト」) — so it is measured here
 * from the stylesheets rather than trusted to a comment
 * (docs/GEM_SWAP_RULES.md §10).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/gem-swap/ui/gem-swap.css'), 'utf8');

/** The #rrggbb custom properties declared in the first rule whose selector list starts so. */
function tokens(source: string, selector: string): Map<string, string> {
  const start = source.indexOf(`\n${selector}`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out.set(match[1]!, match[2]!.toLowerCase());
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

const THEMES = [
  { name: 'light', base: ':root {', accent: ":root[data-game='gem-swap'],", gems: ':root {' },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='gem-swap'],",
    gems: ":root[data-theme='dark'] {",
  },
] as const;

describe('the gems and rings on --surface (docs/BRAND.md「コントラスト」)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('writes colour only in the six gem tokens', () => {
    const literals = gameCss.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(literals).toHaveLength(12);
    const declared = [...tokens(gameCss, ':root {').values()];
    expect(declared).toHaveLength(6);
  });

  for (const theme of THEMES) {
    it(`clears 3:1 for all six gems, the selection and the focus ring (${theme.name})`, () => {
      const base = tokens(sharedCss, theme.base);
      const surface = base.get('--surface')!;
      const gems = tokens(gameCss, theme.gems);
      for (let kind = 0; kind < 6; kind++) {
        const colour = gems.get(`--gs-gem-${kind}`);
        expect(colour, `--gs-gem-${kind}`).toBeDefined();
        expect(contrast(colour!, surface), `--gs-gem-${kind}`).toBeGreaterThanOrEqual(3);
      }
      const accent = tokens(sharedCss, theme.accent).get('--accent');
      expect(contrast(accent!, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(base.get('--ink')!, surface)).toBeGreaterThanOrEqual(3);
    });
  }
});

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

/** Specificity of a simple compound-descendant selector, as [ids, classes, types]. */
function specificity(selector: string): [number, number, number] {
  const classes = (selector.match(/\.[\w-]+|::?[\w-]+|\[[^\]]+\]/g) ?? []).filter(
    (part) => !part.startsWith('::'),
  ).length;
  const types = selector
    .split(/\s+/)
    .filter((part) => /^[a-z]/i.test(part) || part.includes('::')).length;
  return [(selector.match(/#[\w-]+/g) ?? []).length, classes, types];
}

describe('forced colours (docs/GEM_SWAP_RULES.md §9, §10)', () => {
  // jsdom computes no style, so the rules a forced palette leaves standing
  // are pinned here as text: it repaints backgrounds as Canvas and drops
  // box-shadows, so every mark drawn that way opts out and is redrawn in a
  // system colour.
  const forced = block(gameCss, '@media (forced-colors: active)').replace(/\s+/g, ' ');

  it('draws every gem in CanvasText, over the per-kind fills', () => {
    expect(forced).toContain('svg.gs-gem .gs-gem-body { fill: CanvasText; }');
    // Ahead on specificity, so the order of the file does not decide it.
    expect(specificity('svg.gs-gem .gs-gem-body')).toEqual([0, 2, 1]);
    for (let kind = 0; kind < 6; kind++) {
      expect(gameCss).toContain(`.gs-gem-${kind} .gs-gem-body {`);
      expect(specificity(`.gs-gem-${kind} .gs-gem-body`)).toEqual([0, 2, 0]);
    }
    // No other rule for the body outranks it.
    for (const match of gameCss.matchAll(/^([^{}@/\n][^{}\n]*)\{/gm)) {
      for (const selector of match[1]!.split(',').map((part) => part.trim())) {
        if (!selector.endsWith('.gs-gem-body') || selector === 'svg.gs-gem .gs-gem-body') continue;
        const [ids, classes, types] = specificity(selector);
        expect(ids * 10_000 + classes * 100 + types, selector).toBeLessThan(201);
      }
    }
  });

  it('keeps the selection a Highlight ring, in the game and in the Quick Rules figure', () => {
    expect(forced).toContain(
      '.gs-cell-selected::before, .gs-fig-cell-marked::before, .gs-fig-cell-empty::before, .gs-bar-seg { forced-color-adjust: none; }',
    );
    expect(forced).toContain(
      '.gs-cell-selected::before, .gs-fig-cell-marked::before { background: Canvas; box-shadow: inset 0 0 0 3px Highlight; }',
    );
  });

  it('keeps the bar of swaps left: a remaining swap filled, a used one outlined', () => {
    expect(forced).toContain('.gs-bar-seg { box-shadow: inset 0 0 0 1px CanvasText; }');
    expect(forced).toContain('.gs-bar-seg-left { background: CanvasText; }');
  });
});

describe('the replay (docs/GEM_SWAP_RULES.md §10)', () => {
  it('lifts a gem on its way above the tiles it passes', () => {
    // Tiles are positioned ::before boxes painted in board order; without a
    // z-index a gem sliding left or up passes under its neighbour's tile.
    expect(block(gameCss, '\n.gs-slot-arrive {')).toMatch(/z-index:\s*1;/);
    expect(block(gameCss, '\n.gs-cell {')).not.toMatch(/z-index/);
    expect(block(gameCss, '\n.gs-cell::before {')).not.toMatch(/z-index/);
  });
});
