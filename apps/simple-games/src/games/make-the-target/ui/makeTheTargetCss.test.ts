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
 *
 * And what the look promises (§12): a key edge on what can be pressed and on
 * nothing else, a lift that moves only `transform`, and no animation under
 * Reduced Motion. The colours are pinned in ui/contrast.test.ts.
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

  it('gives the key edge to what can be pressed, and a flat face to what cannot (§12)', () => {
    // The Undo bar's recipe: a face darkening towards the paper, a lit top, a
    // hard edge underneath — 3px on a tile, 2px on an operator.
    for (const [selector, edge] of [
      ['.tg-tile', '0 3px 0'],
      ['.tg-op', '0 2px 0'],
    ] as const) {
      const declarations = rule(selector);
      expect(declarations, selector).toMatch(
        /background-image:\s*linear-gradient\(var\(--surface\), var\(--paper\)\)/,
      );
      expect(declarations, selector).toMatch(/inset 0 1px 0 var\(--surface\)/);
      expect(declarations, selector).toContain(`${edge} var(--line)`);
      // Longhands: the `background` shorthand would reset the colour the
      // press transition starts from and flash the paper through.
      expect(declarations, selector).not.toMatch(/\n\s*background:/);
    }
    // The target is not a button, a locked tile and a disabled operator are
    // not pressable: all stay flat.
    expect(rule('.tg-target')).not.toMatch(/box-shadow/);
    expect(rule('.tg-tile:disabled')).toMatch(/box-shadow:\s*none/);
    expect(rule('.tg-op:disabled')).toMatch(/box-shadow:\s*none/);
    // The press gives way (the face drops by the edge's difference).
    expect(rule('.tg-tile:active:not(:disabled)')).toMatch(/translateY\(2px\)/);
    expect(rule('.tg-op:active:not(:disabled)')).toMatch(/translateY\(1px\)/);
  });

  it('keeps the band a pressed key leaves part of the key, so a press on its top rim still clicks it (§12)', () => {
    // The key sinks under the press (above), which moves its top rim out from
    // under a mouse that went down there; the ::before strip stays part of the
    // key while it is held (the technique of echo-pads.css), sized from the
    // key's own border and sink: a tile is 2px + 2px, an operator 2px + 1px.
    // The chosen tile and operator keep their lift and do not sink, so the
    // strip is not theirs.
    for (const [selector, top, height] of [
      ['.tg-tile:not(.tg-tile-selected):active:not(:disabled)::before', '-4px', '2px'],
      ['.tg-op:not(.tg-op-selected):active:not(:disabled)::before', '-3px', '1px'],
    ] as const) {
      const declarations = rule(selector);
      expect(declarations, selector).toMatch(/content:\s*'';/);
      expect(declarations, selector).toMatch(/position:\s*absolute;/);
      expect(declarations, selector).toMatch(new RegExp(`top:\\s*${top};`));
      expect(declarations, selector).toMatch(/right:\s*-2px;/);
      expect(declarations, selector).toMatch(/left:\s*-2px;/);
      expect(declarations, selector).toMatch(new RegExp(`height:\\s*${height};`));
      // Left at its default so the strip receives the press.
      expect(declarations, selector).not.toMatch(/pointer-events/);
    }
  });

  it('puts the target on the accent ground and the used-up slot in a recess (§1, §12)', () => {
    expect(rule('.tg-target')).toMatch(/background:\s*var\(--accent-soft\)/);
    // `.tg-slot-empty` also ends the selector list that sizes it with the
    // tiles; the recess is the rule of its own, which comes last.
    const at = css.lastIndexOf('\n.tg-slot-empty {');
    expect(at, 'no rule of its own for .tg-slot-empty').toBeGreaterThan(css.indexOf('.tg-tile,'));
    const slot = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    expect(slot).toMatch(/border:\s*0;/);
    expect(slot).toMatch(/inset 0 2px 4px var\(--tg-dent\)/);
  });

  it('lifts the arriving tile with transform alone, and draws it not at all under Reduced Motion (§12)', () => {
    for (const name of ['tg-arrive-0', 'tg-arrive-1']) {
      const start = css.indexOf(`@keyframes ${name} {`);
      expect(start, name).toBeGreaterThanOrEqual(0);
      const keyframes = css.slice(start, css.indexOf('\n}\n', start));
      expect(keyframes, name).toMatch(/transform:/);
      // Nothing heavy on an element that moves every frame.
      expect(keyframes, name).not.toMatch(/box-shadow|filter|opacity/);
    }
    const mediaStart = css.indexOf('@media (prefers-reduced-motion: reduce) {');
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    const media = css.slice(mediaStart, css.indexOf('\n}\n', mediaStart));
    expect(media).toMatch(/\.tg-tile-arrive-0,\s*\.tg-tile-arrive-1\s*\{\s*animation:\s*none/);
    expect(media).toMatch(/\.tg-tile,\s*\.tg-op\s*\{\s*transition:\s*none/);
    // The block has to come after the rules that set the transition: the
    // selectors are equally specific, so an earlier block loses to them and
    // the operators' easing would only be cut by the shell's catch-all.
    expect(css.lastIndexOf('\n.tg-tile {'), '.tg-tile comes before the block').toBeLessThan(
      mediaStart,
    );
    expect(css.lastIndexOf('\n.tg-op {'), '.tg-op comes before the block').toBeLessThan(mediaStart);
    // …and the app's own setting does the same.
    expect(css).toMatch(
      /:root\[data-reduced-motion='true'\] \.tg-tile-arrive-0,\s*:root\[data-reduced-motion='true'\] \.tg-tile-arrive-1\s*\{\s*animation:\s*none/,
    );
    expect(css).toMatch(
      /:root\[data-reduced-motion='true'\] \.tg-tile,\s*:root\[data-reduced-motion='true'\] \.tg-op\s*\{\s*transition:\s*none/,
    );
  });
});
