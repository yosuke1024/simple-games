/**
 * The session rules (docs/CONNECT_FOUR_RULES.md §2–§5, §8): turns alternate,
 * the CPU is deterministic per seed and sees the obvious, Undo returns to the
 * player's previous decision point, and a persisted board comes back exactly
 * or not at all.
 */
import { describe, expect, it } from 'vitest';
import { chooseCpuMove } from './cpu';
import { dropDisc } from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import {
  applyCpuMove,
  applyPlayerMove,
  createSession,
  restoreSession,
  undo,
  type ConnectFourSession,
} from './session';
import { cellAt, CPU, emptyBoard, PLAYER, ROWS, type Board, type Piece } from './types';

/** Builds a board from 6 rows of '.', 'Y' (you) and 'C' (CPU), top row first. */
function boardOf(...rows: readonly string[]): Board {
  const board: Piece[] = [];
  for (const row of rows) {
    for (const cell of row) board.push(cell === 'Y' ? PLAYER : cell === 'C' ? CPU : 0);
  }
  return board;
}

/** Plays a column for whoever is to move, without going through the CPU. */
function forceDrop(session: ConnectFourSession, col: number): ConnectFourSession {
  const dropped = dropDisc(session.board, session.toMove, col)!;
  return restoreSession({
    seed: session.seed,
    difficulty: session.difficulty,
    first: PLAYER,
    board: dropped.board,
    moveCount: session.moveCount + 1,
    elapsedSeconds: session.elapsedSeconds,
  });
}

describe('turns (§2)', () => {
  it('starts with the player, and the CPU declines to move out of turn', () => {
    const session = createSession('easy', PLAYER, 'connect-four-t1');
    expect(session.toMove).toBe(PLAYER);
    expect(applyCpuMove(session)).toBeNull();
  });

  it('drops to the bottom and hands the turn over', () => {
    const outcome = applyPlayerMove(createSession('easy', PLAYER, 'connect-four-t2'), 3)!;
    expect(outcome.placed).toBe(cellAt(ROWS - 1, 3));
    expect(outcome.session.toMove).toBe(CPU);
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.status).toBe('playing');
  });

  it('starts on the CPU when the player takes second (§1)', () => {
    const session = createSession('easy', CPU, 'connect-four-second');
    expect(session.toMove).toBe(CPU);
    // The player cannot jump the queue, and the CPU's opening drop hands the
    // turn straight back.
    expect(applyPlayerMove(session, 3)).toBeNull();
    const opened = applyCpuMove(session)!;
    expect(opened.session.toMove).toBe(PLAYER);
    expect(opened.session.first).toBe(CPU);

    // From there it is an ordinary match: the player answers, the CPU replies.
    const answered = applyPlayerMove(opened.session, 0)!.session;
    expect(answered.toMove).toBe(CPU);
  });

  it('rejects a full column, silently (§2)', () => {
    const session = restoreSession({
      seed: 'connect-four-t3',
      difficulty: 'easy',
      first: PLAYER,
      board: boardOf('Y......', 'C......', 'Y......', 'C......', 'Y......', 'C......'),
      moveCount: 6,
      elapsedSeconds: 0,
    });
    expect(applyPlayerMove(session, 0)).toBeNull();
  });

  it('ends the match on the fourth disc (§3)', () => {
    let session = restoreSession({
      seed: 'connect-four-t4',
      difficulty: 'easy',
      first: PLAYER,
      board: boardOf('.......', '.......', '.......', '.......', '...CCC.', '.YYY...'),
      moveCount: 6,
      elapsedSeconds: 0,
    });
    expect(session.toMove).toBe(PLAYER);
    const outcome = applyPlayerMove(session, 4)!;
    session = outcome.session;
    expect(session.status).toBe('won');
    expect(session.winningLine).toHaveLength(4);
  });
});

describe('the CPU (§4)', () => {
  it('replies deterministically for one seed', () => {
    const afterPlayer = applyPlayerMove(
      createSession('normal', PLAYER, 'connect-four-t5'),
      3,
    )!.session;
    const first = applyCpuMove(afterPlayer)!;
    const second = applyCpuMove(afterPlayer)!;
    expect(first.placed).toBe(second.placed);
  });

  it('takes the win it can see, at every strength', () => {
    // Three CPU discs to the left of the gap, three of the player's to the
    // right of it: whoever drops in column 3 makes four, and it is the CPU's
    // turn. Even the shallowest read has to take that.
    const board = boardOf('.......', '.......', '.......', '.......', 'Y......', 'CCC.YYY');
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(chooseCpuMove({ board, difficulty, seed: 'connect-four-t6', moveCount: 7 })).toBe(3);
    }
  });

  it('blocks the player from four once it reads a ply ahead', () => {
    // The player threatens the bottom row at column 3; easy cannot see it,
    // normal and hard must (§4).
    const board = boardOf('.......', '.......', '.......', '.......', 'CC.....', 'YYY....');
    for (const difficulty of ['normal', 'hard'] as const) {
      expect(chooseCpuMove({ board, difficulty, seed: 'connect-four-t7', moveCount: 5 })).toBe(3);
    }
  });

  it('stays inside its node budget on a wide-open board (§4)', () => {
    const started = Date.now();
    chooseCpuMove({
      board: emptyBoard(),
      difficulty: 'hard',
      seed: 'connect-four-t8',
      moveCount: 0,
    });
    // The bound is nodes, not milliseconds; this only proves the search
    // terminates rather than running away with the turn.
    expect(Date.now() - started).toBeLessThan(4000);
  });
});

describe('undo (§5)', () => {
  it('returns to the previous decision point, CPU reply and all', () => {
    const session = createSession('easy', PLAYER, 'connect-four-t9');
    const afterPlayer = applyPlayerMove(session, 3)!.session;
    const afterCpu = applyCpuMove(afterPlayer)!.session;
    expect(afterCpu.toMove).toBe(PLAYER);

    const undone = undo(afterCpu)!;
    expect(undone.board).toEqual(session.board);
    expect(undone.moveCount).toBe(0);
    expect(undone.toMove).toBe(PLAYER);
    expect(undone.history).toEqual([]);
  });

  it('has nothing to undo before the first move', () => {
    expect(undo(createSession('easy', PLAYER, 'connect-four-t10'))).toBeNull();
  });

  it('does not reroll: the same drop brings the same reply (§4, §5)', () => {
    const session = createSession('hard', PLAYER, 'connect-four-t11');
    const first = applyCpuMove(applyPlayerMove(session, 3)!.session)!;
    const again = applyCpuMove(applyPlayerMove(undo(first.session)!, 3)!.session)!;
    expect(again.placed).toBe(first.placed);
  });
});

describe('persistence round-trip (§8)', () => {
  it('encodes and decodes the board it was given', () => {
    const board = boardOf('.......', '.......', '.......', '.......', '...C...', '..YYC.Y');
    const text = encodeBoard(board);
    expect(text).toHaveLength(42);
    expect(decodeBoard(text, PLAYER)).toEqual(board);
  });

  it('fails closed on anything that could not have come from play', () => {
    const valid = encodeBoard(
      boardOf('.......', '.......', '.......', '.......', '...C...', '..YYC.Y'),
    );
    expect(decodeBoard(valid.slice(1), PLAYER)).toBeNull();
    expect(decodeBoard(`x${valid.slice(1)}`, PLAYER)).toBeNull();
    // A disc floating over an empty cell breaks gravity (§8).
    expect(
      decodeBoard(
        encodeBoard(boardOf('.......', '.......', '.......', '.Y.....', '.......', '.......')),
        PLAYER,
      ),
    ).toBeNull();
    // The same board saved as "the CPU opened" does not add up either: the
    // stored opener is part of what makes a position reachable (§1, §8).
    expect(decodeBoard(valid, CPU)).toBeNull();
  });

  it('derives the turn from the board rather than trusting a stored one', () => {
    const level = restoreSession({
      seed: 'connect-four-t12',
      difficulty: 'normal',
      first: PLAYER,
      board: boardOf('.......', '.......', '.......', '.......', '.......', '..YC...'),
      moveCount: 2,
      elapsedSeconds: 0,
    });
    expect(level.toMove).toBe(PLAYER);

    const ahead = forceDrop(level, 4);
    expect(ahead.toMove).toBe(CPU);
  });

  it('recognises a finished board so the loader can discard it', () => {
    const finished = restoreSession({
      seed: 'connect-four-t13',
      difficulty: 'hard',
      first: PLAYER,
      board: boardOf('.......', '.......', '.......', '.......', '.CCC...', '.YYYY..'),
      moveCount: 7,
      elapsedSeconds: 0,
    });
    expect(finished.status).toBe('won');
    expect(finished.winningLine).toHaveLength(4);
  });
});
