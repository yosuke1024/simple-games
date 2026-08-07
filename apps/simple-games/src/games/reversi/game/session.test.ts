/**
 * The session rules (docs/REVERSI_RULES.md §2–§6, §9): turns resolve with
 * their passes, the CPU is deterministic per seed, Undo returns to the
 * player's previous decision point, and a persisted board comes back exactly
 * or not at all.
 */
import { describe, expect, it } from 'vitest';
import { legalMovesOf } from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import {
  applyCpuMove,
  applyPlayerMove,
  cpuColorOf,
  createSession,
  restoreSession,
  undo,
  type ReversiSession,
} from './session';
import {
  BLACK,
  BOARD_SIZE,
  countDiscs,
  initialBoard,
  WHITE,
  type Board,
  type Piece,
} from './types';

/** Builds a board from 8 rows of '.', 'B', 'W'. */
function boardOf(...rows: readonly string[]): Board {
  const board: Piece[] = [];
  for (const row of rows) {
    for (const cell of row) {
      board.push(cell === 'B' ? BLACK : cell === 'W' ? WHITE : 0);
    }
  }
  return board;
}

const at = (row: number, col: number) => row * BOARD_SIZE + col;

/** A mid-match session on an arbitrary board, the player to move. */
function sessionOn(board: Board): ReversiSession {
  return restoreSession({
    seed: 'reversi-test',
    difficulty: 'easy',
    playerColor: BLACK,
    board,
    toMove: BLACK,
    moveCount: 10,
    elapsedSeconds: 0,
  });
}

describe('turns (§2, §5)', () => {
  it('starts with the player, and the CPU declines to move out of turn', () => {
    const session = createSession('easy', BLACK, 'reversi-t1');
    expect(session.toMove).toBe(BLACK);
    expect(applyCpuMove(session)).toBeNull();
  });

  it('starts on the CPU when the player takes white (§1)', () => {
    // Black always opens, so taking white is taking the second move.
    const session = createSession('easy', WHITE, 'reversi-white');
    expect(session.toMove).toBe(BLACK);
    expect(session.playerColor).toBe(WHITE);
    expect(cpuColorOf(session)).toBe(BLACK);
    // The player cannot jump the queue, and the CPU's opening move hands the
    // turn straight back.
    expect(applyPlayerMove(session, at(2, 3))).toBeNull();
    const opened = applyCpuMove(session)!;
    expect(opened.session.toMove).toBe(WHITE);

    // From there it is an ordinary match, played from white's side.
    const answered = applyPlayerMove(opened.session, legalMovesOf(opened.session.board, WHITE)[0]!);
    expect(answered).not.toBeNull();
    expect(answered!.session.toMove).toBe(BLACK);
  });

  it('reads the verdict from the player’s own colour (§3)', () => {
    // A board white owns outright: the same position is a win for the player
    // who took white and a loss for the one who took black.
    const board = boardOf(
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWBB',
      'WWWWWWBB',
    );
    const asWhite = restoreSession({
      seed: 'reversi-verdict',
      difficulty: 'easy',
      playerColor: WHITE,
      board,
      toMove: BLACK,
      moveCount: 40,
      elapsedSeconds: 0,
    });
    const asBlack = restoreSession({
      seed: 'reversi-verdict',
      difficulty: 'easy',
      playerColor: BLACK,
      board,
      toMove: BLACK,
      moveCount: 40,
      elapsedSeconds: 0,
    });
    expect(asWhite.status).toBe('won');
    expect(asBlack.status).toBe('lost');
  });

  it('rejects an illegal cell and accepts a legal one', () => {
    const session = createSession('easy', BLACK, 'reversi-t2');
    expect(applyPlayerMove(session, at(0, 0))).toBeNull();

    const outcome = applyPlayerMove(session, at(2, 3))!;
    expect(outcome).not.toBeNull();
    expect(outcome.placed).toBe(at(2, 3));
    expect(outcome.flipped).toEqual([at(3, 3)]);
    expect(outcome.session.toMove).toBe(WHITE);
    expect(outcome.session.moveCount).toBe(1);
  });

  it('replies deterministically for one seed (§5)', () => {
    const session = createSession('normal', BLACK, 'reversi-t3');
    const afterPlayer = applyPlayerMove(session, at(2, 3))!.session;
    const first = applyCpuMove(afterPlayer)!;
    const second = applyCpuMove(afterPlayer)!;
    expect(first.placed).toBe(second.placed);
    expect(first.session.board).toEqual(second.session.board);
  });
});

describe('passes (§4)', () => {
  /**
   * Black rules the board except for three whites: one in the corner nothing
   * can ever take, and two sitting against edge-anchored black runs. Taking
   * the first leaves white without a move — but not the match without one.
   */
  const PASS_BOARD = boardOf(
    'W.......',
    '........',
    '........',
    '........',
    '....WBBB',
    '........',
    '.....WBB',
    '........',
  );

  it('hands the turn straight back when the CPU has no reply', () => {
    const outcome = applyPlayerMove(sessionOn(PASS_BOARD), at(4, 3))!;
    expect(outcome.passed).toBe(WHITE);
    expect(outcome.session.toMove).toBe(BLACK);
    expect(outcome.session.status).toBe('playing');
  });

  it('ends the match when neither side can move, and counts it (§3)', () => {
    const afterFirst = applyPlayerMove(sessionOn(PASS_BOARD), at(4, 3))!.session;
    const outcome = applyPlayerMove(afterFirst, at(6, 4))!;
    expect(outcome.session.status).toBe('won');
    expect(countDiscs(outcome.session.board)).toMatchObject({ black: 9, white: 1 });
  });
});

describe('undo (§6)', () => {
  it('returns to the previous decision point, CPU reply and all', () => {
    const session = createSession('easy', BLACK, 'reversi-t4');
    const afterPlayer = applyPlayerMove(session, at(2, 3))!.session;
    const afterCpu = applyCpuMove(afterPlayer)!.session;
    expect(afterCpu.toMove).toBe(BLACK);

    const undone = undo(afterCpu)!;
    expect(undone.board).toEqual(session.board);
    expect(undone.moveCount).toBe(0);
    expect(undone.toMove).toBe(BLACK);
    expect(undone.history).toEqual([]);
  });

  it('has nothing to undo before the first move', () => {
    expect(undo(createSession('easy', BLACK, 'reversi-t5'))).toBeNull();
  });

  it('does not reroll: the same move brings the same reply (§5, §6)', () => {
    const session = createSession('hard', BLACK, 'reversi-t6');
    const play = (s: ReversiSession) => applyCpuMove(applyPlayerMove(s, at(2, 3))!.session)!.placed;
    const first = play(session);
    const again = play(undo(applyCpuMove(applyPlayerMove(session, at(2, 3))!.session)!.session)!);
    expect(again).toBe(first);
  });
});

describe('persistence round-trip (§9)', () => {
  it('encodes and decodes the board it was given', () => {
    const board = initialBoard();
    const text = encodeBoard(board);
    expect(text).toHaveLength(64);
    expect(decodeBoard(text)).toEqual(board);
  });

  it('fails closed on anything that could not have come from play', () => {
    const valid = encodeBoard(initialBoard());
    expect(decodeBoard(valid.slice(1))).toBeNull();
    expect(decodeBoard(`x${valid.slice(1)}`)).toBeNull();
    expect(decodeBoard('0'.repeat(64))).toBeNull();
    // An opening whose centre was emptied is not a reachable position (§1).
    expect(decodeBoard(`${valid.slice(0, 27)}0${valid.slice(28)}`)).toBeNull();
  });

  it('normalises a stored turn the side cannot take (§4, §9)', () => {
    // White cannot move on this board; a save claiming white's turn is
    // handed back to black rather than wedging the match.
    const session = restoreSession({
      seed: 'reversi-t7',
      difficulty: 'normal',
      playerColor: BLACK,
      board: boardOf(
        'W.......',
        '........',
        '........',
        '........',
        '...BBBBB',
        '........',
        '.....WBB',
        '........',
      ),
      toMove: WHITE,
      moveCount: 11,
      elapsedSeconds: 5,
    });
    expect(session.toMove).toBe(BLACK);
    expect(session.status).toBe('playing');
  });
});
