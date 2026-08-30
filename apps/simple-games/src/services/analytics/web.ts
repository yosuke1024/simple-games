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

/**
 * The Google tag's command queue.
 *
 * The tag executes an entry as a command **only when it is an `arguments`
 * object** — the shape Google's own snippet pushes. A plain array is neither
 * a command nor a state object, so the tag drains it and drops it: the queue
 * fills up and nothing is ever sent. That is exactly what this integration
 * did in production until 2026-08-30 (issue #84).
 *
 * Typed `IArguments[]` and not `unknown[][]` for that reason — **the old type
 * was what made the array-pushing shim look correct**. Now `tsc` refuses the
 * regression as well as the tests do.
 */
declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: Gtag;
  }
}

const CONTENT_GROUP = 'simple_games_play';
const SCRIPT_ATTRIBUTE = 'data-simple-games-ga4';
/**
 * Stamped on the tag element when it demonstrably could not do its job.
 *
 * **A marker, not a log line** — it is still there in a shipped build, where
 * the developer warning below has been compiled away, so checking the live
 * page is one selector rather than a console that says nothing. Same idiom,
 * and the same "recorded, never retried" rule, as the AdSense loader's
 * `data-sg-adsense-failed` (`services/ads/web/script.ts`).
 */
const SCRIPT_FAILED_ATTRIBUTE = 'data-simple-games-ga4-failed';

let initializationAttempted = false;
let initialized = false;

/**
 * The game on screen, with two clocks.
 *
 * `openedAtMs` is wall time and answers "how long was this game the mounted
 * screen" — `play_duration_ms`, ours to define. `visibleMs` counts only the
 * stretches the tab was in the foreground, and is what
 * `engagement_time_msec` gets: **that name is GA4's, not ours** — the tag
 * sums it into the property's engagement time, engagement rate and
 * engaged-session count, and the property is shared with the rest of
 * pixapps.ai. Handing it wall time would bill a tab left open overnight to
 * the whole site's engagement, and would rank games by "which one do people
 * park in a background tab" — close to the opposite of what the ranking is
 * for (docs/GROWTH_MEASUREMENT.md「このデータで言えないこと」).
 */
let activeGame: {
  gameId: GameId;
  openedAtMs: number;
  visibleMs: number;
  /** Start of the current foreground stretch, or null while hidden. */
  visibleSinceMs: number | null;
} | null = null;

export function measurementIdFromEnv(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return /^G-[A-Z0-9]{6,}$/.test(trimmed) ? trimmed : null;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Developer seam. Measurement may never take a game down, so every failure
 * here stays swallowed — but **a swallowed failure nobody can see is how this
 * integration spent weeks queueing events that were never sent** (issue #84).
 * Development and test builds say what went wrong; `import.meta.env.DEV` is
 * false in every shipped build, so a player never reads a line about it
 * (the same seam brick-breaker's frame pump uses).
 */
function reportFailure(reason: string, error?: unknown): void {
  if (import.meta.env.DEV) console.warn(`web analytics: ${reason}`, error ?? '');
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** Closes the open foreground stretch, if there is one. */
function pauseVisibleTime(): void {
  if (!activeGame || activeGame.visibleSinceMs === null) return;
  activeGame.visibleMs += Math.max(0, nowMs() - activeGame.visibleSinceMs);
  activeGame.visibleSinceMs = null;
}

function resumeVisibleTime(): void {
  if (!activeGame || activeGame.visibleSinceMs !== null) return;
  activeGame.visibleSinceMs = nowMs();
}

function onVisibilityChange(): void {
  if (isHidden()) pauseVisibleTime();
  else resumeVisibleTime();
}

/**
 * One listener for the life of the page, registered once by a successful
 * initialization — the same category as the audio service's, which
 * docs/GAME_LIFECYCLE.md puts outside a game's release duty because it
 * belongs to the shell and no game may create its own. **Do not turn this
 * into a per-game effect**: measurement is imported only by `main.tsx` and
 * `app/App.tsx`, and a game that registered its own copy would be a game
 * writing measurement code.
 */
function watchVisibility(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function ensureGtag(): Gtag {
  window.dataLayer ??= [];
  if (!window.gtag) {
    // Google's official snippet, in shape as well as in effect:
    //   function gtag(){dataLayer.push(arguments);}
    // **It cannot become an arrow function** — an arrow has no `arguments`
    // binding — and `arguments` must be pushed as it is: rest parameters,
    // `[...arguments]`, `Array.from(...)` and `slice` all hand the queue an
    // array, the one shape the tag drops. That was the whole of issue #84.
    window.gtag = function gtagShim(): void {
      // Re-read the queue on every call instead of closing over the array
      // above: the tag takes the queue over when it loads, and the test hook
      // deletes it outright. A captured reference would keep pushing into a
      // detached array — the same silent loss, one layer down.
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer ??= []).push(arguments);
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
  // A tag that never arrives is the failure that looks like success: the
  // commands below keep queueing and nothing ever drains them. The failed
  // element stays in the DOM, so the load is never re-attempted this page
  // view — offline and blocked are handled the same way (OFFLINE_POLICY.md).
  script.addEventListener('error', () => {
    script.setAttribute(SCRIPT_FAILED_ATTRIBUTE, '');
    reportFailure('the Google tag script did not load');
  });
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
  if (!measurementId) {
    // No ID is the default and not a failure. An ID that was supplied and is
    // unusable is — and it fails exactly like being switched off.
    if ((rawMeasurementId ?? '').trim() !== '') {
      reportFailure('the measurement ID is not a G-… web stream ID');
    }
    return false;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    reportFailure('there is no browser document to attach the tag to');
    return false;
  }
  // Offline is a normal state, never an error (docs/OFFLINE_POLICY.md): the
  // tag is not requested, and this page load will not ask again.
  if (!isOnline()) return false;

  const gtag = ensureGtag();
  ensureGoogleTagScript(measurementId);
  watchVisibility();

  // `js` always precedes `config`, even when something else on the page had
  // already installed a gtag of its own: a consent stub is conventionally
  // written `window.gtag = window.gtag || function(){...}` and issues only
  // `consent` commands, so "a gtag exists" does not mean "the tag was
  // bootstrapped". Repeating `js` records a container start time and sends
  // no hit; skipping it when it was needed fails silently.
  gtag('js', new Date());
  gtag('config', measurementId, {
    content_group: CONTENT_GROUP,
    content_type: 'game_collection',
  });

  initialized = true;
  return true;
}

function sendGameEvent(
  eventName: 'game_open' | 'game_close',
  gameId: GameId,
  elapsed?: { durationMs: number; visibleMs: number },
): void {
  const gtag = window.gtag;
  if (!initialized || !gtag) return;

  const params: Record<string, string | number> = {
    content_group: CONTENT_GROUP,
    content_type: 'game',
    content_id: gameId,
    game_id: gameId,
  };

  if (elapsed) {
    // Ours: how long the game was the screen. Uncapped wall time, so a
    // parked tab inflates it — read as a median, never as "play time".
    params.play_duration_ms = elapsed.durationMs;
    // GA4's: foreground time only, which is what the tag would have counted
    // for itself. Never the same number as above, and never larger.
    params.engagement_time_msec = elapsed.visibleMs;
  }

  gtag('event', eventName, params);
}

export function trackGameOpened(
  gameId: GameId,
  rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): void {
  if (!initWebAnalytics(rawMeasurementId)) return;

  const startedAtMs = nowMs();
  activeGame = {
    gameId,
    openedAtMs: startedAtMs,
    visibleMs: 0,
    // Opened into a hidden tab (a restored session, a background click):
    // the foreground clock starts when the tab comes forward, not now.
    visibleSinceMs: isHidden() ? null : startedAtMs,
  };
  sendGameEvent('game_open', gameId);
}

export function trackGameClosed(
  gameId: GameId,
  rawMeasurementId: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID,
): void {
  if (!initWebAnalytics(rawMeasurementId)) return;

  pauseVisibleTime();
  const elapsed =
    activeGame?.gameId === gameId
      ? {
          durationMs: Math.max(0, Math.round(nowMs() - activeGame.openedAtMs)),
          visibleMs: Math.round(activeGame.visibleMs),
        }
      : undefined;
  activeGame = null;
  sendGameEvent('game_close', gameId, elapsed);
}

/** Test hook. Production code never resets a failed or completed attempt. */
export function resetWebAnalyticsForTesting(): void {
  initializationAttempted = false;
  initialized = false;
  activeGame = null;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.querySelector(`script[${SCRIPT_ATTRIBUTE}]`)?.remove();
  }
  if (typeof window !== 'undefined') {
    delete window.gtag;
    delete window.dataLayer;
  }
}
