/**
 * Frozen boards.
 *
 * A level's board is its identity: players replay levels to beat a saved best
 * score (§12), and every past daily stays open for replay (§14). Regenerating
 * a board differently would leave those scores standing against a board that
 * no longer exists.
 *
 * The strings below were captured from the build before stones and wilds
 * existed. They cover every board this game promises never to change: the
 * levels below the first wild (§16), and the dailies before the decoration
 * cutoff. A failure here means a change to generation leaked into boards that
 * were supposed to be settled — not that these numbers need updating.
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
  5: '644365391046663770001767700000392000',
  6: '000881000008884600042277730994228289',
  7: '000899000001199800027773680187599666',
  8: '000699000003297300031188770379993761',
  9: '886877334004677700009373300552646375',
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
