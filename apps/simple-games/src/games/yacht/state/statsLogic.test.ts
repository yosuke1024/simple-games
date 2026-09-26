/**
 * The statistics transitions (docs/YACHT_RULES.md §6): a start counts as
 * played, only a full sheet books a score, and the best only ever rises.
 */
import { describe, expect, it } from 'vitest';
import { statsSchema } from '../storage/schemas';
import { applyGameEnd, applyGameStart, applyPlayTime, averageScore } from './statsLogic';

const empty = () => statsSchema.defaultValue();

describe('statistics (§6)', () => {
  it('counts a started game as played, and nothing else', () => {
    expect(applyGameStart(empty())).toMatchObject({ played: 1, completed: 0, bestScore: null });
  });

  it('books play seconds, and ignores none or negative', () => {
    expect(applyPlayTime(empty(), 30).totalPlaySeconds).toBe(30);
    const stats = empty();
    expect(applyPlayTime(stats, 0)).toBe(stats);
    expect(applyPlayTime(stats, -5)).toBe(stats);
  });

  it('books a full sheet: the count, the sum, and a best that only rises', () => {
    let stats = applyGameEnd(empty(), 180);
    expect(stats).toMatchObject({ completed: 1, totalScore: 180, bestScore: 180 });
    stats = applyGameEnd(stats, 150);
    expect(stats).toMatchObject({ completed: 2, totalScore: 330, bestScore: 180 });
    stats = applyGameEnd(stats, 201);
    expect(stats.bestScore).toBe(201);
  });

  it('averages finished sheets only, and says nothing before the first', () => {
    expect(averageScore(empty())).toBeNull();
    // A started-but-abandoned game adds to `played`, never to the average.
    const stats = applyGameEnd(applyGameEnd(applyGameStart(applyGameStart(empty())), 100), 151);
    expect(averageScore(applyGameStart(stats))).toBe(126);
  });

  it('never changes the record it was given', () => {
    const stats = empty();
    applyGameEnd(applyGameStart(stats), 99);
    expect(stats).toEqual(empty());
  });
});
