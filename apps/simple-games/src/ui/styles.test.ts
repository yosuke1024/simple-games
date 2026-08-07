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
function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing from styles.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
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
 * ARCHITECTURE.md claims every title keeps its styling in its own folder, and
 * then lists the files by name. A list written by hand goes stale the moment
 * a game is added, and it had: five titles were missing from it — the drills
 * and the two later card games — while the sentence above it still said
 * "every title". A claim nobody checks is not a claim.
 *
 * This holds the list to the filesystem in both directions, which is the only
 * way the sentence stays true without anybody remembering to make it so.
 */
describe('the CSS-per-game list in ARCHITECTURE.md', () => {
  const doc = readFileSync(resolve('../../docs/ARCHITECTURE.md'), 'utf8');
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
