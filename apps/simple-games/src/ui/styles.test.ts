/**
 * Two shared classes in styles.css have more owners than the screen you happen
 * to be looking at, so changing them for one caller silently changes the rest.
 *
 * `.home-logo` is the accent tile every game's home screen draws its glyph in
 * (five screens, one rule). It was once rewritten to suit the collection home,
 * which needed no tile at all, and all five games lost their tile in the same
 * commit — visible only by opening a game, which the change had not done.
 *
 * The collection home has `.home-mark` for its own <svg> instead. These tests
 * pin that split: the tile keeps the properties the games rely on, and the two
 * classes stay separate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root rather than import.meta.url: these tests run
// in the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The declarations of one top-level rule, e.g. `.home-logo`. */
function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing from styles.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('the home screens share .home-logo', () => {
  it('keeps the accent tile the five game home screens draw their glyph in', () => {
    const tile = ruleBody('.home-logo');
    // Without these the glyph renders as bare text in the page's ink: no tile,
    // no accent, not centred, and at body size instead of 22px.
    expect(tile).toMatch(/background:\s*var\(--accent-soft\)/);
    expect(tile).toMatch(/color:\s*var\(--accent\)/);
    expect(tile).toMatch(/border-radius:/);
    expect(tile).toMatch(/display:\s*flex/);
    expect(tile).toMatch(/align-items:\s*center/);
    expect(tile).toMatch(/justify-content:\s*center/);
  });

  it('does not style the collection mark, which brings its own fill', () => {
    const mark = ruleBody('.home-mark');
    // The <svg> carries #232a33 and its own corner radius so it stays the app
    // icon in either theme; a background or colour here would fight it.
    expect(mark).not.toMatch(/background:/);
    expect(mark).not.toMatch(/border-radius:/);
    expect(mark).toMatch(/display:\s*block/);
  });
});
