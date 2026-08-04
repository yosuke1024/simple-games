/**
 * GA4 integration for the browser build at pixapps.ai/simple-games/play/.
 *
 * This module is dynamically imported only from `--mode web` builds. The
 * native artifact must contain none of the Google tag integration; CI proves
 * that from the built files rather than trusting this comment.
 *
 * Only shell-level usage is sent: the initial page view and which game was
 * opened or closed. Boards, saved games, scores, moves and other play content
 * never enter this module (docs/WEB_VERSION.md「計測」).
 */
import type { GameId } from '../../app/registry';
import { isOnline } from '../network';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: Gtag;
  }
}

const CONTENT_GROUP = 'simple_games_play';
const SCRIPT_ATTRIBUTE = 'data-simple-games-ga4';

let initializationAttempted = false;
let initialized = false;
let activeGame: { gameId: GameId; openedAtMs: number } | null = null;

export function measurementIdFromEnv(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^G-[A-Z0-9]{6,}$/.test(trimmed) ? trimmed : null;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function ensureGtag(): Gtag {
  window.dataLayer ??= [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
  return window.gtag;
}

function ensureGoogleTagScript(measurementId: string): void {
  if (document.querySelector(`script[${SCRIPT_ATTRIBUTE}]`)) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.setAttribute(SCRIPT_ATTRIBUTE, measurementId);
  document.head.appendChild(script);
}

/**
 * Initializes GA4 once for this page load. An offline or disabled first
 * attempt is terminal for the session: there is no reconnect retry and the
 * next page load can try again, matching the offline policy.
 */
export function initWebAnalytics(
  rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): boolean {
  if (initializationAttempted) return initialized;
  initializationAttempted = true;

  const measurementId = measurementIdFromEnv(rawMeasurementId);
  if (!measurementId || !isOnline() || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const hadGtag = typeof window.gtag === 'function';
  const gtag = ensureGtag();
  ensureGoogleTagScript(measurementId);

  if (!hadGtag) gtag('js', new Date());
  gtag('config', measurementId, {
    content_group: CONTENT_GROUP,
    content_type: 'game_collection',
  });

  initialized = true;
  return true;
}

function sendGameEvent(eventName: 'game_open' | 'game_close', gameId: GameId, durationMs?: number): void {
  const gtag = window.gtag;
  if (!initialized || !gtag) return;

  const params: Record<string, string | number> = {
    content_group: CONTENT_GROUP,
    content_type: 'game',
    content_id: gameId,
    game_id: gameId,
  };

  if (durationMs !== undefined) {
    params.play_duration_ms = durationMs;
    // GA4 uses this reserved parameter when calculating engagement for
    // custom events. It is elapsed shell time, not game content.
    params.engagement_time_msec = durationMs;
  }

  gtag('event', eventName, params);
}

export function trackGameOpened(
  gameId: GameId,
  rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): void {
  if (!initWebAnalytics(rawMeasurementId)) return;

  activeGame = { gameId, openedAtMs: nowMs() };
  sendGameEvent('game_open', gameId);
}

export function trackGameClosed(
  gameId: GameId,
  rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): void {
  if (!initWebAnalytics(rawMeasurementId)) return;

  const durationMs =
    activeGame?.gameId === gameId ? Math.max(0, Math.round(nowMs() - activeGame.openedAtMs)) : undefined;
  activeGame = null;
  sendGameEvent('game_close', gameId, durationMs);
}

/** Test hook. Production code never resets a failed or completed attempt. */
export function resetWebAnalyticsForTesting(): void {
  initializationAttempted = false;
  initialized = false;
  activeGame = null;
  if (typeof document !== 'undefined') {
    document.querySelector(`script[${SCRIPT_ATTRIBUTE}]`)?.remove();
  }
  if (typeof window !== 'undefined') {
    delete window.gtag;
    delete window.dataLayer;
  }
}
