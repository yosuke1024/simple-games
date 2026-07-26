/**
 * Pure interstitial gating logic (docs/ADS_POLICY.md). No I/O here so every
 * rule is unit-testable. The controller feeds in persisted counters and the
 * Remote Config values (which always have in-app defaults).
 */
import type { RemoteConfigValues } from '../remoteConfig';

export interface InterstitialCounters {
  /** App launch count including the current session. */
  sessionCount: number;
  /** Lifetime play seconds. */
  totalPlaySeconds: number;
  /** Lifetime completed (cleared or game over) games. */
  completedGames: number;
  lastInterstitialAt: number | null;
  /** Interstitials already shown on `today`. */
  shownToday: number;
}

export type InterstitialConfig = Pick<
  RemoteConfigValues,
  | 'interstitial_enabled'
  | 'interstitial_first_session_disabled'
  | 'interstitial_min_play_minutes'
  | 'interstitial_min_completed_games'
  | 'interstitial_min_interval_minutes'
  | 'interstitial_daily_limit'
>;

/** Natural-break triggers where an interstitial is allowed at all. */
export type InterstitialTrigger = 'gameCleared' | 'gameOver' | 'newGame';

export function canShowInterstitial(
  config: InterstitialConfig,
  counters: InterstitialCounters,
  now: number,
): boolean {
  if (!config.interstitial_enabled) return false;
  if (config.interstitial_first_session_disabled && counters.sessionCount <= 1) return false;
  if (counters.totalPlaySeconds < config.interstitial_min_play_minutes * 60) return false;
  if (counters.completedGames < config.interstitial_min_completed_games) return false;
  if (counters.shownToday >= config.interstitial_daily_limit) return false;
  if (
    counters.lastInterstitialAt !== null &&
    now - counters.lastInterstitialAt < config.interstitial_min_interval_minutes * 60_000
  ) {
    return false;
  }
  return true;
}
