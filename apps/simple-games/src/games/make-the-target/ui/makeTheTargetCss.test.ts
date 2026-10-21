/**
 * What the stylesheet has to say for the screen to behave as the rules say
 * (docs/MAKE_THE_TARGET_RULES.md §3, §4, §12). jsdom loads no CSS, so a
 * render cannot see these; each rule here guards against a shared rule in
 * src/ui/styles.css that would otherwise win:
 *
 * - `.action-btn { display: flex }` beats the browser's own
 *   `[hidden] { display: none }` (author origin over user agent, whatever the
 *   specificity), so the bar's Undo would stay on screen beside the `missed`
 *   panel's — two buttons named Undo (§3).
 * - `button:disabled { opacity: 0.4 }` would fade the whole board while it is
 *   `missed`, solved or revealed — the last tile included, the number the
 *   panel states (§4) — below BRAND.md's contrast (§12).
 * - Nothing shared sets `touch-action`; the buttons pressed in a row need
 *   `manipulation` (§12).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/games/make-the-target/ui/make-the-target.css'), 'utf8');

/** The declarations of the rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `no "${selector.replace(/\n/g, ' ')}" rule`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('make-the-target.css against the shared rules', () => {
  it('really hides the bar’s Undo while the panel’s stands in, keeping its place (§3)', () => {
    // Hidden for the eye, the tab order and the a11y tree, with its box kept
    // so the bar does not move.
    expect(rule('.tg-actions .action-btn[hidden]')).toMatch(/visibility:\s*hidden/);
    expect(rule('.tg-actions')).toMatch(/min-height:\s*77px/);
  });

  it('keeps a locked board fully legible (§4, §12)', () => {
    expect(rule('.tg-tile:disabled')).toMatch(/opacity:\s*1;/);
  });

  it('lets the buttons pressed in a row take quick taps: operators, tiles and both Undos (§12)', () => {
    expect(rule('.tg-tile')).toMatch(/touch-action:\s*manipulation/);
    expect(rule('.tg-op')).toMatch(/touch-action:\s*manipulation/);
    expect(rule('.tg-actions .action-btn,\n.tg-missed-actions .btn')).toMatch(
      /touch-action:\s*manipulation/,
    );
  });
});
