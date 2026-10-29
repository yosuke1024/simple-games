/**
 * The tray, the two lamp faces, the marks on them and the hint's marker are
 * game content (docs/architecture/css-split.md; docs/LIGHT_GRID_RULES.md
 * 「Visual design and actionable hints」), so their colours are tokens in the
 * two blocks at the top of ui/light-grid.css, light and dark. The rules promise
 * that the marks read on their faces and that every frame the lamps and the
 * hint draw clears WCAG's 3:1 floor for graphical objects against what it sits
 * on, in both themes. That is measured here from the stylesheets rather than
 * trusted to a comment (the same approach as chess/ui/contrast.test.ts and
 * gem-swap/ui/contrast.test.ts).
 *
 * The texture on top of the faces (the gloss, the thick lower edge, the recess,
 * the glow, the tray's rim) carries no meaning, so it has no 3:1 to clear. What
 * is pinned for it is where the light comes from and that no colour is
 * written outside the two blocks. The transitions are pinned as text: jsdom
 * computes no style.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/light-grid/ui/light-grid.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

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

/** Every `--name: value;` declared directly in a block body, the value as written. */
function declared(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out.set(match[1]!, match[2]!.trim());
  return out;
}

interface Colour {
  hex: string;
  alpha: number;
}

const THEMES = [
  { name: 'light', game: '\n:root {', shared: '\n:root {' },
  { name: 'dark', game: "\n:root[data-theme='dark'] {", shared: "\n:root[data-theme='dark'] {" },
] as const;

/** One theme's tokens, parsed; an alias is resolved through the shared tokens of the same theme. */
function theme(which: (typeof THEMES)[number]) {
  const own = declared(block(gameCss, which.game));
  const shell = declared(block(sharedCss, which.shared));
  const colour = (name: string): Colour => {
    const raw = own.get(name);
    expect(raw, `${name} under ${which.name}`).toBeDefined();
    const hex = /^#([0-9a-f]{6})$/i.exec(raw!);
    if (hex) return { hex: `#${hex[1]!.toLowerCase()}`, alpha: 1 };
    const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(raw!);
    if (rgba) {
      const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((part) =>
        Number(part).toString(16).padStart(2, '0'),
      );
      return { hex: `#${r}${g}${b}`, alpha: Number(rgba[4]) };
    }
    const alias = /^var\((--[\w-]+)\)$/.exec(raw!);
    expect(alias, `${name} under ${which.name} is "${raw}"`).not.toBeNull();
    const value = shell.get(alias![1]!);
    expect(value, `${alias![1]} under the shared ${which.name} tokens`).toMatch(/^#[0-9a-f]{6}$/i);
    return { hex: value!.toLowerCase(), alpha: 1 };
  };
  /** An opaque token as #rrggbb. */
  const solid = (name: string): string => {
    const value = colour(name);
    expect(value.alpha, `${name} under ${which.name}`).toBe(1);
    return value.hex;
  };
  const number = (name: string): number => {
    const raw = own.get(name);
    expect(raw, `${name} under ${which.name}`).toMatch(/^[0-9.]+$/);
    return Number(raw);
  };
  /** A shared token such as --paper, #rrggbb. */
  const sharedToken = (name: string): string => {
    const value = shell.get(name);
    expect(value, `${name} under the shared ${which.name} tokens`).toMatch(/^#[0-9a-f]{6}$/i);
    return value!.toLowerCase();
  };
  return { own, colour, solid, number, sharedToken };
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

/** Printed for docs/LIGHT_GRID_RULES.md; the gate is the floor asserted beside it. */
function report(themeName: string, what: string, ratio: number): void {
  console.info(`[light-grid contrast] ${themeName} ${what}: ${ratio.toFixed(2)}`);
}

describe('the board’s colours (docs/LIGHT_GRID_RULES.md「Visual design and actionable hints」)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('declares the same tokens in both themes', () => {
    const light = [...theme(THEMES[0]).own.keys()].sort();
    const dark = [...theme(THEMES[1]).own.keys()].sort();
    expect(light.length).toBeGreaterThan(0);
    expect(dark).toEqual(light);
    for (const name of light) expect(name.startsWith('--lg-'), name).toBe(true);
  });

  it('keeps every colour literal inside the two blocks at the top', () => {
    // Everything after the two blocks reads tokens (or the shared theme's
    // own variables); a literal there would be a colour nothing here measures.
    let outside = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const { game } of THEMES) {
      outside = outside.replace(block(outside, game), '');
    }
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
  });

  for (const which of THEMES) {
    const t = theme(which);
    const tray = [t.solid('--lg-tray'), t.solid('--lg-tray-hi')];
    const socket = t.solid('--lg-socket');
    const socketLit = t.solid('--lg-socket-lit');
    const lit = t.solid('--lg-lit');
    const dark = t.solid('--lg-dark');
    const gloss = t.colour('--lg-gloss').hex;
    // The faces as they are under the gloss, at its strongest (the top edge).
    const litTop = laid(gloss, lit, t.number('--lg-gloss-on'));
    const darkTop = laid(gloss, dark, t.number('--lg-gloss-off'));

    it(`reads the mark on a lit face and on an unlit one (${which.name})`, () => {
      const pairs = {
        'the sun on the lit face': [t.solid('--lg-lit-ink'), lit],
        'the sun under the lit gloss': [t.solid('--lg-lit-ink'), litTop],
        'the ring on the unlit face': [t.solid('--lg-dark-ink'), dark],
        'the ring under the unlit gloss': [t.solid('--lg-dark-ink'), darkTop],
      } as const;
      for (const [what, [ink, face]] of Object.entries(pairs)) {
        const ratio = contrast(ink, face);
        report(which.name, what, ratio);
        // Marks are graphical objects (3:1); they are also held to the text
        // floor because the rules have always promised more than 3:1 here.
        expect(ratio, what).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`tells a lit face from an unlit one by more than 3:1 (${which.name})`, () => {
      const ratio = contrast(lit, dark);
      report(which.name, 'lit face vs unlit face', ratio);
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect(luminance(lit)).toBeGreaterThan(luminance(dark));
    });

    it(`outlines both lamps against the tray and the bezel (${which.name})`, () => {
      const frames = {
        'the unlit frame': t.solid('--lg-dark-edge'),
        'the lit face': lit,
        'the lit frame': t.solid('--lg-lit-edge'),
      };
      for (const [what, colour] of Object.entries(frames)) {
        for (const [under, name] of [
          [tray[0]!, 'the tray (lower stop)'],
          [tray[1]!, 'the tray (upper stop)'],
          [socket, 'the bezel'],
        ] as const) {
          const ratio = contrast(colour, under);
          report(which.name, `${what} on ${name}`, ratio);
          expect(ratio, `${what} on ${name}`).toBeGreaterThanOrEqual(3);
        }
      }
      // The lit lamp's own bezel is warmer, and its frame still stands off it.
      expect(contrast(lit, socketLit)).toBeGreaterThanOrEqual(3);
    });

    it(`outlines the tray against the paper and reads the coordinates (${which.name})`, () => {
      const edge = contrast(t.solid('--lg-tray-edge'), t.sharedToken('--paper'));
      report(which.name, 'the tray edge on the paper', edge);
      expect(edge).toBeGreaterThanOrEqual(3);
      for (const stop of tray) {
        const ratio = contrast(t.solid('--lg-label'), stop);
        report(which.name, 'the coordinate labels on the tray', ratio);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`reads the hint's marker and its frames (${which.name})`, () => {
      const marker = t.solid('--lg-hint');
      const markerInk = t.solid('--lg-hint-ink');
      const markerRatio = contrast(markerInk, marker);
      report(which.name, 'the “1” on the marker', markerRatio);
      expect(markerRatio).toBeGreaterThanOrEqual(4.5);
      // The marker sits across a cell's corner; on a lit face its fill stands off the face by itself.
      const onLit = contrast(marker, lit);
      report(which.name, 'the marker on a lit face', onLit);
      expect(onLit).toBeGreaterThanOrEqual(3);
      // Its white ring and the white frame round the suggested cell (and the focus ring) sit outside the face.
      for (const [what, colour] of [
        ['the marker ring', markerInk],
        ['the hint and focus frame', t.solid('--lg-focus')],
      ] as const) {
        for (const under of [socket, socketLit, ...tray]) {
          const ratio = contrast(colour, under);
          report(which.name, `${what} on ${under}`, ratio);
          expect(ratio, `${what} on ${under}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`lights the lens from above, and a lit lamp is the brighter thing (${which.name})`, () => {
      // The gloss is the lighter of the shared tokens and rides on both faces.
      expect(luminance(gloss)).toBeGreaterThan(luminance(lit));
      expect(t.number('--lg-gloss-on')).toBeGreaterThan(t.number('--lg-gloss-off'));
      expect(t.number('--lg-gloss-off')).toBeGreaterThan(0);
      expect(t.number('--lg-gloss-on')).toBeLessThanOrEqual(0.5);
      // The bezel is darker than the tray, and a lit lamp warms it without
      // making it as bright as the lens.
      for (const stop of tray) expect(luminance(socket)).toBeLessThan(luminance(stop));
      expect(luminance(socketLit)).toBeGreaterThan(luminance(socket));
      expect(luminance(socketLit)).toBeLessThan(luminance(lit));
      // The glow is the lit colour; its off state is that colour at no opacity,
      // so a transition between them never passes through another hue.
      const glow = t.colour('--lg-glow');
      const off = t.colour('--lg-glow-off');
      expect(off.hex).toBe(glow.hex);
      expect(off.alpha).toBe(0);
      expect(glow.alpha).toBeGreaterThan(0);
      expect(glow.alpha).toBeLessThanOrEqual(0.6);
      // The texture's alphas exist and are partial.
      for (const name of [
        '--lg-tray-rim',
        '--lg-tray-shade',
        '--lg-label-cut',
        '--lg-lit-spec',
        '--lg-lit-thick',
        '--lg-dark-recess',
        '--lg-dark-lip',
      ]) {
        const { alpha } = t.colour(name);
        expect(alpha, name).toBeGreaterThan(0);
        expect(alpha, name).toBeLessThan(1);
      }
      // Highlights are light and shades are dark.
      for (const name of ['--lg-tray-rim', '--lg-lit-spec', '--lg-dark-lip']) {
        expect(luminance(t.colour(name).hex), name).toBeGreaterThan(0.9);
      }
      for (const name of ['--lg-tray-shade', '--lg-label-cut', '--lg-dark-recess']) {
        expect(luminance(t.colour(name).hex), name).toBeLessThan(0.01);
      }
    });
  }

  it('dims the lit face in the dark theme and lets its glow show more', () => {
    const light = theme(THEMES[0]);
    const dark = theme(THEMES[1]);
    // A lit lamp should not glare in a dark room (Chess's dark squares do the same).
    expect(luminance(dark.solid('--lg-lit'))).toBeLessThan(luminance(light.solid('--lg-lit')));
    expect(dark.colour('--lg-glow').alpha).toBeGreaterThan(light.colour('--lg-glow').alpha);
    expect(contrast(dark.solid('--lg-lit'), dark.solid('--lg-dark'))).toBeGreaterThanOrEqual(3);
  });
});

/** The normalised bodies of every rule whose selector list starts a line as `header {`, joined. */
function rule(header: string): string {
  const bodies: string[] = [];
  for (
    let at = gameCss.indexOf(`\n${header} {`);
    at > -1;
    at = gameCss.indexOf(`\n${header} {`, at + 1)
  ) {
    bodies.push(block(gameCss.slice(at), `\n${header} {`).replace(/\s+/g, ' ').trim());
  }
  expect(bodies.length, `${header} is missing`).toBeGreaterThan(0);
  return bodies.join(' ');
}

/** The layers of a rule's box-shadow, each as [inset?, number of lengths], so two lists can be compared in shape. */
function shadowShape(body: string): Array<[boolean, number]> {
  const value = /box-shadow:\s*([^;]+);/.exec(body)?.[1];
  expect(value, 'box-shadow').toBeDefined();
  return value!.split(/,\s*(?![^(]*\))/).map((layer) => {
    const parts = layer.trim().split(/\s+/);
    return [parts[0] === 'inset', parts.filter((part) => /^-?[\d.]+(?:px)?$/.test(part)).length];
  });
}

/** Every value a property is given in a rule body, as written. */
function values(body: string, property: string): string[] {
  const pattern = new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]+);`, 'g');
  return [...body.matchAll(pattern)].map((match) => match[1]!.trim());
}

describe('the lens, the tray and the transitions (docs/LIGHT_GRID_RULES.md)', () => {
  it('draws each part with the token whose contrast is measured above', () => {
    // The ratios above are of token pairs; this is what ties a pair to the
    // thing drawn with it. Swap two tokens in a rule (the unlit ink on a lit
    // face, the tray's low stop on top) and the measured pair is no longer the
    // one on screen, so this goes red rather than the ratios staying green.
    const tray = 'linear-gradient(180deg, var(--lg-tray-hi), var(--lg-tray))';
    const wiring: Array<[string, Record<string, string>]> = [
      [
        '.lg-lit',
        {
          color: 'var(--lg-lit-ink)',
          background: 'var(--lg-lit)',
          'border-color': 'var(--lg-lit-edge)',
        },
      ],
      [
        '.lg-dark',
        {
          color: 'var(--lg-dark-ink)',
          background: 'var(--lg-dark)',
          'border-color': 'var(--lg-dark-edge)',
        },
      ],
      ['.lg-board-frame', { background: tray, border: '1px solid var(--lg-tray-edge)' }],
      ['.lg-figure', { background: tray, border: '1px solid var(--lg-tray-edge)' }],
      ['.lg-column-labels,\n.lg-row-labels', { color: 'var(--lg-label)' }],
      [
        '.lg-hint-marker,\n.lg-hint-step',
        { background: 'var(--lg-hint)', color: 'var(--lg-hint-ink)' },
      ],
      ['.lg-hint-marker', { border: '2px solid var(--lg-hint-ink)' }],
      ['.lg-hinted', { outline: '2px solid var(--lg-focus)' }],
      ['.lg-cell:focus-visible', { outline: '2px solid var(--lg-focus)' }],
    ];
    for (const [header, expected] of wiring) {
      const body = rule(header);
      for (const [property, value] of Object.entries(expected)) {
        expect(values(body, property), `${header} ${property}`).toEqual([value]);
      }
    }
    // The bezel ring in the gap is the warm one for a lit lamp, the dark one otherwise.
    expect(values(rule('.lg-lit'), 'box-shadow')[0]).toContain('0 0 0 2px var(--lg-socket-lit)');
    expect(values(rule('.lg-dark'), 'box-shadow')[0]).toContain('0 0 0 2px var(--lg-socket)');
    expect(values(rule('.lg-dark'), 'box-shadow')[0]).not.toContain('--lg-socket-lit');
  });

  it('draws the collection’s board frame on the board, the lift first, under the tray’s own rim', () => {
    expect(rule('.lg-board-frame')).toContain(
      'box-shadow: inset 0 1px 0 var(--lg-tray-rim), inset 0 -2px 0 var(--lg-tray-shade), 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
  });

  it('gives the Quick Rules figure the same tray thickness', () => {
    expect(rule('.lg-figure')).toContain(
      'box-shadow: inset 0 1px 0 var(--lg-tray-rim), inset 0 -2px 0 var(--lg-tray-shade);',
    );
  });

  it('lists the same four shadows, in the same order, for a lit and an unlit lens', () => {
    // A transition interpolates a shadow list only when the lists match; if
    // they differ the lamp would snap instead of warming or cooling.
    const lit = shadowShape(rule('.lg-lit'));
    const unlit = shadowShape(rule('.lg-dark'));
    expect(lit).toHaveLength(4);
    expect(unlit).toEqual(lit);
    expect(lit.map(([inset]) => inset)).toEqual([true, true, false, false]);
  });

  it('puts the gloss on a pseudo-element, under the mark, so its opacity can be transitioned', () => {
    expect(rule('.lg-cell::before,\n.lg-figure > span::before')).toContain(
      'background: linear-gradient(180deg, var(--lg-gloss), transparent 50%);',
    );
    expect(rule('.lg-lit::before')).toContain('opacity: var(--lg-gloss-on);');
    expect(rule('.lg-dark::before')).toContain('opacity: var(--lg-gloss-off);');
    // The mark is positioned so it paints over the gloss.
    expect(rule('.lg-light-symbol')).toContain('position: relative;');
  });

  it('comes on in 0.1s and cools in 0.22s, with a 0.06s press', () => {
    const fast = rule('.lg-lit,\n.lg-dark');
    const slow = rule('.lg-dark');
    for (const property of ['background-color', 'border-color', 'color', 'box-shadow']) {
      expect(fast).toContain(`${property} 0.1s ease-out`);
      expect(slow).toContain(`${property} 0.22s ease-out`);
    }
    expect(fast).toContain('transform 0.06s ease-out');
    expect(slow).toContain('transform 0.06s ease-out');
    expect(rule('.lg-lit::before')).toContain('transition: opacity 0.1s ease-out;');
    expect(rule('.lg-dark::before')).toContain('transition: opacity 0.22s ease-out;');
    expect(rule('.lg-cell:active')).toContain('transform: translateY(1px);');
  });

  it('adds no loop: no animation, no keyframes, nothing heavy, nothing the old WebView lacks', () => {
    const css = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/\banimation(?:-[\w-]+)?\s*:|@keyframes/);
    expect(css).not.toMatch(/\bfilter\s*:|backdrop-filter/);
    expect(css).not.toMatch(/:has\(|color-mix\(|container-type|@container/);
    expect(css).not.toMatch(/^\s+&|\{\s*&/m);
  });

  it('is ended by the shared Reduced Motion rules, under the OS setting and the in-app one', () => {
    // The game writes no exception of its own; these shared rules are what
    // take its transitions to 0.01ms and its pseudo-elements' to none.
    const os = block(sharedCss, '@media (prefers-reduced-motion: reduce)').replace(/\s+/g, ' ');
    expect(os).toContain('* { animation-duration: 0.01ms !important;');
    expect(os).toContain('transition-duration: 0.01ms !important;');
    expect(os).toContain('*::before, *::after {');
    expect(os).toContain('transition: none !important;');
    const app = (header: string) => block(sharedCss, `\n${header}`).replace(/\s+/g, ' ');
    expect(app(":root[data-reduced-motion='true'] * {")).toContain(
      'transition-duration: 0.01ms !important;',
    );
    expect(
      app(
        ":root[data-reduced-motion='true'] *::before,\n:root[data-reduced-motion='true'] *::after {",
      ),
    ).toContain('transition: none !important;');
  });

  it('scales the mark with the cell, never below the 5×5 board’s 24px / 20px', () => {
    expect(rule('.lg-light-symbol')).toContain('width: clamp(24px, 40%, 40px);');
    expect(rule('.lg-dark .lg-light-symbol')).toContain('width: clamp(20px, 33%, 34px);');
  });
});
