/**
 * The board is drawn on --surface (docs/INVADERS_RULES.md §8, §11): the
 * invaders in the accent, the ship and the player's shot in the ink, the
 * bunkers and the defence line in the soft ink. The stylesheet writes no
 * colour literal of its own, so what it promises is measured here from the
 * stylesheets, against the shared tokens, rather than trusted to a comment:
 * every mark that carries meaning clears 3:1 — the WCAG floor for graphical
 * objects (docs/BRAND.md「コントラスト」) — in both themes.
 *
 * Which token paints which mark is read from the rules themselves (the
 * invaders' `color`, the shots' `stroke`, ...), so pointing a mark at a
 * different token changes what is measured instead of slipping past a
 * hard-coded list.
 *
 * The texture on top — the cast shadow under an invader, the lit top and
 * shaded foot of a bunker, the recess of the rail, the board's frame —
 * carries no meaning (the shape, the crack and the dashes do), so it has no
 * 3:1 to clear. What is pinned instead is where the light comes from: the
 * colours are aliases of shared tokens, never literals, and in both themes
 * the lit side is lighter than the shaded one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/invaders/ui/invaders.css'), 'utf8');

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

/** The body of the first rule whose header is exactly `selector`, braces balanced. */
function block(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    if (source[at] === '}' && --depth === 0) return source.slice(open + 1, at);
  }
  throw new Error(`${selector} is not closed`);
}

/** The normalised bodies of every rule whose selector starts a line as `selector {`. */
function rulesOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodies = [...gameCss.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))];
  expect(bodies.length, `${selector} is missing`).toBeGreaterThan(0);
  return bodies.map((match) => match[1]!.replace(/\s+/g, ' ')).join(' ');
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
  { name: 'light', base: ':root', accent: ":root[data-game='invaders'],", own: ':root' },
  {
    name: 'dark',
    base: ":root[data-theme='dark']",
    accent: ":root[data-theme='dark'][data-game='invaders'],",
    own: ":root[data-theme='dark']",
  },
] as const;
type Theme = (typeof THEMES)[number];

/** The --accent the shell stamps for this game: `:root[data-game='invaders'],` opens the rule. */
function accentOf(theme: Theme): string {
  const start = sharedCss.indexOf(`\n${theme.accent}`);
  expect(start, `${theme.accent} is missing`).toBeGreaterThan(-1);
  const body = sharedCss.slice(sharedCss.indexOf('{', start) + 1, sharedCss.indexOf('}', start));
  const value = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(body)?.[1];
  expect(value, `--accent under ${theme.accent}`).toBeDefined();
  return value!.toLowerCase();
}

/** What `--name: var(--other)` in the theme's top block points at, resolved in the shared tokens. */
function aliasOf(theme: Theme, name: string): string {
  const reference = new RegExp(`${name}:\\s*var\\((--[\\w-]+)\\)\\s*;`).exec(
    block(gameCss, theme.own),
  )?.[1];
  expect(reference, `${name} under ${theme.own}`).toBeDefined();
  const value = tokens(sharedCss, theme.base).get(reference!);
  expect(value, `${reference} under ${theme.base}`).toBeDefined();
  return value!;
}

/** A number token such as `--iv-defense-alpha: 0.75;` in the theme's top block. */
function numberOf(theme: Theme, name: string): number {
  const value = new RegExp(`${name}:\\s*([0-9.]+)\\s*;`).exec(block(gameCss, theme.own))?.[1];
  expect(value, `${name} under ${theme.own}`).toBeDefined();
  return Number(value);
}

/** The custom property a rule paints with, e.g. `.iv-enemy { color: var(--accent) }` → `--accent`. */
function paintOf(selector: string, property: string): string {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*var\\((--[\\w-]+)\\)`).exec(
    rulesOf(selector),
  );
  expect(match, `${selector} { ${property}: var(--…) }`).not.toBeNull();
  return match![1]!;
}

/** What a shared token (or the shell's per-game --accent) is in this theme. */
function colourOf(theme: Theme, name: string): string {
  const value = name === '--accent' ? accentOf(theme) : tokens(sharedCss, theme.base).get(name);
  expect(value, `${name} under ${theme.base}`).toBeDefined();
  return value!;
}

describe('the marks that carry meaning, on the floor (docs/INVADERS_RULES.md §11)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    // The floor is --surface from the first 12% of the tray down (Board.tsx): the
    // defence line, the bunkers, the ship and every invader that matters are below it.
    const base = tokens(sharedCss, theme.base);
    const surface = base.get('--surface')!;

    it(`clears 3:1 for the invaders, the ship, the bunkers and the shots (${theme.name})`, () => {
      // Read from the rules: the ship is drawn in currentColor, so it takes the board's `color`.
      const marks = {
        'an invader (accent)': paintOf('.iv-enemy', 'color'),
        'the enemy shot (accent)': paintOf('.iv-enemy-shot', 'stroke'),
        'the ship (ink)': paintOf('.iv-board', 'color'),
        'the player shot (ink)': paintOf('.iv-player-shot', 'stroke'),
        'a bunker and the damaged outline (soft ink)': paintOf('.iv-cover', 'color'),
      };
      // The tokens are pinned as well as measured: a swap is a design change, not a no-op.
      expect(Object.values(marks)).toEqual([
        '--accent',
        '--accent',
        '--ink',
        '--ink',
        '--ink-soft',
      ]);
      for (const [what, name] of Object.entries(marks)) {
        const ratio = contrast(colourOf(theme, name), surface);
        console.info(`[invaders contrast] ${theme.name} ${what} on the floor: ${ratio.toFixed(2)}`);
        expect(ratio, what).toBeGreaterThanOrEqual(3);
      }
    });

    it(`clears 3:1 for the defence line at its opacity (${theme.name})`, () => {
      const alpha = numberOf(theme, '--iv-defense-alpha');
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
      const line = colourOf(theme, paintOf('.iv-defense-line', 'stroke'));
      const ratio = contrast(laid(line, surface, alpha), surface);
      // Printed for docs/INVADERS_RULES.md §11; the gate is the 3:1.
      console.info(`[invaders contrast] ${theme.name} defence line ${alpha}: ${ratio.toFixed(2)}`);
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  }

  it('draws the defence line in the soft ink, not in a token no stylesheet defines', () => {
    const rule = rulesOf('.iv-defense-line');
    expect(rule).toContain('stroke: var(--ink-soft);');
    expect(rule).toContain('opacity: var(--iv-defense-alpha);');
    expect(rule).toContain('stroke-dasharray: 3 6;');
    // It once named --line-strong, which is declared nowhere, and fell back to --line.
    expect(gameCss).not.toContain('--line-strong');
  });

  it('declares every custom property it reads, here or in the shared tokens', () => {
    const declared = new Set(
      [...(gameCss + sharedCss).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]!),
    );
    const used = [...gameCss.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]!);
    expect(used.filter((name) => !declared.has(name))).toEqual([]);
    expect(used.length).toBeGreaterThan(10);
  });
});

describe('the light on the tray comes from above, in both themes (docs/INVADERS_RULES.md §8, §11)', () => {
  it('keeps every colour literal out: the aliases are the only colours it names', () => {
    expect(gameCss.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(gameCss.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
  });

  for (const theme of THEMES) {
    const base = tokens(sharedCss, theme.base);
    const surface = base.get('--surface')!;

    it(`drops the invader's shadow below the floor's brightness (${theme.name})`, () => {
      const shade = aliasOf(theme, '--iv-shade');
      // A shadow is darker than what it falls on.
      expect(luminance(shade)).toBeLessThan(luminance(surface));
      const ratio = contrast(shade, surface);
      console.info(
        `[invaders contrast] ${theme.name} invader shadow on the floor: ${ratio.toFixed(2)}`,
      );
      // Texture, not a mark: the gate is that the cue exists at all.
      expect(ratio).toBeGreaterThanOrEqual(1.1);
    });

    it(`sinks the rail below the floor and the top of the tray deeper still (${theme.name})`, () => {
      const recessed = base.get('--surface-recessed')!;
      expect(luminance(recessed)).toBeLessThan(luminance(surface));
      const ratio = contrast(recessed, surface);
      console.info(
        `[invaders contrast] ${theme.name} rail and top wall on the floor: ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(1.05);
    });

    it(`lights a bunker's top and shades its foot (${theme.name})`, () => {
      const cover = base.get('--ink-soft')!;
      const hi = aliasOf(theme, '--iv-cover-hi');
      const lo = aliasOf(theme, '--iv-cover-lo');
      expect(luminance(hi)).toBeGreaterThan(luminance(lo));
      const lit = laid(hi, cover, numberOf(theme, '--iv-cover-hi-alpha'));
      const shaded = laid(lo, cover, numberOf(theme, '--iv-cover-lo-alpha'));
      expect(luminance(lit)).toBeGreaterThan(luminance(cover));
      expect(luminance(shaded)).toBeLessThan(luminance(cover));
      const ratios = [contrast(lit, cover), contrast(shaded, cover)];
      console.info(
        `[invaders contrast] ${theme.name} bunker top / foot on the block: ${ratios.map((ratio) => ratio.toFixed(2)).join(' / ')}`,
      );
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(1.3);
    });
  }
});

describe('the tray is static and light enough for a board that repaints every frame', () => {
  it('puts the collection frame on the board box, the lift first', () => {
    const rule = rulesOf('.iv-board');
    expect(rule).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
    // The frame hugs the drawing only while the box keeps the viewBox's 3:4: auto size, capped by the field.
    expect(rule).toContain('width: auto;');
    expect(rule).toContain('height: auto;');
    expect(rule).toContain('max-width: 100%;');
    expect(rule).toContain('max-height: 100%;');
    // The edge a missed shot leaves through (game/index.ts runs it to y = 495).
    expect(rule).toContain('overflow: hidden;');
    expect(rulesOf('.iv-field')).toContain('display: flex;');
  });

  it('sinks the rail into the recessed surface and draws no second lift inside the SVG', () => {
    expect(rulesOf('.iv-track')).toContain('fill: var(--surface-recessed);');
    // The thickness is the frame's; a lift drawn in the SVG as well would be a double.
    expect(gameCss).not.toContain('iv-field-lift');
  });

  it('gives the HUD the 2px lift the keys carry', () => {
    expect(rulesOf('.iv-metrics > span')).toContain('box-shadow: 0 2px 0 var(--line);');
  });

  it('rims the ship in the floor colour, painted under the fill', () => {
    const rule = rulesOf('.iv-ship > path');
    expect(rule).toContain('paint-order: stroke;');
    expect(rule).toContain('stroke: var(--surface);');
  });

  it('thins a damaged block to a pale body and takes the lit top and the foot off it', () => {
    expect(rulesOf('.iv-cover-1 rect')).toContain('fill-opacity: 0.14;');
    // The two lines are drawn only for a whole block (Board.tsx), so a hit removes them.
    expect(gameCss).not.toContain('.iv-cover-1 .iv-cover-hi');
  });

  it('uses no filter, no motion and nothing the old Android WebView lacks', () => {
    expect(gameCss).not.toMatch(/\bfilter\s*:/);
    expect(gameCss).not.toMatch(/\banimation\b|\btransition\b|@keyframes/);
    expect(gameCss).not.toMatch(/:has\(|container-type|color-mix\(/);
  });
});
