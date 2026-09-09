/**
 * The records a released build actually wrote, read by today's validators
 * (issue #170, docs/BUNNY_HOP_RULES.md §9, §10).
 *
 * Two records and no more: the track is real time and endless, so there is no
 * level to unlock and no run to restore. What is left is the only thing a
 * player here can lose — the best they have ever done. Bunny Hop has never
 * migrated a record, so both keys are still v1 and nothing has forced the
 * question yet. That is exactly why this file exists: the day a schema here
 * goes to v2, the only thing between a player and a reset best score is a
 * validator, and a validator is only proven by data it did not generate
 * itself. Building the payload from `defaultValue()` would prove nothing — it
 * would follow the schema wherever the schema went.
 *
 * Provenance: played in the browser, in this repository's own web build — the
 * hops dispatched by a script through the game's own pointer handlers, which
 * is how one run got to 96 obstacles — and the two strings below are what
 * Capacitor Preferences held afterwards, copied verbatim. This game's `game/`
 * and `storage/` trees are byte-identical to v1.2.2 (verified with
 * `git rev-parse v1.2.2:.../games/bunny-hop/storage`), so what the shipped app
 * wrote is what these strings are.
 *
 * Do not regenerate them to make a change go green: a payload that has to be
 * rewritten is a payload existing players cannot load either.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { BH_STORAGE_KEYS, flagsSchema, statsSchema } from './schemas';

/** Capacitor Preferences, as it stood after five runs in the browser. */
const RELEASED: Record<string, string> = {
  [BH_STORAGE_KEYS.flags]: '{"schemaVersion":1,"tutorialCompleted":true}',
  [BH_STORAGE_KEYS.stats]:
    '{"schemaVersion":1,"played":5,"bestScore":1746,"obstaclesPassed":96,"totalPlaySeconds":132}',
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
      played: 5,
      bestScore: 1746,
      obstaclesPassed: 96,
      totalPlaySeconds: 132,
    });
  });
});

describe('data it cannot use', () => {
  const cases: [string, string][] = [
    ['a version it does not know', '{"schemaVersion":99,"bestScore":1746}'],
    ['text that is not JSON', '{"schemaVersion":1,'],
    ['the wrong shape entirely', '[]'],
  ];

  it.each(cases)('falls back to the flags default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BH_STORAGE_KEYS.flags]: raw });
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it.each(cases)('falls back to the statistics default for %s', async (_label, raw) => {
    const kv = createMemoryKV({ [BH_STORAGE_KEYS.stats]: raw });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });

  it('drops the whole statistics record when one number is unusable', async () => {
    // Deliberate, and worth stating: the numbers here are one record, and a
    // best score of NaN — or of -1 — is not a record with one bad field, it
    // is data this game did not write.
    const kv = createMemoryKV({
      [BH_STORAGE_KEYS.stats]:
        '{"schemaVersion":1,"played":5,"bestScore":-1,"obstaclesPassed":96,"totalPlaySeconds":132}',
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
  });
});
