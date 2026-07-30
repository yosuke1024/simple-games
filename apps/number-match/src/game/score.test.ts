import { describe, expect, it } from 'vitest';
import {
  clearBonusBase,
  createScore,
  scoreAddNumbers,
  scoreClear,
  scoreMatch,
  type ScoreState,
} from './score';

/** A budget wide enough that these cases never bump into it. */
const INITIAL_SCORE = createScore(1000);

const invariant = (s: ScoreState) =>
  expect(s.total).toBe(s.matchPoints + s.rowPoints + s.clearBonus + s.noHintBonus);

describe('scoreMatch', () => {
  it('scores an adjacent match at base 10', () => {
    const s = scoreMatch(INITIAL_SCORE, 0, 0);
    expect(s.total).toBe(10);
    expect(s.matchPoints).toBe(10);
    invariant(s);
  });

  it('adds 3 points per jumped cleared cell (distance bonus)', () => {
    expect(scoreMatch(INITIAL_SCORE, 4, 0).total).toBe(10 + 12);
  });

  it('applies the streak multiplier and caps it at ×2.0', () => {
    let s = INITIAL_SCORE;
    s = scoreMatch(s, 0, 0); // ×1.0 → 10
    s = scoreMatch(s, 0, 0); // ×1.1 → 11
    expect(s.total).toBe(21);
    expect(s.streakTenths).toBe(12);
    for (let i = 0; i < 20; i++) s = scoreMatch(s, 0, 0);
    expect(s.streakTenths).toBe(20);
    const before = s.total;
    s = scoreMatch(s, 0, 0); // ×2.0 → 20
    expect(s.total).toBe(before + 20);
    invariant(s);
  });

  it('scores a removed row by its width, so narrow shaped rows are worth less', () => {
    expect(scoreMatch(INITIAL_SCORE, 0, 1, 9).rowPoints).toBe(54);
    expect(scoreMatch(INITIAL_SCORE, 0, 1, 3).rowPoints).toBe(18);
  });

  it('adds 50 extra for multi-row removals', () => {
    expect(scoreMatch(INITIAL_SCORE, 0, 2, 18).rowPoints).toBe(18 * 6 + 50);
    invariant(scoreMatch(INITIAL_SCORE, 0, 2, 18));
  });

  it('does not multiply the row bonus by the streak', () => {
    const hot = { ...INITIAL_SCORE, streakTenths: 20 };
    const s = scoreMatch(hot, 0, 1, 9);
    expect(s.rowPoints).toBe(54);
    expect(s.matchPoints).toBe(20);
  });
});

describe('scoring budget', () => {
  it('spends two cells per match and stops at zero', () => {
    let s = createScore(4);
    s = scoreMatch(s, 0, 0);
    expect(s.scorableCells).toBe(2);
    s = scoreMatch(s, 0, 0);
    expect(s.scorableCells).toBe(0);
    s = scoreMatch(s, 0, 0);
    expect(s.scorableCells).toBe(0);
  });

  it('pays nothing once the board’s starting cells are paid for', () => {
    let s = createScore(2);
    s = scoreMatch(s, 4, 1, 9); // within budget: match + distance + row
    const paid = s.total;
    expect(paid).toBeGreaterThan(0);
    s = scoreMatch(s, 4, 2, 18); // budget spent: a big move now earns zero
    expect(s.total).toBe(paid);
    expect(s.matchPoints + s.rowPoints).toBe(paid);
    invariant(s);
  });

  it('is not refreshed by Add Numbers', () => {
    const spent = scoreMatch(createScore(2), 0, 0);
    expect(scoreAddNumbers(spent).scorableCells).toBe(0);
  });

  it('still awards the clear and no-hint bonuses after the budget runs out', () => {
    const spent = scoreMatch(createScore(0), 0, 0);
    expect(spent.total).toBe(0);
    const s = scoreClear(spent, 'level', 10, 0, 0);
    expect(s.clearBonus).toBe(300);
    expect(s.noHintBonus).toBe(30);
    invariant(s);
  });

  it('grinding with Add Numbers can never beat an efficient clear', () => {
    const CELLS = 24;
    const playOut = (extraMatches: number) => {
      let s = createScore(CELLS);
      for (let i = 0; i < CELLS / 2 + extraMatches; i++) s = scoreMatch(s, 2, 1, 9);
      // Each Add costs 25% of the clear bonus; grinding needs at least one.
      const adds = extraMatches === 0 ? 0 : 1;
      return scoreClear(s, 'level', 50, adds, 0).total;
    };
    const efficient = playOut(0);
    expect(playOut(20)).toBeLessThan(efficient);
    expect(playOut(200)).toBeLessThan(efficient);
  });
});

describe('scoreAddNumbers', () => {
  it('resets the streak without touching points', () => {
    const hot = scoreMatch(scoreMatch(INITIAL_SCORE, 0, 0), 0, 0);
    const s = scoreAddNumbers(hot);
    expect(s.streakTenths).toBe(10);
    expect(s.total).toBe(hot.total);
  });
});

describe('scoreClear', () => {
  it('scales the clear bonus with the level', () => {
    expect(clearBonusBase('level', 1)).toBe(165);
    expect(clearBonusBase('level', 999)).toBe(150 + 15 * 999);
    expect(clearBonusBase('daily', null)).toBe(300);
  });

  it('reduces the bonus 25% per Add Numbers use, never below zero', () => {
    const base = clearBonusBase('level', 10); // 300
    expect(scoreClear(INITIAL_SCORE, 'level', 10, 0, 1).clearBonus).toBe(base);
    expect(scoreClear(INITIAL_SCORE, 'level', 10, 1, 1).clearBonus).toBe(225);
    expect(scoreClear(INITIAL_SCORE, 'level', 10, 4, 1).clearBonus).toBe(0);
    expect(scoreClear(INITIAL_SCORE, 'level', 10, 9, 1).clearBonus).toBe(0);
  });

  it('adds 10% on top for a no-hint clear', () => {
    const played = scoreMatch(INITIAL_SCORE, 0, 0); // 10 points
    const s = scoreClear(played, 'level', 10, 0, 0);
    // subtotal = 10 + 300 = 310 → +31
    expect(s.noHintBonus).toBe(31);
    expect(s.total).toBe(341);
    invariant(s);
    const withHint = scoreClear(played, 'level', 10, 0, 2);
    expect(withHint.noHintBonus).toBe(0);
    invariant(withHint);
  });
});
