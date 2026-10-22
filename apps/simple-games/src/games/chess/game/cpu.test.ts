/**
 * What the opponent is, and what it is not (docs/CHESS_RULES.md §5, §12).
 *
 * The properties that matter: every strength plays only legal moves and takes
 * a mate in one; it reads draws as endings, as the rules end games; the
 * capture search never stands still in check; the node limit is a limit and
 * the reply says honestly when it hit it; and everything is decided by the
 * position, the history, the seed and the move count — which is what makes
 * Undo a take-back rather than a reroll (§6).
 */
import { describe, expect, it } from 'vitest';
import {
  __test,
  decideCpuMove,
  evaluate,
  HARD_NODE_LIMIT,
  MATE_VALUE,
  NORMAL_MAX_DEPTH,
  pieceSquareValue,
  type CpuMoveInput,
} from './cpu';
import { generateLegalMoves, hasLegalEnPassant, makeMove, repetitionKey } from './engine';
import { toFen } from './fen';
import type { HistoryEntry } from './rules';
import { moveToUci } from './serialize';
import { fen, legalMove, randomGame } from './test-helpers';
import { BISHOP, BLACK_BIT, DIFFICULTIES, KNIGHT, PAWN, QUEEN, ROOK, parseSquare } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * A smaller budget for the cases about what the search reads rather than
 * what it costs: the same search, the same depths, a tenth of the nodes — so
 * the file stays inside the default timeout on a busy runner (a hard reply at
 * the full limit takes about a second inside vitest — §5.3). The cases about
 * the limit itself use the real one.
 */
const LIGHT = { nodeLimit: 8_000 };

const decide = (text: string, difficulty: CpuMoveInput['difficulty'], extra = {}) =>
  decideCpuMove({ position: fen(text), difficulty, seed: 'cpu-test', moveCount: 0, ...extra })!;

const replyUci = (text: string, difficulty: CpuMoveInput['difficulty'], extra = {}) =>
  moveToUci(decide(text, difficulty, extra).move);

/**
 * A position reached from `start` by `ucis`, with the history the repetition
 * rule reads — the game record's keys (record.ts), built here from a FEN
 * start the record cannot take.
 */
function withHistory(start: string, ...ucis: string[]) {
  const position = fen(start);
  const entry = (): HistoryEntry => {
    const key = repetitionKey(position, hasLegalEnPassant(position));
    return { hashHi: key.hi, hashLo: key.lo, signature: '' };
  };
  const history = [entry()];
  for (const uci of ucis) {
    makeMove(position, legalMove(position, uci));
    history.push(entry());
  }
  return { position, history };
}

/** The same position with colours swapped and the board turned round. */
function mirrorFen(text: string): string {
  const [board, side, castling, ep, half, full] = text.split(' ');
  const swap = (s: string) =>
    [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
  const mirroredEp = ep === '-' ? '-' : `${ep![0]}${9 - Number(ep![1])}`;
  const mirroredCastling =
    castling === '-' ? '-' : [...swap(castling!)].sort((a, b) => (a < b ? -1 : 1)).join('');
  return [
    swap(board!.split('/').reverse().join('/')),
    side === 'w' ? 'b' : 'w',
    mirroredCastling,
    mirroredEp,
    half,
    full,
  ].join(' ');
}

describe('the static value (§5.2)', () => {
  it('is 0 in the starting position — the two sides are the same', () => {
    expect(evaluate(fen(START))).toBe(0);
  });

  it('matches the hand count of §5.2: a centralised knight against a bare king is 368', () => {
    // Knight 320 + 6 × (3 + 3) − 18 = 18 on e4; both kings 0 at phase 1
    // (trunc((−5 × 1 + 0 × 23) / 24) = 0); the mop-up against the bare king
    // on e8: 10 × (6 − 3 − 0) + 4 × (7 − 7) = 30. From the side to move.
    expect(evaluate(fen('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'))).toBe(368);
    expect(evaluate(fen('4k3/8/8/8/4N3/8/8/4K3 b - - 0 1'))).toBe(-368);
  });

  it('builds the piece tables from the §5.2 formulas', () => {
    const sq = parseSquare;
    expect(pieceSquareValue(KNIGHT, sq('a1'))).toBe(-18);
    expect(pieceSquareValue(KNIGHT, sq('d4'))).toBe(18);
    expect(pieceSquareValue(BISHOP, sq('h8'))).toBe(-12);
    expect(pieceSquareValue(QUEEN, sq('e5'))).toBe(6);
    expect(pieceSquareValue(ROOK, sq('a7'))).toBe(20);
    expect(pieceSquareValue(ROOK | BLACK_BIT, sq('a2'))).toBe(20);
    expect(pieceSquareValue(PAWN, sq('e2'))).toBe(-10);
    expect(pieceSquareValue(PAWN, sq('e4'))).toBe(24);
    expect(pieceSquareValue(PAWN | BLACK_BIT, sq('d5'))).toBe(24);
    expect(pieceSquareValue(PAWN, sq('a7'))).toBe(56);
  });

  it('is the same for a position and its mirror, over 300 positions of random games', () => {
    let checked = 0;
    for (let n = 0; n < 10; n++) {
      randomGame(`cpu-mirror-${n}`, (game) => {
        if (game.moves.length % 7 !== 0 || checked >= 300) return;
        const text = toFen(game.position);
        expect(evaluate(fen(mirrorFen(text)))).toBe(evaluate(game.position));
        checked += 1;
      });
    }
    expect(checked).toBe(300);
  });
});

describe('every strength (§5.1)', () => {
  it('takes a mate in one, for either colour, even with no budget at all', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(replyUci('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', difficulty)).toBe('a1a8');
      expect(replyUci('r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', difficulty)).toBe('a8a1');
      const decision = decide('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', difficulty, {
        nodeLimit: 1,
      });
      expect(decision.kind).toBe('mate');
      expect(decision.nodes).toBe(0);
    }
  });

  it('mates on the hundredth quiet ply rather than reading it as the fifty-move draw (§3.5)', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(replyUci('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 120', difficulty)).toBe('a1a8');
    }
  });

  it('plays a single legal move without searching', () => {
    for (const difficulty of DIFFICULTIES) {
      const decision = decide('7k/8/8/8/8/8/6q1/7K w - - 0 1', difficulty);
      expect(moveToUci(decision.move)).toBe('h1g2');
      expect(decision.kind).toBe('only');
      expect(decision.nodes).toBe(0);
    }
  });

  it('returns null when there is no legal move — the game is over', () => {
    expect(
      decideCpuMove({
        position: fen('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1'),
        difficulty: 'hard',
        seed: 's',
        moveCount: 0,
      }),
    ).toBeNull();
  });

  it('plays only legal moves, over random positions at every strength', () => {
    let checked = 0;
    for (let n = 0; n < 3; n++) {
      randomGame(`cpu-legal-${n}`, (game) => {
        if (game.outcome !== null || game.moves.length % 13 !== 0) return;
        for (const difficulty of DIFFICULTIES) {
          const move = decideCpuMove({
            position: game.position,
            history: game.history,
            difficulty,
            seed: `cpu-legal-${n}`,
            moveCount: game.moves.length,
            nodeLimit: 500,
          })!.move;
          expect(game.legal).toContain(move);
          checked += 1;
        }
      });
    }
    expect(checked).toBeGreaterThan(60);
  });

  it('leaves the position it was given exactly as it was', () => {
    const position = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const before = toFen(position);
    const hash = [position.hashHi, position.hashLo];
    for (const difficulty of DIFFICULTIES) {
      decideCpuMove({ position, difficulty, seed: 's', moveCount: 3, ...LIGHT });
    }
    expect(toFen(position)).toBe(before);
    expect([position.hashHi, position.hashLo]).toEqual(hash);
  });
});

describe('draws are endings in what the CPU reads (§3, §5.2)', () => {
  // White has a queen and a rook for a knight; both sides shuffle. The
  // positions after these moves have each occurred twice.
  const LOPSIDED = '1n2k3/8/8/8/8/8/8/R2QK3 w - - 0 1';

  it('the losing side takes a third occurrence when it is offered', () => {
    // Black to move; c6b8 brings back the starting position a third time.
    const { position, history } = withHistory(
      LOPSIDED,
      'e1f1',
      'b8c6',
      'f1e1',
      'c6b8',
      'e1f1',
      'b8c6',
      'f1e1',
    );
    for (const difficulty of DIFFICULTIES) {
      const decision = decideCpuMove({
        position,
        history,
        difficulty,
        seed: 's',
        moveCount: 7,
        ...LIGHT,
      })!;
      expect(moveToUci(decision.move)).toBe('c6b8');
      expect(decision.value).toBe(0);
    }
  });

  it('the winning side steers round one', () => {
    // White to move; e2f1 would make the position after it a third time.
    const { position, history } = withHistory(
      LOPSIDED,
      'e1f1',
      'b8c6',
      'f1e2',
      'c6b8',
      'e2f1',
      'b8c6',
      'f1e2',
      'c6b8',
    );
    for (const difficulty of DIFFICULTIES) {
      const decision = decideCpuMove({
        position,
        history,
        difficulty,
        seed: 's',
        moveCount: 8,
        ...LIGHT,
      })!;
      expect(moveToUci(decision.move)).not.toBe('e2f1');
      expect(decision.value).toBeGreaterThan(500);
    }
  });

  it('the winning side resets the fifty-move count when the next quiet move would draw', () => {
    const position = '7k/8/8/8/8/8/P7/K2Q4 w - - 99 120';
    for (const difficulty of DIFFICULTIES) {
      expect(['a2a3', 'a2a4']).toContain(replyUci(position, difficulty, LIGHT));
    }
  });

  it('normal and hard see the opponent’s drawing reply one ply further on', () => {
    // At 98 a quiet move lets the losing side make the hundredth quiet ply.
    const position = '7k/8/8/8/8/8/P7/K2Q4 w - - 98 120';
    for (const difficulty of ['normal', 'hard'] as const) {
      expect(['a2a3', 'a2a4']).toContain(replyUci(position, difficulty, LIGHT));
    }
  });

  it('normal and hard read a mate on the hundredth quiet ply as a mate, not as the fifty-move draw', () => {
    // Black to move at 98. Any rook move along the d-file but to d1 is quiet,
    // and lets White mate with Re8 on the hundredth quiet ply. The search
    // must score that as being mated (§5.2) — read as a draw, d8d2 and the
    // like look as good as anything else.
    const position = '3r2k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 98 120';
    for (const difficulty of ['normal', 'hard'] as const) {
      for (let n = 0; n < 4; n++) {
        const decision = decide(position, difficulty, { ...LIGHT, seed: `ply-100-${n}` });
        const after = fen(position);
        makeMove(after, decision.move);
        const white = decideCpuMove({
          position: after,
          difficulty: 'easy',
          seed: 'ply-100',
          moveCount: 1,
        })!;
        expect(white.kind).not.toBe('mate');
      }
    }
  });

  it('a stalemate is a draw, not a win: the winning side never plays the stalemating move', () => {
    // Qg6 leaves the bare king on h8 no move and no check — stalemate. There
    // is no mate in one here, so nothing but the draw rule keeps Qg6 out.
    const position = '7k/8/5K2/8/4Q3/8/8/8 w - - 0 1';
    for (const difficulty of DIFFICULTIES) {
      const decision = decide(position, difficulty, LIGHT);
      expect(decision.kind).not.toBe('mate');
      expect(moveToUci(decision.move)).not.toBe('e4g6');
      expect(decision.value).toBeGreaterThan(500);
    }
  });
});

describe('the capture search (§5.2)', () => {
  it('stands pat when nothing worth taking is on offer', () => {
    // The pawn on d5 is defended: Qxd5 exd5 loses the queen.
    const position = fen('4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1');
    expect(__test.quiescence(position).value).toBe(evaluate(position));
  });

  it('takes what is free', () => {
    const position = fen('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1');
    expect(__test.quiescence(position).value).toBeGreaterThan(evaluate(position) + 90);
  });

  it('does not stand pat in check: a mated side is mated, whatever the material says', () => {
    // Black is mated on the back rank; the static value alone would read a
    // rook down, not lost.
    const position = fen('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1');
    expect(evaluate(position)).toBeGreaterThan(-MATE_VALUE / 2);
    expect(__test.quiescence(position).value).toBe(-MATE_VALUE);
  });

  it('reads every evasion in check, quiet ones included', () => {
    // The only legal reply to the check is a quiet king move; a capture-only
    // search would find nothing and call it mate.
    const position = fen('R5k1/6pp/8/8/8/8/8/6K1 b - - 1 1');
    expect(generateLegalMoves(position).map(moveToUci)).toEqual(['g8f7']);
    expect(__test.quiescence(position).value).toBeGreaterThan(-MATE_VALUE / 2);
  });
});

describe('the node limit is a limit, and the reply says when it hit it (§5.3)', () => {
  it('normal finishes its own depth in the opening, well inside the budget', () => {
    const decision = decide(START, 'normal');
    expect(decision.kind).toBe('search');
    expect(decision.completedDepth).toBe(NORMAL_MAX_DEPTH);
    expect(decision.capped).toBe(false);
    expect(decision.nodes).toBeLessThan(HARD_NODE_LIMIT);
  });

  it('hard spends the whole budget in the opening and says it was cut off', () => {
    const decision = decide(START, 'hard');
    expect(decision.nodes).toBe(HARD_NODE_LIMIT);
    expect(decision.capped).toBe(true);
    expect(decision.completedDepth).toBeGreaterThanOrEqual(NORMAL_MAX_DEPTH);
  });

  it('with too little budget for depth 1, falls back to the static look — still a legal move, and capped', () => {
    const decision = decide(START, 'hard', { nodeLimit: 10 });
    expect(decision.completedDepth).toBe(0);
    expect(decision.capped).toBe(true);
    expect(decision.nodes).toBe(10);
    expect(generateLegalMoves(fen(START))).toContain(decision.move);
  });

  it('stops deepening once a forced mate is read, and is not capped then', () => {
    // Mate in two: a rook to the seventh, then the other to the eighth.
    const decision = decide('7k/8/8/8/8/8/R7/1R4K1 w - - 0 1', 'hard');
    expect(decision.kind).toBe('search');
    expect(decision.value).toBe(MATE_VALUE - 3);
    expect(decision.completedDepth).toBe(3);
    expect(decision.capped).toBe(false);
    expect(['a2a7', 'b1b7']).toContain(moveToUci(decision.move));
  });
});

describe('determinism (§5.4)', () => {
  const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

  it('the same input gives the same move and the same work', () => {
    for (const difficulty of DIFFICULTIES) {
      const first = decide(KIWIPETE, difficulty, LIGHT);
      const again = decide(KIWIPETE, difficulty, LIGHT);
      expect(again).toEqual(first);
    }
  });

  it('the seed decides among equals: easy varies with it', () => {
    const replies = new Set<string>();
    for (let n = 0; n < 12; n++) {
      replies.add(replyUci(START, 'easy', { seed: `seed-${n}` }));
    }
    expect(replies.size).toBeGreaterThan(1);
  });

  it('the seed decides among equally good moves at normal and hard, and each seed keeps its own', () => {
    // In the starting position more than one reply scores the same; the
    // seeded root order decides which is kept (§5.1, §5.4). Hard gets a
    // quarter of LIGHT — sixteen hard replies at 8,000 nodes outrun the
    // default timeout on a busy runner — and still reads past normal's depth.
    for (const difficulty of ['normal', 'hard'] as const) {
      const replies = new Set<string>();
      for (let n = 0; n < 8; n++) {
        const extra = { nodeLimit: 2_000, seed: `seed-${n}` };
        if (difficulty === 'hard') {
          expect(decide(START, difficulty, extra).completedDepth).toBeGreaterThan(NORMAL_MAX_DEPTH);
        }
        const reply = replyUci(START, difficulty, extra);
        expect(replyUci(START, difficulty, extra)).toBe(reply);
        replies.add(reply);
      }
      expect(replies.size).toBeGreaterThan(1);
    }
  });

  it('the seed decides which of two mates in one is played', () => {
    // Ra8 and Rb8 both mate; the first mate in the seeded order is played.
    const position = '6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1';
    for (const difficulty of DIFFICULTIES) {
      const replies = new Set<string>();
      for (let n = 0; n < 8; n++) {
        const decision = decide(position, difficulty, { seed: `seed-${n}` });
        expect(decision.kind).toBe('mate');
        expect(decide(position, difficulty, { seed: `seed-${n}` }).move).toBe(decision.move);
        replies.add(moveToUci(decision.move));
      }
      expect([...replies].sort()).toEqual(['a1a8', 'b1b8']);
    }
  });
});
