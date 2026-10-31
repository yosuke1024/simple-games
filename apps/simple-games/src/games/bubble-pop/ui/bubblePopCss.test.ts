/**
 * What jsdom cannot see: how the board is fitted to the screen lives in
 * `ui/bubble-pop.css` (docs/BUBBLE_POP_RULES.md §14). The canvas is 320×672,
 * so on a phone its width is capped by the height left under the top bar and
 * the tray and above whatever holds the bottom of the screen. These read the
 * stylesheet as text and keep the parts a tidy-up would most likely undo:
 *
 * - the cap is the base rule, on every screen, not only beside the app's
 *   banner strip: with neither the strip nor the web's ad reservation the
 *   full-width board ran its shooter off a 360×640 screen that cannot scroll;
 * - from 600px wide the flat 230 / 210px stays a ceiling and the chrome and
 *   the edges are subtracted only when they take more, in one max() —
 *   subtracting the strip from the flat term as well shrank the board twice;
 * - the board's column never pads itself by the bottom inset: ui/styles.css
 *   already pads the play screen by it when there is no strip and no
 *   reservation, and --bu-edges counts it once;
 * - the web board has its floor, so a short window scrolls instead of
 *   drawing a board a few bubbles wide.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root (src/test/styles.test.ts explains why).
const css = readFileSync(resolve('src/games/bubble-pop/ui/bubble-pop.css'), 'utf8');

/** The source with its comments blanked out: prose may quote a rule. */
const code = `\n${css.replace(/\/\*[\s\S]*?\*\//g, '')}`;

/** Every rule (at any depth) whose selector list names this selector exactly. */
function rules(selector: string): string[] {
  return [...code.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
    .filter((m) =>
      m[1]!
        .split(',')
        .map((s) => s.trim())
        .includes(selector),
    )
    .map((m) => m[2]!.replace(/\s+/g, ' '));
}

describe('the board fits the screen (§14)', () => {
  it('caps the canvas by the height left in its base rule', () => {
    const [base] = rules('.bu-canvas');
    expect(base, '.bu-canvas is missing').toBeDefined();
    expect(base).toContain(
      'width: min(100%, 320px, calc((var(--bu-vh) - var(--bu-chrome) - var(--bu-edges)) * 0.476));',
    );
  });

  it('keeps the flat wide-tier terms as a ceiling, in one max() with the budget', () => {
    const tiers = rules('.bu-canvas').join('\n');
    expect(tiers).toContain('max(230px, var(--bu-chrome) + var(--bu-edges))');
    expect(tiers).toContain('max(210px, var(--bu-chrome) + var(--bu-edges))');
    // Under any selector: the banner strip's own copy of a wide tier once
    // subtracted the strip from the flat term as well.
    expect(code).not.toMatch(/- 2[13]0px - var\(--bu-edges\)/);
  });

  it('counts the bottom inset once, in --bu-edges, and never pads the column by it', () => {
    const wrap = rules('.bu-board-wrap').join('\n');
    expect(wrap).toContain('var(--sg-app-banner-reserve, env(safe-area-inset-bottom, 0px))');
    const padded = [...code.matchAll(/([^{};]+)\{([^{}]*)\}/g)].filter(
      (m) => /\.bu-board-wrap\b/.test(m[1]!) && /padding[\w-]*\s*:/.test(m[2]!),
    );
    expect(padded.map((m) => m[1]!.trim())).toEqual([]);
  });

  it('gives the web board a floor and the reservation its 116px', () => {
    const web = rules(':root[data-sg-web-ads] .bu-board-wrap').join('\n');
    expect(web).toContain(
      '--bu-edges: calc(env(safe-area-inset-top, 0px) + 116px + env(safe-area-inset-bottom, 0px));',
    );
    expect(web).toContain('--bu-floor: 126px;');
    const widths = rules(':root[data-sg-web-ads] .bu-canvas');
    expect(widths).toHaveLength(3);
    for (const body of widths) expect(body).toContain('max( var(--bu-floor),');
  });
});
