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
 *
 * Lives in src/test rather than next to styles.css because it reads every
 * game's stylesheet and docs/architecture/css-split.md with node:fs, which the
 * import graph cannot see: the scoped runs (`pnpm verify:changed`, CI's
 * pull-request job) always run src/test (scripts/always-on-tests.mjs).
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
  // The window is the one sentence that lists the files, and it grows with
  // the collection: thirty names filled about 600 characters, and the three
  // web-beta titles (issue #194) pushed the sentence past it — a scan cut
  // short would have reported them as missing while they sat right there.
  const listed = new Set(
    [...claim.slice(0, claim.indexOf('アーケード 2 本')).matchAll(/`([a-z0-9-]+\.css)`/g)].map(
      (m) => m[1]!,
    ),
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
 * Issue #120: the app's whole promise is a board that keeps its size under
 * the player and moves only when a real ad taller than 64px grows the strip
 * (docs/ADS_POLICY.md「バナー広告の仕様」). The strip reserved for a banner ad, and the
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
    // The comment above this rule in styles.css promises .web-ad-slot a
    // fixed height from mount (the .banner-slot idea applied to the web, and
    // stricter: it never grows) so a loading, failing, or offline ad never
    // moves the game list.
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

/**
 * With ads removed, BannerSlot renders nothing and never marks the root, and
 * the web build without its reservation has neither root attribute either.
 * Then nothing under a play screen's last row holds the bottom inset: the
 * slot's margin is gone with the slot, and `.game-screen .action-bar` leaves
 * the inset to that margin. So styles.css pads the play screen itself, in
 * that state only (docs/ADS_POLICY.md「広告削除の買い切りとの関係」).
 * Before it, the action bar's buttons ran 14px into the Android emulator's
 * 24px gesture inset in most modes. With `css: false` in the test setup, only
 * this notices the rule gone or widened to the states that already hold it.
 * The rules are read with the comments taken out and split at their commas,
 * so a rule commented out, or a selector added to its list, does not pass.
 */
describe('a play screen with no banner and no reservation keeps the bottom inset clear', () => {
  const NEITHER = ':root:not([data-sg-app-banner]):not([data-sg-web-ads]) .game-screen';
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (match) => ({
      selectors: match[1]!.split(',').map((selector) => selector.trim()),
      body: match[2]!,
    }),
  );
  const bodyOf = (selector: string): string => {
    const found = rules.find(
      (rule) => rule.selectors.length === 1 && rule.selectors[0] === selector,
    );
    expect(found, `no rule for ${selector} on its own`).toBeDefined();
    return found!.body;
  };

  it('pads the play screen by the inset in that state, and in no other rule', () => {
    expect(bodyOf(NEITHER)).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)/);
    // Every rule that pads the bottom of a screen as a whole: the play screen
    // here, and every screen under the web's reservation. A third — or either
    // of these with more selectors in its list — would pad a state that
    // already holds the inset.
    const padding = rules.filter(
      (rule) =>
        /padding(-bottom)?:/.test(rule.body) &&
        rule.selectors.some((selector) => /(^|\s)\.(game-)?screen$/.test(selector)),
    );
    expect(padding.map((rule) => rule.selectors.join(', ')).sort()).toEqual(
      [':root[data-sg-web-ads] .screen', NEITHER].sort(),
    );
  });

  it('leaves the inset to the slot and to the reservation in their own states', () => {
    // The two states this rule must not touch hold the inset already; padding
    // the screen there too would lift every board and control by it.
    expect(bodyOf('.banner-slot')).toMatch(/margin-bottom:\s*env\(safe-area-inset-bottom\)/);
    expect(bodyOf('.game-screen .action-bar')).toMatch(/padding-bottom:\s*10px/);
    expect(bodyOf(':root[data-sg-web-ads] .screen')).toMatch(
      /padding-bottom:\s*calc\(116px \+ env\(safe-area-inset-bottom\)\)/,
    );
  });
});

/**
 * Reduced Motion is applied by styles.css for two routes — the OS preference
 * and the app's own setting. Many boards also branch on useReducedMotion, but
 * Crown Grid, Number Path, Shape Regions and Box Regions lean on these rules
 * alone for their pseudo-element washes, and a bare `*` never matches
 * ::before / ::after: until each route had a rule naming them, those washes
 * ran their full 700–900ms with Reduced Motion on. That rule ends transitions
 * instead of shortening them — a 0.01ms duration there gave every
 * pseudo-element a transition it never declared, and each change painted a
 * frame late. With `css: false` in the test setup, nothing rendered can
 * notice either mistake; only this can.
 */
describe('Reduced Motion reaches pseudo-elements', () => {
  type Rule = { selectors: string[]; body: string };
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /** Every innermost rule in `text`, as its selector list and declarations. */
  function rulesIn(text: string): Rule[] {
    return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selectors: match[1]!.split(',').map((selector) => selector.trim()),
      body: match[2]!,
    }));
  }

  /** The rule whose selector list is exactly `selectors`. */
  function rule(rules: Rule[], selectors: string[]): string {
    const found = rules.find((candidate) => candidate.selectors.join() === selectors.join());
    expect(found, `no rule for ${selectors.join(', ')}`).toBeDefined();
    return found!.body;
  }

  function expectRoute(rules: Rule[], prefix: string): void {
    const elements = rule(rules, [`${prefix}*`]);
    expect(elements).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(elements).toMatch(/animation-iteration-count:\s*1 !important/);
    expect(elements).toMatch(/transition-duration:\s*0\.01ms !important/);

    const pseudo = rule(rules, [`${prefix}*::before`, `${prefix}*::after`]);
    expect(pseudo).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(pseudo).toMatch(/animation-iteration-count:\s*1 !important/);
    expect(pseudo).toMatch(/transition:\s*none !important/);
    expect(pseudo).not.toMatch(/transition-duration/);
  }

  it('covers ::before and ::after under the OS preference', () => {
    const media = '@media (prefers-reduced-motion: reduce) {';
    const open = source.indexOf(media);
    expect(open, `${media} is missing from the stylesheet`).toBeGreaterThan(-1);
    // The block ends at the first `}` that closes nothing inside it.
    let depth = 1;
    let close = open + media.length;
    while (depth > 0 && close < source.length) {
      const char = source[close++];
      if (char === '{') depth++;
      if (char === '}') depth--;
    }
    expectRoute(rulesIn(source.slice(open + media.length, close - 1)), '');
  });

  it('covers ::before and ::after under the app setting', () => {
    expectRoute(rulesIn(source), ":root[data-reduced-motion='true'] ");
  });
});

/** Every stylesheet under `dir`, at any depth. */
function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/**
 * The low-spec floor is Chromium 88 (docs/ARCHITECTURE.md), which has no
 * `svh`. The usual fallback is a `vh` declaration followed by the same one in
 * `svh`: an engine that does not know the unit drops the second when it
 * parses the sheet. That stops working once the second holds a var() or an
 * env(). Such a declaration parses whatever it holds, wins the cascade, and
 * only fails at computed-value time, when the property falls to its initial
 * value (`width: auto`, `max-height: none`) instead of the vh line above it.
 * A custom property holding `svh` fails the same way, since it parses
 * anything. On 2026-10-30, 28 declarations in 14 game stylesheets had that
 * shape — the boards of Reversi, Bubble Pop, Snake and Overtake among them —
 * and with `css: false` in the test setup nothing rendered can see it. They
 * belong under `@supports (height: 100svh)`, as Bridges and Unblock Puzzle
 * already wrote theirs (docs/BRIDGES_RULES.md「大きさ」).
 */
describe('svh behind var(), env() or a custom property sits under @supports (Chromium 88)', () => {
  const VIEWPORT_UNIT = /\d(?:svh|dvh|lvh|svw|dvw|lvw|svmin|svmax|dvmin|dvmax)\b/;
  const DEFERRED = /\b(?:var|env)\(/;

  /** Each declaration that needs the guard, as guarded or `file:line declaration`. */
  function scan(file: string): { guarded: number; unguarded: string[] } {
    // Comments are blanked rather than removed, so line numbers stay true.
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, ' '),
    );
    const guards: boolean[] = [];
    const unguarded: string[] = [];
    let guarded = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char !== '{' && char !== '}' && char !== ';') continue;
      const raw = text.slice(start, i);
      const chunk = raw.trim();
      if (char === '{') {
        // `not` inverts the test and `or` lets another condition pass it on
        // Chromium 88, so neither guards anything.
        guards.push(
          chunk.startsWith('@supports') &&
            VIEWPORT_UNIT.test(chunk) &&
            !/\b(?:not|or)\b/.test(chunk),
        );
      } else {
        const custom = chunk.startsWith('--');
        const declaration = custom || /^[a-z-]+\s*:/.test(chunk);
        if (declaration && VIEWPORT_UNIT.test(chunk) && (custom || DEFERRED.test(chunk))) {
          if (guards.includes(true)) {
            guarded++;
          } else {
            const line = text.slice(0, start + raw.length - raw.trimStart().length).split('\n');
            const where = `${file.slice(resolve('src').length + 1)}:${line.length}`;
            unguarded.push(`${where} ${chunk.replace(/\s+/g, ' ')}`);
          }
        }
        if (char === '}') guards.pop();
      }
      start = i + 1;
    }
    return { guarded, unguarded };
  }

  const results = stylesheets(resolve('src')).map(scan);

  it('finds none outside the guard', () => {
    expect(results.flatMap((result) => result.unguarded)).toEqual([]);
  });

  it('reads every stylesheet and the guarded ones — a broken scan would pass the test above vacuously', () => {
    expect(results.length).toBeGreaterThan(60);
    expect(results.reduce((sum, result) => sum + result.guarded, 0)).toBeGreaterThan(28);
  });
});

/**
 * A game's stylesheet is a lazy chunk, and once the game has been opened its
 * rules stay loaded until the app closes. A rule that one game anchors on a
 * class therefore also styles any other game's element with that class.
 * Hearts and Hanoi Towers both wrote `.ht-body` and `.ht-actions`. After
 * Hearts had been opened, Hanoi's play area became a scroller of its own:
 * 17px at 360×640 with a 90px banner slot, against 3px alone. Hanoi's rules
 * also reached Hearts the other way. Hanoi moved to `hn-` on 2026-10-30.
 *
 * A selector's anchor is its first class that the shell does not define. A
 * shell class is one that starts a selector in a stylesheet outside
 * src/games: `.segment` counts, but the Yacht classes that nearby.css restyles
 * under `.nearby-board` do not. A class one game anchors on must not appear in
 * any other game's stylesheet. Two games may each keep a class under their own
 * anchor: `.kt-screen .game-title` and `.nim-screen .game-title` cannot reach
 * each other. This test cannot see a class that another game uses only in its
 * markup and never in its stylesheet. `@keyframes` names are global in the same
 * way. With `css: false` in the test setup, nothing rendered can see either
 * collision (docs/architecture/css-split.md).
 */
describe('a class one game anchors on appears in no other game, and no @keyframes name repeats', () => {
  const games = resolve('src/games');
  const CLASS = /\.(-?[A-Za-z_][\w-]*)/g;

  type Selector = { classes: string[]; lead: string[] };

  /** Each selector's classes and those of its first compound, and each @keyframes name. */
  function read(file: string): { selectors: Selector[]; keyframes: string[] } {
    // Comments and strings go first: a data: URL or a content value may hold
    // braces, dots or semicolons that are not selectors.
    const text = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    const selectors: Selector[] = [];
    const keyframes: string[] = [];
    for (const match of text.matchAll(/([^{};]*)\{/g)) {
      const prelude = match[1]!.trim();
      const frames = /^@(?:-webkit-)?keyframes\s+([\w-]+)/.exec(prelude);
      if (frames) keyframes.push(frames[1]!);
      if (!prelude || prelude.startsWith('@') || /^(?:from|to|[\d.]+%)/.test(prelude)) continue;
      // Attribute values and the arguments of :not() / :is() / :nth-child()
      // are not where a selector is anchored.
      let flat = prelude.replace(/\[[^\]]*\]/g, '');
      while (/\([^()]*\)/.test(flat)) flat = flat.replace(/\([^()]*\)/g, '');
      for (const selector of flat.split(',')) {
        const lead = selector.trim().split(/\s*[\s>+~]\s*/)[0] ?? '';
        selectors.push({
          classes: [...selector.matchAll(CLASS)].map((m) => m[1]!),
          lead: [...lead.matchAll(CLASS)].map((m) => m[1]!),
        });
      }
    }
    return { selectors, keyframes };
  }

  const shell = new Set<string>();
  /** Class → the games that anchor a selector on it. */
  const anchors = new Map<string, Set<string>>();
  /** Class (not the shell's) → the games whose stylesheets name it anywhere. */
  const mentions = new Map<string, Set<string>>();
  /** @keyframes name → the stylesheets' owners, the shell counting as one. */
  const keyframes = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, name: string, owner: string) => {
    map.set(name, (map.get(name) ?? new Set()).add(owner));
  };
  for (const file of stylesheets(resolve('src')).filter((path) => !path.startsWith(`${games}/`))) {
    const sheet = read(file);
    sheet.selectors.forEach((selector) => selector.lead.forEach((name) => shell.add(name)));
    sheet.keyframes.forEach((name) => add(keyframes, name, '(shell)'));
  }
  for (const game of readdirSync(games, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const file of stylesheets(resolve(games, game.name))) {
      const sheet = read(file);
      for (const selector of sheet.selectors) {
        const own = selector.classes.filter((name) => !shell.has(name));
        if (own[0]) add(anchors, own[0], game.name);
        own.forEach((name) => add(mentions, name, game.name));
      }
      sheet.keyframes.forEach((name) => add(keyframes, name, game.name));
    }
  }

  it("finds no class one game anchors on in another game's stylesheet", () => {
    const clashes = [...anchors.keys()]
      .map((name) => [name, [...(mentions.get(name) ?? [])].sort()] as const)
      .filter(([, by]) => by.length > 1)
      .map(([name, by]) => `${name}: ${by.join(', ')}`)
      .sort();
    expect(clashes).toEqual([]);
  });

  it('finds no @keyframes name defined twice', () => {
    const clashes = [...keyframes]
      .filter(([, by]) => by.size > 1)
      .map(([name, by]) => `${name}: ${[...by].sort().join(', ')}`)
      .sort();
    expect(clashes).toEqual([]);
  });

  it('reads every game, the shell and the keyframes — a broken scan would pass the tests above vacuously', () => {
    const gamesWithAnchors = new Set([...anchors.values()].flatMap((by) => [...by]));
    expect(gamesWithAnchors.size).toBeGreaterThan(60);
    expect(anchors.size).toBeGreaterThan(1000);
    expect(anchors.get('kt-screen')).toEqual(new Set(['knight-tour']));
    expect(shell.has('game-content')).toBe(true);
    expect(shell.has('segment')).toBe(true);
    expect(shell.has('yt-sheet-foot')).toBe(false);
    expect(keyframes.size).toBeGreaterThan(50);
    expect(keyframes.get('hn-settle')).toEqual(new Set(['hanoi-towers']));
  });
});

/**
 * Sudoku and Sudoku 6×6 size their grid rows from the board, not from what the
 * cells hold (docs/SUDOKU_RULES.md §1, docs/SUDOKU_6X6_RULES.md §13). With the
 * rows left to their content, a row with no digit shrank to a third of the
 * others or less, and a larger system text size pushed the last rows under the
 * frame.
 * As with the nonogram rule above, `css: false` means nothing rendered in a
 * test can see these declarations go missing.
 */
describe('the Sudoku grids give every row the same height', () => {
  it.each([
    ['src/games/sudoku/ui/sudoku.css', '.sudoku-grid', 9],
    ['src/games/sudoku-6x6/ui/sudoku-6x6.css', '.s6-grid', 6],
    ['src/games/sudoku-6x6/ui/sudoku-6x6.css', '.s6-figure', 6],
  ])('%s %s', (file, selector, rows) => {
    const body = ruleBody(selector, readFileSync(resolve(file), 'utf8')).replace(/\s+/g, ' ');
    // minmax(0, …) rather than 1fr, whose minimum is the content: a digit or a
    // notes block taller than its share would stretch its row again.
    expect(body).toContain(`grid-template-rows: repeat(${rows}, minmax(0, 1fr))`);
  });
});

describe('the arcade status dots in forced colours', () => {
  // A forced palette (Windows contrast themes, on the web) repaints backgrounds
  // as Canvas and drops box-shadows, which is all a .game-life-dot is drawn
  // with. The dots are the only on-screen count of Brick Breaker's and Sky
  // Fighter's lives and of Bubble Pop's shots left (docs/BUBBLE_POP_RULES.md
  // §3), so they opt out and keep their marks in CanvasText. jsdom computes no
  // style, so the rules are pinned as text.
  it('fills a dot left and rings a spent one in CanvasText', () => {
    const media = '@media (forced-colors: active) {\n  .game-life-dot {';
    const open = css.indexOf(media);
    expect(open, 'the forced-colours block for .game-life-dot is missing').toBeGreaterThan(-1);
    const block = css.slice(open, css.indexOf('\n}\n', open)).replace(/\s+/g, ' ');
    expect(block).toContain(
      '.game-life-dot { forced-color-adjust: none; background: CanvasText; }',
    );
    expect(block).toContain(
      '.game-life-dot-spent { background: transparent; box-shadow: inset 0 0 0 1.5px CanvasText; }',
    );
  });
});
