/**
 * Echo Pads writes no colour of its own (docs/ECHO_PADS_RULES.md §11): the
 * pads, the base they stand on and the controls under them are drawn from the
 * series tokens in src/ui/styles.css, with the title's one accent (瑠璃色).
 * That makes two promises worth measuring rather than trusting to a comment
 * (the same approach as chess/ui/contrast.test.ts, which has colours of its
 * own to read):
 *
 * - the stylesheet really contains no colour — no literal in any notation and
 *   no named colour — so a later edit cannot add a hue this file never
 *   measured; and
 * - the pairs that carry meaning clear WCAG 2 in both themes — 3:1 for a
 *   graphical object (a mark, a lit face against its groove), 4.5:1 for text
 *   (the Pace labels, the Play and Stop labels).
 *
 * The pairs are not listed here as token names: each one is read from the
 * declarations of the rule that paints it (`echo-pads.css`, and `styles.css`
 * for the shared .btn keys), and the tokens that rule names are what gets
 * measured. Pointing a rule at another token therefore changes the number
 * under test, instead of leaving a table here that is no longer true.
 *
 * The board's rim, the keys' thickness and the trough of the Pace control are
 * decoration — the marks and the pads' places carry the meaning — so their
 * ratios are printed, not gated.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/echo-pads/ui/echo-pads.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The declarations of every rule that lists this exact selector, in source
 * order (a later one wins, as in the cascade for equal specificity). The two
 * stylesheets read here use neither nesting nor @media around these rules.
 */
function declarations(css: string, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1]!.split(',').map((one) => one.trim().replace(/\s+/g, ' '));
    if (!selectors.includes(selector)) continue;
    for (const declaration of rule[2]!.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      out.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
  }
  return out;
}

/** The nth `var(--token)` a declaration names, e.g. the second end of a gradient. */
function tokenOf(css: string, selector: string, property: string, nth = 0): string {
  const value = declarations(css, selector).get(property);
  const name = [...(value ?? '').matchAll(/var\((--[\w-]+)\)/g)][nth]?.[1];
  expect(name, `${selector} { ${property} } names a token (found: ${value})`).toBeDefined();
  return name!;
}

const game = (selector: string, property: string, nth?: number) =>
  tokenOf(gameCss, selector, property, nth);
const shared = (selector: string, property: string, nth?: number) =>
  tokenOf(sharedCss, selector, property, nth);

/** The #rrggbb custom properties declared in the rule that opens with this line. */
function tokens(source: string, opening: string): Map<string, string> {
  const start = source.indexOf(`\n${opening}`);
  expect(start, `${opening} is missing`).toBeGreaterThan(-1);
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
  {
    name: 'light',
    base: ':root {',
    accent: ":root[data-game='echo-pads'],",
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='echo-pads'],",
  },
] as const;

/**
 * The theme's value for a token, resolved when a test runs (not while the
 * file is collected), so a token that goes missing fails that one test with
 * its name instead of taking the whole file down.
 */
function colourOf(theme: (typeof THEMES)[number], token: string): string {
  const value =
    tokens(sharedCss, theme.accent).get(token) ?? tokens(sharedCss, theme.base).get(token);
  expect(value, `${token} under ${theme.name}`).toBeDefined();
  return value!;
}

/**
 * Anything that paints a colour other than through a token: a literal in any
 * notation, a colour function, or a named colour in a property that takes one.
 * Comments are dropped first so a note may name a value.
 */
const COLOUR_PROPERTY =
  /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color)$/;
// What may stand in such a value besides var(): shape, style and the keywords
// that are not a colour of their own. Anything else is read as a named colour.
const NOT_A_COLOUR = new Set([
  'none',
  'solid',
  'dashed',
  'dotted',
  'inset',
  'transparent',
  'currentcolor',
  'linear-gradient',
  'calc',
  'inherit',
  'initial',
  'unset',
]);

function colourLiterals(css: string): string[] {
  const code = withoutComments(css);
  const found: string[] = [
    ...(code.match(
      /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|color-mix)\(/gi,
    ) ?? []),
  ];
  for (const rule of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const declaration of rule[2]!.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0 || !COLOUR_PROPERTY.test(declaration.slice(0, colon).trim())) continue;
      const words = declaration
        .slice(colon + 1)
        .replace(/var\(--[\w-]+\)/g, ' ')
        .replace(/-?\d*\.?\d+[a-z%]*/gi, ' ')
        .match(/[a-z][a-z-]*/gi);
      for (const word of words ?? []) {
        if (!NOT_A_COLOUR.has(word.toLowerCase())) found.push(word);
      }
    }
  }
  return found;
}

describe('Echo Pads’ colours (docs/ECHO_PADS_RULES.md §11)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  // [what, foreground token, background token, floor] — each token read from
  // the rule that paints the pair.
  const gated: Array<[string, () => string, () => string, number]> = [
    [
      'a resting pad’s mark, the accent on the surface',
      () => game('.ep-pad', 'color'),
      () => game('.ep-pad', 'background'),
      4.5,
    ],
    [
      'the current Pace’s label on the face the Pace control gives it',
      () => game('.ep-pace-current', 'color'),
      () => game('.ep-pace-current', 'background'),
      4.5,
    ],
    [
      'a lit pad’s mark, the accent ink on the accent',
      () => game('.ep-pad-lit', 'color'),
      () => game('.ep-pad-lit', 'background'),
      4.5,
    ],
    [
      'the Play label, the accent ink on the accent',
      () => shared('.btn-primary', 'color'),
      () => shared('.btn-primary', 'background'),
      4.5,
    ],
    [
      'a lit pad’s face against the groove it sits in',
      () => game('.ep-pad-lit', 'background'),
      () => game('.ep-board', 'background'),
      3,
    ],
    [
      'a lit pad’s face against a resting pad’s',
      () => game('.ep-pad-lit', 'background'),
      () => game('.ep-pad', 'background'),
      3,
    ],
    [
      'the other Paces’ labels, the soft ink on the paper',
      () => game('.ep-pace-option', 'color'),
      () => '--paper',
      4.5,
    ],
    [
      'the Stop label, the ink on the key’s surface end',
      () => shared('.btn-secondary', 'color'),
      () => game('.ep-play.btn-secondary', 'background', 0),
      4.5,
    ],
    [
      'the Stop label, the ink on the key’s paper end',
      () => shared('.btn-secondary', 'color'),
      () => game('.ep-play.btn-secondary', 'background', 1),
      4.5,
    ],
  ];

  for (const theme of THEMES) {
    for (const [what, foreground, background, floor] of gated) {
      it(`${what} clears ${floor}:1 (${theme.name})`, () => {
        const ratio = contrast(colourOf(theme, foreground()), colourOf(theme, background()));
        // Printed for docs/ECHO_PADS_RULES.md §11; the gate is the floor below.
        console.info(`[echo-pads contrast] ${theme.name} ${what}: ${ratio.toFixed(2)}`);
        expect(ratio).toBeGreaterThanOrEqual(floor);
      });
    }

    it(`prints the decoration’s ratios, which carry no meaning and are not gated (${theme.name})`, () => {
      const [surface, paper, recessed, line] = [
        '--surface',
        '--paper',
        '--surface-recessed',
        '--line',
      ].map((token) => colourOf(theme, token)) as [string, string, string, string];
      const decoration: Array<[string, string, string]> = [
        ['the hairline and the keys’ thickness on the paper', line, paper],
        ['the hairline on the base', line, recessed],
        ['the base on the paper', recessed, paper],
        ['a resting pad on the base', surface, recessed],
      ];
      for (const [what, a, b] of decoration) {
        console.info(`[echo-pads contrast] ${theme.name} ${what}: ${contrast(a, b).toFixed(2)}`);
      }
      // Not a contrast promise, only that the base is not the paper itself —
      // or the grooves would not read as a recess at all.
      expect(recessed).not.toBe(paper);
    });
  }

  it('paints each pair the way the table above assumes', () => {
    // The pairs read their foreground and background from single rules; these
    // are the places where a different rule could take over the face unseen.
    // The other Paces' labels sit straight on the paper: the control and its
    // idle segments set no face of their own.
    expect(declarations(gameCss, '.ep-pace').has('background')).toBe(false);
    expect(declarations(gameCss, '.ep-pace-option').get('background')).toBe('transparent');
    // The Play key keeps the shared primary face and label, and Stop its
    // shared label, whatever the game gives them a shadow or a gradient for.
    for (const selector of ['.ep-play', '.ep-play.btn-secondary']) {
      expect(declarations(gameCss, selector).has('color'), `${selector} sets no label colour`).toBe(
        false,
      );
    }
    expect(declarations(gameCss, '.ep-play').has('background')).toBe(false);
    // The Pace labels and the pads' marks are the accent only because these
    // rules say so; a lit pad keeps its own face.
    expect(game('.ep-pad', 'color')).toBe('--accent');
    expect(game('.ep-pad-lit', 'background')).toBe('--accent');
  });

  it('finds the colours it is meant to forbid', () => {
    // A scan that never matches would pass the test below on any stylesheet.
    const bad = [
      '.a { color: #fff }',
      '.a { background: #306cb6; }',
      '.a { color: rgb(0 0 0); }',
      '.a { color: hsla(10, 20%, 30%, 0.5); }',
      '.a { color: oklch(0.5 0.1 200); }',
      '.a { color: lab(50% 10 10); }',
      '.a { color: color(display-p3 1 0 0); }',
      '.a { background: color-mix(in srgb, red, blue); }',
      '.a { color: white; }',
      '.a { border: 1px solid tomato; }',
      '.a { box-shadow: 0 2px 0 rebeccapurple; }',
      '.a { background: linear-gradient(gold, var(--paper)); }',
      '.a { fill: navy; }',
    ];
    for (const css of bad) expect(colourLiterals(css), css).not.toEqual([]);

    const good = [
      '.a { color: var(--accent); background: transparent; }',
      '.a { border: 2px solid var(--line); box-shadow: inset 0 1px 2px var(--line), 0 3px 0 var(--line); }',
      '.a { background: linear-gradient(var(--surface), var(--paper)); }',
      '.a { fill: none; stroke: currentColor; outline: 3px dashed var(--ink); }',
      '.a { box-shadow: 0 calc(var(--k) - var(--s)) 0 var(--line); }',
      '.a { /* a note may name #306cb6 or white */ color: var(--ink); }',
    ];
    for (const css of good) expect(colourLiterals(css), css).toEqual([]);
  });

  it('writes no colour anywhere in the stylesheet', () => {
    // Everything reads a token; a colour of its own would be one the tests
    // above never measured.
    expect(colourLiterals(gameCss)).toEqual([]);
  });
});
