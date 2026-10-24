/**
 * What the opponent is, and what it is not (docs/NESTED_TIC_TAC_TOE_RULES.md
 * §4.1, §4.2, §13).
 *
 * It is bound by the rules at every strength; it always takes a move that
 * wins the match; it is decided entirely by the seed and the move count —
 * which is what makes Undo a take-back rather than a reroll (§5); and its
 * search keeps the agreements of §4.1 exactly: one cumulative counter per
 * reply, depth 1 always finished, an unfinished iteration thrown away whole,
 * the win check and easy's scoring not counted, and ties drawn from the first
 * value of the seeded stream.
 *
 * Positions come from seeded random games (test-helpers.ts), not from a
 * hand-picked list.
 */
import { describe, expect, it } from 'vitest';
import {
  decideCpuMove,
  EASY_TOP_CHOICES,
  evaluate,
  orderedMoves,
  WEIGHTS,
  WIN,
  type CpuDecision,
} from './cpu';
import {
  isFreeMove,
  legalMoves,
  makeMove,
  positionFromMoves,
  sendTarget,
  toMove,
  unmakeMove,
  wouldTake,
  type Position,
} from './engine';
import { createRng } from './rng';
import { judge, randomGame } from './test-helpers';
import { boardOf, CELLS_PER_BOARD, DIFFICULTIES, DRAWN, placeOf, type Difficulty } from './types';

const play = (moves: readonly number[]): Position => positionFromMoves(moves)!;

const decide = (
  moves: readonly number[],
  difficulty: Difficulty,
  extra: { nodeLimit?: number; maxDepth?: number } = {},
  seed = 'cpu-test',
): CpuDecision => decideCpuMove({ moves, difficulty, seed, ...extra })!;

/** Unfinished positions of seeded random games: `count` of them, `stride` plies apart. */
function positions(count: number, prefix: string, stride = 7): number[][] {
  const out: number[][] = [];
  for (let n = 1; out.length < count; n++) {
    const game = randomGame(`${prefix}-${n}`);
    for (let ply = 1; ply < game.length && out.length < count; ply += stride) {
      out.push(game.slice(0, ply));
    }
  }
  return out;
}

/** The first unfinished position of seeded random games that satisfies `test`. */
function findPosition(test: (position: Position) => boolean, prefix = 'cpu-find'): number[] {
  for (let n = 1; n <= 2_000; n++) {
    const game = randomGame(`${prefix}-${n}`);
    for (let ply = 0; ply < game.length; ply++) {
      const moves = game.slice(0, ply);
      if (test(play(moves))) return moves;
    }
  }
  throw new Error('no position found');
}

/** The cells whose move wins the match for the side to move, ascending. */
function winningMoves(position: Position): number[] {
  const me = toMove(position);
  return legalMoves(position).filter((cell) => {
    makeMove(position, cell);
    const won = position.result === me;
    unmakeMove(position);
    return won;
  });
}

const firstDraw = (seed: string, moveCount: number): number =>
  createRng(`${seed}:cpu:${moveCount}`)();

/** The eight lines of a 3×3 grid, written out again from §2 5. */
const GRID_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

/**
 * §4.2 read straight off the rules document, as a test oracle: it takes the
 * move list, asks the test judge (not the engine) for the small boards and
 * the legal moves, counts `w(b)` from the lines itself, and adds the terms
 * one by one. Only the weights' values are shared with `cpu.ts` —
 * `compatibility.test.ts` pins those.
 */
function staticValueByTheRules(moves: readonly number[]): number {
  const { smalls, result, legal } = judge(moves);
  if (result !== 0) throw new Error('§4.2 values unfinished positions only');
  const me = moves.length % 2 === 0 ? 1 : 2;
  const them = 3 - me;
  const marks = new Array<number>(81).fill(0);
  moves.forEach((cell, index) => (marks[cell] = index % 2 === 0 ? 1 : 2));
  const w = (board: number) => GRID_LINES.filter((line) => line.some((p) => p === board)).length;
  const { BIG_1, BIG_2, BOARD_OWN, SMALL_2, SMALL_1, FREE_MOVE, TAKE_NEXT } = WEIGHTS;
  let value = 0;
  // Big-board lines: a drawn board or both sides' boards make the line worth 0.
  for (const line of GRID_LINES) {
    const states = line.map((board) => smalls[board]);
    if (states.includes(3)) continue;
    const mine = states.filter((s) => s === me).length;
    const theirs = states.filter((s) => s === them).length;
    if (mine > 0 && theirs > 0) continue;
    value += mine === 1 ? BIG_1 : mine === 2 ? BIG_2 : 0;
    value -= theirs === 1 ? BIG_1 : theirs === 2 ? BIG_2 : 0;
  }
  for (let board = 0; board < 9; board++) {
    if (smalls[board] === me) value += BOARD_OWN * w(board);
    else if (smalls[board] === them) value -= BOARD_OWN * w(board);
    else if (smalls[board] === 0) {
      for (const line of GRID_LINES) {
        const inLine = line.map((p) => marks[9 * board + p]);
        const mine = inLine.filter((m) => m === me).length;
        const theirs = inLine.filter((m) => m === them).length;
        if (theirs === 0) value += (mine === 2 ? SMALL_2 : mine === 1 ? SMALL_1 : 0) * w(board);
        if (mine === 0) value -= (theirs === 2 ? SMALL_2 : theirs === 1 ? SMALL_1 : 0) * w(board);
      }
    }
  }
  // Where the side to move was sent: free (the first move included), and able to take.
  if (moves.length === 0 || smalls[moves[moves.length - 1]! % 9] !== 0) value += FREE_MOVE;
  const playable = new Set(legal.map((cell) => Math.floor(cell / 9)));
  const canTake = [...playable].some((board) =>
    GRID_LINES.some((line) => {
      const inLine = line.map((p) => marks[9 * board + p]);
      return inLine.filter((m) => m === me).length === 2 && inLine.includes(0);
    }),
  );
  if (canTake) value += TAKE_NEXT;
  return value;
}

/** Easy's score of each legal move by §4.1 / §4.2, from the oracle: −value after it, a draw 0. */
function easyScoresByTheRules(moves: readonly number[]): { cell: number; score: number }[] {
  return judge(moves).legal.map((cell) => {
    const after = [...moves, cell];
    const end = judge(after).result;
    return { cell, score: end === 3 ? 0 : -staticValueByTheRules(after) };
  });
}

/** Score order, ties by cell (§4.1). */
const byScore = (x: { cell: number; score: number }, y: { cell: number; score: number }) =>
  y.score - x.score || x.cell - y.cell;

describe('every difficulty obeys the rules', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} only ever plays a legal move`, () => {
      // Hard is the slow one; a dozen positions are enough to show it stays
      // inside the rules, the cheaper strengths get more.
      const sample = positions(difficulty === 'hard' ? 12 : 60, `legal-${difficulty}`);
      for (const moves of sample) {
        const decision = decide(moves, difficulty);
        expect(legalMoves(play(moves))).toContain(decision.cell);
      }
    }, 30_000);
  }

  it('has nothing to say about a finished match or an illegal list', () => {
    const finished = randomGame('cpu-finished-1');
    expect(decideCpuMove({ moves: finished, difficulty: 'hard', seed: 's' })).toBeNull();
    expect(decideCpuMove({ moves: [40, 40], difficulty: 'easy', seed: 's' })).toBeNull();
  });
});

describe('every difficulty takes a win that is there (§4.1)', () => {
  const single = findPosition((position) => winningMoves(position).length === 1);
  const several = findPosition((position) => winningMoves(position).length >= 2);

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} completes the big-board line, without searching`, () => {
      const decision = decide(single, difficulty);
      expect(decision.kind).toBe('win');
      expect(decision.cell).toBe(winningMoves(play(single))[0]);
      // The check is the engine's own — it costs no nodes.
      expect(decision.nodes).toBe(0);
      const after = play([...single, decision.cell]);
      expect(after.result).toBe(toMove(play(single)));
    });
  }

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} draws among several winning moves by the tie rule, without searching`, () => {
      const winners = winningMoves(play(several));
      for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        const decision = decide(several, difficulty, {}, seed);
        expect(decision.kind).toBe('win');
        expect(decision.nodes).toBe(0);
        expect(decision.candidates).toEqual(winners);
        const draw = firstDraw(seed, several.length);
        expect(decision.draw).toBe(draw);
        expect(decision.cell).toBe(winners[Math.floor(draw * winners.length)]);
      }
    });
  }
});

describe('one legal move is no choice (§4.1)', () => {
  const forced = findPosition(
    (position) => legalMoves(position).length === 1 && winningMoves(position).length === 0,
    'cpu-only',
  );

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} plays it without scoring or searching`, () => {
      const decision = decide(forced, difficulty);
      expect(decision.kind).toBe('only');
      expect(decision.cell).toBe(legalMoves(play(forced))[0]);
      expect(decision.nodes).toBe(0);
      expect(decision.completedDepth).toBe(0);
    });
  }
});

describe('the static evaluation (§4.2)', () => {
  it('gives the empty board the free-move term and nothing else', () => {
    expect(evaluate(play([]))).toBe(WEIGHTS.FREE_MOVE);
  });

  it('counts the opponent’s lone centre mark against the side to move', () => {
    // Cross on b4's centre; circle to move, sent to b4. Four small-board
    // lines run through a centre, each holding one cross: −SMALL_1 × w(4) × 4.
    expect(evaluate(play([40]))).toBe(-WEIGHTS.SMALL_1 * 4 * 4);
  });

  it('is scored from the side to move — negamax', () => {
    // The same marks valued for the other side give the opposite value of
    // the board terms; the send terms are the mover's alone, so compare a
    // pair of positions where neither side is free nor can take next.
    // Cross on b4's centre, circle on its top-left corner; cross to move,
    // sent to the empty b0 — neither free nor able to take.
    const position = play([40, 36]);
    expect(isFreeMove(position)).toBe(false);
    // In b4 (w = 4) cross has three lines of its own (the middle row, the
    // middle column, the anti-diagonal) and circle two (the top row, the
    // left column); the main diagonal holds both and counts for no one.
    expect(evaluate(position)).toBe((3 - 2) * WEIGHTS.SMALL_1 * 4);
    // Circle's view of the same marks, one move later on an empty board it
    // was sent to, carries the opposite sign for the shared b4 terms.
    const reply = play([40, 36, 2]);
    expect(isFreeMove(reply)).toBe(false);
    expect(evaluate(reply)).toBe(-(3 - 2) * WEIGHTS.SMALL_1 * 4 - 3 * WEIGHTS.SMALL_1 * 3);
  });

  const { BIG_1, BIG_2, BOARD_OWN, SMALL_2, SMALL_1, FREE_MOVE, TAKE_NEXT } = WEIGHTS;

  it('scores a taken board by BIG_1 on each line through it and BOARD_OWN × w(b)', () => {
    // Cross takes b0 with its middle column (1, 4, 7); circle holds the
    // corner c0 of b1 and b4 (9, 36), then plays 63 (b7 c0). Cross to move,
    // sent to the taken b0 — free. No one can take next.
    const moves = [1, 9, 4, 36, 7, 63];
    expect(isFreeMove(play(moves))).toBe(true);
    const expected =
      3 * BIG_1 + // rows / columns / diagonals through b0: one cross board, nothing against it
      BOARD_OWN * 3 + // b0 is a corner: w = 3
      -3 * SMALL_1 * 2 + // circle's lone corner in b1 (w = 2): three lines
      -3 * SMALL_1 * 4 + // … in b4 (w = 4)
      -3 * SMALL_1 * 2 + // … in b7 (w = 2)
      FREE_MOVE;
    expect(expected).toBe(186);
    expect(evaluate(play(moves))).toBe(expected);
    // One move earlier the same board is the opponent's: circle to move, sent to b7.
    expect(evaluate(play(moves.slice(0, 5)))).toBe(-3 * BIG_1 - BOARD_OWN * 3 + 3 * 2 + 3 * 4);
  });

  it('scores two boards in a line by BIG_2, and two marks in a small-board line by SMALL_2 × w(b)', () => {
    // Cross takes b0 (6, 7, 8) and b1 (15, 16, 17) — two of the top row —
    // while circle answers on c0 / c1 of b6, b7 and c1 of b8. Circle to
    // move, sent to b8, where it has one mark: nothing to take.
    const moves = [6, 54, 7, 63, 8, 73, 15, 55, 16, 64, 17];
    const position = play(moves);
    expect(Array.from(position.smalls)).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(isFreeMove(position)).toBe(false);
    const expected =
      -BIG_2 + // top row: two cross boards
      -3 * BIG_1 + // b0's column and diagonal, b1's column: one each
      -BOARD_OWN * (3 + 2) + // b0 (corner) and b1 (edge)
      (SMALL_2 + 3 * SMALL_1) * 3 + // circle on c0, c1 of b6 (w = 3): the top row holds two
      (SMALL_2 + 3 * SMALL_1) * 2 + // the same in b7 (w = 2)
      2 * SMALL_1 * 3; // circle's lone edge c1 in b8 (w = 3): two lines
    expect(expected).toBe(-494);
    expect(evaluate(position)).toBe(expected);
  });

  it('adds TAKE_NEXT when the board the mover is sent to holds two of its marks and the third empty', () => {
    // Cross 4 and 8 in b0 (diagonal 0-4-8, c0 empty); circle answers in b4
    // and b8 on c0, which sends cross back to b0.
    const moves = [4, 36, 8, 72];
    expect(isFreeMove(play(moves))).toBe(false);
    const inB0 = (SMALL_2 + 5 * SMALL_1) * 3; // the diagonal, and five lines through 4 or 8 alone
    const expected = inB0 - 3 * SMALL_1 * 4 - 3 * SMALL_1 * 3 + TAKE_NEXT;
    expect(expected).toBe(32);
    expect(evaluate(play(moves))).toBe(expected);
  });

  it('adds TAKE_NEXT once on a free move, however many open boards could be taken', () => {
    // Cross takes b0 (1, 2, 0 — circle on c0 of b1, b2); then each circle
    // reply on a c0 sends cross to the taken b0, free, while cross builds
    // 6-7 in b1 and 4-5 in b2. Cross to move, free, able to take b1 or b2.
    const moves = [1, 9, 2, 18, 0, 27, 15, 54, 16, 63, 22, 36, 23, 45];
    const position = play(moves);
    expect(isFreeMove(position)).toBe(true);
    expect(
      legalMoves(position).filter((cell) => wouldTake(position, cell, toMove(position))),
    ).toEqual([17, 21]);
    const b1 = (-1 + 6 + 1 - 1 + 1) * 2; // w = 2: row c0 circle, row 6-7-8 two, c7 column, c0 diagonal circle, c6 anti-diagonal
    const b2 = (-1 + 6 - 1 + 1 + 1 + 1) * 3; // w = 3: row c0 circle, row 3-4-5 two, column c0 circle, c4 column, c5 column, c4 anti-diagonal
    const lone = -3 * (2 + 4 + 2 + 3 + 2); // circle's lone c0 in b3, b4, b5, b6, b7
    const expected = 3 * BIG_1 + BOARD_OWN * 3 + b1 + b2 + lone + FREE_MOVE + TAKE_NEXT;
    expect(expected).toBe(224);
    expect(evaluate(position)).toBe(expected);
  });

  it('agrees with §4.2 read straight off the document, over every position of 300 seeded random games', () => {
    let positionsSeen = 0;
    let drawnLineWithTaken = 0;
    let mixedLine = 0;
    let takeInTwoBoards = 0;
    for (let n = 1; n <= 300; n++) {
      const game = randomGame(`cpu-eval-${n}`);
      for (let ply = 0; ply < game.length; ply++) {
        const moves = game.slice(0, ply);
        const position = play(moves);
        expect(evaluate(position)).toBe(staticValueByTheRules(moves));
        positionsSeen += 1;
        const { smalls } = position;
        const lines = GRID_LINES.map((line) => line.map((board) => smalls[board]!));
        if (lines.some((s) => s.includes(DRAWN) && s.some((x) => x === 1 || x === 2)))
          drawnLineWithTaken += 1;
        if (lines.some((s) => s.includes(1) && s.includes(2))) mixedLine += 1;
        const mark = toMove(position);
        const takeable = new Set(
          legalMoves(position)
            .filter((cell) => wouldTake(position, cell, mark))
            .map(boardOf),
        );
        if (isFreeMove(position) && takeable.size >= 2) takeInTwoBoards += 1;
      }
    }
    // The shapes the hand cases above do not reach did occur, many times over.
    expect(positionsSeen).toBeGreaterThan(10_000);
    expect(drawnLineWithTaken).toBeGreaterThan(100);
    expect(mixedLine).toBeGreaterThan(100);
    expect(takeInTwoBoards).toBeGreaterThan(100);
  }, 30_000);
});

describe('easy (§4.1)', () => {
  it('draws from its best three by the CPU’s own score — the evaluation negated', () => {
    // The expected three come from the oracle above (§4.2 off the document,
    // the judge for the boards), not from `evaluate`.
    let checked = 0;
    for (const moves of positions(40, 'easy')) {
      const position = play(moves);
      if (winningMoves(position).length > 0 || legalMoves(position).length === 1) continue;
      const top = easyScoresByTheRules(moves)
        .sort(byScore)
        .slice(0, EASY_TOP_CHOICES)
        .map((entry) => entry.cell);

      checked += 1;
      const decision = decide(moves, 'easy');
      expect(decision.kind).toBe('easy');
      expect(decision.nodes).toBe(0);
      expect(decision.candidates).toEqual(top);
      expect(decision.cell).toBe(top[Math.floor(decision.draw * top.length)]);
    }
    expect(checked).toBeGreaterThanOrEqual(35);
  });

  it('scores a move that ends the match drawn as 0 (§4.2)', () => {
    // A late position where one legal move closes the last open board
    // without a big-board line, and where scoring that move by the finished
    // position's evaluation instead of 0 would order easy's three otherwise.
    const order = (scored: { cell: number; score: number }[]) =>
      [...scored]
        .sort(byScore)
        .slice(0, EASY_TOP_CHOICES)
        .map((entry) => entry.cell);
    const moves = findPosition((position) => {
      if (winningMoves(position).length > 0 || legalMoves(position).length < 2) return false;
      const asZero: { cell: number; score: number }[] = [];
      const asValue: { cell: number; score: number }[] = [];
      let drawing = false;
      for (const cell of legalMoves(position)) {
        makeMove(position, cell);
        if (position.result === DRAWN) drawing = true;
        asZero.push({ cell, score: position.result === DRAWN ? 0 : -evaluate(position) });
        asValue.push({ cell, score: -evaluate(position) });
        unmakeMove(position);
      }
      return drawing && order(asZero).join() !== order(asValue).join();
    }, 'cpu-easy-draw');
    const scored = easyScoresByTheRules(moves);
    expect(scored.some((entry) => judge([...moves, entry.cell]).result === 3)).toBe(true);
    expect(decide(moves, 'easy').candidates).toEqual(order(scored));
  });

  it('does not pick the move that is best for the player', () => {
    // Somewhere the sign matters: the move the *player* would value most
    // (highest evaluation of the position left, from the player's side) is
    // outside easy's three.
    const moves = findPosition((position) => {
      if (winningMoves(position).length > 0 || legalMoves(position).length < 6) return false;
      const values = legalMoves(position).map((cell) => {
        makeMove(position, cell);
        const value = evaluate(position);
        unmakeMove(position);
        return { cell, value };
      });
      values.sort((x, y) => y.value - x.value || x.cell - y.cell);
      const playerBest = values[0]!;
      const cpuTop = [...values]
        .sort((x, y) => x.value - y.value || x.cell - y.cell)
        .slice(0, EASY_TOP_CHOICES);
      return !cpuTop.some((entry) => entry.cell === playerBest.cell);
    });
    const decision = decide(moves, 'easy');
    const position = play(moves);
    makeMove(position, decision.cell);
    const chosenForPlayer = evaluate(position);
    unmakeMove(position);
    const best = Math.max(
      ...legalMoves(position).map((cell) => {
        makeMove(position, cell);
        const value = evaluate(position);
        unmakeMove(position);
        return value;
      }),
    );
    expect(chosenForPlayer).toBeLessThan(best);
  });
});

describe('the search’s move order (§4.1)', () => {
  it('puts takes first, free-move gifts last, and orders by place then board inside a group', () => {
    const RANK = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    let sawTakeOfOwnTarget = false;
    for (const moves of positions(300, 'order', 3)) {
      const position = play(moves);
      const mark = toMove(position);
      // §4.1's groups by their definition: play the move and look — did it
      // take its board, and is the opponent left without a board to go to?
      const groupOf = (cell: number): number => {
        makeMove(position, cell);
        const took = position.smalls[boardOf(cell)] === mark;
        const free = sendTarget(position) === null;
        unmakeMove(position);
        return took ? 0 : free ? 2 : 1;
      };
      const expected = [...legalMoves(position)].sort(
        (a, b) =>
          groupOf(a) - groupOf(b) ||
          RANK.indexOf(placeOf(a)) - RANK.indexOf(placeOf(b)) ||
          boardOf(a) - boardOf(b),
      );
      expect(orderedMoves(position)).toEqual(expected);
      for (const cell of legalMoves(position)) {
        if (placeOf(cell) === boardOf(cell) && wouldTake(position, cell, mark)) {
          // Takes its own target board — the opponent goes free, still ①.
          expect(groupOf(cell)).toBe(0);
          sawTakeOfOwnTarget = true;
        }
      }
    }
    expect(sawTakeOfOwnTarget).toBe(true);
  });
});

describe('the search’s bound (§4.1)', () => {
  // A free-move position: the widest root there is.
  const wide = findPosition(
    (position) =>
      isFreeMove(position) && position.moves.length > 6 && winningMoves(position).length === 0,
  );
  const rootCount = legalMoves(play(wide)).length;

  it('counts one node per root move at depth 1 — and nothing for the win check', () => {
    const decision = decide(wide, 'hard', { maxDepth: 1 });
    expect(decision.completedDepth).toBe(1);
    expect(decision.nodes).toBe(rootCount);
  });

  it('reads a test’s depth cap below 1 as 1 — depth 1 always runs', () => {
    for (const maxDepth of [0, -3]) {
      const decision = decide(wide, 'hard', { maxDepth });
      expect(decision.completedDepth).toBe(1);
      expect(legalMoves(play(wide))).toContain(decision.cell);
    }
  });

  it('finishes depth 1 whatever the limit', () => {
    for (const nodeLimit of [0, 1, 10]) {
      const decision = decide(wide, 'hard', { nodeLimit });
      expect(decision.completedDepth).toBe(1);
      // The only case the counter passes the limit: below 81, in tests (§4.1).
      expect(decision.nodes).toBe(rootCount);
      expect(decision.candidates).toEqual(decide(wide, 'hard', { maxDepth: 1 }).candidates);
    }
  });

  it('keeps one counter across the iterations and never passes the limit from depth 2 on', () => {
    const throughTwo = decide(wide, 'hard', { maxDepth: 2 }).nodes;
    expect(throughTwo).toBeGreaterThan(rootCount);
    // A limit of exactly depth 1 + depth 2 finishes depth 2 and stops at once in depth 3.
    const exact = decide(wide, 'hard', { nodeLimit: throughTwo });
    expect(exact.completedDepth).toBe(2);
    expect(exact.nodes).toBe(throughTwo);
    // One node fewer and depth 2 is abandoned: had the counter restarted per
    // iteration, depth 2 alone would have fitted.
    const short = decide(wide, 'hard', { nodeLimit: throughTwo - 1 });
    expect(short.completedDepth).toBe(1);
    expect(short.nodes).toBe(throughTwo - 1);
  });

  it('plays the best of the last finished depth when the limit cuts the next one', () => {
    const throughThree = decide(wide, 'normal', { nodeLimit: 10_000_000 });
    expect(throughThree.completedDepth).toBe(3);
    const cut = decide(wide, 'hard', { nodeLimit: throughThree.nodes + 1 });
    expect(cut.completedDepth).toBe(3);
    expect(cut.nodes).toBe(throughThree.nodes + 1);
    expect(cut.candidates).toEqual(throughThree.candidates);
    expect(cut.cell).toBe(throughThree.cell);
  });

  it('reads hard at least as deep as normal under the same limit', () => {
    for (const moves of positions(6, 'deeper')) {
      const normal = decide(moves, 'normal');
      const hard = decide(moves, 'hard');
      if (normal.kind !== 'search') continue;
      expect(hard.completedDepth).toBeGreaterThanOrEqual(normal.completedDepth);
    }
  }, 30_000);

  it('stops deepening once a finished depth proves a win', () => {
    // A late position (one board to play in) where a win is forced within
    // normal's three plies but not available at once.
    const proven = (d: CpuDecision) => d.value !== null && d.value >= WIN - 81;
    const moves = findPosition(
      (position) =>
        legalMoves(position).length <= CELLS_PER_BOARD &&
        winningMoves(position).length === 0 &&
        proven(decide(position.moves, 'normal')),
      'forced',
    );
    const firstProof = [1, 2, 3].find((maxDepth) => proven(decide(moves, 'hard', { maxDepth })))!;
    const hard = decide(moves, 'hard');
    expect(proven(hard)).toBe(true);
    expect(hard.completedDepth).toBe(firstProof);
  });
});

describe('the tie rule and determinism (§4.1)', () => {
  it('draws among exactly equal root values with the first value of the seeded stream', () => {
    // The root values by plain negamax — no pruning, no move order, every
    // reply read — at the depth the search finished: the candidates must be
    // exactly the moves holding the best of them.
    const plain = (position: Position, depth: number, ply: number): number => {
      if (position.result !== 0) return position.result === DRAWN ? 0 : -(WIN - ply);
      if (depth === 0) return evaluate(position);
      let best = -Infinity;
      for (const cell of legalMoves(position)) {
        makeMove(position, cell);
        best = Math.max(best, -plain(position, depth - 1, ply + 1));
        unmakeMove(position);
      }
      return best;
    };
    let several = 0;
    for (const moves of positions(20, 'ties')) {
      const decision = decide(moves, 'normal');
      if (decision.kind !== 'search') continue;
      const position = play(moves);
      const values = legalMoves(position).map((cell) => {
        makeMove(position, cell);
        const value = -plain(position, decision.completedDepth - 1, 1);
        unmakeMove(position);
        return value;
      });
      const best = Math.max(...values);
      expect(decision.value).toBe(best);
      expect(decision.candidates).toEqual(
        legalMoves(position).filter((_, index) => values[index] === best),
      );
      if (decision.candidates.length > 1) several += 1;
      const draw = firstDraw('cpu-test', moves.length);
      expect(decision.draw).toBe(draw);
      expect(decision.cell).toBe(
        decision.candidates[Math.floor(draw * decision.candidates.length)],
      );
    }
    // Ties do occur in the set, so the draw above picked among more than one.
    expect(several).toBeGreaterThan(0);
  }, 30_000);

  it('answers the same match the same way every time, at every strength', () => {
    for (const moves of positions(4, 'same')) {
      for (const difficulty of DIFFICULTIES) {
        const first = decide(moves, difficulty);
        const second = decide(moves, difficulty);
        expect(second).toEqual(first);
      }
    }
  }, 30_000);
});
