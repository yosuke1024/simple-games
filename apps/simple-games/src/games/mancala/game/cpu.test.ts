/**
 * The CPU (docs/MANCALA_RULES.md §4): always a legal pit, at every strength;
 * the node budget kept as promised; the same answer for the same seed; and
 * the obvious seen — an extra turn, a big capture, a won ending.
 *
 * The positions come from random self-play off a fixed seed rather than from
 * a hand-picked list, so they cover the shapes real games reach (long laps,
 * lopsided rows, near-empty sides) without anyone choosing them.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuMove, evaluate, HARD_NODE_LIMIT, searchCost } from './cpu';
import { isGameOver, legalPits, sow } from './engine';
import { createRng } from './rng';
import {
  BOARD_SIZE,
  CPU,
  CPU_STORE,
  DIFFICULTIES,
  initialPits,
  opponentOf,
  PLAYER,
  PLAYER_STORE,
  type Pits,
  type Side,
} from './types';

interface Position {
  readonly pits: Pits;
  readonly moveCount: number;
}

/**
 * `count` positions with the CPU to move and the game still on, reached by
 * both sides picking a random legal pit — extra turns included — for a
 * random number of moves.
 */
function randomPositions(seed: string, count: number): Position[] {
  const rng = createRng(seed);
  const out: Position[] = [];
  while (out.length < count) {
    let pits = initialPits();
    let toMove: Side = rng() < 0.5 ? PLAYER : CPU;
    const length = Math.floor(rng() * 60);
    for (let moveCount = 0; moveCount <= length && !isGameOver(pits); moveCount++) {
      if (toMove === CPU && moveCount === length) {
        out.push({ pits, moveCount });
        break;
      }
      const legal = legalPits(pits, toMove);
      const move = sow(pits, toMove, legal[Math.floor(rng() * legal.length)]!)!;
      pits = move.pits;
      if (!move.extraTurn) toMove = opponentOf(toMove);
    }
  }
  return out;
}

const POSITIONS = randomPositions('mancala-cpu-positions', 200);

/** Builds a board from the screen picture (engine.test.ts has the same helper). */
function boardOf(
  cpuStore: number,
  cpuRow: readonly number[],
  playerRow: readonly number[],
  playerStore: number,
): Pits {
  const pits = new Array<number>(BOARD_SIZE).fill(0);
  playerRow.forEach((count, i) => (pits[i] = count));
  cpuRow.forEach((count, i) => (pits[12 - i] = count));
  pits[PLAYER_STORE] = playerStore;
  pits[CPU_STORE] = cpuStore;
  return pits;
}

describe('legal moves (§4)', () => {
  it('found a spread of positions to try', () => {
    expect(POSITIONS).toHaveLength(200);
    const lengths = POSITIONS.map((position) => position.moveCount);
    expect(Math.max(...lengths)).toBeGreaterThan(30);
    expect(new Set(POSITIONS.map((position) => position.pits.join(','))).size).toBeGreaterThan(150);
  });

  // One `it` per strength: hard reads up to the full budget on each of the
  // 200 positions (about 0.6s in all on a development machine), and keeping
  // it apart gives it room at the parallel-run skew issue #158 measured.
  for (const difficulty of DIFFICULTIES) {
    it(`returns a legal pit on every position (${difficulty})`, () => {
      for (const { pits, moveCount } of POSITIONS) {
        const pit = chooseCpuMove({ pits, difficulty, seed: 'mancala-legal', moveCount });
        expect(legalPits(pits, CPU), pits.join(',')).toContain(pit);
        expect(searchCost.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
      }
    }, 20_000);
  }

  it('plays the only move there is', () => {
    const pits = boardOf(21, [0, 0, 0, 0, 0, 3], [1, 1, 1, 1, 1, 1], 18);
    for (const difficulty of DIFFICULTIES) {
      expect(chooseCpuMove({ pits, difficulty, seed: 'mancala-only', moveCount: 9 })).toBe(7);
    }
  });
});

describe('what it sees (§4)', () => {
  it('takes the extra turn it is offered, at every strength', () => {
    // Pit 10 holds three and is three from the store (11, 12, store); pit 12
    // holds one and is one away. Nothing else scores or captures.
    const pits = boardOf(0, [1, 1, 3, 1, 1, 1], [4, 4, 4, 4, 4, 4], 16);
    for (const difficulty of DIFFICULTIES) {
      const pit = chooseCpuMove({ pits, difficulty, seed: 'mancala-extra', moveCount: 11 });
      expect(sow(pits, CPU, pit)!.extraTurn, difficulty).toBe(true);
    }
  });

  it('takes a big capture, at every strength', () => {
    // CPU pit 7 holds one seed and lands in the empty pit 8, across from the
    // player's pit 4 and its nine seeds. Nothing else comes close.
    const pits = boardOf(10, [2, 0, 0, 0, 0, 1], [1, 1, 1, 1, 9, 1], 21);
    for (const difficulty of DIFFICULTIES) {
      const pit = chooseCpuMove({ pits, difficulty, seed: 'mancala-capture', moveCount: 20 });
      expect(pit, difficulty).toBe(7);
      expect(sow(pits, CPU, pit)!.captured).toBe(10);
    }
  });

  it('scores the store above seeds still in the row', () => {
    const banked = boardOf(4, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], 0);
    const loose = boardOf(0, [0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0], 0);
    expect(evaluate(banked, CPU)).toBeGreaterThan(evaluate(loose, CPU));
    expect(evaluate(banked, PLAYER)).toBe(-evaluate(banked, CPU));
  });
});

describe('determinism and the budget (§4)', () => {
  it('answers the same position the same way for one seed', () => {
    for (const { pits, moveCount } of POSITIONS.slice(0, 20)) {
      const input = { pits, difficulty: 'hard', seed: 'mancala-same', moveCount } as const;
      const first = chooseCpuMove(input);
      const nodes = searchCost.nodes;
      expect(chooseCpuMove(input)).toBe(first);
      // The same work, too: the budget is only a promise if it is repeatable.
      expect(searchCost.nodes).toBe(nodes);
    }
  });

  it('breaks ties by the seed, so different matches can go differently', () => {
    // Two one-seed pits, 7 and 8, and nothing either can score or capture
    // (the pit across from 9 is empty): at one ply they are worth exactly the
    // same, and which one is played is the seed's to say.
    const pits = boardOf(11, [0, 0, 0, 0, 1, 1], [5, 5, 5, 0, 5, 5], 10);
    const replies = new Set<number>();
    for (let i = 0; i < 40; i++) {
      replies.add(
        chooseCpuMove({ pits, difficulty: 'easy', seed: `mancala-tie-${i}`, moveCount: 30 }),
      );
    }
    expect([...replies].sort()).toEqual([7, 8]);
  });

  it('reads the whole opening to depth 8 well inside the budget (§4)', () => {
    // The opening is six moves a side and nothing forced, yet it settles
    // quickly: most first moves are extra turns or quiet. Measured, it
    // finishes all eight plies — hard really is an eight-ply reader here.
    chooseCpuMove({ pits: initialPits(), difficulty: 'hard', seed: 'mancala-open', moveCount: 0 });
    expect(searchCost.nodes).toBeLessThan(HARD_NODE_LIMIT);
  });

  it('stops at the budget on a heavy middle game and still answers (§4)', () => {
    // The bound is nodes, not milliseconds (docs/SUDOKU_RULES.md §7, issue
    // #158): wall-clock on a shared CI runner measures the runner it landed
    // on, not the search. This position came out of the random self-play
    // above as the heaviest of the 200 — long piles on both sides, laps and
    // extra turns everywhere — and it is one that actually reaches the
    // limit, so the cut-off path (keep the last finished depth) is what runs.
    const pits = [1, 0, 1, 0, 8, 7, 3, 1, 2, 7, 7, 3, 7, 1];
    const input = { pits, difficulty: 'hard', seed: 'mancala-budget', moveCount: 8 } as const;

    const started = performance.now();
    const pit = chooseCpuMove(input);
    const nodes = searchCost.nodes;
    chooseCpuMove(input);
    const elapsedMs = performance.now() - started;

    expect(nodes).toBe(HARD_NODE_LIMIT);
    expect(legalPits(pits, CPU)).toContain(pit);
    // Same board, same seed, same move count: exactly the same work both
    // times, or the bound above would only be telling us about one run.
    expect(searchCost.nodes).toBe(nodes);

    // Reported for a reader, not judged: see the comment above.
    console.log(
      `mancala hard reply (heaviest of 200): ${nodes} nodes, ${(elapsedMs / 2).toFixed(1)}ms ` +
        `average over 2 searches (node limit ${HARD_NODE_LIMIT}) — reported, not asserted`,
    );
  });
});
