/**
 * Minimal analytics wrapper (spec §13).
 *
 * - Never blocks or affects gameplay; failures are ignored.
 * - Sends no personal information, no user IDs, no board contents.
 * - Disabled via Remote Config (`analytics_enabled`).
 *
 * NOTE: A real Firebase Analytics adapter is intentionally not wired yet
 * (requires a Firebase project — human account setup). Event call sites are
 * in place; in dev the events log to the console, in production they are
 * no-ops until an adapter forwards them.
 */
import { getRemoteConfig } from './remoteConfig';

export type AnalyticsEvent =
  | 'tutorial_completed'
  | 'game_started'
  | 'game_resumed'
  | 'game_completed'
  | 'game_over'
  | 'daily_challenge_started'
  | 'daily_challenge_completed'
  | 'hint_used'
  | 'undo_used'
  | 'add_numbers_used'
  | 'settings_changed';

export type AnalyticsParams = Record<string, string | number | boolean>;

type AnalyticsAdapter = (event: AnalyticsEvent, params?: AnalyticsParams) => void;

let adapter: AnalyticsAdapter | null = import.meta.env.DEV
  ? (event, params) => console.debug('[analytics]', event, params ?? {})
  : null;

/** A future Firebase adapter registers itself here. */
export function setAnalyticsAdapter(next: AnalyticsAdapter | null): void {
  adapter = next;
}

export function track(event: AnalyticsEvent, params?: AnalyticsParams): void {
  try {
    if (!getRemoteConfig().analytics_enabled) return;
    adapter?.(event, params);
  } catch {
    // Analytics must never break the game.
  }
}
