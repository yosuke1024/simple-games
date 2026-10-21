/**
 * The two small records' validators (docs/NESTED_TIC_TAC_TOE_RULES.md §8.4,
 * §8.5): `nt.stats` is all or nothing, and `nt.prefs` falls back to moving
 * first. Both never throw.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { flagsSchema, NT_STORAGE_KEYS, prefsSchema, statsSchema } from './schemas';

const record = () => ({
  schemaVersion: 1,
  totalPlaySeconds: 3600,
  easy: { played: 5, wins: 3, losses: 1, draws: 1 },
  normal: { played: 2, wins: 0, losses: 2, draws: 0 },
  hard: { played: 0, wins: 0, losses: 0, draws: 0 },
});

describe('nt.stats (§8.5)', () => {
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
      [NT_STORAGE_KEYS.stats]: JSON.stringify({ ...record(), hard: null }),
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect(statsSchema.defaultValue().easy).toEqual({ played: 0, wins: 0, losses: 0, draws: 0 });
  });
});

describe('nt.prefs (§8.4)', () => {
  it('holds who moves first and nothing else, first by default', () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, playerGoesFirst: true });
    expect(prefsSchema.validate({ schemaVersion: 1, playerGoesFirst: false })).toEqual({
      schemaVersion: 1,
      playerGoesFirst: false,
    });
  });

  it.each([
    ['an unknown version', { schemaVersion: 2, playerGoesFirst: false }],
    ['a side that is not a boolean', { schemaVersion: 1, playerGoesFirst: 0 }],
    ['nothing at all', null],
  ])('refuses %s, and the default stands', async (_, raw) => {
    expect(prefsSchema.validate(raw)).toBeNull();
    const kv = createMemoryKV({ [NT_STORAGE_KEYS.prefs]: JSON.stringify(raw) });
    expect((await loadRecord(prefsSchema, kv)).playerGoesFirst).toBe(true);
  });
});

describe('nt.flags (§8.4)', () => {
  it('fails closed to "not taught yet"', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.defaultValue().tutorialCompleted).toBe(false);
  });
});

describe('the keys (§8)', () => {
  it('are declared in the order the registry lists them', () => {
    expect(Object.values(NT_STORAGE_KEYS)).toEqual([
      'nt.saveGame',
      'nt.stats',
      'nt.flags',
      'nt.prefs',
    ]);
  });
});
