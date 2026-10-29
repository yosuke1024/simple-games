/**
 * The tray and the wooden blocks are this game's own colours
 * (docs/UNBLOCK_PUZZLE_RULES.md §14, ui/unblock-puzzle.css): a material, not a
 * role, so they live in the stylesheet's two token blocks and nowhere else.
 * The rules promise the shapes that carry meaning read as WCAG's 3:1 floor for
 * graphical objects — the tray's rim on the page, a block's outline on the
 * tray, the floor and its own face, the groove on the face, and every mark
 * drawn in the accent (the target, the Hint's rings) or the ink (the
 * selection, the keyboard focus, the destination dots) on the surface it lands
 * on. That is measured here from the stylesheets rather than trusted to a
 * comment (the same approach as chess/ui/contrast.test.ts).
 *
 * The grain and the lit and shaded edges are translucent layers (rgba), which
 * the measurement composites the way the browser does, in sRGB, in the order
 * the stylesheet paints them. They are texture: none of them carries a
 * meaning, so what is gated there is a ceiling, not a floor.
 *
 * A few pairs are knowingly under 3:1 and are not gated as such (§14 records
 * them and what carries the meaning instead): the selection's ink on an
 * unselected outline, and the Hint's accent where it crosses the grain in the
 * dark theme. Each has a lower bound here so the recorded numbers cannot
 * quietly stop being true. (The Hint's accent on the block's own outline,
 * about 1:1 in both themes — about 1.6 in the old design, whose outline was
 * the grey --stone-line — is carried by the dashes' gaps and the faint fill,
 * and has no bound.)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/unblock-puzzle/ui/unblock-puzzle.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');
const gameCode = withoutComments(gameCss);
const sharedCode = withoutComments(sharedCss);

type Rgb = readonly [number, number, number];
interface Paint {
  readonly rgb: Rgb;
  readonly alpha: number;
}

/** The body of the first rule whose header starts so (a selector, or a selector list's first line). */
function body(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

function hex(value: string): Rgb {
  return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)) as unknown as Rgb;
}

/** Every `--name: #rrggbb;` and `--name: rgba(r, g, b, a);` in a block body. */
function paints(source: string): Map<string, Paint> {
  const out = new Map<string, Paint>();
  for (const match of source.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out.set(match[1]!, { rgb: hex(match[2]!), alpha: 1 });
  }
  for (const match of source.matchAll(
    /(--[\w-]+):\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*;/gi,
  )) {
    out.set(match[1]!, {
      rgb: [Number(match[2]), Number(match[3]), Number(match[4])],
      alpha: Number(match[5]),
    });
  }
  return out;
}

/** `top` painted over an opaque colour, the way CSS composites in sRGB. */
function over(top: Paint, below: Rgb): Rgb {
  return below.map(
    (channel, at) => top.alpha * top.rgb[at]! + (1 - top.alpha) * channel,
  ) as unknown as Rgb;
}

/** WCAG 2 relative luminance. */
function luminance(colour: Rgb): number {
  const [r, g, b] = colour.map((byte) => {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const THEMES = [
  { name: 'light', block: ':root {', accent: ":root[data-game='unblock-puzzle']," },
  {
    name: 'dark',
    block: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='unblock-puzzle'],",
  },
] as const;

/** Everything one theme paints with: this game's tokens, the series' and the title's, and the layers between. */
function surfaces(theme: (typeof THEMES)[number]) {
  const own = paints(body(gameCode, theme.block));
  const series = paints(body(sharedCode, theme.block));
  const title = paints(body(sharedCode, theme.accent));
  const get = (map: Map<string, Paint>, name: string) => {
    const value = map.get(name);
    expect(value, `${name} under ${theme.block}`).toBeDefined();
    return value!;
  };
  const tray = get(own, '--ub-tray').rgb;
  const floor = get(own, '--ub-floor').rgb;
  const wood = get(own, '--ub-wood').rgb;
  const hi = get(own, '--ub-hi');
  const lo = get(own, '--ub-lo');
  const grain = get(own, '--ub-grain');
  const ghost = get(title, '--accent-ring-soft');
  return {
    paper: get(series, '--paper').rgb,
    ink: get(series, '--ink').rgb,
    inkSoft: get(series, '--ink-soft').rgb,
    accent: get(title, '--accent').rgb,
    accentInk: get(title, '--accent-ink').rgb,
    tray,
    trayEdge: get(own, '--ub-tray-edge').rgb,
    floor,
    // The top 2px of every square, and the exit channel, in shade.
    floorShade: over(lo, floor),
    // The Hint's destination: the accent's faint fill over the square.
    floorGhost: over(ghost, floor),
    wood,
    press: get(own, '--ub-wood-press').rgb,
    edge: get(own, '--ub-edge').rgb,
    woodHi: over(hi, wood),
    woodLo: over(lo, wood),
    woodGrain: over(grain, wood),
    // Where the 9px and the 23px layers cross.
    woodGrain2: over(grain, over(grain, wood)),
    woodGhost: over(ghost, wood),
  };
}

describe('the tray and the wooden blocks (docs/UNBLOCK_PUZZLE_RULES.md §14)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it('composites a translucent layer the way CSS does', () => {
    // Half white over black is mid grey, 127.5 in each channel.
    expect(over({ rgb: [255, 255, 255], alpha: 0.5 }, [0, 0, 0])).toEqual([127.5, 127.5, 127.5]);
  });

  for (const theme of THEMES) {
    let s: ReturnType<typeof surfaces>;
    try {
      s = surfaces(theme);
    } catch (error) {
      // A missing token or block shows up as one failing case that names it,
      // not as a collection error for the whole file.
      it(`reads this game’s tokens and the series’ in the ${theme.name} theme`, () => {
        throw error;
      });
      continue;
    }

    // Each is a shape that carries meaning, so each clears 3:1 (WCAG 1.4.11).
    const floors: Array<[string, Rgb, Rgb]> = [
      ['the tray’s rim on the page', s.trayEdge, s.paper],
      ['the tray’s rim against the exit channel (the break in it)', s.trayEdge, s.floor],
      ['a block’s outline on the rib it touches', s.edge, s.tray],
      ['a block’s outline on a square (a drag, the figure’s “was here”)', s.edge, s.floor],
      ['a block’s outline on a square’s shaded top', s.edge, s.floorShade],
      ['the groove on the face', s.edge, s.wood],
      ['the groove on the pressed face', s.edge, s.press],
      ['the groove on the face’s shaded foot', s.edge, s.woodLo],
      ['the target’s outline and the Hint’s ring on a rib', s.accent, s.tray],
      ['the Hint’s destination on a square', s.accent, s.floor],
      ['the Hint’s destination on a square under its own fill', s.accent, s.floorGhost],
      ['the Hint’s destination over the block’s own face', s.accent, s.wood],
      ['the target’s arrow', s.accentInk, s.accent],
      ['the exit’s arrow on the page', s.accent, s.paper],
      ['the selection and the focus ring on a rib', s.ink, s.tray],
      ['the selection and the focus ring on a square', s.ink, s.floor],
      ['the focus ring on a square under the Hint’s fill', s.ink, s.floorGhost],
      ['the selection over the face', s.ink, s.wood],
      ['a destination dot on a square', s.ink, s.floor],
      ['the figure’s arrows on a square', s.inkSoft, s.floor],
      ['the figure’s arrows over a face', s.inkSoft, s.wood],
    ];

    for (const [what, a, b] of floors) {
      it(`${what} clears 3:1 (${theme.name})`, () => {
        // Printed for docs/UNBLOCK_PUZZLE_RULES.md §14; the gate is the 3:1 below.
        console.info(`[unblock contrast] ${theme.name} ${what}: ${contrast(a, b).toFixed(2)}`);
        expect(contrast(a, b), what).toBeGreaterThanOrEqual(3);
      });
    }

    // Under 3:1 on purpose, with the thing that carries the meaning instead
    // (§14). The bound is the recorded value less a margin: a darker grain or
    // a lighter outline would make the table in §14 false.
    const knownLow: Array<[string, Rgb, Rgb, number]> = [
      [
        'the selection’s ink on an unselected outline (the width and aria-pressed carry it)',
        s.ink,
        s.edge,
        2.2,
      ],
      [
        'the Hint’s accent on the block’s grain (the dashes’ other side is on the rib)',
        s.accent,
        s.woodGrain,
        2.5,
      ],
      ['the Hint’s accent where the two grain layers cross', s.accent, s.woodGrain2, 2.1],
      ['the Hint’s accent over the face under its fill', s.accent, s.woodGhost, 2.6],
      ['the groove where the two grain layers cross', s.edge, s.woodGrain2, 2.3],
    ];

    for (const [what, a, b, bound] of knownLow) {
      it(`${what} stays above ${bound}:1 (${theme.name})`, () => {
        console.info(`[unblock contrast] ${theme.name} ${what}: ${contrast(a, b).toFixed(2)}`);
        expect(contrast(a, b), what).toBeGreaterThanOrEqual(bound);
      });
    }

    // Texture carries no meaning, so it is held quiet instead: a ceiling.
    const ceilings: Array<[string, Rgb, Rgb, number]> = [
      ['one grain layer on the face', s.wood, s.woodGrain, 1.3],
      ['the two grain layers where they cross', s.wood, s.woodGrain2, 1.5],
      ['the lit top edge on the face', s.wood, s.woodHi, 1.6],
      ['the shaded bottom edge on the face', s.wood, s.woodLo, 1.6],
    ];

    for (const [what, a, b, ceiling] of ceilings) {
      it(`${what} stays quiet, under ${ceiling}:1 (${theme.name})`, () => {
        console.info(`[unblock contrast] ${theme.name} ${what}: ${contrast(a, b).toFixed(2)}`);
        expect(contrast(a, b), what).toBeLessThanOrEqual(ceiling);
      });
    }

    it(`cuts the squares into the tray: the floor is darker than the rim (${theme.name})`, () => {
      expect(luminance(s.floor)).toBeLessThan(luminance(s.tray));
    });
  }
});

describe('the stylesheet’s colour discipline (docs/architecture/css-split.md)', () => {
  const darkHeader = "\n:root[data-theme='dark'] {";

  /** The sheet with the two token blocks cut out. */
  function outsideTheTokens(): string {
    const lightStart = gameCss.indexOf('\n:root {');
    const darkStart = gameCss.indexOf(darkHeader);
    expect(lightStart, 'the light block is missing').toBeGreaterThan(-1);
    expect(darkStart, 'the dark block is missing').toBeGreaterThan(lightStart);
    const lightEnd = gameCss.indexOf('}', lightStart);
    const darkEnd = gameCss.indexOf('}', darkStart);
    return (
      gameCss.slice(0, lightStart) +
      gameCss.slice(lightEnd + 1, darkStart) +
      gameCss.slice(darkEnd + 1)
    );
  }

  it('puts no colour literal anywhere but the two token blocks', () => {
    // Everything else, comments included, reads tokens; a literal there would
    // be a colour the tests above do not measure.
    expect(outsideTheTokens().match(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/gi) ?? []).toEqual([]);
    expect(gameCss.split('\n:root {')).toHaveLength(2);
    expect(gameCss.split(darkHeader)).toHaveLength(2);
  });

  it('declares the same tokens in both themes, and uses every one', () => {
    const light = [...paints(body(gameCode, ':root {')).keys()].sort();
    const dark = [...paints(body(gameCode, darkHeader.trimStart())).keys()].sort();
    expect(dark).toEqual(light);
    expect(light).toHaveLength(9);
    const rest = withoutComments(outsideTheTokens());
    for (const name of light) {
      expect(rest, `${name} is declared but never used`).toContain(`var(${name})`);
    }
  });

  it('never reads a colour token it does not declare', () => {
    const declared = new Set(paints(body(gameCode, ':root {')).keys());
    const used = [
      ...gameCode.matchAll(/var\((--ub-(?:tray|floor|wood|edge|hi|lo|grain)[\w-]*)/g),
    ].map((match) => match[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(declared.has(name), name).toBe(true);
  });

  it('no longer borrows the stone or the recessed surface of the neutral card', () => {
    expect(gameCode).not.toMatch(/--stone|--surface-recessed/);
  });
});

describe('the pieces of the wood that the colours rely on (§14)', () => {
  /** Every top-level rule with exactly this header, joined: a class can be in a shared group and have a rule of its own. */
  const rule = (header: string) => {
    const found: string[] = [];
    for (
      let at = gameCode.indexOf(`\n${header}`);
      at > -1;
      at = gameCode.indexOf(`\n${header}`, at + 1)
    ) {
      const open = gameCode.indexOf('{', at);
      found.push(gameCode.slice(open + 1, gameCode.indexOf('}', open)));
    }
    expect(found.length, `${header} is missing`).toBeGreaterThan(0);
    return found.join(' ').replace(/\s+/g, ' ');
  };

  it('keeps the series’ board frame, the lift first so it shows', () => {
    expect(rule('.ub-board {')).toContain(
      '0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft)',
    );
  });

  it('draws the exit channel under the blocks, inside the board’s own stacking context', () => {
    // Without z-index -1 the channel is painted over a selected or hinted
    // block in the exit row and eats the outer 2px of its frame; without
    // isolation the -1 would sink the channel under the page.
    expect(rule('.ub-board {')).toContain('isolation: isolate;');
    expect(rule('.ub-exit {')).toContain('z-index: -1;');
  });

  it('gives only the dragged block its own layer', () => {
    expect(gameCode.match(/will-change/g) ?? []).toHaveLength(1);
    expect(rule('.ub-block-dragging {')).toContain('will-change: transform;');
  });

  it('grains the plain blocks along their lane, two layers of 9px and 23px, and not the target', () => {
    for (const lane of ['.ub-block-h {', '.ub-block-v {']) {
      const grain = rule(lane);
      expect(grain.match(/repeating-linear-gradient\(/g) ?? [], lane).toHaveLength(2);
      expect(grain, lane).toContain('+ 9px)');
      expect(grain, lane).toContain('+ 23px)');
      expect(grain, lane).toContain('var(--ub-bevel)');
    }
    expect(rule('.ub-block-target {')).not.toContain('background-image');
    // The lane rules replace .ub-block's background-image, so they come after it.
    expect(gameCode.indexOf('\n.ub-block-h {')).toBeGreaterThan(gameCode.indexOf('\n.ub-block {'));
  });

  it('presses a block by its ground, leaving the grain on it', () => {
    const pressed = rule('.ub-block:active {');
    expect(pressed).toContain('background-color: var(--ub-wood-press);');
    expect(pressed).not.toMatch(/background:|filter/);
  });

  it('cuts the groove in the outline’s colour', () => {
    expect(rule('.ub-groove {')).toContain('background: var(--ub-edge);');
  });

  it('keeps the figure’s “was here” apart from the Hint’s accent dashes (§13)', () => {
    expect(rule('.ub-figure-was {')).toContain('2px dashed var(--ub-edge)');
    expect(rule('.ub-figure-was {')).not.toContain('--accent');
    expect(rule('.ub-ghost {')).toContain('2px dashed var(--accent)');
  });

  it('adds no motion of its own', () => {
    // The wood is paint: the only transitions are the ones the slide already
    // had, which Reduced Motion (both of its switches) already ends.
    expect(gameCode).not.toMatch(/@keyframes|animation\s*:/);
    expect(gameCode).toContain('@media (prefers-reduced-motion: reduce)');
    expect(gameCode).toContain(":root[data-reduced-motion='true'] .ub-block");
  });
});
