/**
 * Load/save helpers on top of the KV store. Never throw; corrupt or missing
 * data falls back to the schema default (spec §15.1).
 */
import type { KVStore } from './kv';
import { preferencesKV } from './kv';
import { STORAGE_KEYS, type SchemaDef } from './schemas';

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

/** Settings画面の「ローカルデータ削除」: wipes every stored record. */
export async function clearAllLocalData(kv: KVStore = preferencesKV): Promise<void> {
  await Promise.all(Object.values(STORAGE_KEYS).map((key) => kv.remove(key)));
}
