/**
 * The well's colours (docs/FALLING_BLOCKS_RULES.md §6). The stylesheet writes
 * no colour of its own: the floor, the shade, the light and the foot point at
 * series tokens, and a settled block is the accent drawn at a stated strength
 * over the floor. What the board's meaning rests on is therefore a mixture, so
 * it is computed here from the stylesheets — the two token blocks at the top of
 * ui/falling-blocks.css, the shared theme tokens and the title's accent in
 * src/ui/styles.css — rather than trusted to a comment.
 *
 * Meaning-bearing pairs clear WCAG's 3:1 floor for graphical objects in both
 * themes: a settled block, the piece in hand and the landing outline against
 * the floor, the settled block's mark against its body, and the key icons and
 * the next piece against the key / panel they sit on. The texture — the foot,
 * the top light, the shade on the wall, the grid — carries no meaning (the
 * shapes and the dashes do), so it has no ratio to clear; what is pinned is
 * where the light comes from.
 *
 * The numbers are only worth measuring if the rules use them, so the wiring is
 * pinned in words as well: each layer's rule must read its own token, and the
 * board's frame and the keys keep the collection's recipes in their order.
 *
 * Blending is done in sRGB, which is how a browser composites an element with
 * `opacity` over what is under it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/falling-blocks/ui/falling-blocks.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const boardSource = readFileSync(
  resolve('src/games/falling-blocks/ui/components/Board.tsx'),
  'utf8',
);
const controlsSource = readFileSync(
  resolve('src/games/falling-blocks/ui/components/Controls.tsx'),
  'utf8',
);

type Rgb = [number, number, number];

/** The body of the first rule whose selector begins with `head` (include ` {` or `,` to be exact), comments removed. */
function rule(source: string, head: string): string {
  const start = source.indexOf(`\n${head}`);
  expect(start, `${head} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open)).replace(/\/\*[\s\S]*?\*\//g, '');
}

/** A rule body with its whitespace collapsed, so a multi-line value compares as one line. */
function squash(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

/** Every `--name: value;` declared in a rule body, values as written. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out.set(match[1]!, match[2]!.trim());
  return out;
}

function hex(value: string): Rgb {
  expect(value).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)) as Rgb;
}

/** WCAG 2 relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((byte) => {
    const channel = byte / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `top` drawn at `alpha` over `base`. */
function over(top: Rgb, alpha: number, base: Rgb): Rgb {
  return top.map((channel, i) => channel * alpha + base[i]! * (1 - alpha)) as Rgb;
}

const THEMES = [
  { name: 'light', base: ':root {', accent: ":root[data-game='falling-blocks']," },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='falling-blocks'],",
  },
] as const;

/** Everything the board draws with in one theme, resolved to numbers. */
function theme(which: (typeof THEMES)[number]) {
  const series = new Map([
    ...declarations(rule(sharedCss, ':root {')),
    ...declarations(rule(sharedCss, which.base)),
    ...declarations(rule(sharedCss, which.accent)),
  ]);
  // The dark block overrides only what differs; the rest comes from the light one.
  const own = new Map([
    ...declarations(rule(gameCss, ':root {')),
    ...declarations(rule(gameCss, which.base)),
  ]);

  const token = (name: string): Rgb => {
    const raw = series.get(name);
    expect(raw, `${name} under ${which.name}`).toBeDefined();
    return hex(raw!);
  };
  const num = (name: string): number => {
    const raw = own.get(name);
    expect(raw, `${name} under ${which.name}`).toMatch(/^[\d.]+(px)?$/);
    return parseFloat(raw!);
  };
  /** A `--fb-*` colour alias such as `var(--surface-recessed)`, followed to its hex. */
  const alias = (name: string): Rgb => {
    const target = /^var\((--[\w-]+)\)$/.exec(own.get(name) ?? '')?.[1];
    expect(target, `${name} should alias a series token (${which.name})`).toBeDefined();
    return token(target!);
  };

  const floor = alias('--fb-floor');
  // The wall's shade darkens (light) or deepens (dark) the first row of the
  // floor; both floors are measured, and the weaker ratio is the one that counts.
  const shaded = over(alias('--fb-rim'), num('--fb-rim-alpha'), floor);
  return {
    token,
    num,
    alias,
    accent: token('--accent'),
    floors: [floor, shaded] as const,
    foot: num('--fb-foot-alpha'),
    fixed: num('--fb-fixed-alpha'),
  };
}

/** The opacity the settled block's mark is drawn at, read from its rule. */
function markAlpha(): number {
  const match = /opacity:\s*([\d.]+)/.exec(rule(gameCss, '.fb-fixed-mark {'));
  expect(match, '.fb-fixed-mark opacity').not.toBeNull();
  return Number(match![1]);
}

/** The lower stop of the piece in hand's gradient, read from the board. */
function activeLowestAlpha(): number {
  // The whole stop is matched, not the first stopOpacity in the file: it is the
  // accent's own lower end that carries the piece's weakest colour.
  const match =
    /<stop\s+offset="1"\s+stopColor="var\(--accent\)"\s+stopOpacity="(\.\d+)"\s*\/>/.exec(
      boardSource,
    );
  expect(match, 'the active gradient stop in Board.tsx').not.toBeNull();
  return Number(match![1]);
}

describe('the well and its blocks (docs/FALLING_BLOCKS_RULES.md §6)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it('writes no colour literal anywhere in the stylesheet or the components', () => {
    // Comments may quote values; declarations may not. Everything is a token
    // or a number, so nothing here escapes the measurements below.
    const css = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(css.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual([]);
    for (const source of [boardSource, controlsSource]) {
      expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
      expect(source.match(/\b(?:rgba?|hsla?)\(/gi) ?? []).toEqual([]);
    }
  });

  it('sinks the floor to the recessed surface and leaves the settled mark as it was', () => {
    expect(declarations(rule(gameCss, ':root {')).get('--fb-floor')).toBe(
      'var(--surface-recessed)',
    );
    expect(markAlpha()).toBe(0.65);
    expect(rule(gameCss, '.fb-fixed-mark {')).toMatch(/stroke:\s*var\(--surface\)/);
  });

  for (const which of THEMES) {
    const t = theme(which);

    it(`a settled block, the piece in hand and the landing outline read on the floor (${which.name})`, () => {
      for (const floor of t.floors) {
        // The block's top strip has no foot under it, so it is the weakest part.
        const settled = over(t.accent, t.fixed, floor);
        const inHand = over(t.accent, activeLowestAlpha(), floor);
        for (const [what, ratio] of [
          ['settled block', contrast(settled, floor)],
          ['piece in hand (lowest end of its gradient)', contrast(inHand, floor)],
          ['landing outline (the accent itself)', contrast(t.accent, floor)],
        ] as const) {
          // Printed for docs/FALLING_BLOCKS_RULES.md §6; the gate is the 3:1 below.
          console.info(`[falling-blocks contrast] ${which.name} ${what}: ${ratio.toFixed(2)}`);
          expect(ratio, `${what} on the floor (${which.name})`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`the settled mark reads on the block it is cut into (${which.name})`, () => {
      for (const floor of t.floors) {
        // Under the mark there is the foot as well as the floor, where a foot is drawn.
        const underlay = over(t.accent, t.foot, floor);
        const settled = over(t.accent, t.fixed, underlay);
        const mark = over(t.token('--surface'), markAlpha(), settled);
        const ratio = contrast(mark, settled);
        console.info(`[falling-blocks contrast] ${which.name} settled mark: ${ratio.toFixed(2)}`);
        expect(ratio, `the mark on the settled block (${which.name})`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`the next piece and the key icons read on their panels (${which.name})`, () => {
      for (const panel of ['--paper', '--surface'] as const) {
        const ratio = contrast(t.accent, t.token(panel));
        console.info(
          `[falling-blocks contrast] ${which.name} accent on ${panel}: ${ratio.toFixed(2)}`,
        );
        expect(ratio, `the accent on ${panel} (${which.name})`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it('has every layer read its own token, so the measured numbers are the drawn ones', () => {
    const body = (head: string) => squash(rule(gameCss, head));
    expect(body('.fb-board-bg {')).toContain('fill: var(--fb-floor);');
    expect(body('.fb-rim-top {')).toContain('stop-color: var(--fb-rim);');
    expect(body('.fb-rim-top {')).toContain('stop-opacity: var(--fb-rim-alpha);');
    expect(body('.fb-foot {')).toContain('fill: var(--accent);');
    expect(body('.fb-foot {')).toContain('fill-opacity: var(--fb-foot-alpha);');
    expect(body('.fb-fixed {')).toContain('fill: var(--accent);');
    expect(body('.fb-fixed {')).toContain('stroke: var(--accent);');
    expect(body('.fb-fixed {')).toContain('opacity: var(--fb-fixed-alpha);');
    expect(body('.fb-block-edge {')).toContain('stroke: var(--fb-edge);');
    expect(body('.fb-block-edge {')).toContain('stroke-opacity: var(--fb-edge-alpha);');
    expect(body('.fb-block-edge {')).toContain('transform: translateY(var(--fb-edge-drop));');
    expect(body('.fb-ghost {')).toContain('stroke: var(--accent);');
    expect(body('.fb-preview-block {')).toContain('fill: var(--accent);');
    // The piece in hand takes its fill from the gradient the measurement reads.
    expect(boardSource).toMatch(/body="fb-active"\s+fill=\{`url\(#\$\{blockId\}\)`\}/);
  });

  it("keeps the collection's frame on the board and the shared key recipe on the controls", () => {
    const body = (head: string) => squash(rule(gameCss, head));
    // The lift first, so it shows; then the paper edge, its line and the soft spread.
    expect(body('.fb-board {')).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
    // .action-btn in src/ui/styles.css: top highlight, then the 2px lift; pressed sinks; disabled is flat.
    expect(body('.fb-control {')).toContain(
      'box-shadow: inset 0 1px 0 var(--surface), 0 2px 0 var(--line);',
    );
    expect(body('.fb-control:active:not(:disabled) {')).toContain(
      'box-shadow: inset 0 1px 2px var(--line);',
    );
    expect(body('.fb-control:disabled {')).toContain('box-shadow: none;');
  });

  it('stays inside what a Chromium 88 WebView draws', () => {
    // No filter on anything that moves every frame, and none of the syntax the
    // floor lacks (color-mix, :has, container queries, @layer).
    const css = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/\bfilter\s*:|:has\(|color-mix\(|container-type|@container|@layer/);
  });

  it('lights every block from the top, on both themes', () => {
    const light = theme(THEMES[0]);
    const dark = theme(THEMES[1]);
    // Light: a pale line on the dark accent body, and a foot that falls below it.
    expect(luminance(light.alias('--fb-edge'))).toBeGreaterThan(luminance(light.accent));
    expect(light.num('--fb-edge-drop')).toBe(0);
    expect(light.foot).toBeGreaterThan(0);
    // Dark: nothing lighter than the straw accent can be drawn on it, so the
    // edge is a shade moved to the base, and no accent-coloured foot is cast.
    expect(luminance(dark.alias('--fb-edge'))).toBeLessThan(luminance(dark.accent));
    expect(dark.num('--fb-edge-drop')).toBeGreaterThan(0);
    expect(dark.foot).toBe(0);
  });

  it('builds the settled block, the piece in hand and the next piece from one Block', () => {
    expect(boardSource.match(/<Block\b/g) ?? []).toHaveLength(3);
    for (const kind of ['fb-fixed', 'fb-active', 'fb-preview-block']) {
      expect(boardSource).toContain(`body="${kind}"`);
    }
  });
});
