/**
 * The gems are drawn straight on --surface (gem-swap.css): the six gem
 * colours, the selection ring in the accent, the focus ring in --ink. The
 * stylesheet promises each clears 3:1 there in its theme — the WCAG floor for
 * graphical objects (docs/BRAND.md「コントラスト」) — so it is measured here
 * from the stylesheets rather than trusted to a comment
 * (docs/GEM_SWAP_RULES.md §10).
 *
 * The texture on top of the gems — a lit face, a hairline edge, a cast shadow
 * and the board's frame — carries no meaning (the cut is the shape that
 * counts), so it has no 3:1 to clear. What is pinned instead is where the
 * light comes from: the colours are aliases of the shared theme tokens, never
 * literals, and in both themes the lit side is lighter than the shaded one.
 * The selected gem is the exception: it is the ring alone, with no edge and no
 * shadow, so no texture reaches the ring.
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

  it('keeps every colour literal inside the two blocks at the top', () => {
    // The lit face, the edge and the shadow use aliases of the shared tokens
    // (--gs-glint, --gs-shade), so nothing below the two blocks names a colour.
    let outside = gameCss;
    for (const header of THEMES.map((theme) => `\n${theme.gems}`)) {
      outside = outside.replace(block(gameCss, header), '');
    }
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
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

/** What `--name: var(--other)` in the theme's top block points at, resolved in the shared tokens. */
function aliasOf(theme: (typeof THEMES)[number], name: string): string {
  const reference = new RegExp(`${name}:\\s*var\\((--[\\w-]+)\\)\\s*;`).exec(
    block(gameCss, `\n${theme.gems}`),
  )?.[1];
  expect(reference, `${name} under ${theme.gems}`).toBeDefined();
  const value = tokens(sharedCss, theme.base).get(reference!);
  expect(value, `${reference} under ${theme.base}`).toBeDefined();
  return value!;
}

/** A number token such as `--gs-cast-alpha: 0.26;` in the theme's top block. */
function numberOf(theme: (typeof THEMES)[number], name: string): number {
  const value = new RegExp(`${name}:\\s*([0-9.]+)\\s*;`).exec(
    block(gameCss, `\n${theme.gems}`),
  )?.[1];
  expect(value, `${name} under ${theme.gems}`).toBeDefined();
  return Number(value);
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

describe('the light on the gems comes from above, in both themes (docs/GEM_SWAP_RULES.md §10)', () => {
  for (const theme of THEMES) {
    it(`lights the facet with the lighter token and shades with the darker (${theme.name})`, () => {
      const base = tokens(sharedCss, theme.base);
      const surface = base.get('--surface')!;
      const glint = aliasOf(theme, '--gs-glint');
      const shade = aliasOf(theme, '--gs-shade');
      expect(luminance(glint)).toBeGreaterThan(luminance(shade));
      // The shadow falls on a tile, so it must be darker than the tile.
      expect(luminance(shade)).toBeLessThan(luminance(surface));
      // The lit face is lighter than every gem it sits on.
      const gems = tokens(gameCss, theme.gems);
      for (let kind = 0; kind < 6; kind++) {
        expect(luminance(glint), `--gs-gem-${kind}`).toBeGreaterThan(
          luminance(gems.get(`--gs-gem-${kind}`)!),
        );
      }
    });

    it(`lets the shade show on the tile, as an edge and as a shadow (${theme.name})`, () => {
      const surface = tokens(sharedCss, theme.base).get('--surface')!;
      const shade = aliasOf(theme, '--gs-shade');
      for (const name of ['--gs-edge-alpha', '--gs-cast-alpha']) {
        const alpha = numberOf(theme, name);
        expect(alpha, name).toBeGreaterThan(0);
        expect(alpha, name).toBeLessThanOrEqual(1);
        // Printed for docs/GEM_SWAP_RULES.md §10; the gate is that the cue
        // exists at all — it is texture, not a mark that carries meaning. The
        // dark edge is held at 0.5 on purpose (1.10 on the tile): stronger, it
        // read as a black outline round a pale gem, not as an edge.
        const ratio = contrast(laid(shade, surface, alpha), surface);
        console.info(`[gem-swap contrast] ${theme.name} ${name} ${alpha}: ${ratio.toFixed(2)}`);
        expect(ratio, name).toBeGreaterThanOrEqual(1.05);
      }
    });

    it(`keeps each gem apart from the edge and the shadow laid beside it (${theme.name})`, () => {
      // The edge and the shadow are what a gem's outline now touches, in place
      // of the bare tile, so the gems' 3:1 on --surface is not what stands
      // beside them. The cut is the shape that counts and it also meets the
      // tile outside the shadow, so the floor is 2:1, not 3:1; four of the six
      // light gems are under 3:1 against the shadow, and §10 says so.
      const surface = tokens(sharedCss, theme.base).get('--surface')!;
      const shade = aliasOf(theme, '--gs-shade');
      const gems = tokens(gameCss, theme.gems);
      for (const name of ['--gs-edge-alpha', '--gs-cast-alpha']) {
        const beside = laid(shade, surface, numberOf(theme, name));
        const ratios = [0, 1, 2, 3, 4, 5].map((kind) =>
          contrast(gems.get(`--gs-gem-${kind}`)!, beside),
        );
        console.info(
          `[gem-swap contrast] ${theme.name} the six gems against ${name}: ${ratios.map((ratio) => ratio.toFixed(2)).join(' ')}`,
        );
        for (const ratio of ratios) expect(ratio, name).toBeGreaterThanOrEqual(2);
      }
    });

    it(`lets the glint show on every gem, as a face and as a line round it (${theme.name})`, () => {
      const glint = aliasOf(theme, '--gs-glint');
      const gems = tokens(gameCss, theme.gems);
      // The same cue, measured on the six gems; the floor is "visible at all".
      const floors = { '--gs-face-alpha': 1.05, '--gs-facet-alpha': 1.15 } as const;
      for (const [name, floor] of Object.entries(floors)) {
        const alpha = numberOf(theme, name);
        expect(alpha, name).toBeGreaterThan(0);
        expect(alpha, name).toBeLessThanOrEqual(1);
        const ratios = [0, 1, 2, 3, 4, 5].map((kind) => {
          const gem = gems.get(`--gs-gem-${kind}`)!;
          return contrast(laid(glint, gem, alpha), gem);
        });
        console.info(
          `[gem-swap contrast] ${theme.name} ${name} ${alpha} on the six gems: ${ratios.map((ratio) => ratio.toFixed(2)).join(' ')}`,
        );
        for (const ratio of ratios) expect(ratio, name).toBeGreaterThanOrEqual(floor);
      }
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

/**
 * Every top-level rule of the game's stylesheet as [selector list, body], whitespace
 * collapsed. Comments and at-rule blocks (@media, @keyframes) are left out, so a
 * selector inside them is never taken for a top-level one.
 */
const RULES: ReadonlyArray<readonly [string, string]> = [
  ...gameCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@[\w-]+[^{;]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
    .matchAll(/([^{}]+)\{([^{}]*)\}/g),
].map((match) => [match[1]!.replace(/\s+/g, ' ').trim(), match[2]!.replace(/\s+/g, ' ').trim()]);

/**
 * The bodies of every rule whose selector list is exactly the given selector(s), in
 * order. A rule that merely shares a list with the selector (the board's width sits
 * in `.gs-status, .gs-board`) is a different rule and is not read as the selector's.
 */
function rulesOf(...selectors: string[]): string {
  const list = selectors.join(', ');
  const bodies = RULES.filter(([selector]) => selector === list).map(([, body]) => body);
  expect(bodies.length, `${list} is missing`).toBeGreaterThan(0);
  return bodies.join(' ');
}

describe('the board’s frame and the tiles’ dish (docs/GEM_SWAP_RULES.md §9, §10)', () => {
  it('draws the collection’s board frame on the board, the lift first, without its glow', () => {
    // The fourth layer of the recipe (0 8px 18px var(--accent-ring-soft)) is left
    // out: `.gs-body` clips at its 8px of bottom padding, and on a short phone the
    // glow ended in a straight line there (§9). The three layers kept reach 4px.
    expect(rulesOf('.gs-board')).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line);',
    );
    expect(rulesOf('.gs-board')).not.toContain('accent-ring-soft');
    expect(rulesOf('.gs-body')).toContain('padding: 0 12px 8px;');
  });

  it('sinks every tile into a shallow dish, in the game and in the Quick Rules figure', () => {
    for (const selector of ['.gs-cell::before', '.gs-fig-cell::before']) {
      expect(rulesOf(selector), selector).toContain('box-shadow: inset 0 1.5px 2px var(--line);');
    }
  });

  it('lets the selection ring and the empty outline replace the dish by coming after it', () => {
    // Same specificity, so the later rule wins; moving either above the dish
    // would put the dish's shadow back over the ring.
    const at = (header: string) => gameCss.indexOf(`\n${header} {`);
    expect(at('.gs-cell-selected::before')).toBeGreaterThan(at('.gs-cell::before'));
    expect(at('.gs-fig-cell-marked::before')).toBeGreaterThan(at('.gs-fig-cell::before'));
    expect(at('.gs-fig-cell-empty::before')).toBeGreaterThan(at('.gs-fig-cell::before'));
    expect(rulesOf('.gs-cell-selected::before')).toContain(
      'box-shadow: inset 0 0 0 3px var(--accent);',
    );
  });

  it('keeps the texture light enough for a gem that moves every beat', () => {
    // No blur on a moving element, and nothing the old Android WebView lacks.
    expect(gameCss).not.toMatch(/\bfilter\s*:/);
    expect(gameCss).not.toMatch(/:has\(|color-mix\(|container-type/);
    // The shadow is the gem's own outline pushed down, and the edge is painted under the fill.
    expect(rulesOf('.gs-gem-shade')).toContain('transform: translate(0, 5px);');
    expect(rulesOf('.gs-gem-body')).toContain('paint-order: stroke;');
  });

  it('adds no motion: nothing the texture does is a transition or an animation', () => {
    for (const selector of ['.gs-gem', '.gs-gem-body', '.gs-gem-facet', '.gs-gem-shade']) {
      expect(rulesOf(selector), selector).not.toMatch(/\b(?:transition|animation)\s*:/);
    }
  });

  it('leaves a selected gem as the ring alone: no edge, no shadow, no lift', () => {
    // The ring's inner edge is 4.5px from the cell edge and a gem's tip stands
    // 4.7px in on the smallest board, so any edge, shadow or lift crosses it —
    // seen in the dark theme, where the shade is near black on a pale ring.
    const body = ['.gs-cell-selected .gs-gem-body', '.gs-fig-cell-marked .gs-gem-body'];
    const shade = ['.gs-cell-selected .gs-gem-shade', '.gs-fig-cell-marked .gs-gem-shade'];
    expect(rulesOf(...body)).toContain('stroke-opacity: 0;');
    expect(rulesOf(...shade)).toContain('fill-opacity: 0;');
    // One class more specific than the rules they switch off, and after them.
    const order = (...selectors: string[]) =>
      RULES.findIndex(([selector]) => selector === selectors.join(', '));
    expect(specificity(body[0]!)).toEqual([0, 2, 0]);
    expect(specificity('.gs-gem-body')).toEqual([0, 1, 0]);
    expect(order(...body)).toBeGreaterThan(order('.gs-gem-body'));
    expect(order(...shade)).toBeGreaterThan(order('.gs-gem-shade'));
    // Nothing moves the gem or its shadow when it is chosen.
    for (const [selector, declarations] of RULES) {
      if (/\.gs-(?:cell-selected|fig-cell-marked)\b/.test(selector)) {
        expect(declarations, selector).not.toMatch(/\btransform\b|\btranslate/);
      }
    }
  });
});

describe('forced colours (docs/GEM_SWAP_RULES.md §9, §10)', () => {
  // jsdom computes no style, so the rules a forced palette leaves standing
  // are pinned here as text: it repaints backgrounds as Canvas and drops
  // box-shadows, so every mark drawn that way opts out and is redrawn in a
  // system colour.
  const forced = block(gameCss, '@media (forced-colors: active)').replace(/\s+/g, ' ');

  it('draws every gem in CanvasText, over the per-kind fills', () => {
    expect(forced).toContain('svg.gs-gem .gs-gem-body { fill: CanvasText; stroke: none; }');
    // Ahead on specificity, so the order of the file does not decide it.
    expect(specificity('svg.gs-gem .gs-gem-body')).toEqual([0, 2, 1]);
    for (let kind = 0; kind < 6; kind++) {
      expect(gameCss).toContain(`.gs-gem-${kind} .gs-gem-body {`);
      expect(specificity(`.gs-gem-${kind} .gs-gem-body`)).toEqual([0, 2, 0]);
    }
    // No other rule for the body outranks it, whether its selector list is on
    // one line or several.
    for (const [list] of RULES) {
      for (const selector of list.split(',').map((part) => part.trim())) {
        if (!selector.endsWith('.gs-gem-body')) continue;
        const [ids, classes, types] = specificity(selector);
        expect(ids * 10_000 + classes * 100 + types, selector).toBeLessThan(201);
      }
    }
  });

  it('drops the texture that rides on the shade and glint colours', () => {
    // The edge's stroke goes (in the rule above, with the fill), the facet keeps
    // its line at the width it had before the texture, and the shadow is not drawn.
    expect(forced).toContain(
      'svg.gs-gem .gs-gem-facet { fill: none; stroke: Canvas; stroke-width: 4; }',
    );
    expect(forced).toContain('.gs-gem-shade { display: none; }');
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
