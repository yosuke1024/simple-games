/**
 * The records around the saved games (docs/MAKE_THE_TARGET_RULES.md §10):
 * the statistics, the flags and the remembered difficulty. Each is
 * fail-closed — a damaged record reads as nothing and the game falls back to
 * its defaults — except the map of cleared days, where one unreadable entry is
 * dropped rather than costing the player every other day.
 */
import { describe, expect, it } from 'vitest';
import { flagsSchema, MAX_DAILY_ENTRIES, prefsSchema, statsSchema, type Stats } from './schemas';

/**
 * Every path to a value in `record`, nested objects included: `['easy']`,
 * `['easy', 'played']`, `['dailyTimes', '2026-10-20']`, …
 */
function paths(record: object, prefix: string[] = []): string[][] {
  return Object.entries(record).flatMap(([key, value]) => {
    const path = [...prefix, key];
    return value !== null && typeof value === 'object' ? [path, ...paths(value, path)] : [path];
  });
}

/** A deep copy of `record` whose value at `path` is a getter that throws. */
function throwingAt(record: object, path: string[]): unknown {
  const copy = structuredClone(record) as Record<string, unknown>;
  let parent = copy;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  Object.defineProperty(parent, path[path.length - 1]!, {
    get() {
      throw new Error('no');
    },
    enumerable: true,
  });
  return copy;
}

const stats = (): Stats => ({
  schemaVersion: 1,
  easy: { played: 3, solved: 2, totalPlaySeconds: 300, bestSeconds: 61 },
  medium: { played: 1, solved: 0, totalPlaySeconds: 40, bestSeconds: null },
  hard: { played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null },
  daily: { played: 2, totalPlaySeconds: 200 },
  dailyTimes: { '2026-10-20': 95 },
});

describe('statistics (§10)', () => {
  it('reads a record as written, and starts empty with no streak in it', () => {
    expect(statsSchema.validate(JSON.parse(JSON.stringify(stats())))).toEqual(stats());
    const empty = statsSchema.defaultValue();
    expect(empty.easy).toEqual({ played: 0, solved: 0, totalPlaySeconds: 0, bestSeconds: null });
    expect(empty.daily).toEqual({ played: 0, totalPlaySeconds: 0 });
    expect(empty.dailyTimes).toEqual({});
    expect(JSON.stringify(empty)).not.toMatch(/streak/i);
  });

  it('refuses the whole record over one damaged row', () => {
    const damaged: unknown[] = [
      { ...stats(), schemaVersion: 2 },
      { ...stats(), easy: { ...stats().easy, played: -1 } },
      { ...stats(), medium: { ...stats().medium, solved: 1.5 } },
      { ...stats(), hard: { ...stats().hard, totalPlaySeconds: 1e13 } },
      { ...stats(), easy: { ...stats().easy, bestSeconds: '61' } },
      { ...stats(), daily: { played: 'two', totalPlaySeconds: 0 } },
      { ...stats(), daily: undefined },
      'stats',
      null,
    ];
    for (const record of damaged) expect(statsSchema.validate(record)).toBeNull();
  });

  it('drops an unreadable cleared day, and keeps the others', () => {
    const record = {
      ...stats(),
      dailyTimes: {
        '2026-10-20': 95,
        '2026-02-30': 10,
        yesterday: 10,
        '2026-10-19': -4,
        '2026-10-18': 1.5,
        '2026-10-17': 70,
      },
    };
    expect(statsSchema.validate(record)?.dailyTimes).toEqual({
      '2026-10-20': 95,
      '2026-10-17': 70,
    });
    expect(statsSchema.validate({ ...stats(), dailyTimes: 'none' })?.dailyTimes).toEqual({});
  });

  it('keeps at most the bounded number of cleared days', () => {
    const many: Record<string, number> = {};
    for (let day = 0; day < MAX_DAILY_ENTRIES + 10; day++) {
      const date = new Date(2020, 0, 1 + day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      many[key] = 60;
    }
    const read = statsSchema.validate({ ...stats(), dailyTimes: many })!;
    expect(Object.keys(read.dailyTimes)).toHaveLength(MAX_DAILY_ENTRIES);
  });
});

describe('flags and the remembered difficulty (§10)', () => {
  it('reads the tutorial flag, and nothing that is not one', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.defaultValue().tutorialCompleted).toBe(false);
  });

  it('remembers a difficulty, and falls back to Easy for anything else', () => {
    expect(prefsSchema.defaultValue().difficulty).toBe('easy');
    expect(prefsSchema.validate({ schemaVersion: 1, difficulty: 'hard' })?.difficulty).toBe('hard');
    for (const difficulty of ['expert', 'toString', undefined, 3]) {
      expect(prefsSchema.validate({ schemaVersion: 1, difficulty })).toBeNull();
    }
    expect(prefsSchema.validate({ schemaVersion: 2, difficulty: 'hard' })).toBeNull();
  });
});

describe('no validator throws, whatever it is handed (§10)', () => {
  const records: [string, { validate: (raw: unknown) => unknown }, object][] = [
    ['stats', statsSchema, stats()],
    ['flags', flagsSchema, { schemaVersion: 1, tutorialCompleted: true }],
    ['prefs', prefsSchema, { schemaVersion: 1, difficulty: 'hard' }],
  ];

  it.each(records)(
    '%s: a getter that throws, on any field at any depth, reads as nothing',
    (_, schema, good) => {
      expect(schema.validate(good)).not.toBeNull();
      for (const path of paths(good)) {
        const hostile = throwingAt(good, path);
        expect(() => schema.validate(hostile), path.join('.')).not.toThrow();
        expect(schema.validate(hostile), path.join('.')).toBeNull();
      }
    },
  );
});
