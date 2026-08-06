/**
 * The session rules of docs/GAME_2048_RULES.md §2, §3, §5, §6 and §10 —
 * including the ones the brand insists on: unlimited free undo that does not
 * reroll, one announcement rather than an ending at 2048, and a save that
 * carries the position without the moves that led to it.
 */
import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard } from './serialize';
import {
  applyMove,
  canUndo,
  createSession,
  restoreSession,
  undo,
  UNDO_HISTORY_LIMIT,
  type Game2048Session,
  type HistoryEntry,
} from './session';
import { DIRECTIONS, TARGET_TILE, type Board } from './types';

const board = (...rows: readonly number[][]): Board => ([] as number[]).concat(...rows);
const ZERO = [0, 0, 0, 0];

/** A session sitting on a board of the test's choosing. */
const sittingOn = (position: Board, seed = 'fixture'): Game2048Session => ({
  ...createSession(seed),
  board: position,
});

/**
 * One square from the end. Sliding left packs the bottom row and leaves the
 * board full except that last square — and whether the new tile is a 2 or a 4,
 * neither of its neighbours can join it (§2).
 */
const LAST_SQUARE = board([2, 4, 2, 4], [4, 2, 4, 8], [2, 4, 2, 16], [0, 4, 2, 8]);

describe('a fresh board (§5)', () => {
  it('starts with exactly two tiles and nothing counted yet', () => {
    const session = createSession('fresh');
    expect(session.board.filter((value) => value !== 0)).toHaveLength(2);
    expect(session.board).toHaveLength(16);
    expect(session.score).toBe(0);
    expect(session.spawnIndex).toBe(2);
    expect(session.moveCount).toBe(0);
    expect(session.elapsedSeconds).toBe(0);
    expect(session.reached2048).toBe(false);
    expect(session.status).toBe('playing');
    expect(session.history).toEqual([]);
  });

  it('gives the same seed the same two tiles, and other seeds other ones', () => {
    expect(createSession('fresh').board).toEqual(createSession('fresh').board);
    expect(createSession('fresh').board).not.toEqual(createSession('elsewhere').board);
  });
});

describe('making a move (§3, §4)', () => {
  it('slides, scores, spawns and counts the move', () => {
    const session = sittingOn(board([2, 2, 0, 0], ZERO, ZERO, ZERO));
    const outcome = applyMove(session, 'left')!;
    expect(outcome.merged).toBe(true);
    expect(outcome.session.score).toBe(4);
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.spawnIndex).toBe(session.spawnIndex + 1);
    // The 4 that was made, plus the one tile the move put down.
    expect(outcome.session.board.filter((value) => value !== 0)).toHaveLength(2);
    expect(outcome.session.board[0]).toBe(4);
    expect(outcome.session.history).toHaveLength(1);
  });

  it('returns null for a direction that changes nothing', () => {
    // A single tile already in the top-left corner cannot go left or up.
    const session = sittingOn(board([2, 0, 0, 0], ZERO, ZERO, ZERO));
    expect(applyMove(session, 'left')).toBeNull();
    expect(applyMove(session, 'up')).toBeNull();
    expect(applyMove(session, 'right')).not.toBeNull();
  });

  it('says nothing merged when the move only slid', () => {
    const session = sittingOn(board([0, 0, 0, 2], ZERO, ZERO, ZERO));
    const outcome = applyMove(session, 'left')!;
    expect(outcome.merged).toBe(false);
    expect(outcome.session.score).toBe(0);
  });

  it('ends the game when the last move fills the board (§2)', () => {
    const outcome = applyMove(sittingOn(LAST_SQUARE, 'ending'), 'left')!;
    expect(outcome.session.board).not.toContain(0);
    expect(outcome.session.status).toBe('over');
    // A finished board accepts nothing at all; the way on is a new one (§8).
    expect(applyMove(outcome.session, 'right')).toBeNull();
  });
});

describe('reaching 2048 (§2)', () => {
  it('announces once, and the game carries on', () => {
    const session = sittingOn(board([1024, 1024, 0, 0], ZERO, ZERO, ZERO), 'reach');
    const first = applyMove(session, 'left')!;
    expect(first.justReached).toBe(true);
    expect(first.session.reached2048).toBe(true);
    expect(first.session.board).toContain(TARGET_TILE);
    // Not an ending: the board is still playing, and the next move says
    // nothing about a target that has already been passed.
    expect(first.session.status).toBe('playing');
    const second = applyMove(first.session, 'down')!;
    expect(second.justReached).toBe(false);
    expect(second.session.reached2048).toBe(true);
  });
});

describe('undo (§6)', () => {
  it('restores the board, the score and the spawn count together', () => {
    const session = sittingOn(board([2, 2, 0, 0], ZERO, ZERO, ZERO), 'undo');
    expect(canUndo(session)).toBe(false);

    const moved = applyMove(session, 'left')!.session;
    expect(canUndo(moved)).toBe(true);

    const undone = undo(moved)!;
    expect(undone.board).toEqual(session.board);
    expect(undone.score).toBe(0);
    expect(undone.spawnIndex).toBe(session.spawnIndex);
    expect(undone.moveCount).toBe(0);
    expect(canUndo(undone)).toBe(false);
    expect(undo(undone)).toBeNull();
  });

  it('does not reroll: the same move again brings back the same tile', () => {
    // The whole reason the draw is seeded (§5). An undo that reshuffles the
    // board is a slot machine, not help.
    const session = sittingOn(board([2, 2, 0, 0], ZERO, ZERO, ZERO), 'noreroll');
    const first = applyMove(session, 'left')!.session;
    const again = applyMove(undo(first)!, 'left')!.session;
    expect(again.board).toEqual(first.board);
    expect(again.score).toBe(first.score);
    expect(again.spawnIndex).toBe(first.spawnIndex);
  });

  it('is unlimited in practice, and the history stays bounded', () => {
    const session = sittingOn(board([2, 2, 0, 0], ZERO, ZERO, ZERO), 'cap');
    const filler: HistoryEntry[] = [];
    for (let index = 0; index < UNDO_HISTORY_LIMIT; index++) {
      filler.push({ board: session.board, score: index, spawnIndex: 2, moveCount: index });
    }

    const next = applyMove({ ...session, history: filler }, 'left')!.session;
    expect(next.history).toHaveLength(UNDO_HISTORY_LIMIT);
    // The oldest step fell off the front rather than the newest never arriving.
    expect(next.history[0]!.score).toBe(1);
    expect(next.history[UNDO_HISTORY_LIMIT - 1]!.moveCount).toBe(session.moveCount);
  });

  it('brings a finished board back to life', () => {
    const over = applyMove(sittingOn(LAST_SQUARE, 'revive'), 'left')!.session;
    expect(over.status).toBe('over');
    expect(undo(over)!.status).toBe('playing');
  });
});

describe('suspend and resume (§10)', () => {
  it('round-trips a played board through the serializer', () => {
    const start = createSession('resume');
    const played = DIRECTIONS.map((direction) => applyMove(start, direction)).find(
      (outcome) => outcome !== null,
    )!;
    expect(decodeBoard(encodeBoard(played.session.board))).toEqual(played.session.board);
  });

  it('restores a session without its undo history', () => {
    const session = applyMove(
      sittingOn(board([2, 2, 0, 0], ZERO, ZERO, ZERO), 'save'),
      'left',
    )!.session;
    expect(session.history).toHaveLength(1);

    const { history: _history, status: _status, ...persisted } = session;
    const restored = restoreSession(persisted);
    expect(restored.history).toEqual([]);
    expect(restored.status).toBe('playing');
    expect(restored.board).toEqual(session.board);
    expect(restored.score).toBe(session.score);
    expect(restored.spawnIndex).toBe(session.spawnIndex);
    expect(canUndo(restored)).toBe(false);
  });

  it('fails closed on corrupt data instead of loading a broken board', () => {
    const good = encodeBoard(createSession('corrupt').board);
    expect(decodeBoard(good)).not.toBeNull();
    // Wrong length, a digit past the range, and a character that is not one.
    expect(decodeBoard(good.slice(1))).toBeNull();
    expect(decodeBoard(`${good.slice(0, 15)}?`)).toBeNull();
    // A board with nothing on it never came from play: every game deals two.
    expect(decodeBoard('0000000000000000')).toBeNull();
  });
});
