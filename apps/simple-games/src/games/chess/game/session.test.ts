/**
 * The game as the screen drives it (docs/CHESS_RULES.md §4, §6, §7): what the
 * player may select and where it may go, the player's move and the CPU's
 * reply, what Undo takes back, and what a saved game comes back as.
 */
import { describe, expect, it } from 'vitest';
import { toFen } from './fen';
import {
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  cloneGame,
  createSession,
  encodeSessionMoves,
  endReasonOf,
  isCpuTurn,
  isInCheck,
  isPlayerTurn,
  lastMove,
  legalTargets,
  matchSeed,
  newSeedToken,
  planCpuMove,
  restoreSession,
  selectableSquares,
  statusOf,
  undo,
  type ChessSession,
} from './session';
import { moveToUci } from './serialize';
import { gameOf } from './test-helpers';
import { BLACK, QUEEN, WHITE, parseSquare, type Color } from './types';

const sq = parseSquare;

/** A session sitting on the game these moves make, from the start. */
function sessionAfter(playerColor: Color, ...ucis: string[]): ChessSession {
  return {
    ...createSession('normal', playerColor, 'session-test'),
    game: gameOf(...ucis),
  };
}

/** The player's move by UCI; throws when it is refused. */
function play(session: ChessSession, uci: string): ChessSession {
  const promotion = uci.length === 5 ? { q: 5, r: 4, b: 3, n: 2 }[uci[4]!]! : 0;
  const outcome = applyPlayerMove(session, sq(uci.slice(0, 2)), sq(uci.slice(2, 4)), promotion);
  if (outcome === null) throw new Error(`refused: ${uci}`);
  return outcome.session;
}

describe('a new game (§1)', () => {
  it('starts on the player’s move as White and on the CPU’s as Black', () => {
    const white = createSession('easy', WHITE, 's');
    expect(isPlayerTurn(white)).toBe(true);
    const black = createSession('easy', BLACK, 's');
    expect(isCpuTurn(black)).toBe(true);
    expect(statusOf(black)).toBe('playing');
    expect(lastMove(black)).toBeNull();
  });

  it('gets a seed of its own', () => {
    expect(matchSeed(newSeedToken(0, () => 0.5))).toBe('chess-0-' + (0x7fffff).toString(36));
    expect(createSession('easy').seed).toMatch(/^chess-/);
  });
});

describe('selecting and moving (§4)', () => {
  it('offers only the pieces that can move, and only on the player’s turn', () => {
    const session = createSession('easy', WHITE, 's');
    // Knights and pawns: b1 g1 and a2–h2.
    expect(selectableSquares(session)).toEqual([1, 6, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(selectableSquares(createSession('easy', BLACK, 's'))).toEqual([]);
    expect(legalTargets(createSession('easy', BLACK, 's'), sq('e2'))).toEqual([]);
  });

  it('does not offer a pinned piece, nor one that cannot answer a check', () => {
    // 1. e4 e6 2. d3 Bb4+ 3. Nc3 a6: the knight on c3 is pinned to the king.
    const pinned = sessionAfter(WHITE, 'e2e4', 'e7e6', 'd2d3', 'f8b4', 'b1c3', 'a7a6');
    expect(selectableSquares(pinned)).not.toContain(sq('c3'));
    expect(legalTargets(pinned, sq('c3'))).toEqual([]);
    // 1. e4 d6 2. Bb5+: only the pieces that can block on c6 or d7 may move.
    const checked = sessionAfter(BLACK, 'e2e4', 'd7d6', 'f1b5');
    expect(isInCheck(checked)).toBe(true);
    expect(selectableSquares(checked)).toEqual([sq('c7'), sq('b8'), sq('c8'), sq('d8')]);
  });

  it('lists each destination once, marking captures, promotions, castling and en passant', () => {
    // A promotion: four moves, one target.
    const promote = sessionAfter(
      WHITE,
      'a2a4',
      'b7b5',
      'a4b5',
      'a7a6',
      'b5a6',
      'c8b7',
      'a6b7',
      'h7h6',
    );
    const targets = legalTargets(promote, sq('b7'));
    expect(targets.map((t) => [t.to, t.capture, t.promotion])).toEqual([[sq('a8'), true, true]]);
    expect(promote.game.legal.filter((move) => move % 64 === sq('b7'))).toHaveLength(4);
    // Castling: the king's two-square move.
    const castle = sessionAfter(WHITE, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6');
    const kingside = legalTargets(castle, sq('e1')).find((t) => t.to === sq('g1'))!;
    expect(kingside.castle).toBe(true);
    expect(kingside.capture).toBe(false);
    // En passant: an empty square, marked as a capture.
    const ep = sessionAfter(WHITE, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const take = legalTargets(ep, sq('e5')).find((t) => t.to === sq('d6'))!;
    expect(take.enPassant).toBe(true);
    expect(take.capture).toBe(true);
  });

  it('refuses a move that is not legal, the CPU’s turn, and a promotion without its piece', () => {
    const session = createSession('easy', WHITE, 's');
    expect(applyPlayerMove(session, sq('e2'), sq('e5'))).toBeNull();
    expect(applyPlayerMove(createSession('easy', BLACK, 's'), sq('e7'), sq('e5'))).toBeNull();
    const promote = sessionAfter(
      WHITE,
      'a2a4',
      'b7b5',
      'a4b5',
      'a7a6',
      'b5a6',
      'c8b7',
      'a6b7',
      'h7h6',
    );
    expect(applyPlayerMove(promote, sq('b7'), sq('a8'))).toBeNull();
    const queened = applyPlayerMove(promote, sq('b7'), sq('a8'), QUEEN)!;
    expect(moveToUci(queened.move)).toBe('b7a8q');
  });

  it('never changes the session it was given', () => {
    const session = createSession('easy', WHITE, 's');
    const before = toFen(session.game.position);
    const next = play(session, 'e2e4');
    expect(toFen(session.game.position)).toBe(before);
    expect(session.game.moves).toHaveLength(0);
    expect(next.game.moves).toHaveLength(1);
    const replied = applyCpuMove(next)!.session;
    expect(next.game.moves).toHaveLength(1);
    expect(replied.game.moves).toHaveLength(2);
  });
});

describe('the CPU’s turn (§5)', () => {
  it('moves only on its own turn, and the same session always gets the same reply', () => {
    const session = play(createSession('normal', WHITE, 'reply-seed'), 'e2e4');
    expect(planCpuMove(createSession('normal', WHITE, 's'))).toBeNull();
    expect(applyCpuMove(createSession('normal', WHITE, 's'))).toBeNull();
    const first = applyCpuMove(session)!;
    const again = applyCpuMove(session)!;
    expect(again.move).toBe(first.move);
    expect(isPlayerTurn(first.session)).toBe(true);
    expect(lastMove(first.session)).toBe(first.move);
  });

  it('opens the game when the player took Black', () => {
    const opened = applyCpuMove(createSession('easy', BLACK, 's'))!;
    expect(opened.session.game.moves).toHaveLength(1);
    expect(isPlayerTurn(opened.session)).toBe(true);
  });
});

describe('Undo (§6)', () => {
  it('takes back the CPU’s reply and the player’s move together', () => {
    const start = createSession('normal', WHITE, 'undo-seed');
    const replied = applyCpuMove(play(start, 'e2e4'))!.session;
    expect(canUndo(replied)).toBe(true);
    const back = undo(replied)!;
    expect(back.game.moves).toHaveLength(0);
    expect(isPlayerTurn(back)).toBe(true);
    expect(canUndo(back)).toBe(false);
  });

  it('during the CPU’s pause takes back only the player’s move', () => {
    const moved = play(createSession('normal', WHITE, 's'), 'e2e4');
    const back = undo(moved)!;
    expect(back.game.moves).toHaveLength(0);
    expect(isPlayerTurn(back)).toBe(true);
  });

  it('cannot take back the CPU’s opening move when the player took Black', () => {
    const opened = applyCpuMove(createSession('normal', BLACK, 's'))!.session;
    expect(canUndo(opened)).toBe(false);
    expect(undo(opened)).toBeNull();
    const replied = applyCpuMove(play(opened, 'e7e5'))!.session;
    const back = undo(replied)!;
    expect(back.game.moves).toHaveLength(1);
    expect(isPlayerTurn(back)).toBe(true);
  });

  it('is a take-back, not a reroll: the same move brings the same reply', () => {
    const start = createSession('normal', WHITE, 'take-back');
    const first = applyCpuMove(play(start, 'd2d4'))!;
    const back = undo(first.session)!;
    const second = applyCpuMove(play(back, 'd2d4'))!;
    expect(second.move).toBe(first.move);
  });

  it('is not offered once the game is over', () => {
    // Fool's mate, the player on Black delivering it.
    const mated = sessionAfter(BLACK, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(statusOf(mated)).toBe('won');
    expect(endReasonOf(mated)).toBe('checkmate');
    expect(canUndo(mated)).toBe(false);
    expect(undo(mated)).toBeNull();
  });
});

describe('the result from the player’s side (§3)', () => {
  it('reads a mate as a win or a loss, by who delivered it', () => {
    expect(statusOf(sessionAfter(BLACK, 'f2f3', 'e7e5', 'g2g4', 'd8h4'))).toBe('won');
    expect(statusOf(sessionAfter(WHITE, 'f2f3', 'e7e5', 'g2g4', 'd8h4'))).toBe('lost');
  });

  it('reads a repetition as a draw, with its reason', () => {
    const drawn = sessionAfter(
      WHITE,
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
    );
    expect(statusOf(drawn)).toBe('draw');
    expect(endReasonOf(drawn)).toBe('repetition');
  });
});

describe('save and resume (§7.1)', () => {
  it('round-trips through the move list, Undo included', () => {
    let session = createSession('normal', WHITE, 'resume-seed');
    for (const uci of ['e2e4', 'd2d4', 'g1f3']) {
      session = applyCpuMove(play(session, uci))!.session;
    }
    const text = encodeSessionMoves(session);
    const restored = restoreSession({
      seed: session.seed,
      difficulty: session.difficulty,
      playerColor: session.playerColor,
      moves: text,
      elapsedSeconds: 42,
    })!;
    expect(toFen(restored.game.position)).toBe(toFen(session.game.position));
    expect(restored.elapsedSeconds).toBe(42);
    // Undo reaches back past the save, to the first move (§6).
    let back: ChessSession | null = restored;
    let steps = 0;
    while (back && canUndo(back)) {
      back = undo(back);
      steps += 1;
    }
    expect(steps).toBe(3);
    expect(back!.game.moves).toHaveLength(0);
  });

  it('resumes on the CPU’s move when it was left there, and the CPU answers as before', () => {
    const moved = play(createSession('normal', WHITE, 'resume-cpu'), 'e2e4');
    const restored = restoreSession({
      seed: moved.seed,
      difficulty: moved.difficulty,
      playerColor: moved.playerColor,
      moves: encodeSessionMoves(moved),
      elapsedSeconds: 0,
    })!;
    expect(isCpuTurn(restored)).toBe(true);
    expect(applyCpuMove(restored)!.move).toBe(applyCpuMove(moved)!.move);
  });

  it('refuses a finished game, a broken list and an unknown colour', () => {
    const base = {
      seed: 's',
      difficulty: 'easy' as const,
      playerColor: WHITE as Color,
      elapsedSeconds: 0,
    };
    expect(restoreSession({ ...base, moves: 'f2f3 e7e5 g2g4 d8h4' })).toBeNull();
    expect(restoreSession({ ...base, moves: 'e2e5' })).toBeNull();
    expect(restoreSession({ ...base, moves: 42 })).toBeNull();
    expect(restoreSession({ ...base, playerColor: 2 as Color, moves: '' })).toBeNull();
    expect(restoreSession({ ...base, moves: '' })).not.toBeNull();
  });
});

describe('cloneGame', () => {
  it('shares nothing mutable with the original', () => {
    const game = gameOf('e2e4', 'e7e5');
    const copy = cloneGame(game);
    expect(copy.position.board).not.toBe(game.position.board);
    expect(copy.moves).not.toBe(game.moves);
    expect(copy.history).not.toBe(game.history);
    expect(toFen(copy.position)).toBe(toFen(game.position));
  });
});
