/**
 * Persisted ad frequency counters (spec §15). In-memory copy with
 * fire-and-forget persistence; failures never affect gameplay.
 */
import { localDateString } from '../../game';
import type { KVStore } from '../../storage/kv';
import { preferencesKV } from '../../storage/kv';
import { loadRecord, saveRecord } from '../../storage/repo';
import { adStateSchema, type AdState } from '../../storage/schemas';
import type { InterstitialCounters } from './interstitialPolicy';

let state: AdState = adStateSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

function persist(): void {
  void saveRecord(adStateSchema, state, kvStore);
}

/** Loads counters and registers the new session (app launch). */
export async function initAdState(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = await loadRecord(adStateSchema, kv);
  state = { ...state, sessionCount: state.sessionCount + 1 };
  persist();
}

export function getAdState(): AdState {
  return state;
}

/** Called by the play clock; batched persistence every 30 ticks. */
export function addPlaySecond(): void {
  state = { ...state, totalPlaySeconds: state.totalPlaySeconds + 1 };
  if (state.totalPlaySeconds % 30 === 0) persist();
}

export function registerCompletedGame(): void {
  state = { ...state, completedGames: state.completedGames + 1 };
  persist();
}

export function registerInterstitialShown(now: number, today: string): void {
  const sameDay = state.interstitialDate === today;
  state = {
    ...state,
    lastInterstitialAt: now,
    interstitialDate: today,
    interstitialCountToday: sameDay ? state.interstitialCountToday + 1 : 1,
  };
  persist();
}

/** Counters in the shape the pure policy expects, for `today`. */
export function countersForPolicy(today: string = localDateString(new Date())): InterstitialCounters {
  return {
    sessionCount: state.sessionCount,
    totalPlaySeconds: state.totalPlaySeconds,
    completedGames: state.completedGames,
    lastInterstitialAt: state.lastInterstitialAt,
    shownToday: state.interstitialDate === today ? state.interstitialCountToday : 0,
  };
}

/**
 * Called by "Reset Local Data": clears the in-memory counters too, so a later
 * persist() cannot resurrect the wiped record.
 */
export function resetAdState(): void {
  state = adStateSchema.defaultValue();
  persist();
}

/** Test hook. */
export function resetAdStateForTesting(): void {
  state = adStateSchema.defaultValue();
  kvStore = preferencesKV;
}
