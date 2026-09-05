/**
 * Two shared classes in styles.css have more owners than the screen you happen
 * to be looking at, so changing them for one caller silently changes the rest.
 *
 * `.home-logo` is the accent tile every game's home screen draws its glyph in
 * (many screens, one rule). It was once rewritten to suit the collection home,
 * which needed no tile at all, and all five games lost their tile in the same
 * commit — visible only by opening a game, which the change had not done.
 *
 * The collection home has `.home-mark` for its own <svg> instead. These tests
 * pin that split: the tile keeps the properties the games rely on, and the two
 * classes stay separate.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root rather than import.meta.url: these tests run
// in the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The declarations of one top-level rule, e.g. `.home-logo`. */
function ruleBody(selector: string, source = css): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing from the stylesheet`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

describe('the home screens share .home-logo', () => {
  it('keeps the accent tile the game home screens draw their glyph in', () => {
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

/**
 * The architecture doc claims every title keeps its styling in its own folder,
 * and then lists the files by name. A list written by hand goes stale the
 * moment a game is added, and it had: five titles were missing from it — the
 * drills and the two later card games — while the sentence above it still
 * said "every title". A claim nobody checks is not a claim.
 *
 * This holds the list to the filesystem in both directions, which is the only
 * way the sentence stays true without anybody remembering to make it so. The
 * full text of the「CSS の分割」section lives in docs/architecture/css-split.md
 * since the 2026-09-05 split; ARCHITECTURE.md keeps the heading and a summary.
 */
describe('the CSS-per-game list in docs/architecture/css-split.md', () => {
  const doc = readFileSync(resolve('../../docs/architecture/css-split.md'), 'utf8');
  const claim = doc.slice(doc.indexOf('**全タイトルが規約に従っている**'));
  const listed = new Set(
    [...claim.slice(0, 600).matchAll(/`([a-z0-9-]+\.css)`/g)].map((m) => m[1]!),
  );
  // readdirSync rather than fs.globSync: the latter needs Node 22, and this
  // repository says it supports Node 20 (package.json engines).
  const onDisk = new Set(
    readdirSync(resolve('src/games'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((game) => {
        const ui = resolve('src/games', game.name, 'ui');
        return readdirSync(ui).filter((file) => file.endsWith('.css'));
      }),
  );

  it('names a stylesheet for every game that has one', () => {
    expect([...onDisk].filter((file) => !listed.has(file)).sort()).toEqual([]);
  });

  it('names no stylesheet that does not exist', () => {
    expect([...listed].filter((file) => !onDisk.has(file)).sort()).toEqual([]);
  });

  it('is not empty — a broken match would pass the two above vacuously', () => {
    expect(onDisk.size).toBeGreaterThan(15);
    expect(listed.size).toBe(onDisk.size);
  });
});

/**
 * Issue #120: the app's whole promise is a board that doesn't jump around
 * under the player mid-game. The strip reserved for a banner ad, and the
 * fallback that keeps a finished board inert-but-untouched on an old WebView,
 * both do their job through a couple of CSS declarations that a future pass
 * on styles.css could drop without anything in TypeScript noticing.
 */
describe('the reserved ad strips never yield their space (issue #120)', () => {
  it('never lets the flex column squeeze .banner-slot under a tall board', () => {
    // If flex-shrink were allowed to default to 1 here, a board taller than
    // the viewport would shrink the banner strip to fit instead — the ad
    // would shift, resize, or vanish as boards change, exactly what the
    // fixed reservation exists to prevent.
    const slot = ruleBody('.banner-slot');
    expect(slot).toMatch(/flex-shrink:\s*0/);
  });

  it('reserves .web-ad-slot at the same fixed height the comment promises', () => {
    // The rule above this one in styles.css says outright that .web-ad-slot
    // is "the .banner-slot rule, applied to the web" — a fixed height from
    // mount so a loading, failing, or offline ad never moves the game list.
    const slot = ruleBody('.web-ad-slot');
    expect(slot).toMatch(/height:\s*100px/);
  });

  it('keeps a dialog-covered board untouchable even without the inert attribute', () => {
    // docs/ARCHITECTURE.md's low-spec floor is Chromium 88; `inert` only
    // works from Chromium 102. Below that the attribute is present in the
    // DOM but inert, so the board behind a ConfirmDialog or a result screen
    // would still take taps unless this fallback rule blocks pointer events
    // itself, by the attribute selector rather than the browser's own effect.
    const covered = ruleBody('.game-content[inert]');
    expect(covered).toMatch(/pointer-events:\s*none/);
  });

  it('keeps a finger on the nonogram cells drawing, never scrolling the page (issue #108)', () => {
    // vite.config.ts's test setup turns css off (`css: false`), so nothing
    // rendered in a test can ever see this rule fire — every #108 pointer
    // test in the nonogram suite would still pass with the property deleted.
    // This file is the only thing standing between that regression and CI.
    const nonogramCss = readFileSync(resolve('src/games/nonogram/ui/nonogram.css'), 'utf8');
    const cells = ruleBody('.nono-cells', nonogramCss);
    expect(cells).toMatch(/touch-action:\s*none/);
  });
});
