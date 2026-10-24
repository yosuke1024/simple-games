// @vitest-environment node
/**
 * The two doors to a new problem (docs/MAKE_THE_TARGET_RULES.md §6, §8,
 * §10「書く側は、受け入れられる形しか書かない」): every session they make,
 * fresh or after a move, writes a record the reader accepts — through JSON,
 * as storage holds it — and an empty Free Play token, whose save would be
 * refused, is not taken.
 */
import { describe, expect, it } from 'vitest';
import { addDays } from './daily';
import { newDailySession, newFreeSession } from './newSession';
import { checkRecord, toRecord } from './restore';
import { newSeedToken, tapOperator, tapTile, type MakeTheTargetSession } from './session';
import { DIFFICULTIES } from './types';

const NOW = 1_790_000_000_000;

/** The record `session` writes, through JSON, as `checkRecord` sees it. */
const readBack = (session: MakeTheTargetSession) =>
  checkRecord(JSON.parse(JSON.stringify(toRecord(session, NOW))));

/** One `+` of the first two tiles — always legal. */
const oneMove = (session: MakeTheTargetSession) =>
  tapTile(tapOperator(tapTile(session, 0), '+'), 1);

describe('new sessions write records the reader accepts (§10)', () => {
  it('Free Play, every difficulty, a few minted tokens', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 5; i++) {
        const token = newSeedToken(NOW + i * 7_919, () => i / 5);
        const { session } = newFreeSession(difficulty, token);
        for (const s of [session, oneMove(session)]) {
          const result = readBack(s);
          expect(result.ok, `${difficulty} ${token}`).toBe(true);
          if (result.ok) expect(result.session.slots).toEqual(s.slots);
        }
      }
    }
  });

  it('the daily, a run of days', () => {
    for (let i = 0; i < 10; i++) {
      const { session } = newDailySession(addDays('2026-10-21', i * 37)!);
      for (const s of [session, oneMove(session)]) {
        const result = readBack(s);
        expect(result.ok, s.dailyDate!).toBe(true);
        if (result.ok) expect(result.session.slots).toEqual(s.slots);
      }
    }
  });

  it('an empty Free Play token is refused before a seed is made', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(() => newFreeSession(difficulty, '')).toThrow(RangeError);
    }
  });

  it('a minted token is never empty', () => {
    for (const [now, r] of [
      [0, 0],
      [0, 0.999999],
      [NOW, 0.5],
    ] as const) {
      expect(newSeedToken(now, () => r).length).toBeGreaterThan(0);
    }
  });
});
