/**
 * The layering rules of docs/ARCHITECTURE.md, enforced against the real
 * import graph (like the i18n gate, the enforcement lives in a test — a
 * script anyone can skip is not a gate):
 *
 *   1. `games/A/` never imports from `games/B/`. Games do not know each other.
 *   2. Only `app/registry.ts` and code inside `src/games/` may import from
 *      `src/games/` at all — the shell reaches no deeper than the registry.
 *   3. Each game's `storage/keys.ts` imports nothing. It is the one game file
 *      the registry pulls eagerly, and a single import here could tow the
 *      whole game back into the home's initial chunk (issue #26).
 *   4. The registry's *static* imports into games are exactly the keys
 *      leaves; game code arrives only through dynamic `import()` loaders.
 *   5. `src/club/` (Shared / Private Game Club, issue #176; the directory does
 *      not exist yet — issue #161 adds it) is reached from outside itself
 *      only by a real dynamic `import()` from files under `src/app/`. Never
 *      by a static import, an `import type`, an inline `import('x').T` type,
 *      or `import.meta.glob`; never from `games/`, `ui/`, `services/`,
 *      `storage/`, `i18n/`, `backup/`, `state/`, `monetization/`, or test
 *      files outside `club/`. Files inside `club/` may import each other
 *      freely (and reach games only via the registry, which rule 2 already
 *      enforces). This is what turns the one network exception of
 *      check-principles.sh §1 into code Core cannot load without asking
 *      (docs/PRODUCT_PRINCIPLES.md「Shared」).
 *
 * ESLint glob patterns cannot express rule 1 across import depths (a game
 * reaches shared code by '../../../storage' and a sibling game would be
 * '../../<other>' — the specifier shapes overlap), so this test resolves
 * every specifier against the filesystem instead.
 *
 * `import.meta.glob(...)` is a fifth way to reach into games/, alongside the
 * four import forms rule 4 already names (issue #38's per-game i18n tests use
 * it to aggregate every game's catalog). It is treated as dynamic, like
 * `import()`, and only test infrastructure may use it to reach games/ — see
 * GAME_I18N_GLOB below. `no-restricted-imports` cannot see it at all (it only
 * inspects `ImportDeclaration` nodes), so this scanner is its only gate.
 *
 * A glob's resolved path is a *pattern*, and its wildcard may sit before
 * `games`: a glob of every `i18n/index.ts` anywhere under src/, written from
 * ui/, resolves to `src/` followed by a wildcard, so `gameOf` sees no game in
 * it — yet Vite expands it across every game and tows every game chunk into
 * the importer. Rules 1, 2 and 5 therefore judge a glob by the literal head
 * before its first wildcard (`globHead` below), never by a path test.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Vite's project root (apps/simple-games). A specifier starting with '/' is
// root-relative in Vite — `import.meta.glob('/src/club/**')` is a valid way
// to reach a directory — so it resolves here, not to null (a null would
// slip past every rule below; review found exactly that hole for rule 5).
const APP_ROOT = resolve(SRC, '..');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

interface Import {
  file: string;
  specifier: string;
  resolved: string | null; // absolute path inside src/, or null for externals
  dynamic: boolean;
  // Rule 4 reads `dynamic` (loaded eagerly vs. on demand), and
  // `import.meta.glob` is `dynamic: true` like a real `import()`. Two rules
  // need more than that: rules 1 and 2 have to know a glob's `resolved` is a
  // pattern, not a path, to judge it by its literal head (`globMayReachGames`),
  // and rule 5 has to tell a real `import()` apart from a glob (only the
  // former may reach `club/`). `kind` names the form that produced the entry;
  // `dynamic` is untouched, so rule 4 is unchanged.
  kind: 'static' | 'import()' | 'glob';
}

/**
 * Every module specifier in one file, read from the TypeScript AST.
 *
 * This was regex-based until PR #40, and the regexes were wrong five times
 * over: nested generics (`glob<Record<Locale, Record<string, string>>>`)
 * stopped the type-argument matcher at the first inner `>`; whitespace before
 * the type arguments skipped it entirely; the array form Vite documents
 * (`glob: string | string[]`) was not read at all; a glob's own `[...]`
 * character class ended the array scan early; and a comment between the
 * callee and its parentheses hid the call completely. Each fix was correct
 * and each left another hole, because the thing being matched is TypeScript
 * syntax and the thing doing the matching was not a TypeScript parser.
 *
 * `ts.createSourceFile` is one call, ships in a devDependency this repo
 * already has, and settles all five at once by construction — plus escapes
 * and Unicode in specifiers, which `.text` returns already cooked. A gate is
 * only worth the confidence it earns; this one now reads the same grammar
 * the compiler does.
 *
 * The one thing no source scanner can see is an aliased callee
 * (`const g = import.meta.glob; g('../games/…')`). That needs type-level
 * analysis, and is exotic enough to be worth naming here rather than
 * pretending the gate is total.
 */
function importsOf(file: string): Import[] {
  const dir = dirname(file);
  const out: Import[] = [];
  const push = (specifier: string, dynamic: boolean, kind: Import['kind']) => {
    const resolved = specifier.startsWith('.')
      ? resolve(dir, specifier)
      : specifier.startsWith('@/')
        ? resolve(SRC, specifier.slice(2))
        : specifier.startsWith('/')
          ? resolve(APP_ROOT, specifier.slice(1))
          : null;
    out.push({ file, specifier, resolved, dynamic, kind });
  };

  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    // .tsx must parse as TSX: it is what decides whether `<T>` is a type
    // argument list or a JSX element, and reading a component file as plain
    // TS would throw the parse off from that point on.
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  // Covers '' and `` alike — a plain template literal is as valid a
  // specifier as a quoted string, and `.text` gives the cooked value.
  const literalsOf = (node: ts.Node | undefined): string[] => {
    if (node === undefined) return [];
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.filter(ts.isStringLiteralLike).map((element) => element.text);
    }
    return [];
  };

  const visit = (node: ts.Node): void => {
    // `import x from 'y'`, bare `import 'y'`, and `export … from 'y'`.
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      for (const specifier of literalsOf(node.moduleSpecifier)) push(specifier, false, 'static');
    }
    // `const x: import('y').T` — an import in type position. Erased at
    // build time, so it tows no chunk, but the layering rules are about who
    // may know whom: `import type { T } from 'y'` is caught above, and
    // leaving its inline twin unseen would be one more hole of exactly the
    // kind this rewrite exists to close. Static for the same reason.
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      // Erased at build time, so it tows no *chunk* — but rule 5 cares who
      // may know whom, not what survives to the bundle, so this counts as
      // 'static' like the declaration forms above, not as a real `import()`.
      for (const specifier of literalsOf(node.argument.literal)) push(specifier, false, 'static');
    }
    if (ts.isCallExpression(node)) {
      // Dynamic `import('y')`.
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        for (const specifier of literalsOf(node.arguments[0])) push(specifier, true, 'import()');
      }
      // `import.meta.glob('y')` / `glob(['y', 'z'])`, with or without type
      // arguments. Treated as dynamic, like `import()`, for rules 1-4: both
      // are "loaded only when asked for", which is the distinction rule 4
      // turns on. Its own 'glob' kind is what lets rules 1 and 2 read
      // `resolved` as the pattern it is rather than as a path, and rule 5
      // tell it apart from a real `import()` (only the latter may reach into
      // `club/`).
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'glob' &&
        ts.isMetaProperty(callee.expression)
      ) {
        for (const specifier of literalsOf(node.arguments[0])) push(specifier, true, 'glob');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return out;
}

const files = listSourceFiles(SRC);
const allImports = files.flatMap(importsOf);
const gamesDir = join(SRC, 'games') + sep;
const registryFile = join(SRC, 'app', 'registry.ts');

/**
 * The one glob shape issue #38's i18n tests use to aggregate every game's
 * catalog (`src/i18n/gate.test.ts`, `src/i18n/i18n.test.ts`,
 * `src/test/setup.ts`). Matched on the *resolved* path, so it is exempt no
 * matter which of those files' relative depths wrote it — and only this exact
 * pattern: a wildcard placed before `games` resolves to a different string
 * and is judged by `globMayReachGames` like any other glob.
 */
const GAME_I18N_GLOB = join(SRC, 'games', '*', 'i18n', 'index.ts');
const isTestInfra = (file: string): boolean =>
  /\.test\.tsx?$/.test(file) || file === join(SRC, 'test', 'setup.ts');

/** The game id a path belongs to, or null. */
const gameOf = (path: string): string | null =>
  path.startsWith(gamesDir) ? (path.slice(gamesDir.length).split(sep)[0] ?? null) : null;

const rel = (path: string) => path.slice(SRC.length + 1);
const listed = (offenders: Import[]): string[] =>
  offenders.map((o) => `${rel(o.file)} -> ${o.specifier}`);

// Rules 1 and 2 for `import.meta.glob` (rule 5 below shares `globHead`). A
// glob's `resolved` is a pattern, and a wildcard can sit *before* `games`, so
// `gameOf` never sees a game in it:
//
//   import.meta.glob('../**/i18n/index.ts')       from ui/     -> src/**/i18n/index.ts
//   import.meta.glob('../../../**/i18n/index.ts') from a game  -> src/**/i18n/index.ts
//   import.meta.glob('../ga*/*/i18n/index.ts')    from ui/     -> src/ga*/*/i18n/index.ts
//
// Vite expands every one of those across every game and tows every game chunk
// into the importer — the exact thing rule 2 exists to prevent. Only the
// literal head before the first wildcard is known, so a glob counts as
// reaching games/ whenever that head is games/ itself, something under it, or
// an ancestor games/ hangs beneath (`src/`, `src/ga`); a head naming some
// other directory (`src/ui/`, `src/gamesx/`) provably cannot. Deliberately
// conservative: expanding the pattern against the filesystem would tie the
// verdict to whatever is on disk today, and a gate should not go quiet
// because a directory moved. (Line comments on purpose: `**` before `/`
// would end a block comment.)
const GLOB_META = /[*?[{]/;
const globHead = (pattern: string): string => {
  const at = pattern.search(GLOB_META);
  return at === -1 ? pattern : pattern.slice(0, at);
};
const globMayReachGames = (pattern: string): boolean => {
  const head = globHead(pattern);
  return head.startsWith(gamesDir) || gamesDir.startsWith(head);
};
// For a glob written inside game `from`: may it match a file of *another*
// game? Only a head already inside the game's own directory
// (`src/games/sudoku/…`) is provably confined to it. A bare `src/games/sudoku`
// (from '../../sudoku*/…') is not — a sibling `sudoku-plus/` would match too.
const globMayReachOtherGame = (pattern: string, from: string): boolean =>
  globMayReachGames(pattern) && !globHead(pattern).startsWith(join(gamesDir, from) + sep);

/** Rule 1: `games/A/` never imports from `games/B/`. */
function crossGameOffenders(imports: Import[]): Import[] {
  return imports.filter((entry) => {
    if (entry.resolved === null) return false;
    const from = gameOf(entry.file);
    if (from === null) return false;
    if (entry.kind === 'glob') return globMayReachOtherGame(entry.resolved, from);
    const to = gameOf(entry.resolved);
    return to !== null && from !== to;
  });
}

/**
 * Rule 2: only `app/registry.ts`, code inside `src/games/`, and the issue #38
 * i18n aggregator (GAME_I18N_GLOB, from recognised test files) reach into
 * `src/games/`.
 */
function gamesReachOffenders(imports: Import[]): Import[] {
  return imports.filter((entry) => {
    if (entry.resolved === null) return false;
    const reaches =
      entry.kind === 'glob' ? globMayReachGames(entry.resolved) : gameOf(entry.resolved) !== null;
    if (!reaches) return false;
    if (gameOf(entry.file) !== null || entry.file === registryFile) return false;
    // issue #38: the i18n tests glob every game's catalog to test it as a
    // whole. Exempt only this exact resolved target, and only from
    // recognised test files — a shell file (or any other glob shape,
    // wildcard-before-`games` included) reaching into games/ still fails.
    if (isTestInfra(entry.file) && entry.resolved === GAME_I18N_GLOB) return false;
    return true;
  });
}

// The real graph is green, so rules 1 and 2 can only be seen accepting. These
// probes — synthetic entries in the exact shape importsOf() produces, a
// relative specifier resolved against its file's directory the way `push`
// does — show what each rule rejects, and that the glob-head treatment
// neither misses a wildcard-first glob nor over-rejects a glob that provably
// stays out of games/. The files need not exist.
interface Probe {
  file: string; // relative to src/
  specifier: string;
  kind: Import['kind'];
  verdict: 'ok' | 'offender';
}
const probeImports = (probes: Probe[]): Import[] =>
  probes.map(({ file, specifier, kind }) => {
    const abs = join(SRC, file);
    return {
      file: abs,
      specifier,
      resolved: resolve(dirname(abs), specifier),
      dynamic: kind !== 'static',
      kind,
    };
  });
const expectedOffenders = (probes: Probe[]): string[] =>
  probes.filter((p) => p.verdict === 'offender').map((p) => `${p.file} -> ${p.specifier}`);

// Rule 5. `src/club/` does not exist yet (issue #161 adds it), but the gate
// is declared now so #161 lands against it. It is what turns the single
// network exception `check-principles.sh` §1 grants to `apps/simple-games/
// src/club/` into something Core cannot reach without going through a real
// dynamic `import()` from `src/app/` — everywhere else, including `games/`,
// `ui/`, `services/`, `storage/`, `i18n/`, `backup/`, `state/`,
// `monetization/`, and test files outside `club/`, is refused.
const clubRoot = join(SRC, 'club');
const clubDir = clubRoot + sep;
const appDir = join(SRC, 'app') + sep;
// A directory-index import (`import { Hub } from '../club'`, served by
// `club/index.ts`) resolves to the bare directory path, with no trailing
// separator — so a descendants-only prefix test would wave it through. That
// hole was found by review before the directory existed; the equality
// check is what closes it.
const reachesClub = (resolved: string): boolean =>
  resolved === clubRoot || resolved.startsWith(clubDir);
// A glob's resolved "path" is a pattern, and a wildcard can sit *before*
// `club` (`import.meta.glob('../**/api/*.ts')` from app/ resolves to
// `src/**/api/*.ts`), so the prefix test above would never see it — the
// second hole review found. Same treatment as `globMayReachGames`: only the
// literal head before the first wildcard is known, and the pattern may reach
// club/ whenever that head is club/ itself, something under it, or an
// ancestor club/ hangs beneath (`src/`, `src/cl`). A head naming some other
// directory (`src/games/`) provably cannot. Deliberately conservative for the
// same reason, and doubly so here: expanding the glob against the filesystem
// would go quiet exactly while club/ does not exist yet.
const globMayReachClub = (resolved: string): boolean => {
  const head = globHead(resolved);
  return reachesClub(head) || clubDir.startsWith(head);
};

function clubOffenders(imports: Import[]): Import[] {
  return imports.filter((entry) => {
    if (entry.resolved === null) return false;
    const reaches =
      entry.kind === 'glob' ? globMayReachClub(entry.resolved) : reachesClub(entry.resolved);
    if (!reaches) return false;
    // Files inside club/ reach each other freely — only a reach from outside
    // club/ is the thing rule 5 restricts.
    if (entry.file.startsWith(clubDir)) return false;
    // The only shape allowed from outside: a real `import()` (not a static
    // import, an `import type`, an inline `import('x').T`, or
    // `import.meta.glob` — all of those are `kind: 'static' | 'glob'`), and
    // only from a file under src/app/.
    return !(entry.kind === 'import()' && entry.file.startsWith(appDir));
  });
}

describe('import boundaries (docs/ARCHITECTURE.md)', () => {
  it('found a believable amount of code to check', () => {
    // A refactor that breaks the scanner must fail loudly, not pass emptily.
    expect(files.length).toBeGreaterThan(100);
    expect(allImports.filter((entry) => entry.resolved).length).toBeGreaterThan(300);
  });

  it('no game imports from another game', () => {
    expect(listed(crossGameOffenders(allImports))).toEqual([]);
  });

  it('only the registry, the games themselves, and the i18n test aggregator reach into src/games/', () => {
    expect(listed(gamesReachOffenders(allImports))).toEqual([]);
  });

  it('every storage/keys.ts is a zero-import leaf', () => {
    const keyFiles = files.filter((file) =>
      /games[\\/][^\\/]+[\\/]storage[\\/]keys\.ts$/.test(file),
    );
    // One per game — if a game loses its keys leaf the registry cannot list it.
    expect(keyFiles.length).toBe(readdirSync(join(SRC, 'games')).length);
    const withImports = keyFiles.filter((file) => importsOf(file).length > 0);
    expect(withImports.map(rel)).toEqual([]);
  });

  it('the registry statically imports only the keys leaves from games', () => {
    const offenders = allImports.filter(
      (entry) =>
        entry.file === registryFile &&
        !entry.dynamic &&
        entry.resolved !== null &&
        gameOf(entry.resolved) !== null &&
        !/[\\/]storage[\\/]keys$/.test(entry.resolved),
    );
    expect(offenders.map((o) => o.specifier)).toEqual([]);
  });

  it('rule 1 rejects a sibling game, by path or by glob head (self-check on synthetic imports)', () => {
    const own = 'games/sudoku/ui/SudokuRoot.tsx';
    const probes: Probe[] = [
      // Within the game, and out to shared code: allowed.
      { file: own, specifier: '../game/solver', kind: 'static', verdict: 'ok' },
      { file: own, specifier: '../../../storage/kv', kind: 'static', verdict: 'ok' },
      // Another game, statically or lazily: offender either way.
      { file: own, specifier: '../../minesweeper/game/board', kind: 'static', verdict: 'offender' },
      {
        file: own,
        specifier: '../../minesweeper/ui/MinesweeperRoot',
        kind: 'import()',
        verdict: 'offender',
      },
      // A glob confined to the game's own directory: allowed.
      { file: own, specifier: './components/*.tsx', kind: 'glob', verdict: 'ok' },
      // A glob whose head is games/ itself: every sibling matches.
      { file: own, specifier: '../../*/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      // The wildcard-first shape: resolves to src/**/i18n/index.ts, where
      // gameOf() sees nothing — the hole the glob-head treatment closes.
      { file: own, specifier: '../../../**/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      // A bare head `src/games/sudoku` is not the game's directory: a sibling
      // named `sudoku-plus/` would match. Conservative, so an offender.
      { file: own, specifier: '../../sudoku*/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      // A glob whose head names a directory games/ cannot hang under: allowed.
      { file: own, specifier: '../../../ui/**/*.tsx', kind: 'glob', verdict: 'ok' },
      // From outside games/ altogether: rule 2's business, not rule 1's.
      {
        file: 'ui/screens/HomeScreen.tsx',
        specifier: '../../**/i18n/index.ts',
        kind: 'glob',
        verdict: 'ok',
      },
    ];
    expect(listed(crossGameOffenders(probeImports(probes)))).toEqual(expectedOffenders(probes));
  });

  it('rule 2 rejects a reach into games/, by path or by glob head (self-check on synthetic imports)', () => {
    const shell = 'ui/screens/HomeScreen.tsx';
    const i18nTest = 'i18n/i18n.test.ts';
    const probes: Probe[] = [
      // The shell reaching past the registry, statically or lazily: offender.
      {
        file: shell,
        specifier: '../../games/sudoku/ui/SudokuRoot',
        kind: 'static',
        verdict: 'offender',
      },
      {
        file: shell,
        specifier: '../../games/sudoku/ui/SudokuResult',
        kind: 'import()',
        verdict: 'offender',
      },
      // A glob that stays in ui/: allowed.
      { file: shell, specifier: '../components/*.tsx', kind: 'glob', verdict: 'ok' },
      // The aggregator's exact shape, but from a shell file: offender.
      { file: shell, specifier: '../../games/*/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      // Wildcard before `games` (resolves to src/**/i18n/index.ts): Vite
      // expands it across every game — offender, though gameOf() sees nothing.
      { file: shell, specifier: '../../**/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      // Heads that are a proper prefix of `src/games/`: `src/ga`, `src/games`.
      { file: shell, specifier: '../../ga*/*/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      { file: shell, specifier: '../../games*/index.ts', kind: 'glob', verdict: 'offender' },
      // A sibling directory that merely shares letters with games/: allowed.
      { file: shell, specifier: '../../gamesx/**/*.ts', kind: 'glob', verdict: 'ok' },
      // issue #38: the aggregator's shape from recognised test files: exempt.
      { file: i18nTest, specifier: '../games/*/i18n/index.ts', kind: 'glob', verdict: 'ok' },
      { file: 'test/setup.ts', specifier: '../games/*/i18n/index.ts', kind: 'glob', verdict: 'ok' },
      // The same files with any other shape — wildcard first, a wider tail,
      // a static import — get no pass.
      { file: i18nTest, specifier: '../**/i18n/index.ts', kind: 'glob', verdict: 'offender' },
      { file: i18nTest, specifier: '../games/*/i18n/*.ts', kind: 'glob', verdict: 'offender' },
      {
        file: i18nTest,
        specifier: '../games/sudoku/i18n/index.ts',
        kind: 'static',
        verdict: 'offender',
      },
      // The registry is rule 4's business, not rule 2's.
      {
        file: 'app/registry.ts',
        specifier: '../games/sudoku/storage/keys',
        kind: 'static',
        verdict: 'ok',
      },
      // Inside games/ is rule 1's business, not rule 2's.
      {
        file: 'games/sudoku/ui/SudokuRoot.tsx',
        specifier: '../../minesweeper/game/board',
        kind: 'static',
        verdict: 'ok',
      },
    ];
    expect(listed(gamesReachOffenders(probeImports(probes)))).toEqual(expectedOffenders(probes));
  });

  it('the scanner resolves root-relative and @/ globs, so they cannot hide from any rule', () => {
    // Synthetic entries prove the *rule*; this proves the *scanner* feeds it.
    // A root-relative glob used to resolve to null and fall out of every
    // rule before reachability was even asked (review finding, 2026-09-09).
    const dir = mkdtempSync(join(tmpdir(), 'sg-import-boundaries-'));
    const file = join(dir, 'probe.ts');
    try {
      writeFileSync(
        file,
        [
          "export const a = import.meta.glob('/src/club/**/*.ts', { eager: true });",
          "export const b = import.meta.glob('@/club/*.ts');",
          "export const c = import('/src/club/hub');",
        ].join('\n'),
      );
      const found = importsOf(file).map((entry) => [entry.kind, entry.resolved]);
      expect(found).toEqual([
        ['glob', join(SRC, 'club', '**', '*.ts')],
        ['glob', join(SRC, 'club', '*.ts')],
        ['import()', join(SRC, 'club', 'hub')],
      ]);
      // And the rule refuses them from a file outside src/app/.
      expect(clubOffenders(importsOf(file)).map((o) => o.specifier)).toEqual([
        '/src/club/**/*.ts',
        '@/club/*.ts',
        '/src/club/hub',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('src/club/ is reached only by dynamic import() from src/app/', () => {
    const offenders = clubOffenders(allImports);
    expect(offenders.map((o) => `${rel(o.file)} -> ${o.specifier}`)).toEqual([]);
  });

  it('the club rule sees offenders (self-check, because the directory may not exist yet)', () => {
    // club/ does not exist in this checkout yet (issue #161 adds it), so the
    // rule above passes vacuously — the same "no-op while green" failure mode
    // every fs-reading gate in this repo has to guard against. These entries
    // are synthetic, built the same shape importsOf() produces, to prove the
    // rule actually rejects what it claims to reject.
    const settingsFile = join(SRC, 'ui', 'screens', 'SettingsScreen.tsx');
    const settingsTestFile = join(SRC, 'ui', 'screens', 'SettingsScreen.test.tsx');
    const appFile = join(SRC, 'app', 'App.tsx');
    const sudokuFile = join(SRC, 'games', 'sudoku', 'ui', 'SudokuRoot.tsx');
    const hubFile = join(SRC, 'club', 'hub', 'Hub.tsx');
    const hubResolved = join(SRC, 'club', 'hub', 'Hub');
    const apiClientResolved = join(SRC, 'club', 'api', 'client');
    const globResolved = join(SRC, 'club', '*');

    const synthetic: Import[] = [
      // static import of club/ from ui/, outside app/: offender.
      {
        file: settingsFile,
        specifier: '../../club/hub (static)',
        resolved: hubResolved,
        dynamic: false,
        kind: 'static',
      },
      // import() of club/ from ui/, outside app/: still an offender — only a
      // file under src/app/ may load club/ dynamically.
      {
        file: settingsFile,
        specifier: '../../club/hub (import())',
        resolved: hubResolved,
        dynamic: true,
        kind: 'import()',
      },
      // static import of club/ from app/: offender — even the shell must go
      // through a real import().
      {
        file: appFile,
        specifier: '../club/hub (static)',
        resolved: hubResolved,
        dynamic: false,
        kind: 'static',
      },
      // import.meta.glob of club/ from app/: offender — glob is not import().
      {
        file: appFile,
        specifier: '../club/*',
        resolved: globResolved,
        dynamic: true,
        kind: 'glob',
      },
      // static import of club/ from a game: offender.
      {
        file: sudokuFile,
        specifier: '../../../club/hub',
        resolved: hubResolved,
        dynamic: false,
        kind: 'static',
      },
      // import() of club/ from app/: the one allowed shape.
      {
        file: appFile,
        specifier: '../club/hub (import())',
        resolved: hubResolved,
        dynamic: true,
        kind: 'import()',
      },
      // static import from inside club/ to inside club/: allowed, files in
      // club/ compose freely.
      {
        file: hubFile,
        specifier: '../api/client',
        resolved: apiClientResolved,
        dynamic: false,
        kind: 'static',
      },
      // a .test.tsx outside club/ importing club/ statically: offender —
      // tests do not get a pass either.
      {
        file: settingsTestFile,
        specifier: '../../club/hub',
        resolved: hubResolved,
        dynamic: false,
        kind: 'static',
      },
      // directory-index import (`from '../../club'`, i.e. club/index.ts):
      // resolves to the bare directory with no trailing separator, and is
      // still an offender.
      {
        file: settingsFile,
        specifier: '../../club',
        resolved: clubRoot,
        dynamic: false,
        kind: 'static',
      },
      // the same directory-index shape via a real import() from app/: allowed.
      {
        file: appFile,
        specifier: '../club (import())',
        resolved: clubRoot,
        dynamic: true,
        kind: 'import()',
      },
      // a glob whose wildcard comes *before* `club`: the resolved pattern is
      // `src/**/api/*.ts`, which never starts with `src/club/` — still an
      // offender, because its literal head (`src/`) is an ancestor of club/.
      {
        file: appFile,
        specifier: '../**/api/*.ts',
        resolved: join(SRC, '**', 'api', '*.ts'),
        dynamic: true,
        kind: 'glob',
      },
      // the i18n aggregator's real glob shape: its literal head is
      // `src/games/`, which club/ cannot hang under — allowed by this rule
      // (rule 2 governs whether that file may reach games/ at all).
      {
        file: join(SRC, 'i18n', 'i18n.test.ts'),
        specifier: '../games/*/i18n/index.ts',
        resolved: join(SRC, 'games', '*', 'i18n', 'index.ts'),
        dynamic: true,
        kind: 'glob',
      },
    ];

    const offenders = clubOffenders(synthetic)
      .map((o) => `${rel(o.file)} -> ${o.specifier}`)
      .sort();
    expect(offenders).toEqual(
      [
        'app/App.tsx -> ../**/api/*.ts',
        'app/App.tsx -> ../club/*',
        'app/App.tsx -> ../club/hub (static)',
        'games/sudoku/ui/SudokuRoot.tsx -> ../../../club/hub',
        'ui/screens/SettingsScreen.test.tsx -> ../../club/hub',
        'ui/screens/SettingsScreen.tsx -> ../../club',
        'ui/screens/SettingsScreen.tsx -> ../../club/hub (import())',
        'ui/screens/SettingsScreen.tsx -> ../../club/hub (static)',
      ].sort(),
    );
  });
});
