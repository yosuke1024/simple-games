/**
 * Gem Swap's four records (docs/GEM_SWAP_RULES.md §7): what is kept, what a
 * save round-trips to, and every way a stored value is refused rather than
 * repaired (fail-closed). The saved round is checked through the rules — a
 * replay of (seed, gem count, swaps) — so the cases below include records
 * that are well-formed JSON of the right shape and still impossible.
 */
import { describe, expect, it } from 'vitest';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createMemoryKV } from '../../../storage/kv';
import {
  createRound,
  gemSwapSeed,
  MAX_ROUND_SCORE,
  ROUND_SWAPS,
  trySwap,
  type Round,
} from '../game';
import { firstValid, invalidAdjacent, playFirst, roundAfter } from '../game/play-helpers';
import {
  clearSavedGame,
  fromPersisted,
  loadSavedGame,
  saveGame,
  toPersisted,
} from './gamePersistence';
import {
  flagsSchema,
  gameSchema,
  GS_STORAGE_KEYS,
  prefsSchema,
  statsSchema,
  type PersistedGame,
} from './schemas';

const recordOf = (round: Round, elapsedSeconds = 0): PersistedGame =>
  toPersisted({ round, elapsedSeconds }, 1700000000000)!;

describe('the keys (⑩)', () => {
  it('are the four §7 names, all under this game’s own prefix', () => {
    expect(Object.values(GS_STORAGE_KEYS).sort()).toEqual([
      'gs.flags',
      'gs.prefs',
      'gs.saveGame',
      'gs.stats',
    ]);
    for (const key of Object.values(GS_STORAGE_KEYS)) expect(key.startsWith('gs.')).toBe(true);
    // Each schema writes the key it is named for, and no other.
    expect([gameSchema.key, statsSchema.key, flagsSchema.key, prefsSchema.key].sort()).toEqual(
      Object.values(GS_STORAGE_KEYS).sort(),
    );
  });
});

describe('the saved round (④ round trip)', () => {
  it('writes the replay triple and the seconds, never a board', () => {
    const round = roundAfter(5);
    const record = recordOf(round, 61);
    expect(Object.keys(record).sort()).toEqual([
      'colors',
      'elapsedSeconds',
      'savedAt',
      'schemaVersion',
      'seed',
      'swaps',
    ]);
    expect(record.swaps).toHaveLength(5);
    expect(record.elapsedSeconds).toBe(61);
  });

  it('comes back through JSON as the same round, Undo history included', async () => {
    const kv = createMemoryKV();
    const round = roundAfter(12);
    await saveGame({ round, elapsedSeconds: 33 }, kv);
    const back = await loadSavedGame(kv);
    expect(back?.elapsedSeconds).toBe(33);
    expect(JSON.stringify(back?.round)).toBe(JSON.stringify(round));
  });

  it('reads a reversed pair as its normalised form', () => {
    const round = roundAfter(2);
    const record = recordOf(round);
    const reversed = { ...record, swaps: record.swaps.map(([a, b]) => [b, a]) };
    expect(gameSchema.validate(reversed)?.swaps).toEqual(record.swaps);
  });

  it('never writes a finished round, and clearing removes the slot', async () => {
    const kv = createMemoryKV();
    const over = playFirst(createRound(gemSwapSeed('over'), 6), ROUND_SWAPS);
    expect(over.status).toBe('over');
    await saveGame({ round: over, elapsedSeconds: 1 }, kv);
    expect(await kv.get(GS_STORAGE_KEYS.game)).toBeNull();
    await saveGame({ round: roundAfter(1), elapsedSeconds: 1 }, kv);
    expect(await kv.get(GS_STORAGE_KEYS.game)).not.toBeNull();
    await clearSavedGame(kv);
    expect(await kv.get(GS_STORAGE_KEYS.game)).toBeNull();
    expect(fromPersisted(null)).toBeNull();
  });
});

describe('the saved round, refused (⑤ fail-closed)', () => {
  const base = recordOf(roundAfter(3));
  const round = roundAfter(3);

  it.each<[string, unknown]>([
    ['not a record', 'gem'],
    ['null', null],
    ['an unknown version', { ...base, schemaVersion: 2 }],
    ['no savedAt', { ...base, savedAt: undefined }],
    ['an empty seed', { ...base, seed: '' }],
    ['a seed that is a number', { ...base, seed: 42 }],
    ['an over-long seed', { ...base, seed: 'x'.repeat(201) }],
    ['seven gems', { ...base, colors: 7 }],
    ['a gem count as text', { ...base, colors: '6' }],
    ['negative seconds', { ...base, elapsedSeconds: -1 }],
    ['fractional seconds', { ...base, elapsedSeconds: 2.5 }],
    ['swaps that are not a list', { ...base, swaps: '0,1' }],
    ['a pair of one', { ...base, swaps: [[0]] }],
    ['a pair of three', { ...base, swaps: [[0, 1, 2]] }],
    ['a cell past the board', { ...base, swaps: [[63, 64]] }],
    ['a negative cell', { ...base, swaps: [[-1, 0]] }],
    ['a cell as text', { ...base, swaps: [['0', '1']] }],
    ['two cells that are not neighbours', { ...base, swaps: [...base.swaps, [0, 2]] }],
    ['a diagonal pair', { ...base, swaps: [...base.swaps, [0, 9]] }],
    ['31 swaps', { ...base, swaps: Array.from({ length: 31 }, () => [0, 1]) }],
  ])('refuses %s', (_, raw) => {
    expect(gameSchema.validate(raw)).toBeNull();
  });

  it('refuses a swap that makes no line', () => {
    const [a, b] = invalidAdjacent(round);
    expect(gameSchema.validate({ ...base, swaps: [...base.swaps, [a, b]] })).toBeNull();
  });

  it('refuses a round that replays to a finished one, and any swap after the end', () => {
    const last = roundAfter(ROUND_SWAPS - 1);
    const [a, b] = firstValid(last);
    const finished = trySwap(last, a, b)!.round;
    expect(finished.status).toBe('over');
    const raw = {
      ...recordOf(last),
      swaps: finished.swaps.map(([x, y]) => [x, y]),
    };
    expect(gameSchema.validate(raw)).toBeNull();
  });

  it('refuses through the loader too: a stored impossible round loads as nothing', async () => {
    const kv = createMemoryKV({
      [GS_STORAGE_KEYS.game]: JSON.stringify({ ...base, swaps: [...base.swaps, [0, 9]] }),
    });
    expect(await loadSavedGame(kv)).toBeNull();
    // Reading never deletes: the slot's next write replaces it.
    expect(await kv.get(GS_STORAGE_KEYS.game)).not.toBeNull();
  });

  it('refuses unparseable JSON without throwing', async () => {
    const kv = createMemoryKV({ [GS_STORAGE_KEYS.game]: '{"seed":' });
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('statistics, flags and the gem count', () => {
  it('round-trip, and default to nothing played and six gems', async () => {
    const kv = createMemoryKV();
    expect(await loadRecord(statsSchema, kv)).toEqual({
      schemaVersion: 1,
      played: 0,
      best5: 0,
      best6: 0,
      totalPlaySeconds: 0,
    });
    expect(await loadRecord(prefsSchema, kv)).toEqual({ schemaVersion: 1, colors: 6 });
    const stats = {
      schemaVersion: 1 as const,
      played: 4,
      best5: 120,
      best6: 0,
      totalPlaySeconds: 600,
    };
    await saveRecord(statsSchema, stats, kv);
    expect(await loadRecord(statsSchema, kv)).toEqual(stats);
    await saveRecord(prefsSchema, { schemaVersion: 1, colors: 5 }, kv);
    expect(await loadRecord(prefsSchema, kv)).toEqual({ schemaVersion: 1, colors: 5 });
  });

  it.each<[string, unknown]>([
    ['a best of 1 (a counted round clears at least three)', { best5: 1 }],
    ['a best of 2', { best6: 2 }],
    ['a best past any possible round', { best6: MAX_ROUND_SCORE + 1 }],
    ['a negative play count', { played: -1 }],
    ['fractional seconds', { totalPlaySeconds: 1.5 }],
    ['a missing best', { best5: undefined }],
  ])('refuses statistics with %s', (_, patch) => {
    const good = { schemaVersion: 1, played: 3, best5: 0, best6: 50, totalPlaySeconds: 9 };
    expect(statsSchema.validate(good)).not.toBeNull();
    expect(statsSchema.validate({ ...good, ...(patch as object) })).toBeNull();
  });

  it('refuses a gem count the game does not offer, and a flag that is not a boolean', () => {
    expect(prefsSchema.validate({ schemaVersion: 1, colors: 7 })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, colors: 4 })).toBeNull();
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
  });
});
