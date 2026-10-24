// @vitest-environment node
/**
 * Regenerates the bundled catalogue of docs/UNBLOCK_PUZZLE_RULES.md §8 with
 * the procedure of catalogueBuild.ts. Not a check: without the environment
 * variable UNBLOCK_CATALOGUE it does nothing (one skipped case), so the
 * suite never spends the hour a full regeneration takes.
 *
 * Two commands, run from apps/simple-games:
 *
 * - `UNBLOCK_CATALOGUE=scan:<difficulty>:<from>:<to>:<file.jsonl>` scans
 *   seeds `from`…`to` (step 1) and appends one record per seed to the file.
 *   One seed's record depends on that seed alone, so ranges can be scanned
 *   side by side in separate processes and in any order.
 * - `UNBLOCK_CATALOGUE=children:<difficulty>:<from>:<to>:<dir>:<file.jsonl>`
 *   does the second half of a Hard scan on its own: for each seed in range
 *   whose base a scan file in `dir` holds, `childrenOf` that base, appended
 *   as `{n, children}`. A scan record is its base plus its children, so the
 *   two halves can run apart — the base climbs are the long part.
 * - `UNBLOCK_CATALOGUE=write:<dir>:<easy>:<medium>:<hard>` reads every
 *   `<difficulty>*.jsonl` in `dir`, selects that many boards per tier in seed
 *   order (step 2), and writes catalogueData.ts (step 3) and
 *   catalogueProvenance.ts (the seeds read and why each skipped one was
 *   skipped, for catalogueBuild.test.ts). Then format both with prettier.
 *
 * pnpm exec vitest run src/games/unblock-puzzle/game/catalogue.generate.test.ts
 * with the variable set; the case has no time limit.
 */
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  baseSeed,
  catalogueDataSource,
  childrenOf,
  encodeTier,
  scanSeed,
  selectCatalogue,
  type ScanRecord,
  type Selection,
} from './catalogueBuild';
import { decodeBoard } from './serialize';
import { DIFFICULTIES, isDifficulty, type Difficulty } from './types';

const command = process.env.UNBLOCK_CATALOGUE ?? '';
const here = fileURLToPath(new URL('.', import.meta.url));

function scan(args: string[]): void {
  const [difficulty, from, to, file] = args;
  if (!isDifficulty(difficulty) || file === undefined)
    throw new Error('scan:<difficulty>:<from>:<to>:<file>');
  for (let n = Number(from); n <= Number(to); n++) {
    appendFileSync(file, `${JSON.stringify(scanSeed(difficulty, n))}\n`);
  }
}

/** Every record of a tier in a directory's scan files, halves of one seed merged. */
function records(dir: string, difficulty: Difficulty): ScanRecord[] {
  const byN = new Map<number, ScanRecord>();
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(difficulty) || !name.endsWith('.jsonl')) continue;
    for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const record = JSON.parse(line) as ScanRecord;
      byN.set(record.n, { ...byN.get(record.n), ...record });
    }
  }
  return [...byN.values()].sort((a, b) => a.n - b.n);
}

function children(args: string[]): void {
  const [difficulty, from, to, dir, file] = args;
  if (!isDifficulty(difficulty) || dir === undefined || file === undefined) {
    throw new Error('children:<difficulty>:<from>:<to>:<dir>:<file>');
  }
  for (const record of records(dir, difficulty)) {
    if (record.n < Number(from) || record.n > Number(to) || record.board === null) continue;
    const board = decodeBoard(record.board)!;
    const kids = childrenOf(baseSeed(difficulty, record.n), board, difficulty);
    appendFileSync(file, `${JSON.stringify({ n: record.n, children: kids })}\n`);
  }
}

function write(args: string[]): void {
  const [dir, ...counts] = args;
  if (dir === undefined || counts.length !== 3)
    throw new Error('write:<dir>:<easy>:<medium>:<hard>');
  const selections = {} as Record<Difficulty, Selection>;
  DIFFICULTIES.forEach((difficulty, i) => {
    const count = Number(counts[i]);
    const selection = selectCatalogue(difficulty, records(dir, difficulty), count);
    if (selection.kept.length < count) {
      throw new Error(
        `${difficulty}: ${selection.kept.length} of ${count} after ${selection.tried} seeds`,
      );
    }
    selections[difficulty] = selection;
  });
  const data = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      encodeTier(
        selections[difficulty].kept.map((kept) => ({
          board: decodeBoard(kept.board)!,
          minMoves: kept.minMoves,
        })),
      ),
    ]),
  ) as Record<Difficulty, ReturnType<typeof encodeTier>>;
  const note = DIFFICULTIES.map((difficulty) => {
    const s = selections[difficulty];
    return (
      `${difficulty}: ${s.kept.length} boards from seeds 1–${s.tried} (${s.nulls.length} found nothing, ` +
      `${s.duplicates.length} repeated a component, ${s.rigid.length} rigid; ` +
      `${s.children} children kept, ${s.childDuplicates} repeated a component).`
    );
  }).join('\n');
  writeFileSync(join(here, 'catalogueData.ts'), catalogueDataSource(data, note));
  // One character per seed read: k kept, n nothing found, d a component
  // already kept, r rigid.
  const provenance = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => {
      const selection = selections[difficulty];
      const marks = Array.from({ length: selection.tried }, () => 'k');
      for (const n of selection.nulls) marks[n - 1] = 'n';
      for (const n of selection.duplicates) marks[n - 1] = 'd';
      for (const n of selection.rigid) marks[n - 1] = 'r';
      const { children: kids, childDuplicates, lastRound } = selection;
      return [difficulty, { seeds: marks.join(''), children: kids, childDuplicates, lastRound }];
    }),
  );
  writeFileSync(
    join(here, 'catalogueProvenance.ts'),
    `/**\n * Generated by catalogue.generate.test.ts — do not edit by hand. The seeds\n` +
      ` * the catalogue procedure (catalogueBuild.ts) read for each tier, one\n` +
      ` * character each — k kept, n nothing found, d a component already kept,\n` +
      ` * r rigid — and how many children (Hard) it kept, skipped as repeats, and\n` +
      ` * the last round of children it began. Read by catalogueBuild.test.ts only —\n` +
      ` * the app never imports it.\n */\n` +
      `export const CATALOGUE_PROVENANCE = ${JSON.stringify(provenance, null, 2)} as const;\n`,
  );
}

describe.skipIf(command === '')('catalogue generation (UNBLOCK_CATALOGUE)', () => {
  it(
    'runs the command',
    () => {
      const [verb, ...args] = command.split(':');
      if (verb === 'scan') scan(args);
      else if (verb === 'children') children(args);
      else if (verb === 'write') write(args);
      else throw new Error(`UNBLOCK_CATALOGUE: unknown command ${verb}`);
      expect(true).toBe(true);
    },
    24 * 60 * 60 * 1000,
  );
});
