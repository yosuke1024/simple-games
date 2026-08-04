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
 * GAME_I18N_GLOB below. `no-restricted-imports` cannot see it at all (it only
 * inspects `ImportDeclaration` nodes), so this scanner is its only gate.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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
  const push = (specifier: string, dynamic: boolean) => {
    const resolved = specifier.startsWith('.')
      ? resolve(dir, specifier)
      : specifier.startsWith('@/')
        ? resolve(SRC, specifier.slice(2))
        : null;
    out.push({ file, specifier, resolved, dynamic });
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
      for (const specifier of literalsOf(node.moduleSpecifier)) push(specifier, false);
    }
    // `const x: import('y').T` — an import in type position. Erased at
    // build time, so it tows no chunk, but the layering rules are about who
    // may know whom: `import type { T } from 'y'` is caught above, and
    // leaving its inline twin unseen would be one more hole of exactly the
    // kind this rewrite exists to close. Static for the same reason.
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      for (const specifier of literalsOf(node.argument.literal)) push(specifier, false);
    }
    if (ts.isCallExpression(node)) {
      // Dynamic `import('y')`.
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        for (const specifier of literalsOf(node.arguments[0])) push(specifier, true);
      }
      // `import.meta.glob('y')` / `glob(['y', 'z'])`, with or without type
      // arguments. Treated as dynamic, like `import()`: both are "loaded
      // only when asked for", which is the distinction rule 4 turns on.
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'glob' &&
        ts.isMetaProperty(callee.expression)
      ) {
        for (const specifier of literalsOf(node.arguments[0])) push(specifier, true);
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
