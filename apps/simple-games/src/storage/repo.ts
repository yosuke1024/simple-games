/**
 * Load/save helpers on top of the KV store. Never throw; corrupt or missing
 * data falls back to the schema default.
 */
import type { KVStore } from './kv';
import { preferencesKV } from './kv';
import type { SchemaDef } from './schemas';

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
  try {
    await kv.set(def.key, JSON.stringify(value));
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
 */
export async function clearLocalData(
  keys: readonly string[],
  kv: KVStore = preferencesKV,
): Promise<void> {
  await Promise.all(keys.map((key) => kv.remove(key)));
}
