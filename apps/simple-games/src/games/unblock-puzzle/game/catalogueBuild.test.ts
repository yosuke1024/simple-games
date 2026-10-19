/**
 * The procedure behind the bundled catalogue (catalogueBuild.ts,
 * docs/UNBLOCK_PUZZLE_RULES.md §8): its compact form reads back exactly, its
 * selection rules skip what they say they skip, and — provenance — re-running
 * it on a sample of seeds gives the bundled boards back: they are this
 * game's own output, not data from anywhere else.
 *
 * The whole regeneration takes the better part of an hour
 * (catalogue.generate.test.ts runs it), so it is sampled here: the first, a
 * middle and the last kept seed of each tier, and the first seed each rule
 * skipped. catalogueProvenance.ts marks, per tier, every seed read: kept,
 * or skipped and why; every kept seed's base is a bundled board, and for
 * Hard its children follow.
 */
import { describe, expect, it } from 'vitest';
import {
  RUN,
  boardFromCode,
  bucketCode,
  catalogueEntry,
  catalogueSize,
  type CatalogueData,
} from './catalogue';
import {
  BASE_PROBES_KEPT,
  boardCode,
  buildCatalogue,
  encodeBucket,
  encodeTier,
  scanSeed,
  selectCatalogue,
  type ScanRecord,
} from './catalogueBuild';
import { CATALOGUE_PROVENANCE } from './catalogueProvenance';
import { holdsBoard } from './catalogueVerify';
import { COMPONENT_LIMIT, componentKey } from './generator';
import { createRng } from './rng';
import { exploreComponent } from './search';
import { decodeBoard, encodeBoard } from './serialize';
import { DIFFICULTIES, type Difficulty } from './types';

const bundledByTier = new Map<Difficulty, Map<string, number>>();

/** Every bundled board of a tier, as text, with its fewest moves. */
function bundled(difficulty: Difficulty): Map<string, number> {
  let boards = bundledByTier.get(difficulty);
  if (boards === undefined) {
    boards = new Map(
      Array.from({ length: catalogueSize(difficulty) }, (_, index) => {
        const entry = catalogueEntry(difficulty, index);
        return [encodeBoard(entry.board), entry.minMoves] as const;
      }),
    );
    bundledByTier.set(difficulty, boards);
  }
  return boards;
}

/** The seeds of a tier the procedure marked `mark` (catalogueProvenance.ts), in order. */
function seedsMarked(difficulty: Difficulty, mark: 'k' | 'n' | 'd' | 'r'): number[] {
  const out: number[] = [];
  const { seeds } = CATALOGUE_PROVENANCE[difficulty];
  for (let n = 1; n <= seeds.length; n++) if (seeds[n - 1] === mark) out.push(n);
  return out;
}

/** The seeds of a tier whose base the procedure kept, in order. */
const keptSeeds = (difficulty: Difficulty): number[] => seedsMarked(difficulty, 'k');

describe('the compact form (§8)', () => {
  it('writes every bundled board as a code that reads back as the same board', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < catalogueSize(difficulty); index++) {
        const { board } = catalogueEntry(difficulty, index);
        const back = boardFromCode(boardCode(board));
        expect(back && encodeBoard(back)).toBe(encodeBoard(board));
      }
    }
  });

  it('reads no board from a code the walk does not end on', () => {
    expect(boardFromCode(-1)).toBeNull();
    expect(boardFromCode(0.5)).toBeNull();
    expect(boardFromCode(Number.MAX_SAFE_INTEGER)).toBeNull();
    // Every cell empty: no target.
    expect(boardFromCode(0)).toBeNull();
  });

  it('reads back sorted codes from runs of gaps, across run boundaries', () => {
    const rng = createRng('rice');
    const codes = new Set<number>();
    while (codes.size < 3 * RUN + 5) codes.add(Math.floor(rng() * 2 ** 44));
    const sorted = [...codes].sort((a, b) => a - b);
    const bucket = encodeBucket(12, sorted);
    expect(bucket.count).toBe(sorted.length);
    sorted.forEach((code, index) => expect(bucketCode(bucket, index)).toBe(code));
    expect(() => encodeBucket(12, [5, 5])).toThrow();
  });

  it('groups a tier by fewest moves and keeps every entry', () => {
    const entries = Array.from({ length: 70 }, (_, index) => catalogueEntry('medium', index));
    const data: CatalogueData = { easy: [], medium: encodeTier(entries), hard: [] };
    expect(catalogueSize('medium', data)).toBe(70);
    const read = new Set(
      Array.from({ length: 70 }, (_, index) =>
        encodeBoard(catalogueEntry('medium', index, data).board),
      ),
    );
    expect(read).toEqual(new Set(entries.map((entry) => encodeBoard(entry.board))));
  });
});

describe('the selection rules (§8)', () => {
  const record = (
    n: number,
    board: string | null,
    extra: Partial<ScanRecord> = {},
  ): ScanRecord => ({
    n,
    board,
    minMoves: 12,
    exploredStates: 900,
    componentSize: 2000,
    probes: 20,
    ...extra,
  });
  const a = catalogueEntry('medium', 0);
  const b = catalogueEntry('medium', 1);

  it('skips a seed that found nothing, one in a kept component, and a rigid base', () => {
    const records = [
      record(1, null),
      record(2, encodeBoard(a.board)),
      record(3, encodeBoard(a.board)),
      record(4, encodeBoard(b.board), { probes: BASE_PROBES_KEPT - 1 }),
      record(5, encodeBoard(b.board)),
    ];
    const selection = selectCatalogue('medium', records, 10);
    expect(selection.kept.map((r) => r.n)).toEqual([2, 5]);
    expect([selection.nulls, selection.duplicates, selection.rigid]).toEqual([[1], [3], [4]]);
    expect(selection.tried).toBe(5);
    // Hard is dealt as it is, so its bases are never probed.
    const hard = selectCatalogue('hard', [record(1, encodeBoard(b.board), { probes: 0 })], 10);
    expect(hard.kept).toHaveLength(1);
  });

  it('stops once it has the count, and refuses a gap in the seeds', () => {
    const records = [record(1, encodeBoard(a.board)), record(2, encodeBoard(b.board))];
    expect(selectCatalogue('medium', records, 1).tried).toBe(1);
    expect(() => selectCatalogue('medium', [records[1]!], 1)).toThrow();
  });
});

describe('provenance: the procedure gives the bundled boards back', () => {
  it('reads every seed it lists, and keeps exactly as many as are bundled', () => {
    for (const difficulty of DIFFICULTIES) {
      const { children } = CATALOGUE_PROVENANCE[difficulty];
      expect(keptSeeds(difficulty).length + children).toBe(catalogueSize(difficulty));
      // Only the tier dealt as it is brings children (§8).
      if (difficulty !== 'hard') expect(children).toBe(0);
    }
  });

  const samples = DIFFICULTIES.flatMap((difficulty) => {
    const kept = keptSeeds(difficulty);
    return [kept[0]!, kept[Math.floor(kept.length / 2)]!, kept[kept.length - 1]!].map((n) => ({
      difficulty,
      n,
    }));
  });

  it.each(samples)(
    '$difficulty seed $n is a bundled board, its children too',
    ({ difficulty, n }) => {
      const record = scanSeed(difficulty, n);
      expect(record.board).not.toBeNull();
      expect(bundled(difficulty).get(record.board!)).toBe(record.minMoves);
      if (difficulty !== 'hard') {
        expect(record.probes).toBeGreaterThanOrEqual(BASE_PROBES_KEPT);
        expect(record.children).toBeUndefined();
        return;
      }
      // A child of a round the list finished is bundled unless its component
      // already was (then a bundled board of the same blocks lies in it); in
      // the last round begun, the list may have filled before it.
      const { lastRound } = CATALOGUE_PROVENANCE[difficulty];
      for (const [index, child] of (record.children ?? []).entries()) {
        if (bundled(difficulty).get(child.board) === child.minMoves) continue;
        if (index + 1 >= lastRound) continue;
        const board = decodeBoard(child.board)!;
        const listed = exploreComponent(board, COMPONENT_LIMIT);
        expect(listed.status).toBe('complete');
        if (listed.status !== 'complete') continue;
        const sharing = [...bundled(difficulty).keys()]
          .map((text) => decodeBoard(text)!)
          .filter((other) => componentKey(other) === componentKey(board))
          .some((other) => holdsBoard(listed.component, other));
        expect(sharing, child.board).toBe(true);
      }
    },
  );

  const skipped = DIFFICULTIES.flatMap((difficulty) => {
    const nulls = seedsMarked(difficulty, 'n');
    const duplicates = seedsMarked(difficulty, 'd');
    const rigid = seedsMarked(difficulty, 'r');
    return [
      ...nulls.slice(0, 1).map((n) => ({ difficulty, n, why: 'null' as const })),
      ...duplicates.slice(0, 1).map((n) => ({ difficulty, n, why: 'duplicate' as const })),
      ...rigid.slice(0, 1).map((n) => ({ difficulty, n, why: 'rigid' as const })),
    ];
  });

  it.each(skipped)('$difficulty seed $n was skipped: $why', ({ difficulty, n, why }) => {
    const record = scanSeed(difficulty, n);
    if (why === 'null') {
      expect(record.board).toBeNull();
      return;
    }
    expect(record.board).not.toBeNull();
    const board = decodeBoard(record.board)!;
    if (why === 'rigid') {
      expect(bundled(difficulty).has(record.board!)).toBe(false);
      expect(record.probes).toBeLessThan(BASE_PROBES_KEPT);
      return;
    }
    // A duplicate's component holds a bundled board of its tier — often the
    // very same board: two climbs that end on one summit.
    const listed = exploreComponent(board, COMPONENT_LIMIT);
    expect(listed.status).toBe('complete');
    if (listed.status !== 'complete') return;
    const key = componentKey(board);
    const sharing = [...bundled(difficulty).keys()]
      .map((text) => decodeBoard(text)!)
      .filter((other) => componentKey(other) === key)
      .filter((other) => holdsBoard(listed.component, other));
    expect(sharing.length).toBeGreaterThan(0);
  });

  it('builds the first two Easy entries again from scratch', () => {
    const build = buildCatalogue('easy', 2);
    const kept = keptSeeds('easy').slice(0, 2);
    expect(build.kept.map((r) => r.n)).toEqual(kept);
    const easy = bundled('easy');
    for (const r of build.kept) expect(easy.get(r.board!)).toBe(r.minMoves);
  });
});
