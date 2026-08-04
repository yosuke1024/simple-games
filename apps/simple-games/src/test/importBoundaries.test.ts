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
 * GAME_I18N_GLOB below. `no-restricted-imports` cannot see it either (it only
 * inspects `ImportDeclaration` nodes), so this scanner is the only gate on it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
}

/**
 * Every quoted literal up to (not including) the array's closing `]`, which
 * must itself be outside any quote — a naive `indexOf(']')` would instead
 * stop at the first `]` anywhere, including one inside a glob's own
 * character-class syntax (Codex review, PR #40).
 */
function arrayLiterals(text: string): string[] {
  let quote: string | null = null;
  let closeIdx = text.length;
  for (let j = 0; j < text.length; j++) {
    const ch = text[j];
    if (quote) {
      if (ch === '\\') j++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === ']') {
      closeIdx = j;
      break;
    }
  }
  const out: string[] = [];
  for (const literal of text.slice(0, closeIdx).matchAll(/['"`]([^'"`]+)['"`]/g)) {
    out.push(literal[1]!);
  }
  return out;
}

/**
 * `import.meta.glob<T>('specifier', opts)` — T can itself contain generics
 * (`Record<Locale, Record<string, string>>>`, as issue #38's i18n tests use),
 * so a `<[^>]*>` regex stops at the first *inner* `>` and never reaches the
 * call at all, silently. Balance the angle brackets by hand instead of
 * trying to bound arbitrary nesting depth in one regex (Codex review, PR #40).
 */
function globSpecifiers(text: string): string[] {
  const marker = 'import.meta.glob';
  const out: string[] = [];
  let from = 0;
  for (let at = text.indexOf(marker, from); at !== -1; at = text.indexOf(marker, from)) {
    let i = at + marker.length;
    // A call permits whitespace before its type argument list
    // (`import.meta.glob <T>(...)` is valid TS), so the `<` check has to
    // look past it or this scanner is blind to that formatting too (Codex
    // review, PR #40).
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] === '<') {
      let depth = 1;
      i++;
      while (i < text.length && depth > 0) {
        if (text[i] === '<') depth++;
        else if (text[i] === '>') depth--;
        i++;
      }
    }
    // Vite's own type (vite/types/importGlob.d.ts) accepts `string | string[]`
    // — import.meta.glob(['a', 'b']) is as real as the single-string form —
    // so a scanner that only reads a leading quote misses every array call
    // (Codex review, PR #40). Backtick strings count too: Vite's transform
    // reads the argument as an AST string literal, which a plain
    // `` `../games/*/i18n/index.ts` `` satisfies exactly like a quoted one.
    const afterParen = /^\s*\(\s*/.exec(text.slice(i));
    if (afterParen) {
      const rest = text.slice(i + afterParen[0].length);
      if (rest[0] === '[') {
        // Glob patterns can carry a `[...]` character class of their own
        // (`'../games/[bs]*/i18n/index.ts'` — real Vite 8 syntax), so the
        // array's closing `]` has to be found outside any quoted string,
        // not just the first `]` in the text (Codex review, PR #40).
        out.push(...arrayLiterals(rest.slice(1)));
      } else {
        const single = /^['"`]([^'"`]+)['"`]/.exec(rest);
        if (single) out.push(single[1]!);
      }
    }
    from = at + marker.length;
  }
  return out;
}

/** Static `import ... from`, `export ... from`, bare `import 'x'`, and dynamic `import('x')`. */
function importsOf(file: string): Import[] {
  const text = readFileSync(file, 'utf8');
  const dir = dirname(file);
  const out: Import[] = [];
  const push = (specifier: string, dynamic: boolean) => {
    const resolved = specifier.startsWith('.')
      ? resolve(dir, specifier)
      : specifier.startsWith('@/')
        ? resolve(SRC, specifier.slice(2))
        : null;
    out.push({ file, specifier, resolved, dynamic });
  };
  const staticPattern = /(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s+['"]([^'"]+)['"]/g;
  const barePattern = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  const dynamicPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of text.matchAll(staticPattern)) push(match[1]!, false);
  for (const match of text.matchAll(barePattern)) push(match[1]!, false);
  for (const match of text.matchAll(dynamicPattern)) push(match[1]!, true);
  for (const specifier of globSpecifiers(text)) push(specifier, true);
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
 * matter which of those files' relative depths wrote it.
 */
const GAME_I18N_GLOB = join(SRC, 'games', '*', 'i18n', 'index.ts');
const isTestInfra = (file: string): boolean =>
  /\.test\.tsx?$/.test(file) || file === join(SRC, 'test', 'setup.ts');

/** The game id a path belongs to, or null. */
const gameOf = (path: string): string | null =>
  path.startsWith(gamesDir) ? (path.slice(gamesDir.length).split(sep)[0] ?? null) : null;

const rel = (path: string) => path.slice(SRC.length + 1);

describe('import boundaries (docs/ARCHITECTURE.md)', () => {
  it('found a believable amount of code to check', () => {
    // A refactor that breaks the scanner must fail loudly, not pass emptily.
    expect(files.length).toBeGreaterThan(100);
    expect(allImports.filter((entry) => entry.resolved).length).toBeGreaterThan(300);
  });

  it('no game imports from another game', () => {
    const offenders = allImports.filter((entry) => {
      if (entry.resolved === null) return false;
      const from = gameOf(entry.file);
      const to = gameOf(entry.resolved);
      return from !== null && to !== null && from !== to;
    });
    expect(offenders.map((o) => `${rel(o.file)} -> ${o.specifier}`)).toEqual([]);
  });

  it('only the registry, the games themselves, and the i18n test aggregator reach into src/games/', () => {
    const offenders = allImports.filter((entry) => {
      if (entry.resolved === null || gameOf(entry.resolved) === null) return false;
      if (gameOf(entry.file) !== null || entry.file === registryFile) return false;
      // issue #38: the i18n tests glob every game's catalog to test it as a
      // whole. Exempt only this exact resolved target, and only from
      // recognised test files — a shell file (or any other glob shape)
      // reaching into games/ still fails below.
      if (isTestInfra(entry.file) && entry.resolved === GAME_I18N_GLOB) return false;
      return true;
    });
    expect(offenders.map((o) => `${rel(o.file)} -> ${o.specifier}`)).toEqual([]);
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
});
