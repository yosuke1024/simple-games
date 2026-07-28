import { describe, expect, it } from 'vitest';
import {
  clearBonusBase,
  INITIAL_SCORE,
  scoreAddNumbers,
  scoreClear,
  scoreMatch,
  type ScoreState,
} from './score';

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

  it('adds 50 per removed row and 50 extra for multi-row removals', () => {
    expect(scoreMatch(INITIAL_SCORE, 0, 1).rowPoints).toBe(50);
    expect(scoreMatch(INITIAL_SCORE, 0, 2).rowPoints).toBe(150);
    invariant(scoreMatch(INITIAL_SCORE, 0, 2));
  });

  it('does not multiply the row bonus by the streak', () => {
    const hot = { ...INITIAL_SCORE, streakTenths: 20 };
    const s = scoreMatch(hot, 0, 1);
    expect(s.rowPoints).toBe(50);
    expect(s.matchPoints).toBe(20);
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
