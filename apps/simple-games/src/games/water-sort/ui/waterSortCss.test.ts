/**
 * What jsdom cannot see: the rack's geometry lives in `ui/water-sort.css`
 * (docs/WATER_SORT_RULES.md §12). WaterBoard asks for a number of columns
 * (`--ws-cols`) and each tube's width is worked out from it, taking out the
 * rack's column gap once per gap. When the two numbers disagreed — the width
 * took out 10px, the rack's gap was 12px — a rack whose width was the limit
 * (four or more columns on a phone) came up a few pixels short and wrapped
 * its last tube to a third row nobody asked for, pushing Undo and Hint off a
 * 360×640 screen. This reads the stylesheet as text and keeps them equal.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root (src/test/styles.test.ts explains why).
const css = readFileSync(resolve('src/games/water-sort/ui/water-sort.css'), 'utf8');

/** The source with its comments blanked out: prose may quote a rule. */
const code = `\n${css.replace(/\/\*[\s\S]*?\*\//g, '')}`;

/** The declarations of the first top-level rule with this exact selector line. */
function ruleBody(selector: string): string {
  const start = code.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = code.indexOf('{', start);
  return code.slice(open + 1, code.indexOf('}', open));
}

describe('the rack (§12)', () => {
  it('sizes a tube with the column gap it lays the tubes out with', () => {
    const gap = /\bgap:\s*\d+px\s+(\d+)px;/.exec(ruleBody('.ws-rack'));
    expect(gap, '.ws-rack has no row and column gap').not.toBeNull();
    const width =
      /\bwidth:\s*calc\(\(100% - \(var\(--ws-cols\) - 1\) \* (\d+)px\) \/ var\(--ws-cols\)\);/.exec(
        ruleBody('.ws-tube'),
      );
    expect(width, ".ws-tube's width no longer follows --ws-cols").not.toBeNull();
    expect(Number(width![1])).toBe(Number(gap![1]));
  });

  it('has no second tube width for one state only', () => {
    // The 12px was once written only under the app's banner strip, so every
    // other screen kept the 10px and its third row.
    expect(code).not.toMatch(/\]\s*\.ws-tube\s*\{[^}]*[\s;]width:/);
  });
});
