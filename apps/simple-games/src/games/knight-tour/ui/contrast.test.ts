/**
 * The board's own colours (docs/KNIGHT_TOUR_RULES.md, "Visual refinement"):
 * two squares, the ink of the marks printed on them, the knight's ivory and
 * ink, three alpha-only shades and the lip under the visit numbers, in the two
 * blocks at the top of knight-tour.css. The rules promise the small visit
 * numbers read at WCAG's 4.5:1 and the shapes (the move dots, the knight) at
 * its 3:1 floor for graphical objects on both squares in both themes. That is
 * measured here from the stylesheet rather than trusted to a comment (the same
 * approach as chess/ui/contrast.test.ts and gem-swap/ui/contrast.test.ts).
 *
 * The number is held to 4.5:1 against the square and against the lip drawn
 * right under it: a light lip under a light figure (the dark theme) would take
 * the figure to 3.4:1, which is why that theme sets no lip under a number.
 *
 * The knight is a fill inside an edge of the other colour. What carries it is
 * pinned per theme (the ink edge on the light theme's squares, the ivory fill
 * on the dark theme's), so a later change cannot let the other, weaker one
 * stand in; the two must part at 3:1 so the inner shape is itself visible. The
 * letterpress marks and the contact shadow carry no meaning, so they have no
 * 3:1 to clear; what is pinned is where the light comes from (the lip lighter
 * than the square it sits on, the shade and the shadow darker), that neither
 * the shaded top row of a dot nor its lip can take the dot under the floor,
 * and that no colour is written outside the blocks.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHESS_PIECE_BASE_PATH } from '@/ui/components/KnightArtwork';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/games/knight-tour/ui/knight-tour.css'), 'utf8');

// CSS named colours (keywords like `transparent` and `currentcolor` are not
// colours of their own and stay allowed).
const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
  'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
  'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
  'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
  'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey ' +
  'dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray ' +
  'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
  'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray ' +
  'lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
  'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
  'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
  'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
  'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna ' +
  'silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle ' +
  'tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

const THEMES = [
  { name: 'light', selector: '.kt-screen,' },
  { name: 'dark', selector: ":root[data-theme='dark'] .kt-screen," },
] as const;

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function hex(value: string): Rgb {
  return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)) as Rgb;
}

/** A translucent colour laid over an opaque one, blended per sRGB channel as the browser does. */
function over([r, g, b, alpha]: Rgba, under: Rgb): Rgb {
  return [r, g, b].map((channel, i) => channel * alpha + under[i]! * (1 - alpha)) as Rgb;
}

/** The body of the theme's colour block: the rule whose selector list opens with this selector. */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector}`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

function colours(theme: (typeof THEMES)[number]) {
  const body = block(theme.selector);
  const solid = (name: string): Rgb => {
    const value = new RegExp(`${name}:\\s*(#[0-9a-f]{6})\\s*;`).exec(body)?.[1];
    expect(value, `${name} under ${theme.selector}`).toBeDefined();
    return hex(value!);
  };
  const translucent = (name: string): Rgba => {
    const match = new RegExp(
      `${name}:\\s*rgba\\(\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([0-9.]+)\\s*\\)\\s*;`,
    ).exec(body);
    expect(match, `${name} under ${theme.selector}`).not.toBeNull();
    return [Number(match![1]), Number(match![2]), Number(match![3]), Number(match![4])];
  };
  const lit = translucent('--kt-lit');
  // The lip under a number is the dot's lip (an alias of --kt-lit) or none.
  const lipValue = /--kt-number-lip:\s*([^;]+);/.exec(body)?.[1]?.trim();
  expect(['var(--kt-lit)', 'transparent'], `--kt-number-lip under ${theme.selector}`).toContain(
    lipValue,
  );
  return {
    squares: [solid('--kt-square-light'), solid('--kt-square-dark')],
    ink: solid('--kt-board-ink'),
    piece: solid('--kt-piece'),
    edge: solid('--kt-piece-edge'),
    lit,
    shade: translucent('--kt-shade'),
    contact: translucent('--kt-contact'),
    numberLip: lipValue === 'var(--kt-lit)' ? lit : null,
  };
}

/** The declarations of the first rule with exactly this selector list (no nested braces). */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

/** The text between the braces of `@keyframes name`, whose frames nest one level. */
function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  expect(start, `@keyframes ${name} is missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (let at = css.indexOf('{', start); at < css.length; at++) {
    if (css[at] === '{') depth++;
    if (css[at] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, at);
  }
  throw new Error(`@keyframes ${name} is not closed`);
}

describe('Knight’s Tour visit-number contrast', () => {
  for (const theme of THEMES) {
    it(`keeps small visit numbers readable on both squares in ${theme.name} mode`, () => {
      const { ink, squares } = colours(theme);
      for (const square of squares) {
        expect(contrast(ink, square)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`keeps a number readable against the lip under it too (${theme.name})`, () => {
      const { ink, squares, numberLip } = colours(theme);
      for (const square of squares) {
        const under = numberLip ? over(numberLip, square) : square;
        // Printed for docs/KNIGHT_TOUR_RULES.md; the gate is the 4.5:1 below.
        console.info(
          `[knight-tour contrast] ${theme.name} number on ${square.join(',')}: figure vs square ${contrast(ink, square).toFixed(2)}, vs the lip under it ${contrast(ink, under).toFixed(2)}${numberLip ? '' : ' (no lip)'}`,
        );
        expect(contrast(ink, under), 'the figure against its lip').toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`keeps the move dot a shape on both squares, shaded top row and lip included (${theme.name})`, () => {
      const { ink, squares, shade, lit } = colours(theme);
      // The dot is the ink; its inset shade darkens (or on the dark theme,
      // dims) the top row. Measured at the shade's full alpha, the worst case
      // of a 1px blur, against the square it is hardest to see on.
      const topRow = over(shade, ink);
      for (const square of squares) {
        // The 1px lip under the dot is the nearest ground to its lower edge.
        const lip = over(lit, square);
        // Printed for docs/KNIGHT_TOUR_RULES.md; the gate is the 3:1 below.
        console.info(
          `[knight-tour contrast] ${theme.name} dot on ${square.join(',')}: ${contrast(ink, square).toFixed(2)}, shaded top row ${contrast(topRow, square).toFixed(2)}, against its lip ${contrast(ink, lip).toFixed(2)}`,
        );
        expect(contrast(ink, square), 'the dot').toBeGreaterThanOrEqual(3);
        expect(contrast(topRow, square), 'the dot’s shaded top row').toBeGreaterThanOrEqual(3);
        expect(contrast(ink, lip), 'the dot against its lip').toBeGreaterThanOrEqual(3);
      }
    });
  }
});

// What carries the knight on each theme's squares: the ink edge where the
// ivory fill is close to the square (light), the ivory fill where the edge is
// (dark). Pinned rather than "either", so thinning the light theme's edge
// cannot pass on the strength of a fill that is 1.2:1 there.
const CARRIES = { light: 'edge', dark: 'fill' } as const;

describe('the knight on the board', () => {
  for (const theme of THEMES) {
    const { squares, piece, edge } = colours(theme);
    const carrier = CARRIES[theme.name];

    it(`reads on both squares through its ${carrier}, at 3:1 (${theme.name})`, () => {
      for (const square of squares) {
        // Printed for docs/KNIGHT_TOUR_RULES.md; the gate is the 3:1 below.
        console.info(
          `[knight-tour contrast] ${theme.name} knight on ${square.join(',')}: fill ${contrast(piece, square).toFixed(2)}, edge ${contrast(edge, square).toFixed(2)}`,
        );
        expect(
          contrast(carrier === 'edge' ? edge : piece, square),
          `the knight's ${carrier} on ${square.join(',')}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it(`has a fill and an edge that part at 3:1 (${theme.name})`, () => {
      console.info(
        `[knight-tour contrast] ${theme.name} knight fill vs edge ${contrast(piece, edge).toFixed(2)}`,
      );
      expect(contrast(piece, edge)).toBeGreaterThanOrEqual(3);
    });
  }

  it('is the same ivory and ink in both themes, never swapped with them', () => {
    const [light, dark] = THEMES.map(colours);
    expect(dark!.piece).toEqual(light!.piece);
    expect(dark!.edge).toEqual(light!.edge);
  });

  it('is painted from the piece tokens, not from literals', () => {
    expect(rule('.kt-piece path,\n.kt-piece circle')).toMatch(
      /fill:\s*var\(--kt-piece\);\s*stroke:\s*var\(--kt-piece-edge\);/,
    );
    expect(rule('.kt-piece .knight-eye')).toMatch(/fill:\s*var\(--kt-piece-edge\)/);
  });
});

describe('the letterpress marks and the contact shadow (decoration, no 3:1)', () => {
  for (const theme of THEMES) {
    it(`lights the lip lighter, and shades the wall and the shadow darker, than either square (${theme.name})`, () => {
      const { squares, lit, shade, contact } = colours(theme);
      for (const square of squares) {
        expect(luminance(over(lit, square)), 'the lip').toBeGreaterThan(luminance(square));
        expect(luminance(over(shade, square)), 'the shade').toBeLessThan(luminance(square));
        expect(luminance(over(contact, square)), 'the contact shadow').toBeLessThan(
          luminance(square),
        );
      }
    });

    it(`keeps the three shades translucent, so the squares still show through (${theme.name})`, () => {
      const { lit, shade, contact } = colours(theme);
      for (const alpha of [lit[3], shade[3], contact[3]]) {
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(0.6);
      }
    });
  }

  it('puts the lip under the numbers and the dots and the shade inside the dot', () => {
    expect(rule('.kt-visit-number')).toMatch(/text-shadow:\s*0 1px 0 var\(--kt-number-lip\);/);
    const dot = rule('.kt-move-dot');
    expect(dot).toMatch(/0 1px 0 var\(--kt-lit\)/);
    expect(dot).toMatch(/inset 0 1px 1px var\(--kt-shade\)/);
    // The size and the ink of the dot are the ones the contrast above is measured on.
    expect(dot).toMatch(/width:\s*16%/);
    expect(dot).toMatch(/background:\s*var\(--kt-board-ink\)/);
  });

  it('centres the contact shadow on the pedestal’s lower edge, as wide as the base', () => {
    // The knight's svg fills 96% of the cell, inset 2%, over a 40-unit viewBox.
    const scale = 0.96 / 40;
    const bottom = Number(/^M[\d.]+ ([\d.]+)/.exec(CHESS_PIECE_BASE_PATH)![1]);
    const [left, right] = [/^M([\d.]+)/, /H([\d.]+)/].map((pattern) =>
      Number(pattern.exec(CHESS_PIECE_BASE_PATH)![1]),
    );
    const stroke = Number(
      /stroke-width:\s*([\d.]+)/.exec(rule('.kt-piece path,\n.kt-piece circle'))![1],
    );
    const edge = (0.02 + (bottom + stroke / 2) * scale) * 100;
    const gradient = /radial-gradient\(\s*ellipse ([\d.]+)% ([\d.]+)% at 50% ([\d.]+)%/.exec(
      rule('.kt-cell.kt-current::before'),
    );
    expect(gradient, 'the contact shadow is an ellipse gradient').not.toBeNull();
    const [radiusX, radiusY, centreY] = [1, 2, 3].map((i) => Number(gradient![i]));
    expect(Math.abs(centreY! - edge), 'its centre sits on the pedestal’s lower edge').toBeLessThan(
      1,
    );
    expect(radiusX, 'at least as wide as the straight part of the base').toBeGreaterThanOrEqual(
      ((right! - left!) / 2) * scale * 100,
    );
    // The strip below the base is its lower half; it has to stay inside the cell.
    expect(centreY! + radiusY!).toBeLessThanOrEqual(100);
  });
});

describe('the knight’s landing (one 140ms move, never a loop)', () => {
  it('plays once when the knight is mounted, on the piece and its shadow only', () => {
    expect(rule('.kt-cell > .kt-piece')).toMatch(/animation:\s*kt-settle 140ms ease-out;/);
    expect(rule('.kt-cell.kt-current::before')).toMatch(
      /animation:\s*kt-shadow-in 140ms ease-out;/,
    );
    // The tutorial figure's knight is not a board cell and is not animated.
    expect(css.match(/animation:\s*kt-/g)).toHaveLength(2);
  });

  it('animates transform and opacity only, and never repeats', () => {
    const properties = (body: string) =>
      [...body.matchAll(/([a-z-]+):/g)].map((match) => match[1]).filter((p) => p !== 'from');
    expect(new Set(properties(keyframes('kt-settle')))).toEqual(new Set(['transform']));
    expect(new Set(properties(keyframes('kt-shadow-in')))).toEqual(new Set(['opacity']));
    expect(css).not.toMatch(/infinite|animation-iteration-count/);
  });

  it('is switched off under Reduced Motion, both the OS setting and the app’s', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.kt-cell > \.kt-piece,\s*\.kt-cell\.kt-current::before \{\s*animation: none;\s*\}\s*\}/,
    );
    expect(css).toMatch(
      /:root\[data-reduced-motion='true'\] \.kt-cell > \.kt-piece,\s*:root\[data-reduced-motion='true'\] \.kt-cell\.kt-current::before \{\s*animation: none;\s*\}/,
    );
  });
});

describe('the stylesheet’s colours', () => {
  it('declares the same tokens in both blocks', () => {
    const names = (body: string) => [...body.matchAll(/(--kt-[\w-]+):/g)].map((m) => m[1]).sort();
    const [light, dark] = THEMES.map((theme) => names(block(theme.selector)));
    expect(light).toEqual(dark);
    expect(light).toEqual(
      [
        '--kt-board-ink',
        '--kt-contact',
        '--kt-lit',
        '--kt-number-lip',
        '--kt-piece',
        '--kt-piece-edge',
        '--kt-shade',
        '--kt-square-dark',
        '--kt-square-light',
      ].sort(),
    );
  });

  it('writes no colour literal anywhere but the two blocks at the top', () => {
    // Everything after the two blocks reads tokens; a literal there would be a
    // colour the tests above do not measure. Comments are not styles.
    let outside = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const theme of THEMES) {
      const body = block(theme.selector);
      // The block as written, comments included, may differ from the stripped one.
      outside = outside.replace(body.replace(/\/\*[\s\S]*?\*\//g, ''), '');
    }
    expect(outside).not.toContain('--kt-lit: ');
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    // Nor a named colour (`white`, `black`, ...). A name is a whole word: not
    // part of a class or a custom property (`.kt-board`, `--kt-square-dark`).
    expect(
      outside.match(new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`, 'gi')) ?? [],
    ).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
  });
});
