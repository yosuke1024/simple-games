/**
 * The records' validators (docs/CHESS_RULES.md §7): `ch.stats` is all or
 * nothing, `ch.prefs` falls back to White, `ch.flags` to "not taught yet",
 * and `ch.saveGame`'s shape is checked before its move list is replayed
 * (gamePersistence.test.ts). None of them throws.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { MAX_MOVE_LIST_LENGTH } from '../game';
import { CH_STORAGE_KEYS, flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const record = () => ({
  schemaVersion: 1,
  totalPlaySeconds: 3600,
  easy: { played: 5, wins: 3, losses: 1, draws: 1 },
  normal: { played: 2, wins: 0, losses: 2, draws: 0 },
  hard: { played: 0, wins: 0, losses: 0, draws: 0 },
});

describe('ch.stats (§7.3)', () => {
  it('reads a whole record back as it was', () => {
    expect(statsSchema.validate(record())).toEqual(record());
  });

  it.each([
    ['an unknown version', { ...record(), schemaVersion: 2 }],
    ['a missing difficulty', (({ hard: _hard, ...rest }) => rest)(record())],
    ['a count out of range', { ...record(), easy: { ...record().easy, wins: 1e9 + 1 } }],
    ['a negative count', { ...record(), normal: { ...record().normal, draws: -1 } }],
    ['a fractional count', { ...record(), easy: { ...record().easy, played: 1.5 } }],
    ['a count of the wrong type', { ...record(), hard: { ...record().hard, losses: '0' } }],
    ['total time out of range', { ...record(), totalPlaySeconds: 1e12 + 1 }],
    ['total time missing', (({ totalPlaySeconds: _t, ...rest }) => rest)(record())],
    ['the scaffold’s shape', { schemaVersion: 1, played: 4 }],
    ['not a record', [record()]],
  ])('refuses %s, as a whole', (_, raw) => {
    expect(statsSchema.validate(raw)).toBeNull();
  });

  it('falls back to all zeros, never to the parts that read', async () => {
    const kv = createMemoryKV({
      [CH_STORAGE_KEYS.stats]: JSON.stringify({ ...record(), hard: null }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect(statsSchema.defaultValue().easy).toEqual({ played: 0, wins: 0, losses: 0, draws: 0 });
  });
});

describe('ch.prefs (§7.2)', () => {
  it('holds the side and nothing else, White by default', () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, playerIsWhite: true });
    expect(prefsSchema.validate({ schemaVersion: 1, playerIsWhite: false })).toEqual({
      schemaVersion: 1,
      playerIsWhite: false,
    });
  });

  it.each([
    ['an unknown version', { schemaVersion: 2, playerIsWhite: false }],
    ['a side that is not a boolean', { schemaVersion: 1, playerIsWhite: 0 }],
    ['nothing at all', null],
  ])('refuses %s, and the default stands', async (_, raw) => {
    expect(prefsSchema.validate(raw)).toBeNull();
    const kv = createMemoryKV({ [CH_STORAGE_KEYS.prefs]: JSON.stringify(raw) });
    expect((await loadRecord(prefsSchema, kv)).playerIsWhite).toBe(true);
  });
});

describe('ch.flags', () => {
  it('fails closed to "not taught yet"', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.defaultValue().tutorialCompleted).toBe(false);
  });
});

describe('ch.saveGame — the shape (§7.1)', () => {
  const good = () => ({
    schemaVersion: 1,
    seed: 'chess-abc-def',
    difficulty: 'normal',
    side: 'black',
    moves: 'e2e4',
    elapsedSeconds: 12,
    savedAt: 1,
  });

  it('reads a whole record back as it was', () => {
    expect(gameSchema.validate(good())).toEqual(good());
    expect(gameSchema.defaultValue()).toBeNull();
  });

  it('accepts a move list exactly at the length bound, and not a character over', () => {
    expect(
      gameSchema.validate({ ...good(), moves: 'x'.repeat(MAX_MOVE_LIST_LENGTH) }),
    ).not.toBeNull();
    expect(
      gameSchema.validate({ ...good(), moves: 'x'.repeat(MAX_MOVE_LIST_LENGTH + 1) }),
    ).toBeNull();
  });

  it.each([
    ['an unknown version', { schemaVersion: 2 }],
    ['an empty seed', { seed: '' }],
    ['a seed that is not text', { seed: 7 }],
    ['an over-long seed', { seed: 'x'.repeat(65) }],
    ['an unknown difficulty', { difficulty: 'expert' }],
    ['an unknown side', { side: 'red' }],
    ['a side written as a boolean', { side: true }],
    ['moves that are not text', { moves: ['e2e4'] }],
    ['negative seconds', { elapsedSeconds: -1 }],
    ['fractional seconds', { elapsedSeconds: 1.5 }],
    ['a missing save time', { savedAt: undefined }],
  ])('refuses %s', (_, patch) => {
    expect(gameSchema.validate({ ...good(), ...patch })).toBeNull();
  });
});

describe('the keys (§7)', () => {
  it('are the four of §7, in the order the registry lists them, all under ch.', () => {
    expect(Object.values(CH_STORAGE_KEYS)).toEqual([
      'ch.saveGame',
      'ch.stats',
      'ch.flags',
      'ch.prefs',
    ]);
  });
});
