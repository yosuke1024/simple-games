/**
 * Load/save helpers on top of the KV store. Never throw; corrupt or missing
 * data falls back to the schema default.
 */
import type { KVStore } from './kv';
import { preferencesKV } from './kv';
import type { SchemaDef } from './schemas';

/**
 * How many times the local data has been wiped this session. Saves are
 * fire-and-forget everywhere in the app (a game must never wait on storage to
 * stay playable), so a write can still be in flight when "Reset Local Data"
 * runs — and land afterwards, recreating a record the player just deleted.
 * A write records the count it started under and undoes itself if a wipe
 * overtook it. Every record is covered, not just the shell's: a game saves on
 * every move, so its board is the likeliest write to be in the air.
 */
let wipes = 0;

export async function loadRecord<T>(def: SchemaDef<T>, kv: KVStore = preferencesKV): Promise<T> {
  const raw = await kv.get(def.key);
  if (raw === null) return def.defaultValue();
  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = def.validate(parsed);
    return validated ?? def.defaultValue();
  } catch {
    return def.defaultValue();
  }
}

export async function saveRecord<T>(
  def: SchemaDef<T>,
  value: T,
  kv: KVStore = preferencesKV,
): Promise<void> {
  const startedAt = wipes;
  try {
    await kv.set(def.key, JSON.stringify(value));
    if (wipes !== startedAt) await kv.remove(def.key);
  } catch {
    // Keep playing even when saving fails.
  }
}

export async function removeRecord(key: string, kv: KVStore = preferencesKV): Promise<void> {
  await kv.remove(key);
}

/**
 * Settings画面の「ローカルデータ削除」。The shell collects the shared keys and
 * every registered game's keys — storage itself does not know the games.
 *
 * The counter is raised before the first removal, so a write that is already
 * in flight cleans up after itself rather than outliving the delete.
 */
export async function clearLocalData(
  keys: readonly string[],
  kv: KVStore = preferencesKV,
): Promise<void> {
  wipes += 1;
  await Promise.all(keys.map((key) => kv.remove(key)));
}
