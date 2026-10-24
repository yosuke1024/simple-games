import { describe, expect, it } from 'vitest';
import { hasRun, hasValidSwap, validSwaps } from './board';
import {
  BUNDLED_BOARDS,
  BUNDLED_SEEDS,
  buildBoard,
  drawInitialBoard,
  generateInitialBoard,
  initialAttemptKey,
  parseBoardDigits,
} from './generator';
import { createRng } from './rng';
import { summarize } from './test-helpers';
import { CELL_COUNT, INITIAL_ATTEMPT_LIMIT, isValidBoard } from './types';

/** Seeds per colour count for the guarantee sweep (§13, §14). */
const SWEEP_SEEDS = 10_000;
const SWEEP_CHUNK = 500;

describe('the constructive initial board (§4.1)', () => {
  it('uses its own key namespace, apart from the column tapes', () => {
    expect(initialAttemptKey('abc', 3)).toBe('abc:init:3');
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(generateInitialBoard('same', 6)).toEqual(generateInitialBoard('same', 6));
    expect(generateInitialBoard('one', 6).board).not.toEqual(generateInitialBoard('two', 6).board);
  });

  for (const colors of [5, 6] as const) {
    describe(`${colors} colours, ${SWEEP_SEEDS.toLocaleString('en')} seeds`, () => {
      const attempts = new Map<number, number>();
      const kindCounts = new Array<number>(colors).fill(0);
      const tally = { boards: 0, fallbacks: 0, rawDraws: 0, rawWithoutSwap: 0 };
      const swapCounts: number[] = [];
      let millis = 0;
      // Chunks of SWEEP_CHUNK seeds, one `it` each (docs/ARCHITECTURE.md
      // 「CI / リリース」: split by seed rather than raise the timeout).
      for (let from = 0; from < SWEEP_SEEDS; from += SWEEP_CHUNK) {
        it(`seeds ${from}–${from + SWEEP_CHUNK - 1}: every board is full, has no run and has a valid swap`, () => {
          const started = performance.now();
          for (let i = from; i < from + SWEEP_CHUNK; i++) {
            const seed = `gen-${colors}-${i}`;
            const result = generateInitialBoard(seed, colors);
            expect(isValidBoard(result.board, colors)).toBe(true);
            expect(hasRun(result.board)).toBe(false);
            expect(hasValidSwap(result.board)).toBe(true);
            tally.boards++;
            attempts.set(result.attempts, (attempts.get(result.attempts) ?? 0) + 1);
            if (result.fallback) tally.fallbacks++;
            swapCounts.push(validSwaps(result.board).length);
            for (const kind of result.board) kindCounts[kind]!++;
            // Construction alone (before the swap check) never makes a run:
            // every draw the generator made for this seed, rebuilt and checked.
            for (let a = 0; a < result.attempts; a++) {
              const raw = buildBoard(createRng(initialAttemptKey(seed, a)), colors);
              tally.rawDraws++;
              expect(hasRun(raw)).toBe(false);
              if (!hasValidSwap(raw)) tally.rawWithoutSwap++;
            }
          }
          millis += performance.now() - started;
        });
      }
      it('all seeds: report', () => {
        const distribution = [...attempts.entries()].sort((x, y) => x[0] - y[0]);
        const kindShare = kindCounts.map((n) => (n / (tally.boards * CELL_COUNT)).toFixed(3));
        console.log(
          `[gem-swap §14] initial boards, ${colors} colours, ${tally.boards} seeds: ` +
            `attempts distribution ${JSON.stringify(distribution)}, fallbacks ${tally.fallbacks}, ` +
            `draws ${tally.rawDraws} (without a valid swap: ${tally.rawWithoutSwap}), ` +
            `valid swaps on the chosen board ${JSON.stringify(summarize(swapCounts))}, ` +
            `kind share ${kindShare.join(' ')}, ${millis.toFixed(0)} ms (wall-clock, printed only)`,
        );
        expect(tally.boards).toBe(SWEEP_SEEDS);
        expect(tally.fallbacks).toBe(0);
      });
    });
  }
});

describe('the bundled boards (§4.1)', () => {
  for (const colors of [5, 6] as const) {
    it(`${colors} colours: made by the same generator, no run, at least one valid swap`, () => {
      const bundled = parseBoardDigits(BUNDLED_BOARDS[colors]);
      expect(BUNDLED_BOARDS[colors]).toMatch(/^\d{64}$/);
      expect(isValidBoard(bundled, colors)).toBe(true);
      expect(bundled).toEqual(
        buildBoard(createRng(initialAttemptKey(BUNDLED_SEEDS[colors], 0)), colors),
      );
      expect(hasRun(bundled)).toBe(false);
      expect(hasValidSwap(bundled)).toBe(true);
      console.log(
        `[gem-swap §14] bundled board, ${colors} colours: ${validSwaps(bundled).length} valid swaps`,
      );
    });

    it(`${colors} colours: the fallback is taken when every draw lacks a valid swap`, () => {
      // attemptLimit 0 means no draw is allowed to succeed: the path a seed
      // takes after INITIAL_ATTEMPT_LIMIT draws without a swap.
      const result = generateInitialBoard('fallback', colors, 0);
      expect(result.fallback).toBe(true);
      expect(result.board).toEqual(parseBoardDigits(BUNDLED_BOARDS[colors]));
    });
  }

  it('a rejected draw is redrawn from the next attempt key, up to the limit', () => {
    // No seed in the sweep ever needs a redraw (§14), so the branch is driven
    // with an acceptance test that refuses the first two draws.
    let calls = 0;
    const result = drawInitialBoard('redraw', 6, INITIAL_ATTEMPT_LIMIT, (board) => {
      calls++;
      return calls > 2 && hasValidSwap(board);
    });
    expect(result.attempts).toBe(3);
    expect(result.fallback).toBe(false);
    expect(result.board).toEqual(buildBoard(createRng(initialAttemptKey('redraw', 2)), 6));
    // Refusing everything stops after exactly the limit and falls back.
    let tried = 0;
    const never = drawInitialBoard('redraw', 5, INITIAL_ATTEMPT_LIMIT, () => {
      tried++;
      return false;
    });
    expect(tried).toBe(64);
    expect(never.fallback).toBe(true);
    expect(never.board).toEqual(parseBoardDigits(BUNDLED_BOARDS[5]));
  });

  it('the attempt limit is 64', () => {
    expect(INITIAL_ATTEMPT_LIMIT).toBe(64);
  });
});
