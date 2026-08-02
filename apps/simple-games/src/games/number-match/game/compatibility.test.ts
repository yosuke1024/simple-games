/**
 * Frozen boards.
 *
 * A level's board is its identity: players replay levels to beat a saved best
 * score (§12), and every past daily stays open for replay (§14). Regenerating
 * a board differently would leave those scores standing against a board that
 * no longer exists.
 *
 * These cover every board this game promises never to change: the levels below
 * the first wild (§16), and the dailies before the decoration cutoff. A failure
 * here means a change to generation leaked into boards that were supposed to be
 * settled — not that these numbers need updating.
 *
 * The level strings were re-pinned once, when the ladder was rebuilt from 999
 * levels to 100 (§11). That rebuild moved every knob's schedule, so it changed
 * boards on purpose and every player's level progress was reset with it; the
 * dailies were not touched, then or now, because a daily board has never come
 * from the level list. Levels 1 to 4 came through the rebuild byte-identical
 * anyway, which is why they read the same as the strings captured before stones
 * and wilds existed.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_DECORATIONS_FROM } from './daily';
import { generateLevelBoard } from './levels';
import { encodeBoard } from './serialize';
import { createDailySession } from './session';

const FROZEN_LEVELS: Record<number, string> = {
  1: '972828828973228882818557731',
  2: '737333737288833337557288973',
  3: '282833337719873322149964728',
  4: '346688225554428228654646283',
  5: '644365391046663770001767700009929100000919000',
};

const FROZEN_DAILIES: Record<string, string> = {
  '2026-07-29': '333999118001611200001119900556873129',
  '2026-07-30': '943759122003371100003938600791917646',
  '2026-07-31': '873773849093337870007562800003364100000442000',
};

describe('boards that must never change', () => {
  it('reproduces every level below the first wild exactly', () => {
    for (const [level, values] of Object.entries(FROZEN_LEVELS)) {
      expect(encodeBoard(generateLevelBoard(Number(level))).values).toBe(values);
    }
  });

  it('reproduces every daily before the decoration cutoff exactly', () => {
    for (const [date, values] of Object.entries(FROZEN_DAILIES)) {
      expect(date < DAILY_DECORATIONS_FROM).toBe(true);
      expect(encodeBoard(createDailySession(date).board).values).toBe(values);
    }
  });

  it('holds no stone or wild in any frozen board', () => {
    for (const values of [...Object.values(FROZEN_LEVELS), ...Object.values(FROZEN_DAILIES)]) {
      expect(values).not.toMatch(/[sw]/);
    }
  });
});
