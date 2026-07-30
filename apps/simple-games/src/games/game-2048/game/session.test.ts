/**
 * The play rules of docs/GAME_2048_RULES.md §2, §5, §6 and §7 — including the
 * ones the brand insists on: undo that is unlimited and free, a daily every
 * player meets on the same terms, and a save that fails closed rather than
 * loading a board nobody played.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, dayDifference, localDateString } from './daily';
import { maxTile } from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import {
  acknowledgeWin,
  canUndo,
  createClassicSession,
  createDailySession,
  move,
  OPENING_TILES,
  restartSession,
  restoreSession,
  undoMove,
  type Game2048Session,
} from './session';
import { CELLS, SIZE, type Board, type Direction } from './types';

const boardOf = (...rows: readonly (readonly number[])[]): Board => rows.flat();

const tileCount = (board: Board): number => board.filter((value) => value !== 0).length;

/** A session on a board of our choosing — the only way to reach a rare state. */
const withBoard = (session: Game2048Session, board: Board): Game2048Session => ({
  ...session,
  board,
});

const play = (session: Game2048Session, directions: readonly Direction[]): Game2048Session => {
  let current = session;
  for (const direction of directions) {
    const outcome = move(current, direction);
    if (outcome) current = outcome.session;
  }
  return current;
};

describe('a new game (§7)', () => {
  it('opens on two tiles, no score, and a clean history', () => {
    const session = createClassicSession('opening');
    expect(tileCount(session.board)).toBe(OPENING_TILES);
    expect(session.board).toHaveLength(CELLS);
    for (const value of session.board) expect([0, 2, 4]).toContain(value);
    expect(session.score).toBe(0);
    expect(session.moveCount).toBe(0);
    expect(session.spawnCount).toBe(OPENING_TILES);
    expect(session.status).toBe('playing');
    expect(session.won).toBe(false);
    expect(session.history).toEqual([]);
    expect(session.elapsedSeconds).toBe(0);
  });

  it('gives classic a seed of its own and no date', () => {
    const session = createClassicSession();
    expect(session.mode).toBe('classic');
    expect(session.dailyDate).toBeNull();
    expect(session.seed.length).toBeGreaterThan(0);
    // Two classic games are two different games (§6).
    expect(createClassicSession().seed).not.toBe(session.seed);
  });

  it('gives every player of a day the same board and the same tile stream (§6)', () => {
    const mine = createDailySession('2026-08-03');
    const yours = createDailySession('2026-08-03');
    expect(mine.seed).toBe(dailySeed('2026-08-03'));
    expect(yours.board).toEqual(mine.board);
    expect(mine.dailyDate).toBe('2026-08-03');
    expect(mine.mode).toBe('daily');

    const moves: Direction[] = ['left', 'up', 'right', 'down', 'left', 'up'];
    expect(play(yours, moves).board).toEqual(play(mine, moves).board);

    // A different day is a different game.
    expect(createDailySession('2026-08-04').board).not.toEqual(mine.board);
  });
});

describe('restart (§6)', () => {
  it('rebuilds the very same daily', () => {
    const session = play(createDailySession('2026-08-03'), ['left', 'up', 'left']);
    const restarted = restartSession(session);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.dailyDate).toBe('2026-08-03');
    expect(restarted.board).toEqual(createDailySession('2026-08-03').board);
    expect(restarted.score).toBe(0);
    expect(restarted.history).toEqual([]);
  });

  it('starts classic over on a new seed, because a classic game has no board to rebuild', () => {
    const session = createClassicSession('first');
    const restarted = restartSession(session);
    expect(restarted.mode).toBe('classic');
    expect(restarted.seed).not.toBe(session.seed);
    expect(restarted.score).toBe(0);
    expect(restarted.status).toBe('playing');
  });
});

describe('moving (§2)', () => {
  it('adds one tile for a move that changed the board', () => {
    const session = withBoard(
      createClassicSession('moving'),
      boardOf([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    const outcome = move(session, 'left')!;
    expect(outcome.session.board[0]).toBe(4);
    expect(outcome.session.score).toBe(4);
    expect(outcome.session.moveCount).toBe(1);
    expect(outcome.session.spawnCount).toBe(session.spawnCount + 1);
    // The merged tile plus the new one.
    expect(tileCount(outcome.session.board)).toBe(2);
    expect(outcome.spawnIndex).not.toBeNull();
    expect(outcome.session.board[outcome.spawnIndex!]).not.toBe(0);
  });

  it('refuses a move that changes nothing, and charges no tile for it (§2.4)', () => {
    const session = withBoard(
      createClassicSession('no-op'),
      boardOf([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    expect(move(session, 'left')).toBeNull();
    // Nothing about the session moved on: no tile, no score, no draw.
    expect(session.spawnCount).toBe(OPENING_TILES);
    expect(tileCount(session.board)).toBe(4);

    // The same board, moved somewhere it can actually go, does spawn.
    expect(move(session, 'down')!.session.spawnCount).toBe(OPENING_TILES + 1);
  });

  it('ends the game when the board fills with nothing left to combine (§3)', () => {
    // Sliding left merges the last row's two 8s and leaves one square open.
    // Its neighbours are both 16, so neither a 2 nor a 4 can save the board.
    const session = withBoard(
      createClassicSession('ending'),
      boardOf([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 8, 16], [4, 2, 8, 8]),
    );
    const outcome = move(session, 'left')!;
    expect(outcome.session.score).toBe(16);
    expect(tileCount(outcome.session.board)).toBe(CELLS);
    expect(outcome.session.status).toBe('over');
    // A finished game takes no further move, in any direction.
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      expect(move(outcome.session, direction), direction).toBeNull();
    }
  });

  it('celebrates 2048 and keeps playing (§3)', () => {
    const session = withBoard(
      createClassicSession('winning'),
      boardOf([1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    const outcome = move(session, 'left')!;
    expect(outcome.session.won).toBe(true);
    expect(outcome.session.winAcknowledged).toBe(false);
    expect(outcome.session.status).toBe('playing');
    expect(outcome.session.score).toBe(2048);
    expect(maxTile(outcome.session.board)).toBe(2048);
    // The game accepts the next move like any other.
    expect(move(outcome.session, 'down')).not.toBeNull();

    const seen = acknowledgeWin(outcome.session);
    expect(seen.winAcknowledged).toBe(true);
    expect(acknowledgeWin(seen)).toBe(seen);
    // Still won after a further move — it is a fact, not a screen.
    expect(move(seen, 'down')!.session.won).toBe(true);
  });
});

describe('undo (§5)', () => {
  it('puts back the board and the score together', () => {
    const start = withBoard(
      createClassicSession('undo'),
      boardOf([2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    expect(canUndo(start)).toBe(false);
    expect(undoMove(start)).toBeNull();

    const played = move(start, 'left')!.session;
    expect(played.score).toBe(4);
    expect(canUndo(played)).toBe(true);

    const undone = undoMove(played)!;
    expect(undone.board).toEqual(start.board);
    expect(undone.score).toBe(0);
    expect(canUndo(undone)).toBe(false);
  });

  it('is unlimited: a whole run steps back to where it started', () => {
    const start = createDailySession('2026-08-03');
    const moves: Direction[] = ['left', 'up', 'right', 'down', 'left', 'up', 'right', 'down'];
    let session = play(start, moves);
    expect(session.history.length).toBeGreaterThan(0);

    while (canUndo(session)) session = undoMove(session)!;
    expect(session.board).toEqual(start.board);
    expect(session.score).toBe(0);
  });

  it('rewinds the tile stream, so replaying a move gives the same tile (§6)', () => {
    const start = createDailySession('2026-08-03');
    const first = move(start, 'left')!;
    const again = move(undoMove(first.session)!, 'left')!;
    expect(again.session.board).toEqual(first.session.board);
    expect(again.spawnIndex).toBe(first.spawnIndex);
  });

  it('does not take back the move count or the fact that 2048 was reached', () => {
    const session = withBoard(
      createClassicSession('counters'),
      boardOf([1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    );
    const won = move(session, 'left')!.session;
    const undone = undoMove(won)!;
    expect(undone.moveCount).toBe(1);
    expect(undone.won).toBe(true);
    // The board itself is back before the winning merge.
    expect(maxTile(undone.board)).toBe(1024);
  });
});

describe('suspend and resume (§6)', () => {
  it('round-trips a played board through storage', () => {
    const session = play(createDailySession('2026-08-03'), ['left', 'up', 'right']);
    expect(decodeBoard(encodeBoard(session.board))).toEqual(session.board);

    const big = boardOf([2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2048, 4096], [0, 0, 0, 0]);
    expect(decodeBoard(encodeBoard(big))).toEqual(big);
  });

  it('restores a session without its undo history', () => {
    const session = play(createDailySession('2026-08-03'), ['left', 'up']);
    expect(session.history.length).toBeGreaterThan(0);

    const { history: _history, status: _status, ...persisted } = session;
    const restored = restoreSession(persisted);
    expect(restored.history).toEqual([]);
    expect(restored.status).toBe('playing');
    expect(restored.board).toEqual(session.board);
    expect(restored.score).toBe(session.score);
    expect(canUndo(restored)).toBe(false);

    // And it carries on where it left off: same seed, same stream position.
    expect(move(restored, 'left')?.session.board).toEqual(move(session, 'left')?.session.board);
  });

  it('fails closed on corrupt data instead of loading a board nobody played', () => {
    const good = encodeBoard(createDailySession('2026-08-03').board);
    expect(decodeBoard(good)).not.toBeNull();
    expect(decodeBoard(good.slice(1))).toBeNull();
    expect(decodeBoard(`${good}0`)).toBeNull();
    expect(decodeBoard('')).toBeNull();
    // '-' is not a base-36 digit, and 'z' is 35 — far above the 4x4 ceiling.
    expect(decodeBoard('-'.repeat(CELLS))).toBeNull();
    expect(decodeBoard('z'.repeat(CELLS))).toBeNull();
    expect(decodeBoard(' '.repeat(CELLS))).toBeNull();
    // The largest tile a 4x4 board can hold still decodes; one past it does not.
    expect(decodeBoard(`h${'0'.repeat(CELLS - 1)}`)?.[0]).toBe(131072);
    expect(decodeBoard(`i${'0'.repeat(CELLS - 1)}`)).toBeNull();
  });
});

describe('daily dates (§6)', () => {
  it('formats and shifts local dates', () => {
    expect(localDateString(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts whole days between dates across month and DST boundaries', () => {
    expect(dayDifference('2026-08-03', '2026-08-04')).toBe(1);
    expect(dayDifference('2026-08-04', '2026-08-03')).toBe(-1);
    expect(dayDifference('2026-08-03', '2026-08-03')).toBe(0);
    expect(dayDifference('2026-03-28', '2026-03-30')).toBe(2);
    expect(dayDifference('2026-07-31', '2026-08-01')).toBe(1);
  });

  it('names the seed after the date and nothing else (§7)', () => {
    expect(dailySeed('2026-08-03')).toBe('2048-daily-2026-08-03');
  });
});

describe('the board shape', () => {
  it('is four by four, always', () => {
    expect(SIZE).toBe(4);
    expect(CELLS).toBe(16);
    expect(createClassicSession('shape').board).toHaveLength(CELLS);
  });
});
