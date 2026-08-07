/**
 * The match as a whole (docs/CHECKERS_RULES.md §3, §5, §8): what a turn is,
 * what Undo takes back, and what a saved position comes back as.
 *
 * The distinction this file exists to hold is turn versus step. A capture
 * sequence is several steps and one turn, and everything a player can see or
 * undo is keyed to the turn.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCpuTurn,
  applyPlayerStep,
  canUndo,
  createSession,
  currentMoves,
  DRAW_QUIET_PLIES,
  matchSeed,
  newSeedToken,
  restoreSession,
  undo,
  type CheckersSession,
} from './session';
import {
  CPU,
  CPU_MAN,
  EMPTY,
  PLAYER,
  PLAYER_KING,
  PLAYER_MAN,
  cellAt,
  countPieces,
  initialBoard,
  isDarkSquare,
  type Board,
  type Piece,
  type Side,
} from './types';

function boardOf(rows: readonly string[]): Board {
  const cells: Piece[] = [];
  for (const row of rows) {
    for (const character of row) {
      cells.push(
        character === 'p'
          ? PLAYER_MAN
          : character === 'P'
            ? PLAYER_KING
            : character === 'c'
              ? CPU_MAN
              : character === 'C'
                ? (4 as Piece)
                : EMPTY,
      );
    }
  }
  for (let cell = 0; cell < cells.length; cell++) {
    if (cells[cell] !== EMPTY && !isDarkSquare(cell)) {
      throw new Error(`fixture puts a piece on the light square ${cell}`);
    }
  }
  return cells;
}

/**
 * A session sitting on a hand-made position. Takes either a board or the
 * eight rows to build one from, so a fixture reads as the picture it is.
 */
function sessionOn(
  position: Board | readonly string[],
  overrides: Partial<{ moveCount: number; quietPlies: number; first: Side }> = {},
): CheckersSession {
  const board =
    typeof position[0] === 'string' ? boardOf(position as readonly string[]) : (position as Board);
  const first = overrides.first ?? PLAYER;
  return restoreSession({
    seed: 'test-seed',
    difficulty: 'normal',
    first,
    board,
    pendingJumpFrom: null,
    moveCount: overrides.moveCount ?? 0,
    quietPlies: overrides.quietPlies ?? 0,
    elapsedSeconds: 0,
  });
}

describe('a new match', () => {
  it('opens on the side the player chose, with nothing to undo', () => {
    const mine = createSession('normal', PLAYER, 'seed');
    expect(mine.toMove).toBe(PLAYER);
    expect(mine.status).toBe('playing');
    expect(mine.moveCount).toBe(0);
    expect(canUndo(mine)).toBe(false);

    const theirs = createSession('normal', CPU, 'seed');
    expect(theirs.toMove).toBe(CPU);
  });

  it('gets a seed of its own', () => {
    const a = matchSeed(newSeedToken(1, () => 0.1));
    const b = matchSeed(newSeedToken(2, () => 0.9));
    expect(a).not.toBe(b);
    expect(a.startsWith('checkers-')).toBe(true);
  });

  it('offers the seven opening moves', () => {
    expect(currentMoves(createSession('normal', PLAYER, 'seed'))).toHaveLength(7);
  });
});

describe('a player turn', () => {
  const opening = createSession('normal', PLAYER, 'seed');

  it('is refused when it is not the player to move', () => {
    const theirs = createSession('normal', CPU, 'seed');
    expect(applyPlayerStep(theirs, currentMoves(opening)[0]!)).toBeNull();
  });

  it('is refused when the move is not one the rules offer', () => {
    expect(
      applyPlayerStep(opening, { from: cellAt(5, 0), to: cellAt(3, 0), captured: -1 }),
    ).toBeNull();
  });

  it('ends the turn and hands over on a quiet move', () => {
    const outcome = applyPlayerStep(opening, currentMoves(opening)[0]!)!;
    expect(outcome.turnComplete).toBe(true);
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.toMove).toBe(CPU);
    expect(outcome.session.pendingJumpFrom).toBeNull();
    expect(canUndo(outcome.session)).toBe(true);
  });
});

describe('the capture obligation, through the session', () => {
  const forced = sessionOn([
    '........',
    '........',
    '........',
    '........',
    '...c....',
    '..p...p.',
    '........',
    '........',
  ]);

  it('offers only the jump', () => {
    const moves = currentMoves(forced);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.captured).toBe(cellAt(4, 3));
  });

  it('refuses the quiet move that the rules have taken away', () => {
    expect(
      applyPlayerStep(forced, { from: cellAt(5, 6), to: cellAt(4, 5), captured: -1 }),
    ).toBeNull();
  });
});

describe('a capture sequence', () => {
  const double = sessionOn([
    '........',
    '........',
    '.....c..',
    '........',
    '...c....',
    '..p.....',
    '........',
    '........',
  ]);

  it('keeps the turn open between the jumps', () => {
    const first = applyPlayerStep(double, currentMoves(double)[0]!)!;
    expect(first.turnComplete).toBe(false);
    expect(first.session.moveCount).toBe(0);
    expect(first.session.toMove).toBe(PLAYER);
    expect(first.session.pendingJumpFrom).toBe(cellAt(3, 4));
  });

  it('narrows the offer to the piece that must go on', () => {
    const first = applyPlayerStep(double, currentMoves(double)[0]!)!;
    const next = currentMoves(first.session);
    expect(next).toHaveLength(1);
    expect(next[0]!.from).toBe(cellAt(3, 4));
  });

  it('counts the whole sequence as one turn', () => {
    const first = applyPlayerStep(double, currentMoves(double)[0]!)!;
    const second = applyPlayerStep(first.session, currentMoves(first.session)[0]!)!;
    expect(second.turnComplete).toBe(true);
    expect(second.session.moveCount).toBe(1);
    expect(second.session.toMove).toBe(CPU);
    expect(second.session.pendingJumpFrom).toBeNull();
  });

  it('records one decision point, not one per jump', () => {
    const first = applyPlayerStep(double, currentMoves(double)[0]!)!;
    const second = applyPlayerStep(first.session, currentMoves(first.session)[0]!)!;
    expect(second.session.history).toHaveLength(1);
  });
});

describe('undo', () => {
  it('takes a half-played sequence back to before it started', () => {
    const double = sessionOn([
      '........',
      '........',
      '.....c..',
      '........',
      '...c....',
      '..p.....',
      '........',
      '........',
    ]);
    const first = applyPlayerStep(double, currentMoves(double)[0]!)!;
    const back = undo(first.session)!;
    expect(back.board).toEqual(double.board);
    expect(back.pendingJumpFrom).toBeNull();
    expect(back.toMove).toBe(PLAYER);
    expect(back.moveCount).toBe(0);
  });

  it('takes the CPU reply back with the player turn that drew it', () => {
    const opening = createSession('normal', PLAYER, 'seed');
    const played = applyPlayerStep(opening, currentMoves(opening)[0]!)!.session;
    const answered = applyCpuTurn(played)!.session;
    expect(answered.moveCount).toBe(2);

    const back = undo(answered)!;
    expect(back.board).toEqual(opening.board);
    expect(back.moveCount).toBe(0);
    expect(back.toMove).toBe(PLAYER);
  });

  it('is a take-back, not a reroll: the same turn draws the same reply', () => {
    const opening = createSession('hard', PLAYER, 'seed');
    const move = currentMoves(opening)[2]!;

    const first = applyCpuTurn(applyPlayerStep(opening, move)!.session)!;
    const again = applyCpuTurn(applyPlayerStep(undo(first.session)!, move)!.session)!;
    expect(again.steps).toEqual(first.steps);
  });

  it('has nothing to take back at the start', () => {
    expect(undo(createSession('normal', PLAYER, 'seed'))).toBeNull();
  });
});

describe('how a match ends', () => {
  it('is won when the last of the CPU pieces is taken', () => {
    const lastOne = sessionOn([
      '........',
      '........',
      '........',
      '........',
      '...c....',
      '..p.....',
      '........',
      '........',
    ]);
    const outcome = applyPlayerStep(lastOne, currentMoves(lastOne)[0]!)!;
    expect(outcome.session.status).toBe('won');
    expect(countPieces(outcome.session.board).cpu).toBe(0);
  });

  it('is lost when the player has no move left, pieces or not', () => {
    const shutIn = sessionOn([
      '........',
      '........',
      '........',
      '........',
      '........',
      '....c...',
      '.....c.c',
      '......p.',
    ]);
    expect(shutIn.status).toBe('lost');
  });

  it('is a draw once the kings have shuffled long enough', () => {
    const shuffling = sessionOn(
      [
        '........',
        '........',
        '........',
        '..C.....',
        '........',
        '..P.....',
        '........',
        '........',
      ],
      { quietPlies: DRAW_QUIET_PLIES - 1 },
    );
    const quiet = currentMoves(shuffling).find((move) => move.captured === -1)!;
    const outcome = applyPlayerStep(shuffling, quiet)!;
    expect(outcome.session.quietPlies).toBe(DRAW_QUIET_PLIES);
    expect(outcome.session.status).toBe('draw');
  });

  it('resets the quiet counter on a man move', () => {
    const withMan = sessionOn(
      [
        '........',
        '........',
        '........',
        '........',
        '........',
        '..p.....',
        '........',
        '....C...',
      ],
      { quietPlies: 20 },
    );
    const outcome = applyPlayerStep(withMan, currentMoves(withMan)[0]!)!;
    expect(outcome.session.quietPlies).toBe(0);
  });

  it('resets the quiet counter on a capture', () => {
    const capture = sessionOn(
      [
        '........',
        '........',
        '........',
        '........',
        '...c....',
        '..P.....',
        '........',
        '........',
      ],
      { quietPlies: 30 },
    );
    const outcome = applyPlayerStep(capture, currentMoves(capture)[0]!)!;
    expect(outcome.session.quietPlies).toBe(0);
  });
});

describe('restoring a saved position', () => {
  it('derives the turn from the completed-turn count and the opener', () => {
    const board = initialBoard();
    expect(sessionOn(board, { moveCount: 4, first: PLAYER }).toMove).toBe(PLAYER);
    expect(sessionOn(board, { moveCount: 5, first: PLAYER }).toMove).toBe(CPU);
    expect(sessionOn(board, { moveCount: 4, first: CPU }).toMove).toBe(CPU);
  });

  it('comes back with no undo history — the moves that led here are gone', () => {
    expect(sessionOn(initialBoard(), { moveCount: 6 }).history).toEqual([]);
  });

  it('reads a finished position as finished rather than resuming it', () => {
    const shutIn = sessionOn([
      '........',
      '........',
      '........',
      '........',
      '........',
      '....c...',
      '.....c.c',
      '......p.',
    ]);
    expect(shutIn.status).not.toBe('playing');
  });
});

describe('the CPU turn, through the session', () => {
  it('is refused when it is not the CPU to move', () => {
    expect(applyCpuTurn(createSession('normal', PLAYER, 'seed'))).toBeNull();
  });

  it('plays out as steps the screen can draw one at a time', () => {
    const opening = createSession('normal', CPU, 'seed');
    const outcome = applyCpuTurn(opening)!;
    expect(outcome.steps.length).toBeGreaterThanOrEqual(1);
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.toMove).toBe(PLAYER);
  });
});
