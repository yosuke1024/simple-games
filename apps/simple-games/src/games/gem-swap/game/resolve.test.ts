import { describe, expect, it } from 'vitest';
import { hasRun, isValidSwap, validSwaps } from './board';
import { generateInitialBoard } from './generator';
import { resolveSwap, tapeGem, tapeKey, type MoveResult } from './resolve';
import { createRng } from './rng';
import { STUCK_ROWS, boardFrom, rowsOf } from './test-helpers';
import { EMPTY, freshTape, indexAt, type Board, type ColorCount, type Tape } from './types';

/**
 * An independent, deliberately naive resolver written straight from §1 and
 * §4.2: mark every cell that sits in any horizontal or vertical window of
 * three equal kinds, clear them all, let each column fall, fill each column
 * from its tape bottom-up, repeat. It shares no code with board.ts or
 * resolve.ts except tapeGem (the tape is the definition, not an algorithm).
 */
function naiveResolve(
  board: Board,
  a: number,
  b: number,
  seed: string,
  colors: ColorCount,
  tapeIn: Tape,
): { board: number[]; score: number; stages: number; tape: number[]; cleared: number[][] } {
  const grid = [...board];
  const t = grid[a]!;
  grid[a] = grid[b]!;
  grid[b] = t;
  const tape = [...tapeIn];
  let score = 0;
  let stages = 0;
  const clearedPerStage: number[][] = [];
  for (;;) {
    const mark = new Set<number>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const k = grid[r * 8 + c]!;
        if (c + 2 < 8 && grid[r * 8 + c + 1] === k && grid[r * 8 + c + 2] === k) {
          mark
            .add(r * 8 + c)
            .add(r * 8 + c + 1)
            .add(r * 8 + c + 2);
        }
        if (r + 2 < 8 && grid[(r + 1) * 8 + c] === k && grid[(r + 2) * 8 + c] === k) {
          mark
            .add(r * 8 + c)
            .add((r + 1) * 8 + c)
            .add((r + 2) * 8 + c);
        }
      }
    }
    if (mark.size === 0) break;
    stages++;
    score += mark.size;
    clearedPerStage.push([...mark].sort((x, y) => x - y));
    for (let c = 0; c < 8; c++) {
      const survivors: number[] = [];
      for (let r = 0; r < 8; r++) if (!mark.has(r * 8 + c)) survivors.push(grid[r * 8 + c]!);
      const missing = 8 - survivors.length;
      const fresh: number[] = [];
      for (let i = 0; i < missing; i++) fresh.push(tapeGem(seed, colors, c, tape[c]! + i));
      tape[c] = tape[c]! + missing;
      // fresh[0] lands lowest: the column top-down is fresh reversed, then survivors.
      const column = [...fresh.reverse(), ...survivors];
      for (let r = 0; r < 8; r++) grid[r * 8 + c] = column[r]!;
    }
  }
  return { board: grid, score, stages, tape, cleared: clearedPerStage };
}

describe('refill tapes (§4.2)', () => {
  it('the k-th gem of column c is a pure function of the key `${seed}:${c}:${k}`', () => {
    expect(tapeKey('s', 3, 7)).toBe('s:3:7');
    for (let k = 0; k < 20; k++) {
      expect(tapeGem('s', 6, 3, k)).toBe(Math.floor(createRng(`s:3:${k}`)() * 6));
      expect(tapeGem('s', 6, 3, k)).toBe(tapeGem('s', 6, 3, k));
    }
  });

  it('stays inside 0..colors-1 and uses every kind', () => {
    for (const colors of [5, 6] as const) {
      const seen = new Set<number>();
      for (let c = 0; c < 8; c++) {
        for (let k = 0; k < 50; k++) {
          const kind = tapeGem('range', colors, c, k);
          expect(kind).toBeGreaterThanOrEqual(0);
          expect(kind).toBeLessThan(colors);
          seen.add(kind);
        }
      }
      expect(seen.size).toBe(colors);
    }
  });

  it('columns are different tapes', () => {
    const column = (c: number) => Array.from({ length: 30 }, (_, k) => tapeGem('cols', 6, c, k));
    expect(column(0)).not.toEqual(column(1));
  });
});

describe('one-call resolution (§4.3)', () => {
  // Row 7 reads 9 9 x 9 ...: swapping (7,2) and (7,3) lines up 9 9 9 at the
  // bottom-left, under a quiet stuck-pattern background.
  const base = (() => {
    const board = [...boardFrom(STUCK_ROWS)];
    board[indexAt(7, 0)] = 9;
    board[indexAt(7, 1)] = 9;
    board[indexAt(7, 3)] = 9;
    return board;
  })();

  it('an invalid swap resolves to null and nothing changes', () => {
    const before = [...base];
    expect(
      resolveSwap(base, indexAt(0, 0), indexAt(0, 2), { seed: 's', colors: 5, tape: freshTape() }),
    ).toBeNull();
    expect(
      resolveSwap(base, indexAt(4, 4), indexAt(4, 5), { seed: 's', colors: 5, tape: freshTape() }),
    ).toBeNull();
    expect(base).toEqual(before);
  });

  it('a single clear: gems above fall, the tape fills each column from the bottom up', () => {
    const tape = [0, 4, 0, 0, 0, 0, 0, 0];
    const move = resolveSwap(base, indexAt(7, 2), indexAt(7, 3), {
      seed: 'hand',
      colors: 5,
      tape,
    })!;
    expect(move).not.toBeNull();
    const first = move.stages[0]!;
    expect(first.cleared).toEqual([indexAt(7, 0), indexAt(7, 1), indexAt(7, 2)]);
    // Every gem in columns 0-2 above row 7 slides one row down.
    expect(first.drops).toHaveLength(21);
    expect(first.drops).toContainEqual({ from: indexAt(0, 1), to: indexAt(1, 1) });
    // One refill per column, at row 0, from each column's own tape position.
    expect(first.spawns).toEqual([
      { index: indexAt(0, 0), kind: tapeGem('hand', 5, 0, 0) },
      { index: indexAt(0, 1), kind: tapeGem('hand', 5, 1, 4) },
      { index: indexAt(0, 2), kind: tapeGem('hand', 5, 2, 0) },
    ]);
    // Each column's position advances past what it drew (later stages may draw more).
    expect(move.tape[0]).toBeGreaterThanOrEqual(1);
    expect(move.tape[1]).toBeGreaterThanOrEqual(5);
    expect(move.tape[2]).toBeGreaterThanOrEqual(1);
    expect(move.score).toBeGreaterThanOrEqual(3);
    expect(move.swapped[indexAt(7, 2)]).toBe(9);
    // The resolver does not mutate its inputs.
    expect(tape).toEqual([0, 4, 0, 0, 0, 0, 0, 0]);
  });

  it('a hand-built cascade: the first clear drops a column into a second run', () => {
    // Column 4 holds 7 over 8 over 7 7 at rows 3-6 (row 4 is 8). Swapping the
    // 8 at (4,4) with the 9 at (4,5) clears the row-4 run of 9s; the 7 at (3,4)
    // falls onto the 7 7 below it — a vertical run made by gravity, not refill.
    const board = [...boardFrom(STUCK_ROWS)];
    board[indexAt(3, 4)] = 7;
    board[indexAt(4, 4)] = 8;
    board[indexAt(5, 4)] = 7;
    board[indexAt(6, 4)] = 7;
    board[indexAt(4, 2)] = 9;
    board[indexAt(4, 3)] = 9;
    board[indexAt(4, 5)] = 9;
    expect(hasRun(board)).toBe(false);
    expect(isValidSwap(board, indexAt(4, 4), indexAt(4, 5))).toBe(true);
    const move = resolveSwap(board, indexAt(4, 4), indexAt(4, 5), {
      seed: 'cascade',
      colors: 5,
      tape: freshTape(),
    })!;
    expect(move.stages.length).toBeGreaterThanOrEqual(2);
    expect(move.stages[0]!.cleared).toEqual([indexAt(4, 2), indexAt(4, 3), indexAt(4, 4)]);
    expect(move.stages[1]!.cleared).toEqual(
      expect.arrayContaining([indexAt(4, 4), indexAt(5, 4), indexAt(6, 4)]),
    );
    const naive = naiveResolve(board, indexAt(4, 4), indexAt(4, 5), 'cascade', 5, freshTape());
    expect(move.board).toEqual(naive.board);
    expect(move.score).toBe(naive.score);
  });

  it('every stage is internally consistent and the result settles', () => {
    const start = generateInitialBoard('consistency', 6).board;
    for (const [a, b] of validSwaps(start)) {
      const move = resolveSwap(start, a, b, { seed: 'consistency', colors: 6, tape: freshTape() })!;
      let previous: Board = move.swapped;
      let spawned = 0;
      for (const stage of move.stages) {
        expect(stage.cleared.length).toBeGreaterThanOrEqual(3);
        expect(stage.board).not.toContain(EMPTY);
        // Each stage refills exactly what it cleared.
        expect(stage.spawns).toHaveLength(stage.cleared.length);
        spawned += stage.spawns.length;
        // A stage only clears cells that were part of a run on the board before it.
        expect(hasRun(previous)).toBe(true);
        previous = stage.board;
      }
      expect(move.capped).toBe(false);
      expect(hasRun(move.board)).toBe(false);
      expect(move.score).toBe(spawned);
      expect(move.tape.reduce((s, v) => s + v, 0)).toBe(spawned);
    }
  });

  it('matches the naive resolver on 600 real moves (seeded rounds, both colour counts)', () => {
    let compared = 0;
    for (const colors of [5, 6] as const) {
      for (let i = 0; i < 30; i++) {
        const seed = `naive-${colors}-${i}`;
        let board = generateInitialBoard(seed, colors).board;
        let tape: Tape = freshTape();
        const pick = createRng(`pick-${seed}`);
        for (let m = 0; m < 10; m++) {
          const swaps = validSwaps(board);
          if (swaps.length === 0) break;
          const [a, b] = swaps[Math.floor(pick() * swaps.length)]!;
          const move: MoveResult = resolveSwap(board, a, b, { seed, colors, tape })!;
          const naive = naiveResolve(board, a, b, seed, colors, tape);
          expect(rowsOf(move.board)).toEqual(rowsOf(naive.board));
          expect(move.score).toBe(naive.score);
          expect(move.stages.length).toBe(naive.stages);
          expect(move.stages.map((s) => [...s.cleared])).toEqual(naive.cleared);
          expect(move.tape).toEqual(naive.tape);
          board = move.board;
          tape = move.tape;
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThanOrEqual(550);
  });

  it('is deterministic: the same inputs give the same result', () => {
    const start = generateInitialBoard('determinism', 5).board;
    const [a, b] = validSwaps(start)[0]!;
    const ctx = { seed: 'determinism', colors: 5 as const, tape: freshTape() };
    expect(resolveSwap(start, a, b, ctx)).toEqual(resolveSwap(start, a, b, ctx));
  });
});

describe('the cascade cap (§4.4)', () => {
  it('stops at the limit with a run still on the board and says so, and is honest at the bound', () => {
    // Find a real move with at least three stages, so both bounds below are above 1.
    for (let i = 0; i < 200; i++) {
      const seed = `cap-${i}`;
      const start = generateInitialBoard(seed, 6).board;
      for (const [a, b] of validSwaps(start)) {
        const ctx = { seed, colors: 6 as const, tape: freshTape() };
        const full = resolveSwap(start, a, b, ctx)!;
        const n = full.stages.length;
        if (n < 3) continue;
        expect(full.capped).toBe(false);

        // A cap of 1: one stage, a run left on the board.
        const capped = resolveSwap(start, a, b, ctx, 1)!;
        expect(capped.capped).toBe(true);
        expect(capped.stages).toHaveLength(1);
        expect(hasRun(capped.board)).toBe(true);
        expect(capped.score).toBe(full.stages[0]!.cleared.length);
        expect(capped.stages[0]).toEqual(full.stages[0]);

        // Exactly at the bound: a move that settles in `n` stages is not capped.
        const atBound = resolveSwap(start, a, b, ctx, n)!;
        expect(atBound.capped).toBe(false);
        expect(atBound.board).toEqual(full.board);
        expect(atBound.score).toBe(full.score);
        expect(atBound.tape).toEqual(full.tape);

        // One below the bound: capped, with the first n − 1 stages.
        const below = resolveSwap(start, a, b, ctx, n - 1)!;
        expect(below.capped).toBe(true);
        expect(below.stages).toEqual(full.stages.slice(0, n - 1));
        expect(hasRun(below.board)).toBe(true);
        return;
      }
    }
    throw new Error('no three-stage move found in 200 seeds');
  });
});
