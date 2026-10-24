import { describe, expect, it } from 'vitest';
import { ADJACENT_PAIRS, hasRun, hasValidSwap, isValidSwap, validSwaps } from './board';
import { generateInitialBoard } from './generator';
import { createRng } from './rng';
import {
  canUndo,
  createRound,
  gemSwapSeed,
  parseRoundRecord,
  replayRound,
  restoreRound,
  swapsLeft,
  toRecord,
  trySwap,
  undoRound,
  type Round,
} from './round';
import { STUCK_ROWS, boardFrom } from './test-helpers';
import { ROUND_SWAPS, freshTape, indexAt, type ColorCount, type Swap } from './types';

/** Plays uniformly random valid swaps until the round ends or `limit` swaps. */
function playRandom(round: Round, pickSeed: string, limit = ROUND_SWAPS): Round[] {
  const pick = createRng(pickSeed);
  const seen: Round[] = [round];
  let current = round;
  while (current.status === 'playing' && current.swaps.length < limit) {
    const swaps = validSwaps(current.board);
    const [a, b] = swaps[Math.floor(pick() * swaps.length)]!;
    current = trySwap(current, a, b)!.round;
    seen.push(current);
  }
  return seen;
}

/** The finished round minus its last swap: what a suspended record of it held. */
function undoRoundForCost(last: Round): Round {
  return replayRound({ ...toRecord(last), swaps: last.swaps.slice(0, -1) })!;
}

/**
 * A hand-built round on `board` (seed only feeds the tapes). `priorSwaps`
 * stands in for swaps already made: trySwap reads only their count.
 */
function roundOn(
  board: readonly number[],
  seed: string,
  colors: ColorCount = 5,
  priorSwaps = 0,
): Round {
  const swaps: Swap[] = Array.from({ length: priorSwaps }, () => [0, 1]);
  return {
    seed,
    colors,
    initial: board,
    bundled: false,
    board,
    tape: freshTape(),
    score: 0,
    swaps,
    status: 'playing',
    endReason: null,
  };
}

/**
 * The stuck pattern with the top row rewritten so exactly the swap of (0,2)
 * and (0,3) is valid: it clears 0 0 0 in the top row, and the three refills
 * land in row 0 only. Some tapes leave the board stuck.
 */
function nearStuckBoard(): number[] {
  const board = [...boardFrom(STUCK_ROWS)];
  board[indexAt(0, 0)] = 7;
  board[indexAt(0, 1)] = 7;
  board[indexAt(0, 2)] = 8;
  board[indexAt(0, 3)] = 7;
  return board;
}

describe('a new round (§2, §5)', () => {
  it('starts playing, with 30 swaps left, no score and fresh tapes', () => {
    const round = createRound(gemSwapSeed('t'), 6);
    expect(round.status).toBe('playing');
    expect(round.endReason).toBeNull();
    expect(swapsLeft(round)).toBe(30);
    expect(round.score).toBe(0);
    expect(round.tape).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(round.board).toEqual(round.initial);
    expect(canUndo(round)).toBe(false);
  });

  it('"same board again" is the same seed: the same initial board and the same game', () => {
    const one = playRandom(createRound('again', 6), 'p', 8);
    const two = playRandom(createRound('again', 6), 'p', 8);
    expect(two[two.length - 1]).toEqual(one[one.length - 1]);
  });
});

describe('swaps (§1, §3)', () => {
  it('an invalid swap returns null and the round is untouched', () => {
    const round = createRound('invalid', 5);
    const frozen = JSON.stringify(round);
    // Non-adjacent, diagonal, same cell, off the board.
    expect(trySwap(round, indexAt(0, 0), indexAt(0, 2))).toBeNull();
    expect(trySwap(round, indexAt(0, 0), indexAt(1, 1))).toBeNull();
    expect(trySwap(round, 5, 5)).toBeNull();
    expect(trySwap(round, 63, 64)).toBeNull();
    // Every adjacent pair that is not valid.
    for (const [a, b] of ADJACENT_PAIRS) {
      if (!isValidSwap(round.board, a, b)) expect(trySwap(round, a, b)).toBeNull();
    }
    expect(JSON.stringify(round)).toBe(frozen);
  });

  it('a valid swap counts once and adds the move score', () => {
    const round = createRound('valid', 6);
    const [a, b] = validSwaps(round.board)[0]!;
    const outcome = trySwap(round, b, a)!;
    expect(outcome.round.swaps).toEqual([[a, b]]);
    expect(swapsLeft(outcome.round)).toBe(29);
    expect(outcome.round.score).toBe(outcome.move.score);
    expect(outcome.round.board).toEqual(outcome.move.board);
    expect(outcome.round.tape).toEqual(outcome.move.tape);
    expect(hasRun(outcome.round.board)).toBe(false);
  });

  it('30 valid swaps end the round with reason "swaps"', () => {
    for (let i = 0; i < 50; i++) {
      const rounds = playRandom(createRound(`thirty-${i}`, 5), `p-${i}`);
      const last = rounds[rounds.length - 1]!;
      if (last.endReason !== 'swaps') continue;
      expect(last.swaps).toHaveLength(30);
      expect(last.status).toBe('over');
      expect(swapsLeft(last)).toBe(0);
      // Every earlier round was still playing.
      for (const r of rounds.slice(0, -1)) expect(r.status).toBe('playing');
      // Over means over: no swap, no Undo.
      const [a, b] = ADJACENT_PAIRS[0]!;
      expect(trySwap(last, a, b)).toBeNull();
      expect(canUndo(last)).toBe(false);
      expect(undoRound(last)).toBeNull();
      return;
    }
    throw new Error('no round reached 30 swaps in 50 seeds');
  });

  it('a hand-built near-stuck board ends "stuck" when the refill leaves no valid swap', () => {
    const board = nearStuckBoard();
    expect(hasRun(board)).toBe(false);
    expect(validSwaps(board)).toEqual([[indexAt(0, 2), indexAt(0, 3)]]);
    let found = 0;
    let continued = 0;
    for (let i = 0; i < 200; i++) {
      const outcome = trySwap(roundOn(board, `stuck-${i}`), indexAt(0, 2), indexAt(0, 3))!;
      expect(outcome.move.stages[0]!.cleared).toEqual([0, 1, 2]);
      if (outcome.round.endReason === 'stuck') {
        found++;
        expect(outcome.round.status).toBe('over');
        expect(hasValidSwap(outcome.round.board)).toBe(false);
        expect(outcome.round.swaps).toHaveLength(1);
        expect(canUndo(outcome.round)).toBe(false);
      } else {
        continued++;
        expect(outcome.round.status).toBe('playing');
        expect(hasValidSwap(outcome.round.board)).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(continued).toBeGreaterThan(0);
  });

  it('a capped cascade ends the round with reason "cap" (§4.4)', () => {
    for (let i = 0; i < 200; i++) {
      const round = createRound(`round-cap-${i}`, 6);
      for (const [a, b] of validSwaps(round.board)) {
        const full = trySwap(round, a, b)!;
        if (full.move.stages.length < 2) continue;
        const capped = trySwap(round, a, b, 1)!;
        expect(capped.round.status).toBe('over');
        expect(capped.round.endReason).toBe('cap');
        expect(capped.move.capped).toBe(true);
        expect(hasRun(capped.round.board)).toBe(true);
        expect(trySwap(capped.round, a, b)).toBeNull();
        return;
      }
    }
    throw new Error('no two-stage move found');
  });
});

describe('end-reason ties on the 30th swap (§5)', () => {
  it('a 30th swap that also leaves the board stuck ends "swaps", not "stuck"', () => {
    const board = nearStuckBoard();
    const [a, b] = [indexAt(0, 2), indexAt(0, 3)];
    for (let i = 0; i < 200; i++) {
      // The same tape on a round with no prior swaps ends "stuck" (the test above).
      const first = trySwap(roundOn(board, `stuck-${i}`), a, b)!;
      if (hasValidSwap(first.round.board)) continue;
      expect(first.round.endReason).toBe('stuck');
      const outcome = trySwap(roundOn(board, `stuck-${i}`, 5, ROUND_SWAPS - 1), a, b)!;
      expect(hasValidSwap(outcome.round.board)).toBe(false);
      expect(outcome.round.swaps).toHaveLength(30);
      expect(outcome.round.status).toBe('over');
      expect(outcome.round.endReason).toBe('swaps');
      return;
    }
    throw new Error('no stuck tape found in 200 seeds');
  });

  it('a 30th swap that reaches the cascade cap ends "cap", not "swaps"', () => {
    for (let i = 0; i < 200; i++) {
      const round = createRound(`round-cap-${i}`, 6);
      for (const [a, b] of validSwaps(round.board)) {
        if (trySwap(round, a, b)!.move.stages.length < 2) continue;
        const late: Round = {
          ...round,
          swaps: Array.from({ length: ROUND_SWAPS - 1 }, () => [0, 1]),
        };
        // Uncapped, the same move on the 30th swap ends "swaps".
        expect(trySwap(late, a, b)!.round.endReason).toBe('swaps');
        const capped = trySwap(late, a, b, 1)!;
        expect(capped.move.capped).toBe(true);
        expect(capped.round.swaps).toHaveLength(30);
        expect(capped.round.status).toBe('over');
        expect(capped.round.endReason).toBe('cap');
        return;
      }
    }
    throw new Error('no two-stage move found');
  });
});

describe('Undo (§6)', () => {
  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'is the exact inverse of every swap, all the way back (seed %i)',
    (i) => {
      {
        const rounds = playRandom(createRound(`undo-${i}`, i % 2 === 0 ? 5 : 6), `u-${i}`);
        let current = rounds[rounds.length - 1]!;
        // A finished round offers no Undo; step back from the round before it ended.
        if (current.status === 'over') current = rounds[rounds.length - 2]!;
        for (let k = current.swaps.length; k > 0; k--) {
          expect(current).toEqual(rounds[k]);
          current = undoRound(current)!;
          expect(current).toEqual(rounds[k - 1]);
        }
        expect(undoRound(current)).toBeNull();
      }
    },
  );

  it('is not a reroll: undo then the same swap gives the same result', () => {
    const round = createRound('reroll', 6);
    const [a, b] = validSwaps(round.board)[2]!;
    const first = trySwap(round, a, b)!;
    const again = trySwap(undoRound(first.round)!, a, b)!;
    expect(again).toEqual(first);
  });

  it('is a look-ahead, as the rules say: the next refill of a column survives the undo', () => {
    // After undo, the tape positions are back where they were, so the gems a
    // column will receive next are the ones the undone move showed.
    const round = createRound('lookahead', 6);
    const [a, b] = validSwaps(round.board)[0]!;
    const tried = trySwap(round, a, b)!;
    const undone = undoRound(tried.round)!;
    expect(undone.tape).toEqual(round.tape);
    const replayed = trySwap(undone, a, b)!;
    expect(replayed.move.stages[0]!.spawns).toEqual(tried.move.stages[0]!.spawns);
  });
});

describe('replay — the suspended record (§7)', () => {
  // Every intermediate round of 12 played rounds, one seed per test (the
  // auto-play tests replay the final round of 8,000 more).
  it.each(Array.from({ length: 12 }, (_, i) => i))(
    'round-trips: replaying a record rebuilds the same round, including its Undo (seed %i)',
    (i) => {
      {
        const rounds = playRandom(createRound(`replay-${i}`, i % 2 === 0 ? 5 : 6), `r-${i}`);
        for (const round of rounds) {
          const record = JSON.parse(JSON.stringify(toRecord(round))) as unknown;
          expect(replayRound(record)).toEqual(round);
          if (round.status === 'playing') expect(restoreRound(record)).toEqual(round);
          else expect(restoreRound(record)).toBeNull();
        }
      }
    },
  );

  it('accepts swaps in either order and normalises them', () => {
    const round = createRound('order', 5);
    const [a, b] = validSwaps(round.board)[0]!;
    const replayed = replayRound({ seed: 'order', colors: 5, swaps: [[b, a]] })!;
    expect(replayed.swaps).toEqual([[a, b]]);
  });

  it('rejects records the rules could not have produced', () => {
    const round = playRandom(createRound('reject', 6), 'x', 5).pop()!;
    const good = toRecord(round);
    const swaps = good.swaps.map((s) => [...s]);
    const bad: unknown[] = [
      null,
      'record',
      { ...good, seed: '' },
      { ...good, seed: 42 },
      { ...good, colors: 7 },
      { ...good, colors: '6' },
      { ...good, swaps: 'none' },
      { ...good, swaps: [...swaps, [0]] },
      { ...good, swaps: [...swaps, [0, 1, 2]] },
      { ...good, swaps: [...swaps, [0, 64]] },
      { ...good, swaps: [...swaps, [-1, 0]] },
      { ...good, swaps: [...swaps, [0.5, 1.5]] },
      { ...good, swaps: [...swaps, ['0', '1']] },
      // Not adjacent / diagonal.
      { ...good, swaps: [...swaps, [0, 2]] },
      { ...good, swaps: [...swaps, [0, 9]] },
    ];
    // An adjacent pair that is not valid on the board the record leads to.
    const invalid = ADJACENT_PAIRS.find(([a, b]) => !isValidSwap(round.board, a, b))!;
    bad.push({ ...good, swaps: [...swaps, [...invalid]] });
    // A first swap that is not valid on the seed's initial board.
    const initial = generateInitialBoard('reject', 6).board;
    const invalidFirst = ADJACENT_PAIRS.find(([a, b]) => !isValidSwap(initial, a, b))!;
    bad.push({ ...good, swaps: [[...invalidFirst], ...swaps] });
    // The same record under the other colour count is a different game.
    bad.push({ ...good, colors: 5 });
    for (const record of bad) expect(replayRound(record)).toBeNull();
  });

  it.each(Array.from({ length: 30 }, (_, i) => i))(
    'rejects a 31st swap and any swap after the round ended (seed %i)',
    (i) => {
      {
        const rounds = playRandom(createRound(`after-${i}`, 6), `a-${i}`);
        const last = rounds[rounds.length - 1]!;
        expect(last.status).toBe('over');
        const swaps = last.swaps.map((s) => [...s]);
        // Whatever ended it, nothing can follow — try every adjacent pair.
        for (const pair of ADJACENT_PAIRS) {
          expect(replayRound({ ...toRecord(last), swaps: [...swaps, [...pair]] })).toBeNull();
        }
        if (last.endReason === 'swaps') expect(swaps).toHaveLength(30);
      }
    },
  );

  it('replay is light: the work is at most 30 resolutions (wall-clock printed only)', () => {
    const records = [];
    for (let i = 0; i < 40; i++) {
      const last = playRandom(createRound(`cost-${i}`, 6), `c-${i}`).pop()!;
      // The longest record storage can hold: the round one swap before its end.
      records.push(toRecord(undoRoundForCost(last)));
    }
    const times: number[] = [];
    for (const record of records) {
      const started = performance.now();
      expect(replayRound(record)).not.toBeNull();
      times.push(performance.now() - started);
    }
    const lengths = records.map((r) => r.swaps.length);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(29);
    console.log(
      `[gem-swap §14] replay of ${records.length} saved rounds (${Math.min(...lengths)}–${Math.max(...lengths)} swaps): ` +
        `mean ${(times.reduce((s, v) => s + v, 0) / times.length).toFixed(2)} ms, ` +
        `max ${Math.max(...times).toFixed(2)} ms (wall-clock, printed only)`,
    );
  });

  it('rejects more than 30 swaps by shape alone, before replaying anything (parseRoundRecord)', () => {
    // parseRoundRecord never replays, so a null here is the length gate itself:
    // 31 well-formed pairs fail on their count, not on their validity.
    const pairs = (n: number) => Array.from({ length: n }, (_, k) => [(k % 7) + 1, k % 7]);
    expect(parseRoundRecord({ seed: 'long', colors: 6, swaps: pairs(31) })).toBeNull();
    expect(replayRound({ seed: 'long', colors: 6, swaps: pairs(31) })).toBeNull();
    // 30 pairs pass the shape check, normalised (a < b) — whether they are
    // valid moves is the replay's question.
    expect(parseRoundRecord({ seed: 'long', colors: 6, swaps: pairs(30) })).toEqual({
      seed: 'long',
      colors: 6,
      swaps: Array.from({ length: 30 }, (_, k) => [k % 7, (k % 7) + 1]),
    });
    expect(parseRoundRecord({ seed: 'long', colors: 6, swaps: [] })).toEqual({
      seed: 'long',
      colors: 6,
      swaps: [],
    });
  });
});
