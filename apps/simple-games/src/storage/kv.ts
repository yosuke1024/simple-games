/**
 * Tiny async key-value store backed by Capacitor Preferences
 * (SharedPreferences on Android, localStorage on the web).
 * Every operation is failure-tolerant: storage errors never crash the game.
 */
import { Preferences } from '@capacitor/preferences';

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const preferencesKV: KVStore = {
  async get(key) {
    try {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await Preferences.set({ key, value });
    } catch {
      // Saving failed (e.g. storage full): keep playing, spec §15.1.
    }
  },
  async remove(key) {
    try {
      await Preferences.remove({ key });
    } catch {
      // Ignore.
    }
  },
};

/**
 * Entitlement reads must distinguish "missing" from "could not read" so a
 * storage error cannot enable ads. Ordinary record callers keep the existing
 * failure-tolerant adapter; loadRecordWithStatus catches this one's rejection
 * and returns readable:false without letting it escape into app boot.
 */
export const preferencesKVWithReadStatus: KVStore = {
  ...preferencesKV,
  async get(key) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  },
};

/** In-memory store for tests. */
export function createMemoryKV(initial: Record<string, string> = {}): KVStore {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => Promise.resolve(map.get(key) ?? null),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
}
