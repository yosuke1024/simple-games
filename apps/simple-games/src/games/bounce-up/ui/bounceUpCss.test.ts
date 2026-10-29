/**
 * What jsdom cannot see: the stylesheet itself (docs/BOUNCE_UP_RULES.md §7
 * 「描画とループ」「盤の大きさ」「盤の上のもの」). These read `ui/bounce-up.css`
 * as text:
 *
 * - it writes no colour at all — every colour on and around the board is a
 *   shared token (the board's own are read by ui/draw.ts from the same
 *   tokens), so there is nothing here for a contrast test to hold. A colour
 *   that is ever declared goes in two blocks at the top, with the ratios
 *   asserted, as the other boards do (docs/BRAND.md);
 * - the board wears the collection's frame, lift first, and ◀ ▶ the shared
 *   key's face, lift and press.
 *
 * The frame's order matters: shadows paint first-listed on top, so a lift
 * listed after the paper ring is hidden under it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root (src/test/styles.test.ts explains why).
const css = readFileSync(resolve('src/games/bounce-up/ui/bounce-up.css'), 'utf8');

/** The source with its comments blanked out: prose may say "colour". */
const code = `\n${css.replace(/\/\*[\s\S]*?\*\//g, '')}`;

/** The declarations of one rule, found by its exact selector line. */
function ruleBody(selector: string): string {
  const start = code.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = code.indexOf('{', start);
  return code.slice(open + 1, code.indexOf('}', open));
}

/** One declaration's value with its whitespace folded, or null. */
function declared(body: string, property: string): string | null {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body);
  return match ? match[1]!.replace(/\s+/g, ' ').trim() : null;
}

describe('bounce-up.css writes no colour (§7)', () => {
  it('has no hex, rgb(), hsl() or other colour function', () => {
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
  });
});

describe('bounce-up.css adds no motion (§7, §9.5)', () => {
  it('has no transition, animation, keyframes or transform anywhere', () => {
    // The look this change adds is all in the drawing and in static shadows,
    // so there is nothing for Reduced Motion to switch off in the stylesheet.
    expect(code).not.toMatch(/\btransition\b|@keyframes|\banimation\b|\btransform\b/);
  });

  it('declares the board and ◀ ▶ once each, so no later rule can quietly override their shadows', () => {
    expect((code.match(/^\s*\.bo-canvas\b/gm) ?? []).length).toBe(1);
    expect((code.match(/^\s*\.bo-pad-btn \{/gm) ?? []).length).toBe(1);
    expect((code.match(/^\s*\.bo-pad-btn:active \{/gm) ?? []).length).toBe(1);
  });
});

describe('the board’s frame and ◀ ▶ (§7)', () => {
  it('puts the collection’s frame on the canvas, the 3px lift first', () => {
    expect(declared(ruleBody('.bo-canvas'), 'box-shadow')).toBe(
      '0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft)',
    );
  });

  it('gives ◀ ▶ the shared key: a lit paper face and a 2px lift', () => {
    const body = ruleBody('.bo-pad-btn');
    expect(declared(body, 'background')).toBe('linear-gradient(var(--surface), var(--paper))');
    expect(declared(body, 'box-shadow')).toBe('inset 0 1px 0 var(--surface), 0 2px 0 var(--line)');
  });

  it('takes the lift away and fills the face while it is held, and does not move it', () => {
    const body = ruleBody('.bo-pad-btn:active');
    expect(declared(body, 'box-shadow')).toBe('inset 0 1px 2px var(--line)');
    expect(declared(body, 'background')).toBe('var(--accent)');
    expect(body).not.toMatch(/transform|transition|animation/);
  });

  it('keeps ◀ ▶ at 0.85 (§12 — provisional, not touched by the lift)', () => {
    expect(declared(ruleBody('.bo-pad-btn'), 'opacity')).toBe('0.85');
  });
});
