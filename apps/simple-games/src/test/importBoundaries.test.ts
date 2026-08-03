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
  return out;
}

const files = listSourceFiles(SRC);
const allImports = files.flatMap(importsOf);
const gamesDir = join(SRC, 'games') + sep;
const registryFile = join(SRC, 'app', 'registry.ts');

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

  it('only the registry and the games themselves reach into src/games/', () => {
    const offenders = allImports.filter((entry) => {
      if (entry.resolved === null || gameOf(entry.resolved) === null) return false;
      return gameOf(entry.file) === null && entry.file !== registryFile;
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
