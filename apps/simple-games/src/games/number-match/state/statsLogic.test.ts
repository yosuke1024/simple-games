import { describe, expect, it } from 'vitest';
import { createDailySession, createLevelSession, type GameSession } from '../game';
import { statsSchema } from '../storage/schemas';
import { applyGameEnd, applyGameStart } from './statsLogic';

const cleared = (session: GameSession, elapsedSeconds: number): GameSession => ({
  ...session,
  status: 'cleared',
  elapsedSeconds,
});

describe('applyGameStart', () => {
  it('counts a started game per mode without touching the other mode', () => {
    let stats = statsSchema.defaultValue();
    stats = applyGameStart(stats, 'level');
    stats = applyGameStart(stats, 'level');
    stats = applyGameStart(stats, 'daily');
    expect(stats.level.played).toBe(2);
    expect(stats.daily.played).toBe(1);
  });

  it('does not mutate its input', () => {
    const stats = statsSchema.defaultValue();
    applyGameStart(stats, 'level');
    expect(stats.level.played).toBe(0);
  });
});

describe('applyGameEnd', () => {
  it('records a clear with play time and best time', () => {
    const stats = applyGameEnd(statsSchema.defaultValue(), cleared(createLevelSession(1), 90));
    expect(stats.level.cleared).toBe(1);
    expect(stats.level.totalPlaySeconds).toBe(90);
    expect(stats.level.bestClearSeconds).toBe(90);
  });

  it('keeps the faster clear as the best', () => {
    let stats = applyGameEnd(statsSchema.defaultValue(), cleared(createLevelSession(1), 90));
    stats = applyGameEnd(stats, cleared(createLevelSession(1), 120));
    stats = applyGameEnd(stats, cleared(createLevelSession(1), 60));
    expect(stats.level.bestClearSeconds).toBe(60);
    expect(stats.level.totalPlaySeconds).toBe(270);
  });

  it('records a game over without touching clear counters', () => {
    const session: GameSession = {
      ...createLevelSession(1),
      status: 'gameOver',
      elapsedSeconds: 30,
    };
    const stats = applyGameEnd(statsSchema.defaultValue(), session);
    expect(stats.level.gameOver).toBe(1);
    expect(stats.level.cleared).toBe(0);
    expect(stats.level.totalPlaySeconds).toBe(30);
    expect(stats.level.bestClearSeconds).toBeNull();
  });

  it('books a daily clear under the daily bucket', () => {
    const stats = applyGameEnd(
      statsSchema.defaultValue(),
      cleared(createDailySession('2026-07-30'), 45),
    );
    expect(stats.daily.cleared).toBe(1);
    expect(stats.level.cleared).toBe(0);
  });
});
