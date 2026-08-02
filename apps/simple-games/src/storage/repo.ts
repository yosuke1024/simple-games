/**
 * Load/save helpers on top of the KV store. Never throw; corrupt or missing
 * data falls back to the schema default.
 */
import type { KVStore } from './kv';
import { preferencesKV } from './kv';
import type { SchemaDef } from './schemas';

/**
 * The last queued write or removal for each key.
 *
 * Saves are fire-and-forget everywhere in the app — a game must stay playable
 * whether or not storage is keeping up — so several operations on one key can
 * be outstanding at once, and without ordering the one that finishes last wins
 * regardless of the order it was asked for. The visible cost is "Reset Local
 * Data": a save still in flight when the player deletes their data lands
 * afterwards and puts the record back, so the delete has told them something
 * untrue. A game saves on every move, so its board is the likeliest write to
 * be in the air.
 *
 * Chaining each key's operations makes storage finish them in the order they
 * were asked for: the straggling save lands, the delete then removes it, and a
 * save made after the delete — the player changing a setting on the fresh
 * install — survives, because it was asked for last. Keys are independent, so
 * one slow record never holds up another.
 */
const lastOp = new Map<string, Promise<unknown>>();

/**
 * Queues `op` behind whatever is already outstanding for `key`. Reads queue
 * too, so a caller always sees its own writes; a load that jumped the queue
 * could return the value a save was in the middle of replacing.
 */
function enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
  // `op` runs whether the previous operation resolved or rejected, so one
  // failed write cannot strand every later operation on the key.
  const run = (lastOp.get(key) ?? Promise.resolve()).then(op, op);
  lastOp.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

export async function loadRecord<T>(def: SchemaDef<T>, kv: KVStore = preferencesKV): Promise<T> {
  const raw = await enqueue(def.key, () => kv.get(def.key));
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
  // Serialised at the point of call, so the value written is the value the
  // caller had when it asked — not whatever the state became while it waited.
  // Inside the guard, because callers save with `void saveRecord(...)`: a
  // throw from here would surface as an unhandled rejection, not as a failed
  // save, and this function is relied on never to throw.
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return;
  }
  await enqueue(def.key, async () => {
    try {
      await kv.set(def.key, payload);
    } catch {
      // Keep playing even when saving fails.
    }
  });
}

export async function removeRecord(key: string, kv: KVStore = preferencesKV): Promise<void> {
  await enqueue(key, () => kv.remove(key));
}

/**
 * Settings画面の「ローカルデータ削除」。The shell collects the shared keys and
 * every registered game's keys — storage itself does not know the games.
 *
 * Each removal joins its key's queue rather than jumping it, so a save already
 * in flight cannot outlive the delete (see `lastOp`).
 */
export async function clearLocalData(
  keys: readonly string[],
  kv: KVStore = preferencesKV,
): Promise<void> {
  await Promise.all(keys.map((key) => enqueue(key, () => kv.remove(key))));
}
