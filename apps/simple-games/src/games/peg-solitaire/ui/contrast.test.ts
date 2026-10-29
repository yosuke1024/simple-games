/**
 * The board's wood and what is drawn on it (docs/PEG_SOLITAIRE_RULES.md §5,
 * §13). The plate, the floor of a hole and the rim of a hole and of the target
 * ring are game content, in the two blocks at the very top of
 * peg-solitaire.css; the marks that carry meaning are the accent (the peg, the
 * landing hole's rim, the keyboard focus) and the ink (the landing dot, the
 * picked-up peg's ring), which the shell hands the game. The stylesheet
 * promises each clears 3:1 — the WCAG floor for graphical objects
 * (docs/BRAND.md「コントラスト」) — on whatever it is drawn over, in both
 * themes. That is measured here from the stylesheets rather than trusted to a
 * comment (the same approach as chess/ui/contrast.test.ts and
 * gem-swap/ui/contrast.test.ts).
 *
 * What sits on what:
 * - the peg, and the rim of a landing hole, sit over the floor of a hole and,
 *   where a peg is lifted or carried, over the plate;
 * - the target ring and the rim of every hole are drawn on the plate;
 * - the landing dot is drawn on the floor (under the shade at the hole's top);
 * - the picked-up peg's outer ring (the ink) crosses both the floor and the
 *   plate, and the ring inside it (--surface) parts it from the peg.
 * The shades and lights are alpha-only and carry no meaning, so they are not
 * measured — except where they sit over a measured mark and could take it
 * under the floor (a peg's edge falloff, the shade over the floor).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/peg-solitaire/ui/peg-solitaire.css'), 'utf8');
/** The sheet without its comments, which are free to quote what they like. */
const sheet = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector starts a line so (`prefix` ends where the match may). */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector}`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

/** The #rrggbb custom properties declared in the first rule whose selector list starts so. */
function tokens(source: string, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of ruleBody(source, selector).matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out.set(match[1]!, match[2]!.toLowerCase());
  }
  return out;
}

interface Alpha {
  readonly rgb: readonly [number, number, number];
  readonly alpha: number;
}

/** The rgba() custom properties declared in the first rule whose selector list starts so. */
function alphas(source: string, selector: string): Map<string, Alpha> {
  const out = new Map<string, Alpha>();
  const pattern = /(--[\w-]+):\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)\s*;/gi;
  for (const match of ruleBody(source, selector).matchAll(pattern)) {
    out.set(match[1]!, {
      rgb: [Number(match[2]), Number(match[3]), Number(match[4])],
      alpha: Number(match[5]),
    });
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

/** `over` painted on `under` (#rrggbb), as the browser blends it, back to #rrggbb. */
function composite(over: Alpha, under: string): string {
  const channels = [1, 3, 5].map((at, index) => {
    const base = parseInt(under.slice(at, at + 2), 16);
    const blended = Math.round(over.rgb[index]! * over.alpha + base * (1 - over.alpha));
    return blended.toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

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

/** Every innermost rule in `text`, as its selector list and declarations. */
function rulesIn(text: string): Array<{ selectors: string[]; body: string }> {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]!.split(',').map((selector) => selector.trim()),
    body: match[2]!,
  }));
}

const TOKEN_BLOCKS = {
  light: ':root {',
  dark: ":root[data-theme='dark'] {",
} as const;

const THEMES = [
  {
    name: 'light',
    game: TOKEN_BLOCKS.light,
    shared: ':root {',
    accent: ":root[data-game='peg-solitaire'],",
  },
  {
    name: 'dark',
    game: TOKEN_BLOCKS.dark,
    shared: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='peg-solitaire'],",
  },
] as const;

/** The four wood tones, in the order the rules document lists them. */
const WOOD = ['--pg-plate-face', '--pg-plate-edge', '--pg-hole-floor', '--pg-rim'];
/** The alpha-only shades and lights. */
const SHADES = ['--pg-shade', '--pg-lip', '--pg-shine', '--pg-body', '--pg-foot', '--pg-cast'];

describe('the colour this stylesheet writes (docs/PEG_SOLITAIRE_RULES.md §13)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('puts the two token blocks first and no colour literal anywhere after them', () => {
    // The blocks are the first two rules of the sheet, light then dark.
    expect(sheet.trimStart().startsWith(':root {')).toBe(true);
    const darkBlock = sheet.indexOf("\n:root[data-theme='dark'] {");
    expect(darkBlock, 'the dark block').toBeGreaterThan(-1);
    expect(sheet.slice(0, darkBlock).match(/\{/g)).toHaveLength(1);
    // Everything after them reads tokens or system colours; a literal there
    // would be a colour the tests below do not measure.
    const rest = sheet.slice(sheet.indexOf('}', darkBlock) + 1);
    expect(rest.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(/gi) ?? []).toEqual([]);
  });

  it('declares the same tokens in both themes — four wood tones and six shades', () => {
    const light = [...tokens(gameCss, TOKEN_BLOCKS.light).keys()];
    const dark = [...tokens(gameCss, TOKEN_BLOCKS.dark).keys()];
    expect(light).toEqual(WOOD);
    expect(dark).toEqual(WOOD);
    expect([...alphas(gameCss, TOKEN_BLOCKS.light).keys()]).toEqual(SHADES);
    expect([...alphas(gameCss, TOKEN_BLOCKS.dark).keys()]).toEqual(SHADES);
    // Every declaration in a block was read as one of the two forms above.
    for (const selector of Object.values(TOKEN_BLOCKS)) {
      expect(ruleBody(gameCss, selector).match(/--pg-[\w-]+:/g)).toHaveLength(
        WOOD.length + SHADES.length,
      );
    }
  });

  it('keeps every shade a well-formed alpha (0 to 1, channels up to 255)', () => {
    for (const selector of Object.values(TOKEN_BLOCKS)) {
      for (const [name, shade] of alphas(gameCss, selector)) {
        expect(shade.alpha, `${name} under ${selector}`).toBeGreaterThanOrEqual(0);
        expect(shade.alpha, `${name} under ${selector}`).toBeLessThanOrEqual(1);
        for (const channel of shade.rgb) expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('the peg’s body shade (docs/PEG_SOLITAIRE_RULES.md §13)', () => {
  it('reaches its full alpha at the rim of the disc, which is where the edge is measured', () => {
    // Without `closest-side` a radial-gradient ends at the farthest corner, so
    // the rim of a circle sits at about 70% of the ramp and the edge gets
    // 0.02 of --pg-body instead of all of it (the test below assumes all).
    const body = ruleBody(sheet, '.pg-peg::before');
    expect(body.replace(/\s+/g, ' ')).toContain(
      'radial-gradient(circle closest-side at 50% 50%, transparent 64%, var(--pg-body) 100%)',
    );
  });
});

describe('the marks on the wood (docs/PEG_SOLITAIRE_RULES.md §13, docs/BRAND.md「コントラスト」)', () => {
  for (const theme of THEMES) {
    const wood = tokens(gameCss, theme.game);
    const shades = alphas(gameCss, theme.game);
    const shared = tokens(sharedCss, theme.shared);
    const get = (name: string) => {
      const value = wood.get(name);
      expect(value, `${name} under ${theme.game}`).toBeDefined();
      return value!;
    };
    const shade = (name: string) => {
      const value = shades.get(name);
      expect(value, `${name} under ${theme.game}`).toBeDefined();
      return value!;
    };
    const plate = get('--pg-plate-face');
    const floor = get('--pg-hole-floor');
    const rim = get('--pg-rim');
    const ink = shared.get('--ink')!;
    const surface = shared.get('--surface')!;
    const paper = shared.get('--paper')!;
    const accent = tokens(sharedCss, theme.accent).get('--accent')!;

    it(`reads the shared tokens it is measured against (${theme.name})`, () => {
      expect(accent, 'the title accent').toBeDefined();
      expect(ink, '--ink').toBeDefined();
      expect(surface, '--surface').toBeDefined();
      expect(paper, '--paper').toBeDefined();
    });

    it(`the accent (the peg, the landing hole's rim, the keyboard focus) reads on the plate and on the floor (${theme.name})`, () => {
      // Printed for docs/PEG_SOLITAIRE_RULES.md §13; the gate is the 3:1 below.
      console.info(
        `[peg-solitaire contrast] ${theme.name} accent on plate ${contrast(accent, plate).toFixed(2)}, on floor ${contrast(accent, floor).toFixed(2)}`,
      );
      expect(contrast(accent, plate)).toBeGreaterThanOrEqual(3);
      expect(contrast(accent, floor)).toBeGreaterThanOrEqual(3);
    });

    it(`the peg's edge, with its falloff applied, still reads on the plate and on the floor (${theme.name})`, () => {
      const edge = composite(shade('--pg-body'), accent);
      console.info(
        `[peg-solitaire contrast] ${theme.name} peg edge ${edge} on plate ${contrast(edge, plate).toFixed(2)}, on floor ${contrast(edge, floor).toFixed(2)}`,
      );
      expect(contrast(edge, plate)).toBeGreaterThanOrEqual(3);
      expect(contrast(edge, floor)).toBeGreaterThanOrEqual(3);
    });

    it(`the target ring and the rim of a hole read on the plate (${theme.name})`, () => {
      console.info(
        `[peg-solitaire contrast] ${theme.name} rim on plate ${contrast(rim, plate).toFixed(2)}, on floor ${contrast(rim, floor).toFixed(2)}`,
      );
      expect(contrast(rim, plate)).toBeGreaterThanOrEqual(3);
    });

    it(`the landing dot reads on the floor, also under the shade at the hole's top (${theme.name})`, () => {
      const shaded = composite(shade('--pg-shade'), floor);
      console.info(
        `[peg-solitaire contrast] ${theme.name} dot on floor ${contrast(ink, floor).toFixed(2)}, under the shade ${contrast(ink, shaded).toFixed(2)}`,
      );
      expect(contrast(ink, floor)).toBeGreaterThanOrEqual(3);
      expect(contrast(ink, shaded)).toBeGreaterThanOrEqual(3);
    });

    it(`the picked-up peg's ring reads on the plate and on the floor, and the ring inside it parts it from the peg (${theme.name})`, () => {
      console.info(
        `[peg-solitaire contrast] ${theme.name} ring ink on plate ${contrast(ink, plate).toFixed(2)}, on floor ${contrast(ink, floor).toFixed(2)}; --surface on peg ${contrast(surface, accent).toFixed(2)}`,
      );
      expect(contrast(ink, plate)).toBeGreaterThanOrEqual(3);
      expect(contrast(ink, floor)).toBeGreaterThanOrEqual(3);
      expect(contrast(surface, accent)).toBeGreaterThanOrEqual(3);
    });

    it(`sets the plate's wood edge apart from its face, and the hard drop in that wood apart from the paper (${theme.name})`, () => {
      // The silhouette of the board is carried by the plate itself, the hard
      // drop in the edge wood and the soft wash — not by an edge that is
      // 3:1 on the paper, which a board's edge never is. Printed for the
      // rules document. The gate is the direction: in the light theme the
      // edge is the darker wood, so the plate reads as having a side; in the
      // dark theme it is the lighter, because a black side would vanish into
      // the dark paper.
      const edge = get('--pg-plate-edge');
      console.info(
        `[peg-solitaire contrast] ${theme.name} plate edge on paper ${contrast(edge, paper).toFixed(2)}, plate face on paper ${contrast(plate, paper).toFixed(2)}, edge on face ${contrast(edge, plate).toFixed(2)}`,
      );
      if (theme.name === 'light') {
        expect(luminance(edge)).toBeLessThan(luminance(plate));
        expect(luminance(edge)).toBeLessThan(luminance(paper));
      } else {
        expect(luminance(edge)).toBeGreaterThan(luminance(plate));
        expect(luminance(edge)).toBeGreaterThan(luminance(paper));
      }
    });
  }
});

describe('the plate’s lift (docs/PEG_SOLITAIRE_RULES.md §13)', () => {
  it('is a hard 3px drop in the edge wood, then the series’ soft wash, as a filter on the svg', () => {
    // A box-shadow would follow the svg's rectangle, not the cross.
    const body = ruleBody(sheet, '.pg-plate {');
    const filter = /filter:\s*([^;]+);/.exec(body)?.[1] ?? '';
    expect(filter.replace(/\s+/g, ' ')).toBe(
      'drop-shadow(0 3px 0 var(--pg-plate-edge)) drop-shadow(0 8px 18px var(--accent-ring-soft))',
    );
  });

  it('is never put on a peg, which moves (a drag, a slide)', () => {
    for (const rule of rulesIn(sheet)) {
      if (!/\bfilter\s*:\s*(?!none\b)\S/.test(rule.body)) continue;
      expect(rule.selectors, 'the only rule with a filter').toEqual(['.pg-plate']);
    }
  });

  it('colours the wood as fill and as stroke on both polygons, because the stroke is the shape', () => {
    // The rule whose selector list is exactly the one polygon (the group rule
    // above it, `.pg-plate-edge, .pg-plate-face`, only carries the joins).
    const alone = (selector: string) =>
      rulesIn(sheet).find((rule) => rule.selectors.join() === selector)?.body ?? '';
    const edge = alone('.pg-plate-edge');
    expect(edge).toContain('fill: var(--pg-plate-edge);');
    expect(edge).toContain('stroke: var(--pg-plate-edge);');
    const face = alone('.pg-plate-face');
    expect(face).toContain('fill: var(--pg-plate-face);');
    expect(face).toContain('stroke: var(--pg-plate-face);');
  });
});

describe('forced colours (docs/PEG_SOLITAIRE_RULES.md §13)', () => {
  // jsdom computes no style, so what a forced palette leaves standing is
  // pinned here as text. The layers opt out of forced-color-adjust, so the
  // wood's gradients, its lip and the plate's filter would stay unless the
  // block resets them.
  const forced = block(sheet, '@media (forced-colors: active)').replace(/\s+/g, ' ');

  it('drops the plate’s filter and redraws the plate in system colours', () => {
    expect(forced).toContain('.pg-plate { filter: none; }');
    expect(forced).toContain('.pg-plate-edge { fill: CanvasText; stroke: CanvasText; }');
    expect(forced).toContain('.pg-plate-face { fill: Canvas; stroke: Canvas; }');
  });

  it('redraws the ring, the pit, the dot and the peg without the wood’s shading', () => {
    expect(forced).toContain('.pg-ring::before { border-color: CanvasText; box-shadow: none; }');
    // `background:` is the shorthand, so it also clears the gradients.
    expect(forced).toContain(
      '.pg-pit::before { background: Canvas; box-shadow: inset 0 0 0 2px CanvasText; }',
    );
    expect(forced).toContain('.pg-dot::before { background: Highlight; }');
    expect(forced).toContain('.pg-peg::before { background: CanvasText; box-shadow: none; }');
  });

  it('keeps the picked-up peg’s Highlight ring and the landing hole’s Highlight rim', () => {
    expect(forced).toContain(
      '.pg-hole-selected .pg-peg::before, .pg-peg-held::before { box-shadow: 0 0 0 2px Canvas, 0 0 0 5px Highlight; }',
    );
    expect(forced).toContain(
      '.pg-hole-hover .pg-pit::before { box-shadow: inset 0 0 0 3px Highlight; }',
    );
  });
});

describe('the jump’s motion (docs/PEG_SOLITAIRE_RULES.md §13)', () => {
  it('moves only transforms and opacity', () => {
    const names = [...sheet.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]!);
    expect(names.sort()).toEqual(['pg-arrive', 'pg-lift', 'pg-vanish']);
    for (const name of names) {
      const declared = [...block(sheet, `@keyframes ${name}`).matchAll(/([a-z-]+)\s*:/g)].map(
        (match) => match[1]!,
      );
      expect(declared.length, name).toBeGreaterThan(0);
      for (const property of declared) {
        expect(['transform', 'opacity'], `${name} animates ${property}`).toContain(property);
      }
    }
    // The rise and fall of a picked-up peg is a transition on the peg's own
    // layer, of the same two properties and never on a pseudo-element.
    const transition = /(?:^|\n)\.pg-peg \{\s*transition:([^;]+);/.exec(sheet)?.[1] ?? '';
    expect(transition.replace(/\s+/g, ' ').trim()).toBe(
      'transform 120ms ease-out, opacity 120ms ease-out',
    );
    for (const rule of rulesIn(sheet)) {
      if (!/\btransition\s*:\s*(?!none\b)\S/.test(rule.body)) continue;
      for (const selector of rule.selectors) expect(selector).not.toMatch(/::/);
    }
  });

  it('ends every animation and transition the file declares under both Reduced Motion switches', () => {
    const osBlock = block(sheet, '@media (prefers-reduced-motion: reduce)');
    const os = rulesIn(osBlock);
    const app = rulesIn(sheet).filter((rule) =>
      rule.selectors.every((selector) => selector.startsWith(":root[data-reduced-motion='true'] ")),
    );
    const moving = rulesIn(sheet.replace(osBlock, '')).filter(
      (rule) =>
        /\b(?:animation|transition)\s*:\s*(?!none\b)\S/.test(rule.body) &&
        !rule.selectors.some((selector) => selector.startsWith(':root[data-reduced-motion')),
    );
    expect(moving.flatMap((rule) => rule.selectors).sort()).toEqual([
      '.pg-peg',
      '.pg-peg-arrive',
      '.pg-peg-arrive::before',
      '.pg-peg-vanish',
    ]);
    for (const { selectors, body } of moving) {
      const property = /\banimation\s*:/.test(body) ? 'animation' : 'transition';
      for (const selector of selectors) {
        const ended = (rules: typeof os, wanted: string) =>
          rules.some(
            (rule) =>
              rule.selectors.includes(wanted) && new RegExp(`${property}:\\s*none`).test(rule.body),
          );
        expect(ended(os, selector), `${selector} under the OS preference`).toBe(true);
        expect(
          ended(app, `:root[data-reduced-motion='true'] ${selector}`),
          `${selector} under the app setting`,
        ).toBe(true);
      }
    }
  });
});
