/**
 * Session rules (docs/MAHJONG_SOLITAIRE_RULES.md §2, §7, §8): taking a pair
 * demands free + matching, undo pops exactly one removal and revives a stuck
 * board, and stuck is a derived fact the detector may never invent for a
 * live board.
 */
import { describe, expect, it } from 'vitest';
import { LAYOUTS } from './layouts';
import {
  countHintUse,
  createDailySession,
  createLevelSession,
  currentFreeTiles,
  findMatchingPair,
  isStuck,
  remainingCount,
  removedFlags,
  removePair,
  restartSession,
  undoRemoval,
  type MahjongSession,
} from './session';
import { generateBoard } from './generator';
import { levelParams } from './layouts';
import type { TileFace } from './types';

describe('creating sessions (§5, §6)', () => {
  it('level 1 is the 24-tile sprout, dealt the same way every time', () => {
    const a = createLevelSession(1);
    const b = createLevelSession(1);
    expect(a.layout.id).toBe('sprout');
    expect(a.faces).toEqual(b.faces);
    expect(a.status).toBe('playing');
    expect(remainingCount(a)).toBe(24);
  });

  it('the daily is always the 144-tile turtle', () => {
    const session = createDailySession('2026-08-08');
    expect(session.layout.id).toBe('turtle');
    expect(remainingCount(session)).toBe(144);
    expect(session.dailyDate).toBe('2026-08-08');
    expect(session.level).toBeNull();
  });

  it('a fresh deal is never stuck — the first construction pair is free (§5)', () => {
    for (const level of [1, 20, 50, 90, 100]) {
      expect(isStuck(createLevelSession(level))).toBe(false);
    }
    expect(isStuck(createDailySession('2026-08-08'))).toBe(false);
  });
});

describe('taking a pair (§2)', () => {
  it('removes a free matching pair and refuses everything else', () => {
    const session = createLevelSession(1);
    const pair = findMatchingPair(session);
    expect(pair).not.toBeNull();
    const [a, b] = pair!;
    const next = removePair(session, a, b);
    expect(next).not.toBeNull();
    expect(remainingCount(next!)).toBe(22);
    expect(removedFlags(next!)[a]).toBe(true);
    expect(removedFlags(next!)[b]).toBe(true);

    // The same pair again: already removed.
    expect(removePair(next!, a, b)).toBeNull();
    // A tile with itself.
    expect(removePair(session, a, a)).toBeNull();
    // Out of range.
    expect(removePair(session, a, 999)).toBeNull();
  });

  it('refuses a covered tile even when its face matches', () => {
    const session = createLevelSession(1);
    // In the sprout, the four raised tiles each pin the tile directly below.
    const covered = session.layout.tiles.findIndex((tile) => {
      if (tile.z !== 0) return false;
      return session.layout.tiles.some(
        (upper) =>
          upper.z === 1 && Math.abs(upper.x - tile.x) < 2 && Math.abs(upper.y - tile.y) < 2,
      );
    });
    expect(covered).toBeGreaterThanOrEqual(0);
    const partner = session.faces.findIndex(
      (face, index) => index !== covered && face === session.faces[covered],
    );
    expect(removePair(session, covered, partner)).toBeNull();
  });

  it('refuses two free tiles whose faces do not match', () => {
    const session = createLevelSession(1);
    const free = currentFreeTiles(session);
    const a = free[0]!;
    const b = free.find((i) => session.faces[i] !== session.faces[a!]);
    expect(b).toBeDefined();
    expect(removePair(session, a, b!)).toBeNull();
  });
});

describe('winning and undo (§2, §8)', () => {
  it('replaying the construction order wins; undo steps back out of the win', () => {
    const board = generateBoard(levelParams(1), 'mj-level-1');
    let session: MahjongSession = createLevelSession(1);
    for (let k = 0; k + 1 < board.solvedOrder.length; k += 2) {
      const next = removePair(session, board.solvedOrder[k]!, board.solvedOrder[k + 1]!);
      expect(next).not.toBeNull();
      session = next!;
    }
    expect(session.status).toBe('won');
    expect(remainingCount(session)).toBe(0);
    // No further moves on a finished board.
    expect(removePair(session, 0, 1)).toBeNull();

    const undone = undoRemoval(session);
    expect(undone).not.toBeNull();
    expect(undone!.status).toBe('playing');
    expect(remainingCount(undone!)).toBe(2);
  });

  it('undo pops exactly the last pair; an empty history has nothing to pop', () => {
    const session = createLevelSession(1);
    expect(undoRemoval(session)).toBeNull();
    const [a, b] = findMatchingPair(session)!;
    const next = removePair(session, a, b)!;
    const back = undoRemoval(next)!;
    expect(back.removed).toEqual(session.removed);
    expect(remainingCount(back)).toBe(24);
  });

  it('restart deals the identical board again — identity is the truth (§7)', () => {
    const session = createLevelSession(7);
    const [a, b] = findMatchingPair(session)!;
    const played = removePair(session, a, b)!;
    const fresh = restartSession(played);
    expect(fresh.faces).toEqual(session.faces);
    expect(fresh.removed).toEqual([]);
    expect(fresh.elapsedSeconds).toBe(0);
  });
});

describe('stuck is derived, and honest both ways (§7)', () => {
  /** A hand-dealt board: the sprout with faces chosen for the case. */
  const synthetic = (faces: TileFace[]): MahjongSession => ({
    mode: 'level',
    level: 1,
    dailyDate: null,
    layout: LAYOUTS.sprout,
    faces,
    removed: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  });

  // The sprout's 14 initially-free positions (row ends and the raised four).
  const FREE = [0, 3, 4, 7, 8, 11, 12, 15, 16, 19, 20, 21, 22, 23];

  it('calls a board stuck when no free pair matches', () => {
    const faces = new Array<TileFace>(24).fill('c1');
    const distinct: TileFace[] = [
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'c8',
      'c9',
      'o1',
      'o2',
      'o3',
      'o4',
      'o5',
    ];
    FREE.forEach((index, k) => {
      faces[index] = distinct[k]!;
    });
    // Buried tiles all share a face; none of them is reachable.
    for (let i = 0; i < 24; i++) if (!FREE.includes(i)) faces[i] = 'we';
    const session = synthetic(faces);
    expect(currentFreeTiles(session)).toEqual(FREE);
    expect(findMatchingPair(session)).toBeNull();
    expect(isStuck(session)).toBe(true);
  });

  it('never calls a live board stuck — one free match is enough', () => {
    const faces = new Array<TileFace>(24).fill('we');
    const distinct: TileFace[] = [
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'c8',
      'c9',
      'o1',
      'o2',
      'o3',
      'o4',
    ];
    FREE.slice(0, 13).forEach((index, k) => {
      faces[index] = distinct[k]!;
    });
    // The 14th free tile repeats c1: exactly one live pair, group rules apply.
    faces[FREE[13]!] = 'c1';
    const session = synthetic(faces);
    expect(isStuck(session)).toBe(false);
    expect(findMatchingPair(session)).not.toBeNull();
  });

  it('a won board is not stuck', () => {
    const board = generateBoard(levelParams(1), 'mj-level-1');
    let session: MahjongSession = createLevelSession(1);
    for (let k = 0; k + 1 < board.solvedOrder.length; k += 2) {
      session = removePair(session, board.solvedOrder[k]!, board.solvedOrder[k + 1]!)!;
    }
    expect(session.status).toBe('won');
    expect(isStuck(session)).toBe(false);
  });
});

describe('hints (§8)', () => {
  it('counting a hint bumps the counter and nothing else', () => {
    const session = createLevelSession(1);
    const next = countHintUse(session);
    expect(next.hintCount).toBe(1);
    expect(next.removed).toBe(session.removed);
  });
});
