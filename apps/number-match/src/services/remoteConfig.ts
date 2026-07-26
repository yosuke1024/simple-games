/**
 * Remote Config with bundled defaults (spec §11).
 *
 * Every key has an in-app default; the last-fetched values are cached locally
 * and merged on boot. Fetch completion is never a condition for app start or
 * game start. Remote Config is used ONLY as an ad/analytics safety switch —
 * never for game rules or content.
 *
 * NOTE: An actual Firebase Remote Config fetch adapter is intentionally not
 * wired yet: it requires a Firebase project (human account setup). When added,
 * it should call `applyFetchedValues()` at most once per 12h and must remain
 * fire-and-forget. Until then the app runs on defaults + cached values, which
 * satisfies every offline requirement.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { rcCacheSchema } from '../storage/schemas';

export interface RemoteConfigValues {
  banner_enabled: boolean;
  interstitial_enabled: boolean;
  interstitial_first_session_disabled: boolean;
  interstitial_min_play_minutes: number;
  interstitial_min_completed_games: number;
  interstitial_min_interval_minutes: number;
  interstitial_daily_limit: number;
  analytics_enabled: boolean;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfigValues = {
  banner_enabled: true,
  interstitial_enabled: true,
  interstitial_first_session_disabled: true,
  interstitial_min_play_minutes: 10,
  interstitial_min_completed_games: 2,
  interstitial_min_interval_minutes: 15,
  interstitial_daily_limit: 3,
  analytics_enabled: true,
};

/** Minimum interval between real fetches (production). */
export const RC_MIN_FETCH_INTERVAL_MS = 12 * 60 * 60 * 1000;

let snapshot: RemoteConfigValues = { ...DEFAULT_REMOTE_CONFIG };

function mergeValues(values: Record<string, boolean | number>): RemoteConfigValues {
  const merged = { ...DEFAULT_REMOTE_CONFIG };
  for (const key of Object.keys(DEFAULT_REMOTE_CONFIG) as (keyof RemoteConfigValues)[]) {
    const value = values[key];
    const defaultValue = DEFAULT_REMOTE_CONFIG[key];
    if (typeof value === typeof defaultValue) {
      // Types line up (boolean/boolean or number/number); accept the override.
      (merged as Record<string, boolean | number>)[key] = value as boolean | number;
    }
  }
  return merged;
}

/** Loads cached values into the in-memory snapshot. Never throws, never blocks gameplay. */
export async function initRemoteConfig(kv: KVStore = preferencesKV): Promise<void> {
  const cache = await loadRecord(rcCacheSchema, kv);
  snapshot = mergeValues(cache.values);
}

/** Synchronous access for hot paths (ad gating). */
export function getRemoteConfig(): RemoteConfigValues {
  return snapshot;
}

/**
 * Adapter entry point: a future Firebase fetch (or a test) delivers values
 * here; they are cached for offline use and applied immediately.
 */
export async function applyFetchedValues(
  values: Record<string, boolean | number>,
  fetchedAt: number,
  kv: KVStore = preferencesKV,
): Promise<void> {
  snapshot = mergeValues(values);
  await saveRecord(rcCacheSchema, { schemaVersion: 1, values, fetchedAt }, kv);
}

/** Test hook. */
export function resetRemoteConfigForTesting(): void {
  snapshot = { ...DEFAULT_REMOTE_CONFIG };
}
