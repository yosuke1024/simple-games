/**
 * The tray, the pegs and the disks are physical wood, so their colours are
 * this game's own (hanoi-towers.css, docs/HANOI_TOWERS_RULES.md "Visual
 * presentation"): two token blocks at the top of the stylesheet, light and
 * dark. The rules promise that what carries meaning stays visible on the tray
 * in both themes — text at WCAG's 4.5:1, graphical objects at 3:1 — so it is
 * measured here from the stylesheets rather than trusted to a comment (the
 * same approach as chess/ui/contrast.test.ts and gem-swap/ui/contrast.test.ts).
 *
 * The tray is not one colour. Under a peg number or a peg lie the wood
 * gradient (measured at both ends), the grain lines (two layers, assumed to
 * cross), and in a selected or a destination column the translucent wash on
 * top, so every pair is measured against each of those composites. The lit
 * and shade lines, the cast shadow and the tray's thickness carry no meaning
 * (the disk's width, its number and its position do), so they have no 3:1 to
 * clear: what is pinned instead is where the light comes from, and that the
 * shadow falls darker than the tray in both themes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/hanoi-towers/ui/hanoi-towers.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** A colour token: `#rrggbb`, or `#rrggbbaa` when the custom property carries its own alpha. */
interface Colour {
  hex: string;
  alpha: number;
}

/** The text of the first rule opened by exactly this header (a block has no nested braces). */
function block(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

function colours(body: string): Map<string, Colour> {
  const out = new Map<string, Colour>();
  for (const match of body.matchAll(/(--[\w-]+):\s*#([0-9a-f]{6})([0-9a-f]{2})?\s*;/gi)) {
    out.set(match[1]!, {
      hex: `#${match[2]!.toLowerCase()}`,
      alpha: match[3] === undefined ? 1 : parseInt(match[3], 16) / 255,
    });
  }
  return out;
}

function numbers(body: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([0-9.]+)\s*;/g)) {
    out.set(match[1]!, Number(match[2]));
  }
  return out;
}

/**
 * What one declaration of one rule says, whitespace folded: `value('.ht-peg {', 'color')`.
 * The header is the rule's opening line exactly as written, so `.ht-disk {` does not
 * find `.ht-disk-0 {` and `color` does not find `border-color`.
 */
function value(header: string, property: string): string {
  const match = new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(block(gameCss, header));
  expect(match, `${property} in ${header}`).not.toBeNull();
  return match![1]!.replace(/\s+/g, ' ').trim();
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
    header: ':root {',
    accent: ":root[data-game='hanoi-towers'],",
  },
  {
    name: 'dark',
    header: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='hanoi-towers'],",
  },
] as const;

/** Everything the board draws with, for one theme, with the accent from the shell. */
function palette(theme: (typeof THEMES)[number]) {
  const tokens = colours(block(gameCss, theme.header));
  const alphas = numbers(block(gameCss, theme.header));
  const get = (name: string) => {
    const value = tokens.get(name);
    expect(value, `${name} under ${theme.header}`).toBeDefined();
    return value!;
  };
  const alpha = (name: string) => {
    const value = alphas.get(name);
    expect(value, `${name} under ${theme.header}`).toBeDefined();
    return value!;
  };
  const accentBody = block(sharedCss, theme.accent);
  const accent = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(accentBody)?.[1]?.toLowerCase();
  const accentInk = /--accent-ink:\s*(#[0-9a-f]{6})\s*;/i.exec(accentBody)?.[1]?.toLowerCase();
  const ring = /--accent-ring-soft:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i.exec(
    accentBody,
  );
  expect(accent, `--accent under ${theme.accent}`).toBeDefined();
  expect(accentInk, `--accent-ink under ${theme.accent}`).toBeDefined();
  expect(ring, `--accent-ring-soft under ${theme.accent}`).not.toBeNull();
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return {
    tokens,
    get,
    alpha,
    accent: accent!,
    accentInk: accentInk!,
    // The selected column's wash: --accent-ring-soft over the wood.
    wash: { hex: `#${hex(ring![1]!)}${hex(ring![2]!)}${hex(ring![3]!)}`, alpha: Number(ring![4]) },
  };
}

/**
 * Every background a peg number or a peg can sit on: each end of the tray
 * gradient, bare, under the grain (both layers crossing, the darkest or the
 * lightest the lines can make it), and with the selected wash or the
 * destination wash on top of that.
 */
function trays(theme: (typeof THEMES)[number]): { label: string; colour: string }[] {
  const p = palette(theme);
  const grain = p.get('--ht-grain');
  const valid = p.get('--ht-valid');
  const out: { label: string; colour: string }[] = [];
  for (const [end, token] of [
    ['top', '--ht-tray-top'],
    ['bottom', '--ht-tray-bottom'],
  ] as const) {
    const bare = p.get(token).hex;
    const grained = laid(grain.hex, laid(grain.hex, bare, grain.alpha), grain.alpha);
    out.push(
      { label: `${end} bare`, colour: bare },
      { label: `${end} grain`, colour: grained },
      { label: `${end} selected`, colour: laid(p.wash.hex, grained, p.wash.alpha) },
      { label: `${end} destination`, colour: laid(valid.hex, grained, valid.alpha) },
    );
  }
  return out;
}

const DISKS = ['--ht-disk-0', '--ht-disk-1', '--ht-disk-2', '--ht-disk-3', '--ht-disk-4'];

/** Printed for docs/HANOI_TOWERS_RULES.md "Visual presentation"; the gate is the floor after it. */
function minimum(what: string, theme: string, values: number[]): number {
  const lowest = Math.min(...values);
  console.info(`[hanoi contrast] ${theme} ${what}: min ${lowest.toFixed(2)}`);
  return lowest;
}

describe('the board’s colours (docs/HANOI_TOWERS_RULES.md "Visual presentation")', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('declares the same tokens in the light and the dark block', () => {
    const light = [...colours(block(gameCss, THEMES[0].header)).keys()].sort();
    const dark = [...colours(block(gameCss, THEMES[1].header)).keys()].sort();
    expect(dark).toEqual(light);
    const lightNumbers = [...numbers(block(gameCss, THEMES[0].header)).keys()].sort();
    const darkNumbers = [...numbers(block(gameCss, THEMES[1].header)).keys()].sort();
    expect(darkNumbers).toEqual(lightNumbers);
  });

  it('keeps every colour literal inside the two blocks at the top', () => {
    let outside = gameCss;
    for (const theme of THEMES) {
      const header = `\n${theme.header}`;
      const start = outside.indexOf(header);
      outside = outside.slice(0, start) + outside.slice(outside.indexOf('}', start) + 1);
    }
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
  });

  it('reads only tokens that are declared (here or by the shell)', () => {
    const declared = new Set([...gameCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]!));
    const shell = new Set([...sharedCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]!));
    for (const [, token] of gameCss.matchAll(/var\((--[a-z0-9-]+)/gi)) {
      expect(declared.has(token!) || shell.has(token!), token).toBe(true);
    }
  });

  for (const theme of THEMES) {
    describe(theme.name, () => {
      it('reads the peg numbers at 4.5:1 on every tray background', () => {
        const ink = palette(theme).get('--ht-peg-ink').hex;
        const lowest = minimum(
          'peg number',
          theme.name,
          trays(theme).map((tray) => contrast(ink, tray.colour)),
        );
        expect(lowest).toBeGreaterThanOrEqual(4.5);
      });

      it('reads the disk numbers at 4.5:1 on every disk', () => {
        const p = palette(theme);
        const lowest = minimum(
          'disk number',
          theme.name,
          DISKS.map((disk) => contrast(p.get('--ht-disk-ink').hex, p.get(disk).hex)),
        );
        expect(lowest).toBeGreaterThanOrEqual(4.5);
      });

      it('reads the number on the lifted disk at 4.5:1', () => {
        const p = palette(theme);
        const ratio = contrast(p.accentInk, p.accent);
        minimum('lifted disk number', theme.name, [ratio]);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it('draws every disk’s edge at 3:1 against its own fill', () => {
        const p = palette(theme);
        const lowest = minimum(
          'disk edge',
          theme.name,
          DISKS.map((disk) => contrast(p.get('--ht-disk-edge').hex, p.get(disk).hex)),
        );
        expect(lowest).toBeGreaterThanOrEqual(3);
      });

      it('shows the peg on every tray background at 3:1', () => {
        const peg = palette(theme).get('--ht-peg').hex;
        const lowest = minimum(
          'peg',
          theme.name,
          trays(theme).map((tray) => contrast(peg, tray.colour)),
        );
        expect(lowest).toBeGreaterThanOrEqual(3);
      });

      it('shows the base by its fill or its edge, whichever parts from the tray, at 3:1', () => {
        const p = palette(theme);
        // The base stands at the foot of the column, so it is measured against
        // the bottom end of the gradient only.
        const lowest = minimum(
          'base',
          theme.name,
          trays(theme)
            .filter((tray) => tray.label.startsWith('bottom'))
            .map((tray) =>
              Math.max(
                contrast(p.get('--ht-base').hex, tray.colour),
                contrast(p.get('--ht-base-edge').hex, tray.colour),
              ),
            ),
        );
        expect(lowest).toBeGreaterThanOrEqual(3);
      });

      it('shows the accent marks and the lifted disk on every tray background at 3:1', () => {
        const p = palette(theme);
        const lowest = minimum(
          'accent mark',
          theme.name,
          trays(theme).map((tray) => contrast(p.accent, tray.colour)),
        );
        expect(lowest).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

describe('the rules read the tokens the floors above measure', () => {
  // The floors are computed from token values; these fail when a rule is
  // wired to another token (a selection tint put back to --accent-soft, say),
  // which would leave the measured figures in the rules doc describing a
  // different picture.
  const TRAY = '.ht-board,\n.ht-mini-tray {';

  it('lays the tray on the measured gradient, edge, lit line, shade and front', () => {
    const background = value(TRAY, 'background');
    expect(background).toContain(
      'linear-gradient(180deg, var(--ht-tray-top), var(--ht-tray-bottom))',
    );
    expect(value(TRAY, 'border')).toBe('1px solid var(--ht-tray-edge)');
    const shadow = value(TRAY, 'box-shadow');
    expect(shadow).toContain('inset 0 1px 0 var(--ht-tray-lit)');
    expect(shadow).toContain('inset 0 -4px 0 var(--ht-tray-shade)');
    expect(shadow).toContain('0 5px 0 var(--ht-tray-face)');
  });

  it('washes the selected column with the shell’s soft ring and the destination with --ht-valid', () => {
    // palette() lays --accent-ring-soft over the wood for "selected".
    expect(value('.ht-selected {', 'background')).toBe('var(--accent-ring-soft)');
    expect(value('.ht-valid {', 'background')).toBe('var(--ht-valid)');
  });

  it('draws the accent marks and the lifted disk in the measured accent', () => {
    expect(value('.ht-selected {', 'border-color')).toBe('var(--accent)');
    expect(value('.ht-valid {', 'border-color')).toBe('var(--accent)');
    expect(value('.ht-goal-mark {', 'stroke')).toBe('var(--accent)');
    expect(value('.ht-destination {', 'color')).toBe('var(--accent)');
    expect(value('.ht-lifted-disk .ht-disk {', 'fill')).toBe('var(--accent)');
    expect(value('.ht-lifted-disk .ht-disk {', 'stroke')).toBe('var(--accent)');
    expect(value('.ht-lifted-disk text {', 'fill')).toBe('var(--accent-ink)');
  });

  it('inks the peg numbers, the pegs, the bases and the disks with the measured tokens', () => {
    expect(value('.ht-peg {', 'color')).toBe('var(--ht-peg-ink)');
    expect(value('.ht-wood {', 'stroke')).toBe('var(--ht-peg)');
    expect(value('.ht-base {', 'fill')).toBe('var(--ht-base)');
    expect(value('.ht-base {', 'stroke')).toBe('var(--ht-base-edge)');
    expect(value('.ht-disk {', 'stroke')).toBe('var(--ht-disk-edge)');
    DISKS.forEach((token, disk) => {
      expect(value(`.ht-disk-${disk} {`, 'fill')).toBe(`var(${token})`);
    });
    expect(value('.ht-tower text {', 'fill')).toBe('var(--ht-disk-ink)');
  });

  it('draws the lit lines, the shade lines and the cast shadows with the tokens the direction test pins', () => {
    expect(value('.ht-wood-light {', 'stroke')).toBe('var(--ht-peg-lit)');
    expect(value('.ht-wood-shade {', 'stroke')).toBe('var(--ht-peg-shade)');
    expect(value('.ht-disk-light {', 'stroke')).toBe('var(--ht-disk-lit)');
    expect(value('.ht-disk-shade,\n.ht-base-shade {', 'stroke')).toBe('var(--ht-disk-shade)');
    expect(value('.ht-base-shadow,\n.ht-disk-shadow {', 'fill')).toBe('var(--ht-cast)');
    expect(value('.ht-base-shadow,\n.ht-disk-shadow {', 'opacity')).toBe('var(--ht-cast-alpha)');
    expect(value('.ht-lifted-disk .ht-disk-shadow {', 'opacity')).toBe(
      'var(--ht-cast-lifted-alpha)',
    );
  });
});

describe('the light comes from above, in both themes', () => {
  for (const theme of THEMES) {
    it(`lights the top edge and shades the opposite side (${theme.name})`, () => {
      const p = palette(theme);
      // The tray: a lit line over the top of the gradient, an opaque front darker than its bottom.
      expect(luminance(p.get('--ht-tray-lit').hex)).toBeGreaterThan(
        luminance(p.get('--ht-tray-top').hex),
      );
      expect(luminance(p.get('--ht-tray-face').hex)).toBeLessThan(
        luminance(p.get('--ht-tray-bottom').hex),
      );
      expect(p.get('--ht-tray-face').alpha, 'the front is opaque').toBe(1);
      // The peg: lit on the left, shade on the right.
      const peg = p.get('--ht-peg');
      const pegShade = p.get('--ht-peg-shade');
      expect(luminance(p.get('--ht-peg-lit').hex)).toBeGreaterThan(luminance(peg.hex));
      expect(luminance(laid(pegShade.hex, peg.hex, pegShade.alpha))).toBeLessThan(
        luminance(peg.hex),
      );
      // The disks: a lit line on the top, a shade line near the bottom.
      const shade = p.get('--ht-disk-shade');
      for (const disk of DISKS) {
        const fill = p.get(disk).hex;
        expect(luminance(p.get('--ht-disk-lit').hex), disk).toBeGreaterThan(luminance(fill));
        expect(luminance(laid(shade.hex, fill, shade.alpha)), disk).toBeLessThan(luminance(fill));
      }
      // The base takes the same shade line.
      const base = p.get('--ht-base').hex;
      expect(luminance(laid(shade.hex, base, shade.alpha))).toBeLessThan(luminance(base));
    });

    it(`casts a shadow darker than the tray, fainter once the disk is lifted (${theme.name})`, () => {
      const p = palette(theme);
      const cast = p.get('--ht-cast').hex;
      for (const token of ['--ht-tray-top', '--ht-tray-bottom']) {
        const tray = p.get(token).hex;
        const shadowed = laid(cast, tray, p.alpha('--ht-cast-alpha'));
        expect(luminance(shadowed), token).toBeLessThan(luminance(tray));
        // A lifted disk's shadow is still a shadow.
        expect(luminance(laid(cast, tray, p.alpha('--ht-cast-lifted-alpha'))), token).toBeLessThan(
          luminance(tray),
        );
      }
      expect(p.alpha('--ht-cast-lifted-alpha')).toBeLessThan(p.alpha('--ht-cast-alpha'));
    });

    it(`keeps the grain to two faint layers of at most 5% alpha (${theme.name})`, () => {
      const grain = palette(theme).get('--ht-grain');
      expect(grain.alpha).toBeGreaterThan(0);
      expect(grain.alpha).toBeLessThanOrEqual(0.05);
    });
  }

  it('lays the grain as two repeating gradients of 9px and 23px, over the wood', () => {
    const rule = gameCss.slice(gameCss.indexOf('\n.ht-board,\n.ht-mini-tray {'));
    const background = rule.slice(rule.indexOf('background:'), rule.indexOf(';'));
    const layers = [
      ...background.matchAll(/repeating-linear-gradient\((?:[^()]|\([^()]*\))*\)/g),
    ].map((m) => m[0]);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatch(/var\(--ht-grain\) 8px 9px/);
    expect(layers[1]).toMatch(/var\(--ht-grain\) 21px 23px/);
    expect(background.indexOf('linear-gradient(180deg')).toBeGreaterThan(
      background.lastIndexOf('repeating-linear-gradient'),
    );
  });

  it('puts the lift first among the tray’s outer shadows, with an opaque front', () => {
    const rule = gameCss.slice(gameCss.indexOf('\n.ht-board,\n.ht-mini-tray {'));
    const shadows = rule.slice(
      rule.indexOf('box-shadow:'),
      rule.indexOf(';', rule.indexOf('box-shadow:')),
    );
    const outer = shadows
      .split(',')
      .map((part) => part.trim())
      .filter(
        (part) => part.length > 0 && !part.startsWith('inset') && !part.startsWith('box-shadow'),
      );
    expect(outer[0]).toBe('0 5px 0 var(--ht-tray-face)');
    expect(outer[1]).toBe('0 8px 18px var(--accent-ring-soft)');
  });
});

describe('the lift and the settle (docs/HANOI_TOWERS_RULES.md "Visual presentation")', () => {
  it('is one transform transition and one settle animation of 140ms, never a loop', () => {
    // The disk's group, a lifted disk and the disk's shadow share the one
    // transition, and it names transform alone: the shadow's fainter tint
    // switches at once.
    expect(gameCss).toMatch(
      /\.ht-disk-group,\s*\.ht-lifted-disk,\s*\.ht-disk-shadow\s*\{\s*transition:\s*transform 0\.14s ease-out;\s*\}/,
    );
    const transitions = [...gameCss.matchAll(/transition:\s*([^;]+);/g)].map((m) =>
      m[1]!.replace(/\s+/g, ' ').trim(),
    );
    expect(transitions.filter((t) => t !== 'none')).toEqual(['transform 0.14s ease-out']);
    expect(gameCss).not.toMatch(/transition-property/);
    expect(gameCss).toMatch(/\.ht-lifted-disk\s*\{\s*transform:\s*translateY\(-12px\);\s*\}/);
    expect(gameCss).toMatch(/\.ht-arrived\s*\{\s*animation:\s*ht-settle 0\.14s ease-out;\s*\}/);
    expect(gameCss).toMatch(
      /@keyframes ht-settle\s*\{\s*from\s*\{\s*transform:\s*translateY\(-12px\);\s*\}\s*\}/,
    );
    expect(gameCss).not.toMatch(/infinite/);
    expect(gameCss).not.toMatch(/transition:\s*all/);
    // Nothing heavy on what moves: no filter, anywhere in the stylesheet.
    expect(gameCss).not.toMatch(/filter\s*:/);
  });

  it('is removed under the OS setting and under the in-app switch', () => {
    const media = gameCss.slice(gameCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    const mediaBody = media.slice(0, media.indexOf('\n}'));
    for (const selector of ['.ht-disk-group', '.ht-lifted-disk', '.ht-disk-shadow']) {
      expect(mediaBody, selector).toContain(selector);
    }
    expect(mediaBody).toMatch(/transition:\s*none/);
    expect(mediaBody).toMatch(/\.ht-arrived\s*\{\s*animation:\s*none/);
    for (const selector of ['.ht-disk-group', '.ht-lifted-disk', '.ht-disk-shadow']) {
      expect(gameCss, selector).toContain(`:root[data-reduced-motion='true'] ${selector}`);
    }
    expect(gameCss).toMatch(
      /:root\[data-reduced-motion='true'\] \.ht-arrived\s*\{\s*animation:\s*none;\s*\}/,
    );
  });
});
