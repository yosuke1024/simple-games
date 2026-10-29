/**
 * docs/LOOP_PUZZLE_RULES.md §13 promises numbers that can be read on the board
 * in both themes: the line (the accent) at 3:1 or more against the board's
 * ground, the numbers and the × — full ink, and the softer ink of a met number
 * — at 4.5:1 or more, the warn rings at 3:1 or more, and the printed dots (the
 * soft ink, lighter than the pen's line) at 3:1 or more on the hint's (and the
 * press) ground. The board is drawn on --surface. Those are numbers, so they
 * are measured here from the shared stylesheet rather than trusted to a
 * comment (the shape of Dots and Boxes' ui/contrast.test.ts): each must clear
 * its floor and match the value §13's table states. This game's CSS writes no
 * colour of its own (docs/architecture/css-split.md), which is also checked.
 *
 * One ground is recorded, not guaranteed: the faint line a mouse's hover
 * previews on an empty edge ends under the dot, and the dark theme's dot falls
 * below 3:1 there (§13). It is measured below so the document cannot drift,
 * but it carries no floor — whether to accept it is the owner's to decide.
 *
 * The rest of this file pins the rules of loop-puzzle.css that the board's
 * behaviour rests on and that jsdom cannot see (it computes no layout and
 * no style): what stays out of the hit test, how the hint and the focus
 * differ in shape, Reduced Motion, forced colours and the board's floor.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/loop-puzzle/ui/loop-puzzle.css'), 'utf8');

/** The custom properties declared in the first rule whose selector ends with this line. */
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

/**
 * An rgba token of the accent (`--accent-ring-soft`, `--accent-ring`) laid over
 * a ground, as the browser composites it: the result is rounded to 8 bits per
 * channel at every layer, which is what a painted layer is. (Without the
 * rounding the hint's ground measures 4.15 on the dark theme, not 4.16, and
 * §13's table would disagree with the screen by a hundredth.)
 */
function over(source: string, selector: string, token: string, ground: string): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  const match = new RegExp(
    `${token}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`,
  ).exec(body);
  expect(match, `${selector} declares no ${token}`).not.toBeNull();
  const alpha = Number(match![4]);
  const channels = [1, 3, 5].map((at, i) =>
    Math.round(
      Number(match![i + 1]) * alpha + parseInt(ground.slice(at, at + 2), 16) * (1 - alpha),
    ),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * §13's table: line, numbers, met numbers and ×, warn rings, printed dots — on
 * --surface; `dotHint` is the same dot over the hint's ground and `dotPaper`
 * the Quick Rules figure's dot on the page's --paper. `dotHover` and
 * `dotHoverPress` are the recorded (floor-less) grounds under the mouse's
 * hover: the hover line alone, and the hover line over the press ground.
 */
const THEMES = [
  {
    name: 'light',
    base: ':root',
    accent: '.accent-loop-puzzle',
    table: {
      line: 5.97,
      ink: 14.24,
      soft: 5.68,
      warn: 4.1,
      dotHint: 4.79,
      dotPaper: 5.07,
      dotHover: 3.2,
      dotHoverPress: 2.8,
    },
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark']",
    accent: "[data-theme='dark'] .accent-loop-puzzle",
    table: {
      line: 3.99,
      ink: 12.06,
      soft: 4.96,
      warn: 5.15,
      dotHint: 4.16,
      dotPaper: 5.92,
      dotHover: 2.79,
      dotHoverPress: 2.48,
    },
  },
] as const;

const css = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the rule whose selector list is exactly `selector` (comments removed). */
function rule(selector: string, source = css): string {
  const at = source.indexOf(`${selector} {`);
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', at) + 1, source.indexOf('}', at));
}

/** The body of the first `@media` / `@supports` block with this condition. */
function block(condition: string): string {
  const at = css.indexOf(`${condition} {`);
  expect(at, `${condition} is missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', at) + 1, i);
  }
  throw new Error(`${condition} is not closed`);
}

describe('the board reads in both themes (§13)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const theme of THEMES) {
    it(`clears its contrast floors on --surface (${theme.name})`, () => {
      const shared = tokens(sharedCss, theme.base);
      const accent = tokens(sharedCss, theme.accent).get('--accent');
      const ground = shared.get('--surface')!;
      expect(accent, `the loop-puzzle accent is not declared for ${theme.name}`).toBeDefined();
      expect(contrast(accent!, ground), 'the line').toBeGreaterThanOrEqual(3);
      expect(contrast(shared.get('--ink')!, ground), 'numbers').toBeGreaterThanOrEqual(4.5);
      expect(contrast(shared.get('--ink-soft')!, ground), 'met numbers, ×').toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrast(shared.get('--warn')!, ground), 'warn rings').toBeGreaterThanOrEqual(3);
      // The printed dots are drawn in --ink-soft: over the hint's ground (the
      // ratio on the board itself is the met numbers' 4.5:1 above), and the
      // Quick Rules figure's dots over the page's --paper.
      const soft = shared.get('--ink-soft')!;
      const hintGround = over(sharedCss, theme.accent, '--accent-ring-soft', ground);
      expect(contrast(soft, hintGround), 'dots on the hint').toBeGreaterThanOrEqual(3);
      expect(contrast(soft, shared.get('--paper')!), 'figure dots').toBeGreaterThanOrEqual(3);
      // …and the values §13 states for them.
      expect(contrast(accent!, ground)).toBeCloseTo(theme.table.line, 2);
      expect(contrast(shared.get('--ink')!, ground)).toBeCloseTo(theme.table.ink, 2);
      expect(contrast(soft, ground)).toBeCloseTo(theme.table.soft, 2);
      expect(contrast(shared.get('--warn')!, ground)).toBeCloseTo(theme.table.warn, 2);
      expect(contrast(soft, hintGround)).toBeCloseTo(theme.table.dotHint, 2);
      expect(contrast(soft, shared.get('--paper')!)).toBeCloseTo(theme.table.dotPaper, 2);
      // Recorded, not a floor (see the header): the hover line's end under a
      // dot, alone and over the press ground.
      const hoverGround = over(sharedCss, theme.accent, '--accent-ring', ground);
      const hoverPressGround = over(sharedCss, theme.accent, '--accent-ring', hintGround);
      expect(contrast(soft, hoverGround)).toBeCloseTo(theme.table.dotHover, 2);
      expect(contrast(soft, hoverPressGround)).toBeCloseTo(theme.table.dotHoverPress, 2);
    });
  }

  it('draws the printed dots lighter than the pen: soft ink unused, the accent once the loop passes (§13)', () => {
    // A dot is the printed grid, so it takes the soft ink; the numbers keep the
    // full ink. A dot on the loop joins the line's colour and width.
    expect(rule('.lp-dot::before')).toMatch(/background:\s*var\(--ink-soft\);/);
    expect(rule('.lp-dot-used::before')).toMatch(/background:\s*var\(--accent\);/);
    expect(rule('.lp-clue-digit')).toMatch(/color:\s*var\(--ink\);/);
    // The Quick Rules figure shows the board's look, so its dots follow it.
    expect(rule('.lp-fig-dot')).toMatch(/fill:\s*var\(--ink-soft\);/);
  });

  it('keeps the middle of a cell a tap target of its own (§4)', () => {
    // A rule that depends on :active is what makes the browser treat the pad
    // as an element that responds to a touch; without one, Chromium moves a
    // tap on it to the nearest edge (measured in a real browser, 2026-10-17).
    const withoutComments = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).toMatch(/\.lp-pad:active\s*\{/);
    const pad = /\n\.lp-pad \{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';
    expect(pad).not.toMatch(/pointer-events:\s*none/);
  });

  it('writes no colour of its own', () => {
    const withoutComments = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});

describe('the rules the board rests on (loop-puzzle.css)', () => {
  it('keeps the numbers and dots out of the hit test (§4)', () => {
    // A number spans its cell's three tracks, over the inner band of all four
    // of its edges' hit areas, and sits after two of them in the DOM; only
    // this keeps those bands tappable (LoopPuzzleBoard.test.tsx checks where
    // everything is placed).
    expect(rule('.lp-clue')).toMatch(/pointer-events:\s*none/);
    expect(rule('.lp-dot')).toMatch(/pointer-events:\s*none/);
    expect(rule('.lp-edge-mark')).toMatch(/pointer-events:\s*none/);
    expect(rule('.lp-edge-hint::before')).toMatch(/pointer-events:\s*none/);
  });

  it('frames the hint dashed and the keyboard focus solid — two shapes, not one (§13)', () => {
    expect(rule('.lp-edge-hint::before')).toMatch(/border:\s*2px dashed var\(--accent\)/);
    expect(rule('.lp-edge:focus-visible .lp-edge-mark')).toMatch(
      /outline:\s*2px solid var\(--accent\)/,
    );
    // The legend in the line under the board is the hint's shape.
    expect(rule('.lp-feedback-hint::before')).toMatch(/border:\s*2px dashed var\(--accent\)/);
    // The frame sits outside the edge's box and the focus ring further out,
    // so on one edge both show.
    expect(rule('.lp-edge-h.lp-edge-hint::before')).toMatch(/var\(--lp-dot\) \/ -2 - 2px/);
    expect(rule('.lp-edge:focus-visible .lp-edge-mark')).toMatch(/outline-offset:\s*3px/);
  });

  it('drops the solved wash under Reduced Motion, the OS’s and the app’s (§13)', () => {
    // Not only shortened by the shared rules (src/ui/styles.css, which reach
    // ::before / ::after since 2026-10-18): this game's own rule stops it.
    expect(block('@media (prefers-reduced-motion: reduce)')).toMatch(
      /\.lp-board-solved::after\s*\{\s*animation:\s*none;/,
    );
    expect(rule(":root[data-reduced-motion='true'] .lp-board-solved::after")).toMatch(
      /animation:\s*none/,
    );
  });

  it('paints the dots and the loop in system colours when colours are forced', () => {
    const forced = block('@media (forced-colors: active)').replace(/\s+/g, ' ');
    expect(forced).toContain(
      '.lp-dot::before, .lp-edge-mark::before { forced-color-adjust: none; }',
    );
    expect(forced).toContain('.lp-dot::before { background: CanvasText; }');
    expect(forced).toContain(
      '.lp-dot-used::before, .lp-edge-line .lp-edge-mark::before { background: Highlight; }',
    );
  });

  it('never shrinks a board below its floor: a 6×6 stays at least 280px on a phone (§4)', () => {
    const area = rule('.lp-board-area');
    const tenth = /\(10 \* var\(--lp-n\) \+ 6\) \* ([\d.]+)px/.exec(area);
    expect(tenth, 'the floor is (n + 1) dots plus (10n + 6) tenths').not.toBeNull();
    expect(area).toMatch(/--lp-floor:\s*calc\(\(var\(--lp-n\) \+ 1\) \* var\(--lp-dot\)/);
    const floor = (n: number, dot: number) => (n + 1) * dot + (10 * n + 6) * Number(tenth![1]);
    expect(floor(6, 10)).toBeGreaterThanOrEqual(280);
    // The floor wins over the height (and only up to the width) in both lines.
    for (const body of [area, block('@supports (height: 100svh)')]) {
      expect(body.replace(/\s+/g, ' ')).toMatch(
        /--lp-size: max\( min\(100vw - 8px, var\(--lp-floor\)\), min\(100vw - 8px, 100s?vh - var\(--lp-chrome\), 560px\) \);/,
      );
    }
    // A screen too short for the floor scrolls the area instead of clipping it.
    expect(area).toMatch(/overflow-y:\s*auto/);
    expect(area).not.toMatch(/justify-content:\s*center/);
  });
});
