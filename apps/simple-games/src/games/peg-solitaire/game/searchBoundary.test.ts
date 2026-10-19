/**
 * Nothing searches at play time (docs/PEG_SOLITAIRE_RULES.md §6, §8;
 * docs/GAME_LIFECYCLE.md「CPU 探索」): the solver and the generator exist for
 * the tests and for making the bundled table, and the game never calls them.
 * There is no Hint, and the deal is a table lookup.
 *
 * A promise kept only by convention is one a later change can break without
 * noticing — a "can this still be cleared?" badge would be one call away, and
 * a capped search on the cross costs up to the solver's 200,000-node limit.
 * So this test holds the line in the import graph:
 * - the barrel game/index.ts, which ui/ and state/ import, does not re-export
 *   the solver or the generator;
 * - no file in ui/, state/, storage/ or i18n/ imports either of them, by any
 *   path (relative, the `@/` alias, a dynamic `import()`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAME_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(GAME_DIR, '..');
const SRC = resolve(GAME_ROOT, '../../');
const SEARCH_MODULES = ['solver', 'generator'].map((name) => join(GAME_DIR, name));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Every module specifier a file names: `from '…'`, `import '…'`, `import('…')`. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]!);
  }
  return found;
}

/** The absolute module path a specifier names, extension dropped; null for packages. */
function resolveSpecifier(file: string, specifier: string): string | null {
  const path = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(file), specifier)
      : null;
  return path === null ? null : path.replace(/\.(ts|tsx|js)$/, '');
}

describe('nothing searches at play time (§6, §8)', () => {
  it('reads the specifiers the scan relies on', () => {
    // The scanner's own check: each import form is seen and resolved.
    const file = join(GAME_ROOT, 'ui', 'x.tsx');
    const source = [
      "import { solve } from '../game/solver';",
      "export { enumerateSolvableProblems } from '@/games/peg-solitaire/game/generator';",
      "const later = import('../game/solver.ts');",
      "import '../game/generator';",
    ].join('\n');
    const resolved = specifiers(source).map((s) => resolveSpecifier(file, s));
    expect(resolved).toHaveLength(4);
    for (const path of resolved) expect(SEARCH_MODULES).toContain(path);
  });

  it('keeps the solver and the generator out of the barrel', () => {
    const barrel = join(GAME_DIR, 'index.ts');
    const reached = specifiers(readFileSync(barrel, 'utf8')).map((s) =>
      resolveSpecifier(barrel, s),
    );
    expect(reached.length).toBeGreaterThan(0);
    for (const path of SEARCH_MODULES) expect(reached).not.toContain(path);
  });

  it('is never imported by ui/, state/, storage/ or i18n/', () => {
    const files = ['ui', 'state', 'storage', 'i18n'].flatMap((dir) =>
      sourceFiles(join(GAME_ROOT, dir)),
    );
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      specifiers(readFileSync(file, 'utf8'))
        .filter((s) => SEARCH_MODULES.includes(resolveSpecifier(file, s) ?? ''))
        .map((s) => `${file.slice(GAME_ROOT.length + 1)} → ${s}`),
    );
    expect(offenders).toEqual([]);
  });
});
