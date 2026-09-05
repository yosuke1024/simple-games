/**
 * The load-then-mount step every game root performs: read the game's own
 * records from the device store, fall back to schema defaults on any failure,
 * and never let a load that outlives the component write into it.
 *
 * Thirty roots carried this effect verbatim — the `cancelled` flag, the
 * try/catch that turns an unexpected failure into "play with defaults", the
 * `[kv]` dependency. Only the list of records differed, so that is all a
 * game keeps: a `load` that names its schemas and a `fallback` that names
 * their defaults. Returns null until the reads land; local reads resolve in
 * milliseconds, so a spinner would only flash (the roots render nothing
 * meanwhile, as before).
 *
 * `load` and `fallback` are read through refs so a root can pass module-level
 * functions or inline closures alike; the effect re-runs only when the store
 * itself changes (the `kv` prop is a test seam — production always passes
 * the device store).
 */
import { useEffect, useRef, useState } from 'react';
import type { KVStore } from '../storage/kv';

export function useLoadedRecords<T>(
  kv: KVStore,
  load: (kv: KVStore) => Promise<T>,
  fallback: () => T,
): T | null {
  const [data, setData] = useState<T | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: T;
      try {
        loaded = await loadRef.current(kv);
      } catch {
        // Even unexpected load failures must not prevent playing: defaults.
        loaded = fallbackRef.current();
      }
      if (!cancelled) setData(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [kv]);

  return data;
}
