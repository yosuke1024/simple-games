/**
 * The six tile colours are game content, drawn on --surface (the board's
 * frame) and, as the palette's round keys, on --paper (docs/COLOR_FLOOD_RULES.md
 * 「Visual follow-up (2026-10-29)」). Each theme has its own six values in the
 * two blocks at the top of color-flood.css. The rules promise three things,
 * measured here from the stylesheets rather than trusted to a comment (the
 * same approach as gem-swap/ui/contrast.test.ts):
 *
 * - the symbol drawn on a tile (and with it the contour of a flooded region and
 *   the origin mark, which are the same ink) reads on it at WCAG's 4.5:1;
 * - a tile clears the 3:1 floor for graphical objects (docs/BRAND.md
 *   「コントラスト」) against --surface and --paper, in the dark theme for all
 *   six and in the light theme for all but the two that cannot — light yellow
 *   and light orange are named below, and the test fails if that list drifts,
 *   in either direction;
 * - the light that falls from above (a lit top edge, a shaded bottom edge, the
 *   key's cast shadow) shows on the colours it lands on, and nothing in the
 *   file writes a colour outside the two blocks.
 *
 * The texture carries no meaning (the symbol and the contour do), so it has no
 * 3:1 to clear; what is pinned is that the lit side is lighter than the
 * shaded one and that each cue is visible at all.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/color-flood/ui/color-flood.css'), 'utf8');
/** The stylesheet without its comments, so prose never reads as a rule. */
const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** CSS named colours (CSS Color 4). Any of them in a declaration value is a colour literal. */
const NAMED_COLOURS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.split(/\s+/),
);

/**
 * Colour words written in the declaration values of this CSS: anything that is
 * a named colour once `var(...)` and the keywords that are not a colour
 * (transparent, currentColor, inherit, none...) are set aside. Properties and
 * selectors are not looked at, so `.cf-colour-0` or `border-color:` never match.
 */
function namedColoursIn(css: string): string[] {
  const found: string[] = [];
  for (const body of css.matchAll(/\{([^{}]*)\}/g)) {
    for (const declaration of body[1]!.split(';')) {
      const value = declaration
        .slice(declaration.indexOf(':') + 1)
        .replace(/var\([^)]*\)/g, ' ')
        .toLowerCase();
      for (const word of value.match(/[a-z]+(?:-[a-z]+)*/g) ?? []) {
        if (NAMED_COLOURS.has(word)) found.push(word);
      }
    }
  }
  return found;
}

type Colour = { r: number; g: number; b: number; a: number };

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

/** Every `--name: value;` in a block body, values as written. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim());
  }
  return out;
}

const THEMES = [
  { name: 'light', header: '\n:root {' },
  { name: 'dark', header: "\n:root[data-theme='dark'] {" },
] as const;
type Theme = (typeof THEMES)[number];

/** A token of the game's block for this theme, resolved to a colour (var() looks in the shell's block). */
function colourOf(theme: Theme, name: string): Colour {
  const value = declarations(block(gameCss, theme.header)).get(name);
  expect(value, `${name} under ${theme.name}`).toBeDefined();
  return parse(theme, value!);
}

function parse(theme: Theme, value: string): Colour {
  const alias = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (alias) {
    const shared = declarations(block(sharedCss, theme.header)).get(alias);
    expect(shared, `${alias} under ${theme.name} in styles.css`).toBeDefined();
    return parse(theme, shared!);
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\s*\)$/.exec(value);
  expect(rgba, `${value} is neither #rrggbb, rgba() nor var()`).not.toBeNull();
  return { r: Number(rgba![1]), g: Number(rgba![2]), b: Number(rgba![3]), a: Number(rgba![4]) };
}

/** WCAG 2 relative luminance of an opaque colour. */
function luminance({ r, g, b }: Colour): number {
  const [lr, lg, lb] = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: Colour, b: Colour): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `top` laid over the opaque `under`, as the renderer does. */
function laid(top: Colour, under: Colour): Colour {
  const mix = (over: number, base: number) => Math.round(over * top.a + base * (1 - top.a));
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

const KINDS = [0, 1, 2, 3, 4, 5] as const;
const NAMES = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;

/** Light yellow and light orange sit under 3:1 on the paper; dark has none. */
const BELOW_FLOOR: Record<Theme['name'], readonly number[]> = { light: [2, 5], dark: [] };

function surfaceAndPaper(theme: Theme): { surface: Colour; paper: Colour } {
  const base = declarations(block(sharedCss, theme.header));
  return {
    surface: parse(theme, base.get('--surface')!),
    paper: parse(theme, base.get('--paper')!),
  };
}

describe('the tile colours and their ink (docs/COLOR_FLOOD_RULES.md)', () => {
  it('measures black on white at 21:1', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrast(black, white)).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    it(`reads the symbol, the contour and the origin mark on every tile at 4.5:1 (${theme.name})`, () => {
      for (const kind of KINDS) {
        const ratio = contrast(
          colourOf(theme, `--cf-${kind}-ink`),
          colourOf(theme, `--cf-${kind}`),
        );
        // Printed for docs/COLOR_FLOOD_RULES.md; the gate is the 4.5 below.
        console.info(
          `[color-flood contrast] ${theme.name} ${NAMES[kind]} ink on tile: ${ratio.toFixed(2)}`,
        );
        expect(ratio, `--cf-${kind}-ink on --cf-${kind}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`clears 3:1 on --surface and --paper except the colours named (${theme.name})`, () => {
      const { surface, paper } = surfaceAndPaper(theme);
      const missing: number[] = [];
      for (const kind of KINDS) {
        const tile = colourOf(theme, `--cf-${kind}`);
        const onSurface = contrast(tile, surface);
        const onPaper = contrast(tile, paper);
        console.info(
          `[color-flood contrast] ${theme.name} ${NAMES[kind]} tile on --surface ${onSurface.toFixed(2)}, on --paper ${onPaper.toFixed(2)}`,
        );
        if (Math.min(onSurface, onPaper) < 3) missing.push(kind);
      }
      // Exactly the named colours: a new miss fails, and so does a fix that
      // leaves a stale name (the rules document would still list it).
      expect(missing).toEqual(BELOW_FLOOR[theme.name]);
    });
  }

  it('gives the dark theme values of its own, not the light ones', () => {
    for (const kind of KINDS) {
      expect(colourOf(THEMES[1], `--cf-${kind}`), `--cf-${kind}`).not.toEqual(
        colourOf(THEMES[0], `--cf-${kind}`),
      );
    }
  });

  it('keeps the six tiles of a theme six different colours', () => {
    // The symbols are what tells tiles apart; this only guards against two
    // tiles of a theme collapsing into one colour through an editing slip.
    for (const theme of THEMES) {
      const tiles = KINDS.map((kind) => JSON.stringify(colourOf(theme, `--cf-${kind}`)));
      expect(new Set(tiles).size, theme.name).toBe(6);
    }
  });
});

describe('colour is written in the two blocks at the top and nowhere else', () => {
  it('opens the file with the light block and then the dark block', () => {
    const start = code.trimStart();
    expect(start.startsWith(':root {')).toBe(true);
    expect(start.indexOf(":root[data-theme='dark'] {")).toBeGreaterThan(0);
    const lightEnd = start.indexOf('}');
    expect(
      start
        .slice(lightEnd + 1)
        .trimStart()
        .startsWith(":root[data-theme='dark'] {"),
    ).toBe(true);
  });

  it('declares the same sixteen tokens in both themes', () => {
    const want = [
      ...KINDS.flatMap((kind) => [`--cf-${kind}`, `--cf-${kind}-ink`]),
      '--cf-seam',
      '--cf-light',
      '--cf-shade',
      '--cf-drop',
    ].sort();
    for (const theme of THEMES) {
      expect([...declarations(block(gameCss, theme.header)).keys()].sort(), theme.name).toEqual(
        want,
      );
    }
  });

  it('writes no colour literal below them', () => {
    let outside = code;
    for (const theme of THEMES) outside = outside.replace(block(code, theme.header), '');
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
    // Named colours would slip past the two checks above, in any position of a
    // value (`border: 1px solid white`) and whichever of the 148 they are.
    expect(namedColoursIn(outside)).toEqual([]);
  });

  it('would notice a named colour, wherever it stands in a value', () => {
    expect(namedColoursIn('a { color: navy; }')).toEqual(['navy']);
    expect(namedColoursIn('a { border: 1px solid White; }')).toEqual(['white']);
    expect(namedColoursIn('a { box-shadow: 0 0 0 1px gray, 0 2px 0 var(--line); }')).toEqual([
      'gray',
    ]);
    expect(namedColoursIn('@media (x) { a { outline: 2px solid red; } }')).toEqual(['red']);
    // Keywords, tokens and compound words that merely contain a colour are not colours.
    expect(
      namedColoursIn(
        'a { color: currentColor; background: var(--cf-0) transparent; border: 0 solid none; ' +
          'transition: color 0.14s ease-out; box-sizing: border-box; place-items: center; }',
      ),
    ).toEqual([]);
  });

  it('reads the tokens in the six colour classes and nothing else', () => {
    for (const kind of KINDS) {
      expect(rulesOf(`.cf-colour-${kind}`)).toBe(
        `background: var(--cf-${kind}); color: var(--cf-${kind}-ink);`,
      );
    }
  });
});

describe('the light comes from above, in both themes (docs/COLOR_FLOOD_RULES.md)', () => {
  for (const theme of THEMES) {
    it(`lights the top with the lighter token and shades the bottom with the darker (${theme.name})`, () => {
      const { surface } = surfaceAndPaper(theme);
      const light = colourOf(theme, '--cf-light');
      const shade = colourOf(theme, '--cf-shade');
      for (const [name, colour] of [
        ['--cf-light', light],
        ['--cf-shade', shade],
        ['--cf-seam', colourOf(theme, '--cf-seam')],
      ] as const) {
        expect(colour.a, name).toBeGreaterThan(0);
        expect(colour.a, name).toBeLessThanOrEqual(1);
      }
      expect(luminance(light)).toBeGreaterThan(luminance(shade));
      // The shadow falls on a tile, so it is darker than the surface the tile sits on.
      expect(luminance(shade)).toBeLessThan(luminance(surface));
    });

    it(`shows the lit edge and the shaded edge on all six tiles (${theme.name})`, () => {
      const light = colourOf(theme, '--cf-light');
      const shade = colourOf(theme, '--cf-shade');
      const floors = { '--cf-light': 1.05, '--cf-shade': 1.1 } as const;
      for (const [name, veil] of [
        ['--cf-light', light],
        ['--cf-shade', shade],
      ] as const) {
        const ratios = KINDS.map((kind) => {
          const tile = colourOf(theme, `--cf-${kind}`);
          return contrast(laid(veil, tile), tile);
        });
        console.info(
          `[color-flood contrast] ${theme.name} ${name} on the six tiles: ${ratios.map((ratio) => ratio.toFixed(2)).join(' ')}`,
        );
        // Texture, not a mark: the gate is only that the cue exists on every tile.
        for (const ratio of ratios) expect(ratio, name).toBeGreaterThanOrEqual(floors[name]);
      }
    });

    it(`casts a shadow that shows on the paper (${theme.name})`, () => {
      const { paper } = surfaceAndPaper(theme);
      const drop = laid(colourOf(theme, '--cf-drop'), paper);
      const ratio = contrast(drop, paper);
      console.info(
        `[color-flood contrast] ${theme.name} --cf-drop on --paper: ${ratio.toFixed(2)}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(1.1);
    });
  }
});

/** The normalised body of the first rule whose selector starts a line as `selector {`, comments removed. */
function rulesOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodies = [...code.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'gm'))];
  expect(bodies.length, `${selector} is missing`).toBeGreaterThan(0);
  return bodies.map((match) => match[1]!.replace(/\s+/g, ' ').trim()).join(' ');
}

/** Where the first rule with this exact selector begins in the comment-free source. */
function at(selector: string): number {
  const found = code.indexOf(`\n${selector} {`);
  expect(found, `${selector} is missing`).toBeGreaterThan(-1);
  return found;
}

describe('the frame, the flooded region and the keys (docs/COLOR_FLOOD_RULES.md)', () => {
  it('draws the collection’s board frame on the frame, the lift first', () => {
    expect(rulesOf('.cf-board-frame')).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
  });

  it('lays one lit top edge and one shaded bottom edge over the whole board, not on each tile', () => {
    expect(rulesOf('.cf-board')).toContain('position: relative;');
    const sheet = rulesOf('.cf-board::after');
    expect(sheet).toContain('pointer-events: none;');
    expect(sheet).toContain('border-radius: inherit;');
    expect(sheet).toContain(
      'box-shadow: inset 0 1px 0 var(--cf-light), inset 0 -2px 0 var(--cf-shade);',
    );
    expect(sheet).not.toMatch(/animation|transition|filter/);
    // A bevel on the tiles would draw a second grid over the one sheet a flooded region becomes.
    expect(rulesOf('.cf-tile')).not.toMatch(/--cf-light|--cf-shade/);
  });

  it('removes the seams inside a flooded region, after the tile rule that draws them', () => {
    expect(rulesOf('.cf-tile')).toContain('box-shadow: inset 0 0 0 0.5px var(--cf-seam);');
    expect(rulesOf('.cf-connected')).toBe('box-shadow: none;');
    // Same specificity, so the later rule wins; moving it above would bring the seams back.
    expect(at('.cf-connected')).toBeGreaterThan(at('.cf-tile'));
  });

  it('draws the contour in the tile’s own ink, so it reads on yellow', () => {
    expect(rulesOf('.cf-connected::after')).toContain('border: 0 solid currentColor;');
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(rulesOf(`.cf-edge-${side}::after`)).toBe(`border-${side}-width: 2px;`);
    }
  });

  it('builds the Quick Rules figure like the board: no gap between tiles', () => {
    expect(rulesOf('.cf-figure')).toContain('gap: 0;');
  });

  it('raises the palette keys 2px and sinks them on press, with a shadow and never a transform', () => {
    expect(rulesOf('.cf-paint')).toContain(
      'box-shadow: inset 0 1px 0 var(--cf-light), inset 0 -2px 0 var(--cf-shade), 0 2px 0 var(--cf-drop);',
    );
    expect(rulesOf('.cf-paint:active:not(:disabled)')).toBe(
      'box-shadow: inset 0 1px 2px var(--cf-shade);',
    );
    // A transform moves the disc from under the finger and the click is lost.
    expect(code.match(/\.cf-paint[^{]*\{[^}]*transform\s*:/g) ?? []).toEqual([]);
  });

  it('keeps a key that cannot be played flat, and the current colour pressed in with its outline', () => {
    expect(rulesOf('.cf-paint:disabled')).toContain('box-shadow: none;');
    expect(rulesOf('.cf-paint:disabled')).toContain('opacity: 0.38;');
    const current = rulesOf('.cf-paint.cf-current');
    expect(current).toContain('box-shadow: inset 0 1px 2px var(--cf-shade);');
    // The outline is the cue that does not rely on the shadow; it stays.
    expect(current).toContain('outline: 1px solid var(--ink-soft);');
    // Same specificity as :disabled, and the current colour is disabled too.
    expect(at('.cf-paint.cf-current')).toBeGreaterThan(at('.cf-paint:disabled'));
  });
});

describe('the colour settles in, and Reduced Motion ends it (docs/COLOR_FLOOD_RULES.md)', () => {
  it('eases a tile’s background and ink together over 140ms, and the bar over 180ms', () => {
    const tile = rulesOf('.cf-tile');
    expect(tile).toContain('transition: background-color 0.14s ease-out, color 0.14s ease-out;');
    expect(rulesOf('.cf-progress > span')).toContain('transition: width 0.18s ease-out;');
    // The contour is a pseudo-element; the shell’s Reduced Motion rule keeps those at `none`,
    // so nothing is declared on it here.
    expect(code).not.toMatch(/::(?:before|after)[^{]*\{[^}]*transition/);
  });

  it('turns every transition added here off under both Reduced Motion routes', () => {
    const os = block(code, '@media (prefers-reduced-motion: reduce)').replace(/\s+/g, ' ');
    expect(os).toContain('.cf-tile, .cf-progress > span { transition: none; }');
    const app = code.replace(/\s+/g, ' ');
    expect(app).toContain(
      ":root[data-reduced-motion='true'] .cf-tile, :root[data-reduced-motion='true'] .cf-progress > span { transition: none; }",
    );
    // After the rules they switch off, so the order of the file does not decide it.
    expect(code.indexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(at('.cf-tile'));
    expect(code.indexOf("\n:root[data-reduced-motion='true'] .cf-tile")).toBeGreaterThan(
      at('.cf-progress > span'),
    );
  });

  it('adds nothing the old Android WebView lacks, and nothing heavy', () => {
    expect(code).not.toMatch(/\bfilter\s*:|backdrop-filter/);
    expect(code).not.toMatch(
      /:has\(|color-mix\(|container-type|@container|@keyframes|animation\s*:/,
    );
    // The knobs of a transition on an element that changes colour: never `all`.
    expect(code).not.toMatch(/transition\s*:\s*all\b/);
  });
});
