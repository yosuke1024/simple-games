// @vitest-environment node
/**
 * Rewrites bundled.ts (docs/MAKE_THE_TARGET_RULES.md §6「同梱の問題」) from the
 * generator. Not a check: without the environment variable
 * MAKE_THE_TARGET_BUNDLED=write it does nothing (one skipped case).
 *
 * From apps/simple-games:
 *   MAKE_THE_TARGET_BUNDLED=write pnpm exec vitest run \
 *     src/games/make-the-target/game/bundled.generate.test.ts
 *   pnpm exec prettier --write src/games/make-the-target/game/bundled.ts
 *
 * bundled.test.ts then proves the table: same seeds, same problems.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { bundledSeeds } from './test-helpers';
import { DIFFICULTIES } from './types';

const command = process.env.MAKE_THE_TARGET_BUNDLED ?? '';
const file = fileURLToPath(new URL('./bundled.ts', import.meta.url));

describe('bundled.ts writer', () => {
  it.skipIf(command !== 'write')('writes the table', () => {
    const source = readFileSync(file, 'utf8');
    const start = source.indexOf('const ROWS');
    const end = source.indexOf('};', start) + 2;
    const rows = DIFFICULTIES.map((difficulty) => {
      const entries = bundledSeeds(difficulty).rows.map(
        ({ k, made }) =>
          `    [${k}, [${made.numbers.join(', ')}], ${made.target}, '${made.solution}', ${made.ways}, ${made.waysWithoutDivision}],`,
      );
      return `  ${difficulty}: [\n${entries.join('\n')}\n  ],`;
    });
    const table = `const ROWS: Record<Difficulty, readonly Row[]> = {\n${rows.join('\n')}\n};`;
    writeFileSync(file, source.slice(0, start) + table + source.slice(end));
  });
});
