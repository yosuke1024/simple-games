/**
 * The match as a whole (docs/GOMOKU_RULES.md §3, §5, §8): what a stone does
 * to it, what Undo takes back, and what a saved position comes back as.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  cpuColorOf,
  createSession,
  matchSeed,
  newSeedToken,
  restoreSession,
  undo,
} from './session';
import {
  BLACK,
  WHITE,
  cellAt,
  countStones,
  emptyBoard,
  type Board,
  type Piece,
  type Player,
} from './types';

/** A board with the given stones down. */
function boardOf(
  black: readonly (readonly [number, number])[],
  white: readonly (readonly [number, number])[] = [],
): Board {
  const cells = emptyBoard().slice() as Piece[];
  for (const [row, col] of black) cells[cellAt(row, col)] = BLACK;
  for (const [row, col] of white) cells[cellAt(row, col)] = WHITE;
  return cells;
}

const sessionOn = (board: Board, playerColor: Player = BLACK) =>
  restoreSession({
    seed: 'gomoku-test',
    difficulty: 'normal',
    playerColor,
    board,
    moveCount: countStones(board).black + countStones(board).white,
    elapsedSeconds: 0,
  });

describe('a new match', () => {
  it('opens black, whoever the player is', () => {
    expect(createSession('normal', BLACK, 'seed').toMove).toBe(BLACK);
    expect(createSession('normal', WHITE, 'seed').toMove).toBe(BLACK);
  });

  it('gives the CPU the other colour', () => {
    expect(cpuColorOf(createSession('normal', BLACK, 'seed'))).toBe(WHITE);
    expect(cpuColorOf(createSession('normal', WHITE, 'seed'))).toBe(BLACK);
  });

  it('starts empty, with nothing to undo', () => {
    const session = createSession('normal', BLACK, 'seed');
    expect(countStones(session.board).empty).toBe(225);
    expect(session.moveCount).toBe(0);
    expect(canUndo(session)).toBe(false);
  });

  it('gets a seed of its own', () => {
    const a = matchSeed(newSeedToken(1, () => 0.1));
    const b = matchSeed(newSeedToken(2, () => 0.9));
    expect(a).not.toBe(b);
    expect(a.startsWith('gomoku-')).toBe(true);
  });
});

describe('playing a stone', () => {
  const opening = createSession('normal', BLACK, 'seed');

  it('is refused when it is not the player to move', () => {
    const asWhite = createSession('normal', WHITE, 'seed');
    expect(applyPlayerMove(asWhite, cellAt(7, 7))).toBeNull();
  });

  it('is refused on an intersection that is taken', () => {
    const played = applyPlayerMove(opening, cellAt(7, 7))!.session;
    const answered = applyCpuMove(played)!.session;
    expect(applyPlayerMove(answered, cellAt(7, 7))).toBeNull();
  });

  it('hands the turn over and records a decision point', () => {
    const outcome = applyPlayerMove(opening, cellAt(7, 7))!;
    expect(outcome.placed).toBe(cellAt(7, 7));
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.toMove).toBe(WHITE);
    expect(canUndo(outcome.session)).toBe(true);
  });
});

describe('how a match ends', () => {
  it('is won when the player completes five', () => {
    // Four black, four white, black to move — a real position, not a
    // contrived one, so the turn falls out of the counts.
    const balanced = restoreSession({
      seed: 'gomoku-win',
      difficulty: 'normal',
      playerColor: BLACK,
      board: boardOf(
        [
          [7, 3],
          [7, 4],
          [7, 5],
          [7, 6],
        ],
        [
          [9, 3],
          [9, 4],
          [9, 5],
          [10, 6],
        ],
      ),
      moveCount: 8,
      elapsedSeconds: 0,
    });
    expect(balanced.status).toBe('playing');
    const outcome = applyPlayerMove(balanced, cellAt(7, 7))!;
    expect(outcome.session.status).toBe('won');
    expect(outcome.session.winningLine).toHaveLength(5);
  });

  it('is lost when the CPU completes five', () => {
    // The player holds white; black is the CPU and has an open four.
    const session = restoreSession({
      seed: 'gomoku-lose',
      difficulty: 'normal',
      playerColor: WHITE,
      board: boardOf(
        [
          [7, 3],
          [7, 4],
          [7, 5],
          [7, 6],
        ],
        [
          [9, 3],
          [9, 4],
          [9, 5],
          [10, 6],
        ],
      ),
      moveCount: 8,
      elapsedSeconds: 0,
    });
    expect(session.toMove).toBe(BLACK);
    const outcome = applyCpuMove(session)!;
    expect(outcome.session.status).toBe('lost');
  });

  it('reads a finished position as finished rather than resuming it', () => {
    const done = sessionOn(
      boardOf(
        [
          [7, 3],
          [7, 4],
          [7, 5],
          [7, 6],
          [7, 7],
        ],
        [
          [9, 3],
          [9, 4],
          [9, 5],
          [9, 6],
          [10, 6],
        ],
      ),
      BLACK,
    );
    expect(done.status).not.toBe('playing');
    expect(done.winningLine).not.toBeNull();
  });
});

describe('undo', () => {
  it('takes the CPU reply back with the stone that drew it', () => {
    const opening = createSession('normal', BLACK, 'seed');
    const played = applyPlayerMove(opening, cellAt(7, 7))!.session;
    const answered = applyCpuMove(played)!.session;
    expect(answered.moveCount).toBe(2);

    const back = undo(answered)!;
    expect(back.board).toEqual(opening.board);
    expect(back.moveCount).toBe(0);
    expect(back.toMove).toBe(BLACK);
  });

  it('is a take-back, not a reroll: the same stone draws the same reply', () => {
    const opening = createSession('hard', BLACK, 'seed');
    const first = applyCpuMove(applyPlayerMove(opening, cellAt(7, 7))!.session)!;
    const again = applyCpuMove(applyPlayerMove(undo(first.session)!, cellAt(7, 7))!.session)!;
    expect(again.placed).toBe(first.placed);
  });

  it('has nothing to take back at the start', () => {
    expect(undo(createSession('normal', BLACK, 'seed'))).toBeNull();
  });
});

describe('restoring a saved position', () => {
  it('derives the turn from the stones — black opens and nobody passes', () => {
    expect(sessionOn(emptyBoard()).toMove).toBe(BLACK);
    expect(sessionOn(boardOf([[7, 7]])).toMove).toBe(WHITE);
    expect(sessionOn(boardOf([[7, 7]], [[7, 8]])).toMove).toBe(BLACK);
  });

  it('comes back with no undo history — the moves that led here are gone', () => {
    expect(sessionOn(boardOf([[7, 7]])).history).toEqual([]);
  });

  it('keeps the colour the player holds', () => {
    expect(sessionOn(emptyBoard(), WHITE).playerColor).toBe(WHITE);
    expect(cpuColorOf(sessionOn(emptyBoard(), WHITE))).toBe(BLACK);
  });
});

describe('the CPU turn, through the session', () => {
  it('is refused when it is not the CPU to move', () => {
    expect(applyCpuMove(createSession('normal', BLACK, 'seed'))).toBeNull();
  });

  it('opens in the centre when the player takes white', () => {
    const outcome = applyCpuMove(createSession('normal', WHITE, 'seed'))!;
    expect(outcome.placed).toBe(cellAt(7, 7));
    expect(outcome.session.toMove).toBe(WHITE);
  });
});
