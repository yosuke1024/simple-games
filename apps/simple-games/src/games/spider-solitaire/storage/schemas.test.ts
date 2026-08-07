/**
 * What the persisted records accept and what they refuse. Validators never
 * throw: anything they cannot vouch for comes back as the safe default, so a
 * corrupt file costs a player their record, never their app (§10).
 */
import { describe, expect, it } from 'vitest';
import { COLUMNS, dealBoard, type SpiderBoard } from '../game';
import { gameSchema, statsSchema } from './schemas';

describe('statsSchema (§9)', () => {
  const base = { schemaVersion: 1, perSuit: {}, totalPlaySeconds: 0 };

  it('keeps a day’s record separately for each difficulty', () => {
    const stats = statsSchema.validate({
      ...base,
      dailyResults: {
        '2026-08-07': { '1': { moves: 100, seconds: 600 }, '4': { moves: 150, seconds: 900 } },
      },
    });
    expect(stats?.dailyResults['2026-08-07']).toEqual({
      '1': { moves: 100, seconds: 600 },
      '4': { moves: 150, seconds: 900 },
    });
  });

  it('drops entries it cannot read, and the day with them if nothing is left', () => {
    const stats = statsSchema.validate({
      ...base,
      dailyResults: {
        '2026-08-07': { '1': { moves: 100, seconds: 600 }, '4': { moves: 'many' } },
        'not-a-date': { '1': { moves: 10, seconds: 10 } },
        '2026-08-06': { '3': { moves: 10, seconds: 10 } },
        '2026-08-05': {},
        '2026-08-04': 7,
      },
    });
    // A day left with nothing readable is not a day that was won, so it must
    // not survive as an empty shell and inflate the daily count (§6).
    expect(Object.keys(stats?.dailyResults ?? {})).toEqual(['2026-08-07']);
    expect(stats?.dailyResults['2026-08-07']).toEqual({ '1': { moves: 100, seconds: 600 } });
  });

  it('falls back to no dailies rather than failing the whole record', () => {
    expect(statsSchema.validate({ ...base, dailyResults: 'gone' })?.dailyResults).toEqual({});
    expect(statsSchema.validate({ ...base })?.dailyResults).toEqual({});
    expect(statsSchema.validate({ ...base, totalPlaySeconds: -1 })).toBeNull();
    expect(statsSchema.validate({ ...base, schemaVersion: 2 })).toBeNull();
    expect(statsSchema.validate(null)).toBeNull();
  });
});

/** A real deal whose stock has been shortened to a length no deal produces. */
function withStockOf(count: number): SpiderBoard {
  const dealt = dealBoard('ss-free-schema', 4);
  const stock = [...dealt.stock];
  const tableau = dealt.tableau.map((pile) => ({ down: [...pile.down], up: [...pile.up] }));
  while (stock.length > count) tableau[0]!.down.push(stock.pop()!);
  return { ...dealt, stock, tableau };
}

const saved = (board: SpiderBoard): Record<string, unknown> => ({
  schemaVersion: 1,
  mode: 'free',
  seed: 'ss-free-schema',
  suitCount: board.suitCount,
  dailyDate: null,
  stock: board.stock,
  tableau: board.tableau.map((pile) => ({ down: pile.down, up: pile.up })),
  completed: board.completed,
  moveCount: 12,
  hintCount: 0,
  elapsedSeconds: 34,
  savedAt: 1_754_000_000_000,
});

describe('gameSchema (§10)', () => {
  it('restores a board that could have come from play', () => {
    const restored = gameSchema.validate(saved(dealBoard('ss-free-schema', 4)));
    expect(restored?.stock).toHaveLength(50);
    expect(restored?.moveCount).toBe(12);
  });

  it('refuses a whole pack whose stock is not whole undealt rows', () => {
    // 104 cards, each exactly once — the file would pass a card-counting check
    // and still hand short rows to the columns on the next deal (§3).
    for (const count of [5, 15]) {
      const board = withStockOf(count);
      expect(board.stock).toHaveLength(count);
      expect(gameSchema.validate(saved(board))).toBeNull();
    }
    expect(gameSchema.validate(saved(withStockOf(COLUMNS * 4)))).not.toBeNull();
  });
});
