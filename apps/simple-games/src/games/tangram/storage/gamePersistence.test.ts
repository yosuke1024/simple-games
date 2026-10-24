/**
 * Every Tangram record through the store and back, and what each refuses
 * (docs/TANGRAM_RULES.md §8). A saved figure comes back exactly as it was
 * played — the board with its pivots, the clock — and one play could not
 * have written is refused by the slot schema itself: the same check a load
 * and a backup restore run. A refused record reads as an empty slot and stays
 * in the store. The other records drop a bad entry rather than the whole
 * record, and fall back to their defaults only when their shape is wrong.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord, saveRecord } from '@/storage/repo';
import {
  createDailySession,
  createSession,
  dailyFigure,
  figureById,
  figuresOf,
  placePiece,
  rotatePiece,
  withElapsedSeconds,
  type Figure,
  type PieceId,
  type Placement,
  type TangramSession,
} from '../game';
import {
  clearSavedGame,
  loadSavedGames,
  saveGame,
  toPersisted,
  toSession,
} from './gamePersistence';
import {
  dailyGameSchema,
  flagsSchema,
  gameSchema,
  MAX_DAILY_ENTRIES,
  prefsSchema,
  progressSchema,
  statsSchema,
  TN_STORAGE_KEYS,
  type PersistedGame,
} from './schemas';

const DAY = '2026-10-21';
const square = figureById('square')!;
const medium = figuresOf('medium')[0]!;
const sol = (figure: Figure, id: PieceId): Placement => ({
  ...figure.solution[id],
  pv: figure.solution[id].at,
});

/** A record as it would come back from storage: through JSON, then the slot's schema. */
const throughStore = (record: unknown, schema = gameSchema) =>
  schema.validate(JSON.parse(JSON.stringify(record)) as unknown);

function played(): TangramSession {
  let session = createSession(square);
  session = placePiece(session, 'L1', sol(square, 'L1'))!;
  session = placePiece(session, 'S1', sol(square, 'S1'))!;
  // A tray turn is not written (§8): the restored tray is unturned.
  session = rotatePiece(session, 'M')!;
  return withElapsedSeconds(session, 42.9);
}

describe('a saved figure comes back as it was (§8)', () => {
  it('round-trips the pieces, their pivots and the clock — not the tray turns or the history', () => {
    const session = played();
    const record = throughStore(toPersisted(session, 1_792_500_000_000));
    expect(record).not.toBeNull();
    expect(record!.savedAt).toBe(1_792_500_000_000);
    const restored = toSession(record)!;
    expect(restored.board).toEqual(session.board);
    expect(restored.elapsedSeconds).toBe(42);
    expect(restored.history).toEqual([]);
    expect(restored.tray.M).toEqual({ r: 0, f: 0 });
    expect(restored.status).toBe('playing');
  });

  it('writes the record §8 shows, field for field', () => {
    const session = withElapsedSeconds(
      placePiece(placePiece(createSession(square), 'L1', sol(square, 'L1'))!, 'S1', {
        ...square.solution.S1,
        pv: [0, 4, 0, 0],
      })!,
      42,
    );
    expect(JSON.parse(JSON.stringify(toPersisted(session, 1792500000000)))).toEqual({
      schemaVersion: 1,
      mode: 'free',
      tier: 'easy',
      figure: 'square',
      dailyDate: null,
      pieces: {
        L1: { r: 5, f: 0, at: [0, 2, 0, 2], pv: [0, 2, 0, 2] },
        S1: { r: 7, f: 0, at: [0, 3, 0, 1], pv: [0, 4, 0, 0] },
      },
      elapsedSeconds: 42,
      savedAt: 1792500000000,
    });
  });

  it('keeps Medium’s fixed pieces out of the record and puts them back from the catalog', () => {
    const session = placePiece(createSession(medium), 'S1', sol(medium, 'S1'))!;
    const record = throughStore(toPersisted(session, 1));
    expect(Object.keys(record!.pieces)).toEqual(['S1']);
    expect(toSession(record)!.board).toEqual(session.board);
  });

  it('saves into the slot of its mode, and a completed figure’s slot can be cleared', async () => {
    const kv = createMemoryKV();
    const daily = createDailySession(DAY)!;
    await saveGame(played(), kv);
    await saveGame(daily, kv);
    const saved = await loadSavedGames(kv, DAY);
    expect(saved.free?.figure.id).toBe('square');
    expect(saved.daily?.figure).toBe(dailyFigure(DAY));
    await clearSavedGame('free', kv);
    expect(await kv.get(TN_STORAGE_KEYS.game)).toBeNull();
    expect(await kv.get(TN_STORAGE_KEYS.dailyGame)).not.toBeNull();
  });
});

describe('a saved figure play could not have written is refused (§8, fail-closed)', () => {
  const base = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(toPersisted(played(), 1))) as Record<string, unknown>;
  const pieces = (r: Record<string, unknown>) =>
    r.pieces as Record<string, Record<string, unknown>>;
  const refused = (mutate: (r: Record<string, unknown>) => void) => {
    const record = base();
    mutate(record);
    return gameSchema.validate(record) === null;
  };

  it('accepts the unmodified record', () => {
    expect(refused(() => undefined)).toBe(false);
  });

  it.each([
    ['a schemaVersion other than 1', (r: Record<string, unknown>) => (r.schemaVersion = 2)],
    ['a savedAt out of range', (r: Record<string, unknown>) => (r.savedAt = -1)],
    ['a savedAt that is not whole', (r: Record<string, unknown>) => (r.savedAt = 1.5)],
    ['an unknown mode', (r: Record<string, unknown>) => (r.mode = 'zen')],
    ['a tier that is not the figure’s', (r: Record<string, unknown>) => (r.tier = 'hard')],
    ['an unknown figure', (r: Record<string, unknown>) => (r.figure = 'toString')],
    ['a turn out of range', (r: Record<string, unknown>) => (pieces(r).L1!.r = 8)],
    ['a flip on a triangle', (r: Record<string, unknown>) => (pieces(r).L1!.f = 1)],
    ['an odd rational part', (r: Record<string, unknown>) => (pieces(r).L1!.at = [1, 2, 0, 2])],
    ['a pivot off the ticks', (r: Record<string, unknown>) => (pieces(r).L1!.pv = [1, 2, 0, 2])],
    ['an unknown piece', (r: Record<string, unknown>) => (pieces(r).XX = pieces(r).L1!)],
    [
      'a piece outside the silhouette',
      (r: Record<string, unknown>) => {
        pieces(r).L1!.at = [8, 2, 0, 2];
        pieces(r).L1!.pv = [8, 2, 0, 2];
      },
    ],
    [
      'two pieces on top of each other',
      (r: Record<string, unknown>) => (pieces(r).L2 = { ...pieces(r).L1!, r: 5 }),
    ],
    ['a clock that is not whole', (r: Record<string, unknown>) => (r.elapsedSeconds = 1.5)],
    ['a clock past the bound', (r: Record<string, unknown>) => (r.elapsedSeconds = 1e9 + 1)],
    ['no record at all', (r: Record<string, unknown>) => (r.pieces = null)],
  ])('refuses %s', (_name, mutate) => {
    expect(refused(mutate)).toBe(true);
  });

  it('refuses a finished figure: complete boards are cleared, never resumed', () => {
    let session = createSession(square);
    for (const id of ['L1', 'L2', 'M', 'P', 'SQ', 'S1'] as const) {
      session = placePiece(session, id, sol(square, id))!;
    }
    const record = JSON.parse(JSON.stringify(toPersisted(session, 1))) as PersistedGame;
    const full = {
      ...record,
      pieces: {
        ...record.pieces,
        S2: {
          ...square.solution.S2,
          at: [...square.solution.S2.at],
          pv: [...square.solution.S2.at],
        },
      },
    };
    expect(gameSchema.validate(full)).toBeNull();
  });

  it('refuses a fixed piece in a Medium record, and a daily that is not its date’s figure', () => {
    const session = createSession(medium);
    const record = JSON.parse(JSON.stringify(toPersisted(session, 1))) as Record<string, unknown>;
    record.pieces = { L1: { ...medium.solution.L1, pv: medium.solution.L1.at } };
    expect(gameSchema.validate(record)).toBeNull();

    const daily = JSON.parse(JSON.stringify(toPersisted(createDailySession(DAY)!, 1))) as Record<
      string,
      unknown
    >;
    const other = figuresOf('medium').find((figure) => figure !== dailyFigure(DAY))!;
    expect(dailyGameSchema.validate({ ...daily, figure: other.id })).toBeNull();
    expect(dailyGameSchema.validate(daily)).not.toBeNull();
  });

  it('never throws, whatever it is given', () => {
    for (const value of [null, undefined, 0, 'x', [], {}, { schemaVersion: 1 }, Symbol.iterator]) {
      expect(() => gameSchema.validate(value)).not.toThrow();
      expect(gameSchema.validate(value)).toBeNull();
    }
  });

  it('reads a refused record as an empty slot and leaves it in the store (§8)', async () => {
    const damaged = JSON.stringify({ ...base(), figure: 'gone-in-the-beta' });
    const kv = createMemoryKV({
      [TN_STORAGE_KEYS.game]: damaged,
      [TN_STORAGE_KEYS.dailyGame]: '{',
    });
    const saved = await loadSavedGames(kv, DAY);
    expect(saved).toEqual({ free: null, daily: null });
    expect(await kv.get(TN_STORAGE_KEYS.game)).toBe(damaged);
  });
});

describe('the other records (§8)', () => {
  it('round-trips the statistics, the progress, the flags and the tier', async () => {
    const kv = createMemoryKV();
    const stats = {
      schemaVersion: 1 as const,
      easy: { played: 5, solved: 3, totalPlaySeconds: 610 },
      medium: { played: 2, solved: 1, totalPlaySeconds: 420 },
      hard: { played: 0, solved: 0, totalPlaySeconds: 0 },
      daily: { played: 2, totalPlaySeconds: 380 },
      dailyTimes: { '2026-10-21': 185 },
    };
    const progress = {
      schemaVersion: 1 as const,
      best: { square: 95, triangle: 140 },
      last: { easy: 'triangle' },
    };
    await saveRecord(statsSchema, stats, kv);
    await saveRecord(progressSchema, progress, kv);
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    await saveRecord(prefsSchema, { schemaVersion: 1, tier: 'hard' }, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);
    expect(await loadRecord(progressSchema, kv)).toEqual(progress);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).tier).toBe('hard');
  });

  it('drops a progress entry the catalog no longer has, and keeps the rest', () => {
    expect(
      progressSchema.validate({
        schemaVersion: 1,
        best: { square: 95, 'gone-in-the-beta': 30, toString: 1, triangle: -1 },
        last: { easy: 'gone-in-the-beta', medium: 'corner', hard: 7 },
      }),
    ).toEqual({ schemaVersion: 1, best: { square: 95 }, last: { medium: 'corner' } });
  });

  it('falls back to an empty progress only when its shape is wrong', () => {
    expect(progressSchema.validate({ schemaVersion: 1, best: [], last: {} })).toBeNull();
    expect(progressSchema.validate({ schemaVersion: 1, best: {} })).toBeNull();
    expect(progressSchema.validate({ schemaVersion: 2, best: {}, last: {} })).toBeNull();
  });

  it('drops an unreadable daily date and keeps the record (§8)', () => {
    const value = statsSchema.validate({
      ...statsSchema.defaultValue(),
      dailyTimes: { '2026-10-21': 185, '2026-02-30': 10, garbage: 3, '2026-10-22': -4 },
    });
    expect(value?.dailyTimes).toEqual({ '2026-10-21': 185 });
  });

  it('keeps at most MAX_DAILY_ENTRIES days', () => {
    const dailyTimes: Record<string, number> = {};
    for (let i = 0; i < MAX_DAILY_ENTRIES + 5; i++) {
      const date = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
      dailyTimes[date] = 60;
    }
    const value = statsSchema.validate({ ...statsSchema.defaultValue(), dailyTimes });
    expect(Object.keys(value!.dailyTimes)).toHaveLength(MAX_DAILY_ENTRIES);
  });

  it('does not check the counts against each other, and refuses a broken row whole', () => {
    const fine = {
      ...statsSchema.defaultValue(),
      easy: { played: 1, solved: 4, totalPlaySeconds: 0 },
    };
    expect(statsSchema.validate(fine)?.easy.solved).toBe(4);
    expect(
      statsSchema.validate({ ...fine, hard: { played: -1, solved: 0, totalPlaySeconds: 0 } }),
    ).toBeNull();
    expect(statsSchema.validate({ ...fine, daily: null })).toBeNull();
  });

  it('reads an unknown tier, "toString" included, as the default (§8)', async () => {
    for (const tier of ['toString', 'expert', 3, null]) {
      expect(prefsSchema.validate({ schemaVersion: 1, tier })).toBeNull();
    }
    const kv = createMemoryKV({ [TN_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"tier":"toString"}' });
    expect((await loadRecord(prefsSchema, kv)).tier).toBe('easy');
  });

  it('keeps the flags to their one boolean', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: false })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: false,
    });
  });

  it('never spreads: a damaged record leaves the others readable', async () => {
    const kv = createMemoryKV({
      [TN_STORAGE_KEYS.stats]: 'not json',
      [TN_STORAGE_KEYS.progress]: JSON.stringify({
        schemaVersion: 1,
        best: { square: 9 },
        last: {},
      }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect((await loadRecord(progressSchema, kv)).best).toEqual({ square: 9 });
  });
});
