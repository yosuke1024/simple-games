/**
 * Converts between the in-memory SnakeSession and its persisted form
 * (docs/SNAKE_RULES.md §11).
 *
 * The record is game/serialize.ts's snapshot plus the schema version and the
 * time it was written. What comes back has passed two checks: the schema's
 * (storage/schemas.ts — types and bounds) and the rules' (`restoreSession` —
 * a snake play could have produced). Anything else is null, and the caller
 * lands the player on the game's home with nothing to resume: the record is
 * never repaired and never replaced by a run nobody asked for.
 *
 * A restored run is always paused (§6): nothing moves until the player says
 * Resume.
 */
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord, removeRecord, saveRecord } from '../../../storage/repo';
import { restoreSession, toSnapshot, type SnakeSession } from '../game';
import { gameSchema, type PersistedGame } from './schemas';

/**
 * The record for a run worth coming back to, or null for one that is not — a
 * board never started, or a run already over (§11). A running run is written
 * as the paused run it becomes: `toSnapshot` drops the turns in flight
 * exactly as Pause does.
 */
export function toPersisted(session: SnakeSession, savedAt: number): PersistedGame | null {
  const snapshot = toSnapshot(session);
  if (snapshot === null) return null;
  return {
    schemaVersion: 1,
    seed: snapshot.seed,
    speed: snapshot.speed,
    body: snapshot.body,
    food: snapshot.food,
    score: snapshot.score,
    ticks: snapshot.ticks,
    elapsedSeconds: snapshot.elapsedSeconds,
    ...(snapshot.next === undefined ? {} : { next: snapshot.next }),
    savedAt,
  };
}

/** Fail closed: a record play could not have produced is no run at all. */
export function fromPersisted(persisted: PersistedGame | null): SnakeSession | null {
  // The schema has already shaped it; this guard is for a caller that has not.
  if (!persisted) return null;
  return restoreSession({
    seed: persisted.seed,
    speed: persisted.speed,
    body: persisted.body,
    food: persisted.food,
    score: persisted.score,
    ticks: persisted.ticks,
    elapsedSeconds: persisted.elapsedSeconds,
    ...(persisted.next === undefined ? {} : { next: persisted.next }),
  });
}

export async function loadSavedGame(kv: KVStore = preferencesKV): Promise<SnakeSession | null> {
  return fromPersisted(await loadRecord(gameSchema, kv));
}

/** Writes the run if it is one to come back to; a board never started or a finished run is not. */
export async function saveGame(session: SnakeSession, kv: KVStore = preferencesKV): Promise<void> {
  const record = toPersisted(session, Date.now());
  if (record === null) return;
  await saveRecord(gameSchema, record, kv);
}

export async function clearSavedGame(kv: KVStore = preferencesKV): Promise<void> {
  await removeRecord(gameSchema.key, kv);
}
