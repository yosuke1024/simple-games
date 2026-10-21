/**
 * The four records Overtake keeps (docs/OVERTAKE_RULES.md §9): what they
 * accept, what they refuse, and that a refusal is the whole record falling
 * back to its default — never a thrown error, never a field patched in.
 *
 * There is no saved race and so no gamePersistence.ts (§9,
 * src/test/shortcutResumeWiring.test.ts): these schemas, loaded through the
 * shared `loadRecord` / `saveRecord`, are all the persistence this game has.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KVStore } from '../../../storage/kv';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import type { SchemaDef } from '../../../storage/schemas';
import { OT_STORAGE_KEYS } from './keys';
import { flagsSchema, prefsSchema, progressSchema, statsSchema } from './schemas';

/** A memory store that also remembers every key written to it. */
function recordingKV(initial: Record<string, string> = {}): { kv: KVStore; written: string[] } {
  const inner = createMemoryKV(initial);
  const written: string[] = [];
  return {
    written,
    kv: {
      get: (key) => inner.get(key),
      set: (key, value) => {
        written.push(key);
        return inner.set(key, value);
      },
      remove: (key) => inner.remove(key),
    },
  };
}

const SCHEMAS = [progressSchema, statsSchema, flagsSchema, prefsSchema] as SchemaDef<unknown>[];

/** A played device's record for each key — every one different from its default. */
const PLAYED: Record<string, unknown> = {
  [OT_STORAGE_KEYS.progress]: { schemaVersion: 1, highestUnlocked: 37 },
  [OT_STORAGE_KEYS.stats]: { schemaVersion: 1, played: 58, totalPlaySeconds: 2_917 },
  [OT_STORAGE_KEYS.flags]: { schemaVersion: 1, tutorialCompleted: true },
  [OT_STORAGE_KEYS.prefs]: { schemaVersion: 1, controls: 'buttons' },
};

/** Shapes that must fall back to the default, per key: corrupt, mistyped, out of range. */
const REFUSED: Record<string, readonly unknown[]> = {
  [OT_STORAGE_KEYS.progress]: [
    { schemaVersion: 1, highestUnlocked: 0 },
    { schemaVersion: 1, highestUnlocked: 102 },
    { schemaVersion: 1, highestUnlocked: 3.5 },
    { schemaVersion: 1, highestUnlocked: '12' },
    { schemaVersion: 2, highestUnlocked: 12 },
    { highestUnlocked: 12 },
  ],
  [OT_STORAGE_KEYS.stats]: [
    { schemaVersion: 1, played: 3 },
    { schemaVersion: 1, played: -1, totalPlaySeconds: 0 },
    { schemaVersion: 1, played: 2, totalPlaySeconds: 1.5 },
    { schemaVersion: 1, played: 2, totalPlaySeconds: Number.MAX_SAFE_INTEGER },
    { schemaVersion: 1, played: '2', totalPlaySeconds: 0 },
    { schemaVersion: 0, played: 2, totalPlaySeconds: 0 },
    { played: 2, totalPlaySeconds: 0 },
  ],
  [OT_STORAGE_KEYS.flags]: [
    { schemaVersion: 1, tutorialCompleted: 'yes' },
    { schemaVersion: 1 },
    { schemaVersion: 2, tutorialCompleted: true },
  ],
  [OT_STORAGE_KEYS.prefs]: [
    { schemaVersion: 1, controls: 'tilt' },
    { schemaVersion: 1, controls: 'A' },
    { schemaVersion: 1, controls: null },
    { schemaVersion: 1 },
    { schemaVersion: 2, controls: 'drag' },
  ],
};

/** Not records at all. */
const NOT_RECORDS: readonly unknown[] = [null, undefined, 7, 'drag', true, [], [1, 2]];

describe('the keys (§9)', () => {
  it('are the four of §9, in its order, all under ot.', () => {
    expect(Object.values(OT_STORAGE_KEYS)).toEqual([
      'ot.progress',
      'ot.stats',
      'ot.flags',
      'ot.prefs',
    ]);
    expect(SCHEMAS.map((schema) => schema.key)).toEqual(Object.values(OT_STORAGE_KEYS));
  });

  it('keep no saved race: no `save` key', () => {
    expect(Object.values(OT_STORAGE_KEYS).some((key) => /save/i.test(key))).toBe(false);
  });

  it('live in an import-free leaf (the registry reads them without the game)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'keys.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\b/m);
  });
});

describe('defaults (§9)', () => {
  it('a fresh install: level 1, nothing counted, Quick Rules unseen, Drag', () => {
    expect(progressSchema.defaultValue()).toEqual({ schemaVersion: 1, highestUnlocked: 1 });
    expect(statsSchema.defaultValue()).toEqual({
      schemaVersion: 1,
      played: 0,
      totalPlaySeconds: 0,
    });
    expect(flagsSchema.defaultValue()).toEqual({ schemaVersion: 1, tutorialCompleted: false });
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, controls: 'drag' });
  });

  it('every default is itself a record its schema accepts', () => {
    for (const schema of SCHEMAS)
      expect(schema.validate(schema.defaultValue())).toEqual(schema.defaultValue());
  });
});

describe('round trips through the store', () => {
  it.each(SCHEMAS.map((schema) => [schema.key, schema] as const))(
    '%s comes back as it was saved',
    async (key, schema) => {
      const { kv, written } = recordingKV();
      await saveRecord(schema, PLAYED[key], kv);
      expect(await loadRecord(schema, kv)).toEqual(PLAYED[key]);
      // Only this game's own key was touched.
      expect(written).toEqual([key]);
    },
  );

  it('the "all cleared" frontier, 101, survives the trip', async () => {
    const kv = createMemoryKV();
    await saveRecord(progressSchema, { schemaVersion: 1, highestUnlocked: 101 }, kv);
    expect((await loadRecord(progressSchema, kv)).highestUnlocked).toBe(101);
  });
});

describe('corruption fails closed (§9)', () => {
  it.each(SCHEMAS.map((schema) => [schema.key, schema] as const))(
    '%s: refused shapes fall back to the whole default, without throwing',
    async (key, schema) => {
      for (const raw of [...REFUSED[key]!, ...NOT_RECORDS]) {
        expect(() => schema.validate(raw)).not.toThrow();
        expect(schema.validate(raw), JSON.stringify(raw)).toBeNull();
        const kv = createMemoryKV({ [key]: JSON.stringify(raw) ?? 'undefined' });
        expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
      }
    },
  );

  it.each(SCHEMAS.map((schema) => [schema.key, schema] as const))(
    '%s: text that is not JSON at all reads as the default',
    async (key, schema) => {
      for (const text of ['{', 'not json', '', '{"schemaVersion":1,']) {
        const kv = createMemoryKV({ [key]: text });
        expect(await loadRecord(schema, kv)).toEqual(schema.defaultValue());
      }
    },
  );

  it('a record with extra fields keeps only its own (no stray field is carried along)', () => {
    expect(
      statsSchema.validate({ schemaVersion: 1, played: 4, totalPlaySeconds: 90, cleared: 9 }),
    ).toEqual({ schemaVersion: 1, played: 4, totalPlaySeconds: 90 });
    expect(prefsSchema.validate({ schemaVersion: 1, controls: 'buttons', mapping: 'A' })).toEqual({
      schemaVersion: 1,
      controls: 'buttons',
    });
  });

  it('one corrupt record leaves the other three as they were', async () => {
    const kv = createMemoryKV({
      [OT_STORAGE_KEYS.progress]: '{"schemaVersion":1,"highestUnlocked":-4}',
      [OT_STORAGE_KEYS.stats]: JSON.stringify(PLAYED[OT_STORAGE_KEYS.stats]),
      [OT_STORAGE_KEYS.flags]: JSON.stringify(PLAYED[OT_STORAGE_KEYS.flags]),
      [OT_STORAGE_KEYS.prefs]: JSON.stringify(PLAYED[OT_STORAGE_KEYS.prefs]),
    });
    expect(await loadRecord(progressSchema, kv)).toEqual(progressSchema.defaultValue());
    expect(await loadRecord(statsSchema, kv)).toEqual(PLAYED[OT_STORAGE_KEYS.stats]);
    expect(await loadRecord(flagsSchema, kv)).toEqual(PLAYED[OT_STORAGE_KEYS.flags]);
    expect(await loadRecord(prefsSchema, kv)).toEqual(PLAYED[OT_STORAGE_KEYS.prefs]);
  });
});
