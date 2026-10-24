/**
 * Golden test for released behaviour. These literals are what the shipped
 * version does: the same seed, the same moves, the same replies. If this file
 * is red, either a migration plan exists and the literals change in the same
 * commit, or a change has quietly altered somebody's saved game.
 *
 * **Fix the implementation, not the test.** A saved game is its move list
 * (§7.1), and the CPU is decided by the position, the history, the seed and
 * the move count (§5.4) — so a change to the search, the evaluation, the move
 * ordering or the node limit makes a resumed game answer differently from the
 * one that was saved, and breaks the promise Undo rests on (§6).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { decideCpuMove } from './cpu';
import { toFen } from './fen';
import { moveToUci } from './serialize';
import { applyCpuMove, applyPlayerMove, createSession, isOver, isPlayerTurn } from './session';
import { fen } from './test-helpers';
import {
  BLACK,
  WHITE,
  moveFrom,
  movePromotion,
  moveTo,
  type Color,
  type Difficulty,
} from './types';

const GOLDEN_SEED = 'chess-golden';

/**
 * A fixed game: the player plays the nth of the legal moves in the
 * generator's order on its nth turn, the CPU answers. Nothing here is
 * random — the point is that it stays the same.
 */
function playOut(difficulty: Difficulty, playerColor: Color, plies: number) {
  let session = createSession(difficulty, playerColor, GOLDEN_SEED);
  const cpuTrace: string[] = [];
  let turn = 0;
  while (session.game.moves.length < plies && !isOver(session)) {
    if (isPlayerTurn(session)) {
      const legal = session.game.legal;
      const move = legal[(turn * 7) % legal.length]!;
      turn += 1;
      session = applyPlayerMove(
        session,
        moveFrom(move),
        moveTo(move),
        movePromotion(move),
      )!.session;
    } else {
      const outcome = applyCpuMove(session)!;
      cpuTrace.push(moveToUci(outcome.move));
      session = outcome.session;
    }
  }
  return { fen: toFen(session.game.position), cpuTrace };
}

/**
 * Every strength with the player on White, and normal with the player on
 * Black (the CPU opening). Sixteen plies each: a hard reply costs about a
 * second inside vitest (§13), so the hard game is eight of them.
 */
const PLAYED: readonly [Difficulty, Color][] = [
  ['easy', WHITE],
  ['normal', WHITE],
  ['hard', WHITE],
  ['normal', BLACK],
];

describe('fixed games (released — do not edit to make green)', () => {
  let played: Record<string, ReturnType<typeof playOut>>;

  // Each game is played once and read by the cases below (checkers'
  // compatibility test explains why: duplicated hard searches, not a wider
  // timeout, were the cost). The timeout guards a hang.
  beforeAll(() => {
    played = {};
    for (const [difficulty, color] of PLAYED) {
      played[`${difficulty}-${color}`] = playOut(difficulty, color, 16);
    }
  }, 120_000);

  for (const [difficulty, color] of PLAYED) {
    it(`runs the same way on ${difficulty}, the player on ${color === WHITE ? 'White' : 'Black'}`, () => {
      expect(played[`${difficulty}-${color}`]).toEqual(GOLDEN_GAMES[`${difficulty}-${color}`]);
    });
  }

  it('reads differently at each strength — the difficulty is not decoration', () => {
    const finals = (['easy', 'normal', 'hard'] as const).map((d) => played[`${d}-${WHITE}`]!.fen);
    expect(new Set(finals).size).toBe(3);
  });
});

const POSITIONS: readonly [string, string][] = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'],
];

describe('replies in fixed positions (released — do not edit to make green)', () => {
  let replies: Record<Difficulty, string[]>;

  beforeAll(() => {
    replies = { easy: [], normal: [], hard: [] };
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      replies[difficulty] = POSITIONS.map(([name, text]) => {
        const decision = decideCpuMove({
          position: fen(text),
          difficulty,
          seed: GOLDEN_SEED,
          moveCount: 0,
        })!;
        return `${name}: ${moveToUci(decision.move)} ${decision.nodes} d${decision.completedDepth}`;
      });
    }
  }, 120_000);

  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`answers the same way on ${difficulty}`, () => {
      expect(replies[difficulty]).toEqual(GOLDEN_REPLIES[difficulty]);
    });
  }
});

const GOLDEN_GAMES: Record<string, { fen: string; cpuTrace: string[] }> = {
  [`easy-${WHITE}`]: {
    fen: 'rn1qk1nr/ppp2ppp/4b3/3pp3/N6b/3P4/PPP2P2/RQ2KBNR w KQkq - 0 9',
    cpuTrace: ['e7e5', 'f8c5', 'c5e3', 'e3c1', 'c1g5', 'd7d5', 'c8e6', 'g5h4'],
  },
  [`normal-${WHITE}`]: {
    fen: 'r1bqkb1r/pppnnppp/8/4p1B1/4P1P1/3P3P/P1P1KP2/q2Q1BNR w kq - 0 9',
    cpuTrace: ['d7d5', 'e7e5', 'g8e7', 'b8d7', 'd5d4', 'd4c3', 'c3b2', 'b2a1q'],
  },
  [`hard-${WHITE}`]: {
    fen: 'rnbqkbnr/ppp1pppp/8/8/1Q6/3PP2P/P4PP1/2q1KBNR w kq - 2 9',
    cpuTrace: ['d7d5', 'd5d4', 'd4c3', 'c3b2', 'b2a1q', 'a1c1', 'c1c2', 'c2c1'],
  },
  [`normal-${BLACK}`]: {
    fen: '1Bb1k1nr/1pppqp1p/p5p1/4Q1b1/4P3/8/PPP2PPP/RN2KBNR w KQk - 2 9',
    cpuTrace: ['e2e4', 'd2d4', 'd4d5', 'c1e3', 'e3a7', 'a7b8', 'd1d5', 'd5e5'],
  },
};
const GOLDEN_REPLIES: Record<Difficulty, string[]> = {
  easy: [
    'start: d2d3 0 d0',
    'kiwipete: f3f6 0 d0',
    'position 3: b4f4 0 d0',
    'position 4: b4c5 0 d0',
    'position 5: d7c8q 0 d0',
  ],
  normal: [
    'start: e2e4 94 d2',
    'kiwipete: e2a6 4251 d2',
    'position 3: b4f4 158 d2',
    'position 4: d2d4 1785 d2',
    'position 5: d7c8q 554 d2',
  ],
  hard: [
    'start: e2e4 80000 d5',
    'kiwipete: e2a6 80000 d4',
    'position 3: b4f4 42118 d6',
    'position 4: c4c5 80000 d5',
    'position 5: d7c8q 80000 d4',
  ],
};
