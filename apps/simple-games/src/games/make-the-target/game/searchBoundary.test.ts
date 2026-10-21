// @vitest-environment node
/**
 * Nothing searches at play time except a new problem (docs/MAKE_THE_TARGET_
 * RULES.md §5「Hint は作らない」「game/ のモジュールの境界」, §6「探索の走る
 * とき」; docs/GAME_LIFECYCLE.md「CPU 探索」). A promise kept only by
 * convention is one a later change breaks without noticing — a "can this
 * still be made?" badge would be one `countWays` call away — so this test
 * holds the lines in the import graph:
 *
 * - the barrel game/index.ts re-exports none of the solver, the generator,
 *   the bundled table or newSession.ts;
 * - no file in ui/, state/, storage/ or i18n/ imports the solver, the
 *   generator or the bundled table, by any path (relative, the `@/` alias, a
 *   dynamic `import()`); only state/ may import newSession.ts, the single
 *   door to the generator;
 * - inside game/, only generator.ts imports the solver and the bundled
 *   table, only newSession.ts imports the generator, and no module imports
 *   newSession.ts (tests aside) — so nothing in game/ can hand the generator
 *   on to a layer that may not open it;
 * - restore.ts reaches none of the four, directly or through what it imports
 *   — loading a save never searches — and session.ts reaches neither the
 *   solver nor the generator;
 * - tiers.ts is a leaf: type imports from types.ts, nothing else.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAME_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(GAME_DIR, '..');
const SRC = resolve(GAME_ROOT, '../../');
const mod = (name: string) => join(GAME_DIR, name);
const SOLVER = mod('solver');
const GENERATOR = mod('generator');
const BUNDLED = mod('bundled');
const NEW_SESSION = mod('newSession');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file) || file.endsWith('test-helpers.ts');

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

const importsOf = (file: string): string[] =>
  specifiers(readFileSync(file, 'utf8'))
    .map((s) => resolveSpecifier(file, s))
    .filter((p): p is string => p !== null);

/** Every game/ module `start` reaches through its imports, itself excluded. */
function reachable(start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of importsOf(`${current}.ts`)) {
      if (!next.startsWith(GAME_DIR) || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

describe('nothing searches at play time but a new problem (§5, §6)', () => {
  it('reads the specifiers the scan relies on', () => {
    const file = join(GAME_ROOT, 'ui', 'x.tsx');
    const source = [
      "import { countWays } from '../game/solver';",
      "export { generateProblem } from '@/games/make-the-target/game/generator';",
      "const later = import('../game/bundled.ts');",
      "import '../game/newSession';",
    ].join('\n');
    const resolved = specifiers(source).map((s) => resolveSpecifier(file, s));
    expect([...resolved].sort()).toEqual([SOLVER, GENERATOR, BUNDLED, NEW_SESSION].sort());
  });

  it('keeps the solver, the generator, the bundled table and newSession out of the barrel', () => {
    const reached = importsOf(mod('index.ts'));
    expect(reached.length).toBeGreaterThan(0);
    for (const path of [SOLVER, GENERATOR, BUNDLED, NEW_SESSION])
      expect(reached).not.toContain(path);
  });

  it('ui/, state/, storage/ and i18n/ never import the search; only state/ opens newSession', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of ['ui', 'state', 'storage', 'i18n']) {
      for (const file of sourceFiles(join(GAME_ROOT, dir))) {
        scanned++;
        const banned =
          dir === 'state'
            ? [SOLVER, GENERATOR, BUNDLED]
            : [SOLVER, GENERATOR, BUNDLED, NEW_SESSION];
        for (const path of importsOf(file)) {
          if (banned.includes(path))
            offenders.push(`${file.slice(GAME_ROOT.length + 1)} → ${path}`);
        }
      }
    }
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('inside game/, only generator.ts imports the solver and the table, only newSession.ts the generator, nothing newSession', () => {
    const owners = new Map<string, string[]>([
      [SOLVER, []],
      [BUNDLED, []],
      [GENERATOR, []],
      [NEW_SESSION, []],
    ]);
    for (const file of sourceFiles(GAME_DIR).filter((f) => !isTest(f))) {
      for (const path of importsOf(file)) owners.get(path)?.push(file.slice(GAME_DIR.length + 1));
    }
    expect(owners.get(SOLVER)).toEqual(['generator.ts']);
    expect(owners.get(BUNDLED)).toEqual(['generator.ts']);
    expect(owners.get(GENERATOR)).toEqual(['newSession.ts']);
    // A game/ module re-exporting newSession would let ui/, storage/ or i18n/
    // reach the generator through it; the state layer imports it by name.
    expect(owners.get(NEW_SESSION)).toEqual([]);
  });

  it('restore.ts reaches none of the four, even through what it imports', () => {
    const reached = reachable(mod('restore'));
    expect(reached.size).toBeGreaterThan(0);
    for (const path of [SOLVER, GENERATOR, BUNDLED, NEW_SESSION])
      expect(reached).not.toContain(path);
    // What it does read (§5): the rules, the session, the move string, the tiers, the types, the dates.
    expect([...reached].map((p) => p.slice(GAME_DIR.length + 1)).sort()).toEqual([
      'daily',
      'engine',
      'serialize',
      'session',
      'tiers',
      'types',
    ]);
  });

  it('session.ts reaches neither the solver nor the generator', () => {
    const reached = reachable(mod('session'));
    for (const path of [SOLVER, GENERATOR, BUNDLED, NEW_SESSION])
      expect(reached).not.toContain(path);
  });

  it('tiers.ts is a leaf: type imports from types.ts only', () => {
    const source = readFileSync(mod('tiers.ts'), 'utf8');
    const lines = source.split('\n').filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
    expect(lines).toEqual(["import type { Difficulty, Operator } from './types';"]);
    expect(specifiers(source)).toEqual(['./types']);
  });
});
