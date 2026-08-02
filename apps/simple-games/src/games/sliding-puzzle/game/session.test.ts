/**
 * The session rules of docs/SLIDING_PUZZLE_RULES.md §3, §4, §6, §7, §8, §10 —
 * including the ones the brand insists on: unlimited free undo, no game over,
 * no clock during play, and no streak anywhere.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DEPTH, DAILY_SIZE, dayDifference, localDateString } from './daily';
import { blankIndex, isSolved, neighborsOfBlank, tilesToMove } from './engine';
import { clampLevel, levelSeed, MAX_LEVEL, shuffleDepthForLevel, sizeForLevel } from './levels';
import { decodeTiles, encodeTiles } from './serialize';
import {
  canUndo,
  createDailySession,
  createLevelSession,
  moveTile,
  restartSession,
  restoreSession,
  undo,
  type SlidingPuzzleSession,
} from './session';
import { solvedTiles, type Tiles } from './types';

/** Any legal single-tile move on the session's board. */
const someMove = (session: SlidingPuzzleSession): number =>
  neighborsOfBlank(session.tiles, session.size)[0]!;

/** A tap that moves more than one tile, or null when the board offers none. */
function multiTileMove(session: SlidingPuzzleSession): number | null {
  for (let index = 0; index < session.tiles.length; index++) {
    const moving = tilesToMove(session.tiles, session.size, index);
    if (moving !== null && moving.length > 1) return index;
  }
  return null;
}

describe('createLevelSession (§6)', () => {
  it('builds a playable session with the level’s size, depth and seed', () => {
    const session = createLevelSession(1);
    expect(session.mode).toBe('level');
    expect(session.level).toBe(1);
    expect(session.dailyDate).toBeNull();
    expect(session.seed).toBe(levelSeed(1));
    expect(session.size).toBe(sizeForLevel(1));
    expect(session.tiles).toHaveLength(session.size * session.size);
    expect(session.status).toBe('playing');
    expect(session.moveCount).toBe(0);
    expect(session.elapsedSeconds).toBe(0);
    expect(session.history).toEqual([]);
  });

  it('clamps out-of-range levels instead of failing', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(5000)).toBe(MAX_LEVEL);
    expect(createLevelSession(-5).seed).toBe(levelSeed(1));
    expect(createLevelSession(5000).seed).toBe(levelSeed(MAX_LEVEL));
  });

  it('restart rebuilds the identical puzzle', () => {
    const session = createLevelSession(7);
    const played = moveTile(session, someMove(session))!;
    const restarted = restartSession(played);
    expect(restarted.tiles).toEqual(session.tiles);
    expect(restarted.moveCount).toBe(0);
    expect(restarted.history).toEqual([]);
    expect(restarted.level).toBe(7);
  });

  it('gives a big level a bigger board and a deeper shuffle', () => {
    expect(createLevelSession(1).size).toBe(3);
    expect(createLevelSession(50).size).toBe(4);
    expect(createLevelSession(90).size).toBe(5);
    expect(shuffleDepthForLevel(90)).toBeGreaterThan(shuffleDepthForLevel(1));
  });
});

describe('createDailySession (§7)', () => {
  it('is a 4x4 at a fixed depth every day, and carries the date', () => {
    const monday = createDailySession('2026-08-03');
    const saturday = createDailySession('2026-08-08');
    expect(monday.size).toBe(DAILY_SIZE);
    expect(saturday.size).toBe(DAILY_SIZE);
    expect(DAILY_DEPTH).toBe(200);
    expect(monday.dailyDate).toBe('2026-08-03');
    expect(monday.level).toBeNull();
  });

  it('gives different days different boards', () => {
    expect(createDailySession('2026-08-03').tiles).not.toEqual(
      createDailySession('2026-08-04').tiles,
    );
  });

  it('restart rebuilds the same day', () => {
    const session = createDailySession('2026-08-03');
    const restarted = restartSession(moveTile(session, someMove(session))!);
    expect(restarted.tiles).toEqual(session.tiles);
    expect(restarted.dailyDate).toBe('2026-08-03');
  });
});

describe('moving tiles (§3)', () => {
  it('counts a single-tile slide as one move', () => {
    const session = createLevelSession(1);
    const next = moveTile(session, someMove(session))!;
    expect(next.moveCount).toBe(1);
    expect(next.tiles).not.toEqual(session.tiles);
    expect(next.history).toHaveLength(1);
  });

  it('counts a multi-tile slide by the tiles that moved', () => {
    const session = createLevelSession(1);
    const index = multiTileMove(session);
    expect(index).not.toBeNull();
    const width = tilesToMove(session.tiles, session.size, index!)!.length;
    const next = moveTile(session, index!)!;
    expect(width).toBeGreaterThan(1);
    expect(next.moveCount).toBe(width);
  });

  it('does nothing at all for an illegal tap', () => {
    const session = createLevelSession(1);
    // The blank itself, and anything off the board.
    expect(moveTile(session, blankIndex(session.tiles))).toBeNull();
    expect(moveTile(session, -1)).toBeNull();
    expect(moveTile(session, 99)).toBeNull();
  });

  it('reaches solved on the last slide and then accepts nothing (§2)', () => {
    // One tap from finished: the tile beside the gap goes home.
    const nearly: Tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8];
    const session: SlidingPuzzleSession = {
      ...createLevelSession(1),
      tiles: nearly,
      status: 'playing',
    };
    const solved = moveTile(session, 8)!;
    expect(solved.status).toBe('solved');
    expect(isSolved(solved.tiles, 3)).toBe(true);
    expect(solved.tiles).toEqual(solvedTiles(3));
    expect(moveTile(solved, 7)).toBeNull();
  });
});

describe('undo (§8)', () => {
  it('restores the board and the move count together', () => {
    const session = createLevelSession(1);
    expect(canUndo(session)).toBe(false);
    const moved = moveTile(session, someMove(session))!;
    expect(canUndo(moved)).toBe(true);

    const undone = undo(moved)!;
    expect(undone.tiles).toEqual(session.tiles);
    expect(undone.moveCount).toBe(0);
    expect(canUndo(undone)).toBe(false);
    expect(undo(undone)).toBeNull();
  });

  it('takes a multi-tile slide back whole', () => {
    const session = createLevelSession(1);
    const index = multiTileMove(session)!;
    const moved = moveTile(session, index)!;
    expect(moved.moveCount).toBeGreaterThan(1);

    const undone = undo(moved)!;
    expect(undone.tiles).toEqual(session.tiles);
    expect(undone.moveCount).toBe(0);
  });

  it('is unlimited: a long game unwinds to the start', () => {
    let session = createLevelSession(1);
    const start = session.tiles;
    for (let i = 0; i < 40; i++) {
      const next = moveTile(session, someMove(session));
      if (next) session = next;
    }
    expect(session.moveCount).toBeGreaterThan(0);
    while (canUndo(session)) session = undo(session)!;
    expect(session.tiles).toEqual(start);
    expect(session.moveCount).toBe(0);
  });
});

describe('daily dates (§7)', () => {
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
});

describe('serialization (§10)', () => {
  it('round-trips a played board at every size', () => {
    for (const level of [1, 200, 900]) {
      let session = createLevelSession(level);
      session = moveTile(session, someMove(session))!;
      const decoded = decodeTiles(encodeTiles(session.tiles), session.size);
      expect(decoded, `level ${level}`).toEqual(session.tiles);
    }
  });

  it('restores a session without its undo history', () => {
    let session = createLevelSession(5);
    session = moveTile(session, someMove(session))!;
    expect(session.history).toHaveLength(1);

    const { history: _history, status: _status, ...persisted } = session;
    const restored = restoreSession(persisted);
    expect(restored.history).toEqual([]);
    expect(restored.status).toBe('playing');
    expect(restored.tiles).toEqual(session.tiles);
    expect(restored.moveCount).toBe(session.moveCount);
  });

  it('fails closed on corrupt data instead of loading a broken board', () => {
    const good = encodeTiles(createLevelSession(1).tiles);
    // Wrong length for the size it claims.
    expect(decodeTiles(good, 4)).toBeNull();
    expect(decodeTiles('', 3)).toBeNull();
    // A character that is not a base-36 digit.
    expect(decodeTiles('12345678?', 3)).toBeNull();
    // Not a permutation: a repeated tile, and a value off the board.
    expect(decodeTiles('112345678', 3)).toBeNull();
    expect(decodeTiles('12345678a', 3)).toBeNull();
    // A permutation that no amount of sliding could ever produce (§5).
    expect(decodeTiles(encodeTiles([2, 1, 3, 4, 5, 6, 7, 8, 0]), 3)).toBeNull();
  });
});
