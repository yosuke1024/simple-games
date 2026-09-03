/**
 * Session rules (docs/WATER_SORT_RULES.md §3, §4, §8, §10): one move per
 * pour, undo that restores the count with the board, and the restore that
 * drops history but keeps the position.
 */
import { describe, expect, it } from 'vitest';
import { canPour } from './engine';
import { FREE_TIER_LEVEL, FREE_TIERS, levelSeed } from './levels';
import { decodeTubes, encodeTubes } from './serialize';
import {
  canUndo,
  createDailySession,
  createFreeSession,
  createLevelSession,
  freeSeed,
  newSeedToken,
  pour,
  recordHint,
  restartSession,
  restoreSession,
  undo,
  type WaterSession,
} from './session';

/** Some legal pour on this board — generated boards always have one. */
function legalPour(session: WaterSession): { from: number; to: number } {
  for (let from = 0; from < session.tubes.length; from++) {
    for (let to = 0; to < session.tubes.length; to++) {
      if (canPour(session.tubes, from, to)) return { from, to };
    }
  }
  throw new Error('no legal pour');
}

describe('createLevelSession / createDailySession', () => {
  it('derives the board from the level alone', () => {
    const a = createLevelSession(1);
    const b = createLevelSession(1);
    expect(a.colors).toBe(3);
    expect(a.tubes).toEqual(b.tubes);
    expect(a.status).toBe('playing');
  });

  it('derives the daily from its date', () => {
    const session = createDailySession('2026-08-01');
    expect(session.colors).toBe(6);
    expect(session.dailyDate).toBe('2026-08-01');
    expect(session.tubes).toEqual(createDailySession('2026-08-01').tubes);
  });
});

describe('createFreeSession (§6「フリープレイ」)', () => {
  it('deals a board at the tier asked for, with no level and no date', () => {
    const session = createFreeSession('hard');
    expect(session.mode).toBe('free');
    expect(session.freeTier).toBe('hard');
    expect(session.colors).toBe(9);
    expect(session.level).toBeNull();
    expect(session.dailyDate).toBeNull();
    expect(session.seed.startsWith('water-free-')).toBe(true);
    expect(session.status).toBe('playing');
  });

  it("is one level's deal under another seed: levels 10 / 50 / 95", () => {
    for (const tier of FREE_TIERS) {
      const level = FREE_TIER_LEVEL[tier];
      expect(createFreeSession(tier, levelSeed(level)).tubes).toEqual(
        createLevelSession(level).tubes,
      );
    }
  });

  it('gives a new board each time, and the same board for the same seed', () => {
    const a = createFreeSession('medium', freeSeed(newSeedToken(1, () => 0.25)));
    const b = createFreeSession('medium', freeSeed(newSeedToken(2, () => 0.5)));
    expect(b.tubes).not.toEqual(a.tubes);
    const again = createFreeSession('medium', a.seed);
    expect(again.tubes).toEqual(a.tubes);
  });

  it('restart rebuilds the identical free board', () => {
    const session = createFreeSession('easy');
    const move = legalPour(session);
    const restarted = restartSession(pour(session, move.from, move.to)!);
    expect(restarted.seed).toBe(session.seed);
    expect(restarted.freeTier).toBe('easy');
    expect(restarted.tubes).toEqual(session.tubes);
    expect(restarted.moveCount).toBe(0);
  });

  it('never collides with a level or a daily seed', () => {
    const token = newSeedToken(1, () => 0);
    expect(freeSeed(token)).not.toBe(levelSeed(1));
    expect(freeSeed(token)).not.toMatch(/^water-daily-/);
  });
});

describe('pour', () => {
  it('counts one move per pour and stacks history (§4)', () => {
    const session = createLevelSession(1);
    const move = legalPour(session);
    const next = pour(session, move.from, move.to)!;
    expect(next.moveCount).toBe(1);
    expect(next.history).toHaveLength(1);
    expect(canUndo(next)).toBe(true);
  });

  it('rejects an illegal pour without changing anything (§3)', () => {
    const session = createLevelSession(1);
    expect(pour(session, 0, 0)).toBeNull();
  });
});

describe('undo', () => {
  it('restores the board and the move count together (§8)', () => {
    const session = createLevelSession(1);
    const move = legalPour(session);
    const played = pour(session, move.from, move.to)!;
    const back = undo(played)!;
    expect(back.tubes).toEqual(session.tubes);
    expect(back.moveCount).toBe(0);
    expect(canUndo(back)).toBe(false);
  });

  it('returns null with nothing to undo', () => {
    expect(undo(createLevelSession(1))).toBeNull();
  });
});

describe('restart and restore', () => {
  it('restart rebuilds the same board with progress cleared', () => {
    const session = createLevelSession(2);
    const move = legalPour(session);
    const played = recordHint(pour(session, move.from, move.to)!);
    const restarted = restartSession(played);
    expect(restarted.tubes).toEqual(session.tubes);
    expect(restarted.moveCount).toBe(0);
    expect(restarted.hintCount).toBe(0);
  });

  it('restore keeps the position, drops history, and derives status (§10)', () => {
    const session = createLevelSession(3);
    const move = legalPour(session);
    const played = pour(session, move.from, move.to)!;
    const restored = restoreSession({
      mode: played.mode,
      seed: played.seed,
      colors: played.colors,
      dailyDate: played.dailyDate,
      level: played.level,
      freeTier: played.freeTier,
      tubes: played.tubes,
      moveCount: played.moveCount,
      hintCount: played.hintCount,
      elapsedSeconds: 30,
    });
    expect(restored.tubes).toEqual(played.tubes);
    expect(restored.history).toHaveLength(0);
    expect(restored.status).toBe('playing');
  });
});

describe('serialization', () => {
  it('round-trips a board, empty tubes included', () => {
    const session = createLevelSession(1);
    const text = encodeTubes(session.tubes);
    expect(decodeTubes(text, session.colors)).toEqual(session.tubes);
  });

  it('fails closed on broken boards', () => {
    const session = createLevelSession(1);
    const text = encodeTubes(session.tubes);
    expect(decodeTubes(text.replace('.', ''), session.colors)).toBeNull();
    expect(decodeTubes(`0${text}`, session.colors)).toBeNull();
    expect(decodeTubes('!!!', session.colors)).toBeNull();
    expect(decodeTubes('', session.colors)).toBeNull();
  });
});
