/**
 * What a saved run has to prove before it is handed back
 * (docs/SNAKE_RULES.md §11): a shape the schema accepts, a snake the rules
 * could have produced, and a run that is still under way. Anything else goes
 * back to the game's home — never repaired, never replaced by a new run
 * nobody asked for. And the other three records: what they accept, and that
 * one bad field throws the whole record back to its defaults.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import {
  cellAt,
  createSession,
  encodeBody,
  INITIAL_BODY,
  MAX_SCORE,
  pause,
  resume,
  start,
  tick,
  turn,
  type SnakeSession,
} from '../game';
import { cyclePilot, cycleSuccessors, playRun } from '../game/test-helpers';
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
  prefsSchema,
  SN_STORAGE_KEYS,
  statsSchema,
  type PersistedGame,
} from './schemas';

const SEED = 'snake-persist';

const stored = (raw: string) => createMemoryKV({ [SN_STORAGE_KEYS.game]: raw });
const saved = (record: unknown) => stored(JSON.stringify(record));

/** A few moves in, nothing eaten: a run worth coming back to. */
function midRun(): SnakeSession {
  let session = start(createSession(SEED, 'fast'));
  session = tick(session).session;
  session = turn(session, 'up');
  session = tick(session).session;
  session = tick(session).session;
  return pause(session);
}

function recordOf(session: SnakeSession, savedAt = 1): PersistedGame {
  const record = toPersisted(session, savedAt);
  if (record === null) throw new Error('expected a record');
  return record;
}

describe('resuming a saved run (§11)', () => {
  it('gives back the run that was saved, paused', async () => {
    const session = midRun();
    const loaded = await loadSavedGame(saved(recordOf(session)));
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe('paused');
    expect(loaded!.seed).toBe(session.seed);
    expect(loaded!.speed).toBe('fast');
    expect(loaded!.body).toEqual(session.body);
    expect(loaded!.food).toBe(session.food);
    expect(loaded!.ticks).toBe(session.ticks);
    expect(loaded!.direction).toBe('up');
  });

  it('round-trips through JSON as the provider writes it, with the chosen heading', async () => {
    const kv = createMemoryKV();
    const session = turn(midRun(), 'left');
    await saveGame(session, kv);
    const raw = await kv.get(SN_STORAGE_KEYS.game);
    expect(JSON.parse(raw!)).toMatchObject({ schemaVersion: 1, next: 'left', speed: 'fast' });
    const loaded = await loadSavedGame(kv);
    expect(loaded!.queue).toEqual(['left']);
    expect(loaded!.status).toBe('paused');
  });

  it('brings a running run back as the paused run it becomes, without its queued turns', async () => {
    let running = start(createSession(SEED));
    running = turn(turn(running, 'up'), 'left');
    expect(running.queue).toEqual(['up', 'left']);
    const record = recordOf(running);
    expect(record.next).toBeUndefined();
    const loaded = fromPersisted(record);
    expect(loaded!.status).toBe('paused');
    expect(loaded!.queue).toEqual([]);
  });

  it('writes exactly the fields §11 lists, and no status', () => {
    const keys = Object.keys(recordOf(midRun())).sort();
    expect(keys).toEqual(
      [
        'body',
        'elapsedSeconds',
        'food',
        'savedAt',
        'schemaVersion',
        'score',
        'seed',
        'speed',
        'ticks',
      ].sort(),
    );
  });

  it('writes whole seconds even when the clock hands it a fraction', () => {
    expect(recordOf({ ...midRun(), elapsedSeconds: 12.9 }).elapsedSeconds).toBe(12);
  });

  it('continues tick for tick like the run that never stopped — food included', async () => {
    // Long enough to have eaten several times, so the restored food draws
    // are the seed's later draws, not just its first.
    const pilot = cyclePilot(cycleSuccessors());
    const played = playRun(start(createSession('snake-persist-long')), pilot, 900);
    expect(played.session.score).toBeGreaterThan(3);
    const original = pause(played.session);
    const loaded = await loadSavedGame(saved(recordOf(original)));
    expect(loaded).not.toBeNull();

    let a = resume(original);
    let b = resume(loaded!);
    for (let i = 0; i < 300; i++) {
      a = tick(turn(a, pilot(a))).session;
      b = tick(turn(b, pilot(b))).session;
      expect(b.body).toEqual(a.body);
      expect(b.food).toBe(a.food);
      expect(b.score).toBe(a.score);
    }
  });

  it('keeps nothing when nothing was saved, and nothing after the slot is cleared', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
    const kv = createMemoryKV();
    await saveGame(midRun(), kv);
    expect(await loadSavedGame(kv)).not.toBeNull();
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('never written (§11)', () => {
  it('a board that never started', async () => {
    const kv = createMemoryKV();
    const ready = createSession(SEED);
    expect(toPersisted(ready, 1)).toBeNull();
    await saveGame(ready, kv);
    expect(await kv.get(SN_STORAGE_KEYS.game)).toBeNull();
  });

  it('a run that has ended', async () => {
    // Straight right from the opening hits the wall in ten moves.
    let session = start(createSession(SEED));
    for (let i = 0; i < 20 && session.status === 'running'; i++) session = tick(session).session;
    expect(session.status).toBe('over');
    expect(toPersisted(session, 1)).toBeNull();
    const kv = createMemoryKV();
    await saveGame(session, kv);
    expect(await kv.get(SN_STORAGE_KEYS.game)).toBeNull();
  });
});

describe('discarding what play could not have produced (§11)', () => {
  const good = () => recordOf(midRun());

  it('truncated or unparseable JSON', async () => {
    const text = JSON.stringify(good());
    expect(await loadSavedGame(stored(text.slice(0, text.length - 7)))).toBeNull();
    expect(await loadSavedGame(stored('{'))).toBeNull();
    expect(await loadSavedGame(stored('not json at all'))).toBeNull();
    expect(await loadSavedGame(stored(''))).toBeNull();
  });

  it('something that is not a record at all', async () => {
    for (const raw of [null, 7, 'x', [], true]) {
      expect(await loadSavedGame(saved(raw))).toBeNull();
    }
  });

  it('a different schema version', async () => {
    expect(await loadSavedGame(saved({ ...good(), schemaVersion: 2 }))).toBeNull();
    const { schemaVersion: _v, ...unversioned } = good();
    expect(await loadSavedGame(saved(unversioned))).toBeNull();
  });

  it('a field of the wrong type, or missing', async () => {
    const record = good();
    const broken: unknown[] = [
      { ...record, seed: 42 },
      { ...record, seed: '' },
      { ...record, seed: 'x'.repeat(201) },
      { ...record, speed: 'turbo' },
      { ...record, speed: null },
      { ...record, body: 2 },
      { ...record, body: '' },
      { ...record, food: '5' },
      { ...record, food: 1.5 },
      { ...record, score: -1 },
      { ...record, ticks: 'many' },
      { ...record, ticks: 1e9 + 1 },
      { ...record, elapsedSeconds: -3 },
      { ...record, elapsedSeconds: Number.NaN },
      { ...record, savedAt: 'yesterday' },
      { ...record, next: 'sideways' },
      { ...record, next: 3 },
    ];
    for (const key of Object.keys(record)) {
      const copy: Record<string, unknown> = { ...record };
      delete copy[key];
      broken.push(copy);
    }
    for (const raw of broken) {
      expect(await loadSavedGame(saved(raw)), JSON.stringify(raw)).toBeNull();
    }
  });

  it('a body that is not a snake on this board', async () => {
    const record = good();
    const bodies = [
      'zz2f2e', // a cell past the board
      '2g2f2', // odd length
      '2G2F2E', // upper case is not the encoding
      '2g2g2f', // the same cell twice
      '2g2e2d', // a gap between two cells
      '2g2f', // shorter than the opening snake
      encodeBody([cellAt(0, 13), cellAt(1, 0), cellAt(1, 1)]), // wraps a row
    ];
    for (const body of bodies) {
      expect(await loadSavedGame(saved({ ...record, body })), body).toBeNull();
    }
  });

  it('a body whose length does not match the score', async () => {
    const record = good();
    expect(await loadSavedGame(saved({ ...record, score: 1, ticks: 9 }))).toBeNull();
  });

  it('food under the snake, or not the seed’s first food when nothing was eaten', async () => {
    const record = good();
    expect(await loadSavedGame(saved({ ...record, food: INITIAL_BODY[1] }))).toBeNull();
    const elsewhere = record.food === 0 ? 1 : 0;
    expect(await loadSavedGame(saved({ ...record, food: elsewhere }))).toBeNull();
  });

  it('a history the body cannot have had: turned straight back on the first move', async () => {
    // Left from the opening (facing right) is straight back over the neck.
    const reversed = encodeBody([cellAt(6, 3), cellAt(6, 4), cellAt(6, 5)]);
    expect(
      await loadSavedGame(saved({ ...good(), body: reversed, ticks: 1, food: good().food })),
    ).toBeNull();
  });

  it('a heading chosen while paused that turn() could never have kept', async () => {
    // midRun faces up: up again, and down (straight back), are both refused.
    const record = good();
    expect(await loadSavedGame(saved({ ...record, next: 'up' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, next: 'down' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, next: 'left' }))).not.toBeNull();
  });

  it('a full board — a finished run is never a save', async () => {
    const pilot = cyclePilot(cycleSuccessors());
    const cleared = playRun(start(createSession('snake-persist-full')), pilot, 40_000).session;
    expect(cleared.status).toBe('cleared');
    expect(cleared.score).toBe(MAX_SCORE);
    // Written by hand as if a broken build had saved it, with the last food
    // put back somewhere it could sit.
    const record = {
      schemaVersion: 1,
      seed: cleared.seed,
      speed: cleared.speed,
      body: encodeBody(cleared.body),
      food: 0,
      score: cleared.score,
      ticks: cleared.ticks,
      elapsedSeconds: 0,
      savedAt: 1,
    };
    expect(gameSchema.validate(record)).not.toBeNull();
    expect(await loadSavedGame(saved(record))).toBeNull();
  });

  it('never throws on garbage, at either layer', () => {
    const garbage = [
      null,
      undefined,
      7,
      'x',
      [],
      {},
      { schemaVersion: 1, body: [] },
      { body: 'zz' },
    ];
    for (const raw of garbage) {
      expect(() => gameSchema.validate(raw)).not.toThrow();
      expect(gameSchema.validate(raw)).toBeNull();
      expect(() => fromPersisted(raw as unknown as PersistedGame)).not.toThrow();
    }
  });
});

describe('the other records (§11)', () => {
  it('prefs default to Normal and keep only a known speed (§7)', () => {
    expect(prefsSchema.defaultValue()).toEqual({ schemaVersion: 1, speed: 'normal' });
    expect(prefsSchema.validate({ schemaVersion: 1, speed: 'fast' })).toEqual({
      schemaVersion: 1,
      speed: 'fast',
    });
    expect(prefsSchema.validate({ schemaVersion: 1, speed: 'turbo' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 2, speed: 'fast' })).toBeNull();
    expect(prefsSchema.validate('fast')).toBeNull();
  });

  it('flags keep a boolean and nothing else', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.validate(null)).toBeNull();
  });

  it('keeps a clear even when the run was counted on a record since lost (§11)', () => {
    const base = statsSchema.defaultValue();
    const record = { ...base, normal: { ...base.normal, cleared: 1, bestScore: MAX_SCORE } };
    expect(statsSchema.validate(record)).toEqual(record);
  });

  it('stats round-trip per speed', () => {
    const stats = statsSchema.defaultValue();
    stats.fast = { played: 4, bestScore: MAX_SCORE, cleared: 1, totalPlaySeconds: 1234 };
    stats.slow = { played: 2, bestScore: 17, cleared: 0, totalPlaySeconds: 60 };
    expect(statsSchema.validate(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
  });

  it('stats that play cannot produce are thrown back whole (§11)', () => {
    const base = statsSchema.defaultValue();
    const bad = [
      { ...base, normal: { ...base.normal, bestScore: MAX_SCORE + 1 } },
      { ...base, normal: { ...base.normal, played: 3, cleared: 1, bestScore: 40 } },
      { ...base, normal: { ...base.normal, totalPlaySeconds: -1 } },
      { ...base, normal: { ...base.normal, played: 1.5 } },
      { ...base, fast: undefined },
      { ...base, schemaVersion: 2 },
      [base],
    ];
    for (const raw of bad) expect(statsSchema.validate(raw), JSON.stringify(raw)).toBeNull();
  });

  it('a corrupt record on the device falls back to its default rather than throwing', async () => {
    const kv = createMemoryKV({
      [SN_STORAGE_KEYS.stats]: '{"schemaVersion":1,"slow":',
      [SN_STORAGE_KEYS.prefs]: '{"schemaVersion":1,"speed":"warp"}',
      [SN_STORAGE_KEYS.flags]: 'null',
    });
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect(await loadRecord(prefsSchema, kv)).toEqual(prefsSchema.defaultValue());
    expect(await loadRecord(flagsSchema, kv)).toEqual(flagsSchema.defaultValue());
  });

  it('writes only under its own sn. keys (no other game’s data is touched)', async () => {
    const other = { 'tm.saveGame': '{"keep":true}', 'bh.stats': '{"keep":true}' };
    const kv = createMemoryKV(other);
    await saveGame(midRun(), kv);
    await saveRecord(statsSchema, statsSchema.defaultValue(), kv);
    await saveRecord(prefsSchema, { schemaVersion: 1, speed: 'slow' }, kv);
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    await clearSavedGame(kv);
    expect(await kv.get('tm.saveGame')).toBe(other['tm.saveGame']);
    expect(await kv.get('bh.stats')).toBe(other['bh.stats']);
    for (const key of Object.values(SN_STORAGE_KEYS)) expect(key.startsWith('sn.')).toBe(true);
  });
});
