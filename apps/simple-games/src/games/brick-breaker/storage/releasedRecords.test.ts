/**
 * The records a released build actually wrote, read by today's validators
 * (issue #170, docs/BRICK_BREAKER_RULES.md §7, §9).
 *
 * There is no saved game here — a real-time board cannot be suspended
 * honestly (§10) — so what a player would lose is the ladder itself:
 * `bb.progress` is the only record of which levels they opened, and the
 * frontier never goes backwards (§7). Brick Breaker has never migrated a
 * record, so every stored key is still v1 and nothing has forced the question
 * yet. That is exactly why this file exists: the day a schema here goes to v2,
 * the only thing between a player and a reset ladder is a validator, and a
 * validator is only proven by data it did not generate itself. Building the
 * payload from `defaultValue()` would prove nothing — it would follow the
 * schema wherever the schema went.
 *
 * Provenance: played in the browser, in this repository's own web build —
 * level 1 cleared, the paddle steered by a script through the game's own
 * pointer handlers — and the three strings below are what Capacitor
 * Preferences held afterwards, copied verbatim. This game's `game/` and
 * `storage/` trees are byte-identical to v1.2.2 (verified with
 * `git rev-parse v1.2.2:.../games/brick-breaker/storage`), so what the shipped
 * app wrote is what these strings are.
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { LEVEL_COUNT } from '../game/levels';
import { BB_STORAGE_KEYS, flagsSchema, progressSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after clearing level 1 in the browser. */
const RELEASED: Record<string, string> = {
  [BB_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [BB_STORAGE_KEYS.stats]: '{"schemaVersion":1,"played":2,"cleared":1,"totalPlaySeconds":41}',
  [BB_STORAGE_KEYS.progress]: '{"schemaVersion":1,"highestUnlocked":2}',
};

const released = () => createMemoryKV({ ...RELEASED });

describe('records a released build wrote', () => {
  it('reads the one-time flags', async () => {
    expect(await loadRecord(flagsSchema, released())).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
  });

  it('reads every statistic, not a default in the shape of one', async () => {
    expect(await loadRecord(statsSchema, released())).toEqual({
      schemaVersion: 1,
      played: 2,
      cleared: 1,
      totalPlaySeconds: 41,
    });
  });

  it('keeps the level the player opened', async () => {
    expect(await loadRecord(progressSchema, released())).toEqual({
      schemaVersion: 1,
      highestUnlocked: 2,
    });
  });

  it('still reads a record from someone who has cleared the last level', async () => {
    // The frontier goes one past the end and stays there (§7): a range check
    // that stopped at LEVEL_COUNT would send the one player who finished the
    // game back to level 1.
    const kv = createMemoryKV({
      [BB_STORAGE_KEYS.progress]: `{"schemaVersion":1,"highestUnlocked":${LEVEL_COUNT + 1}}`,
    });
    expect((await loadRecord(progressSchema, kv)).highestUnlocked).toBe(LEVEL_COUNT + 1);
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"highestUnlocked":40}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BB_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BB_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it.each(cases)('falls back to level 1 for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BB_STORAGE_KEYS.progress]: raw });
    expect(await loadRecord(progressSchema, kv)).toEqual(progressSchema.defaultValue());
  });

  it('refuses a frontier past the end of the ladder', async () => {
    // Not a migration case but a corruption one: a number nobody could have
    // earned is data from something else, and the safe reading is the start.
    const kv = createMemoryKV({
      [BB_STORAGE_KEYS.progress]: `{"schemaVersion":1,"highestUnlocked":${LEVEL_COUNT + 2}}`,
    });
    expect(await loadRecord(progressSchema, kv)).toEqual(progressSchema.defaultValue());
  });
});
