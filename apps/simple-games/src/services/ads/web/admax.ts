/**
 * 忍者AdMax — the web build's second ad network
 * (docs/ADS_POLICY.md「Web 版」の「二つのネットワーク」).
 *
 * Which role it plays is decided by what the build carries (config.ts): with
 * an AdSense client it is the runtime fallback, mounting only where AdSense
 * demonstrably failed; without one it serves every placement itself. Test
 * mode never touches it either way — a placeholder is drawn locally and no ad
 * network is contacted at all.
 *
 * This module holds the frame IDs, so unlike config.ts it must never reach
 * the native bundle. That is structural, not a convention: nothing outside
 * `--mode web` imports it, and check-dist-ads-separation.sh greps the built
 * app artifact for the loader host and tag below.
 *
 * IDs are injected at build time via VITE_ADMAX_* and never committed. AdMax
 * frames are fixed-size and a frame must not appear twice on one page, so
 * each (placement, size) pair is its own frame — the home slot and the anchor
 * bar can be on screen together. AdMax has no 234×60, the size the result
 * overlay falls to on the narrowest phones, so there the slot stays empty.
 */
import { type WebAdPlacement, adIdFromEnv } from './config';

export interface AdMaxIds {
  /** Home display slot, 728×90 (desktop widths). */
  slotHome728x90: string | null;
  /** Home display slot, 320×100 (phone widths). */
  slotHome320x100: string | null;
  /** Result display slot, 320×100 (the compact placement's only size). */
  slotResult320x100: string | null;
  /** Anchor bar, 728×90 (desktop widths). */
  anchor728x90: string | null;
  /** Anchor bar, 320×100 (phone widths). */
  anchor320x100: string | null;
}

function fromEnv(): AdMaxIds {
  return {
    slotHome728x90: adIdFromEnv(import.meta.env.VITE_ADMAX_SLOT_HOME_728X90),
    slotHome320x100: adIdFromEnv(import.meta.env.VITE_ADMAX_SLOT_HOME_320X100),
    slotResult320x100: adIdFromEnv(import.meta.env.VITE_ADMAX_SLOT_RESULT_320X100),
    anchor728x90: adIdFromEnv(import.meta.env.VITE_ADMAX_ANCHOR_728X90),
    anchor320x100: adIdFromEnv(import.meta.env.VITE_ADMAX_ANCHOR_320X100),
  };
}

let ids: AdMaxIds = fromEnv();

/**
 * The AdMax frame for one display placement at one exact size, or null when
 * no frame exists for the pair — then that placement shows nothing, exactly
 * as an unfilled AdSense unit always has.
 */
export function adMaxFrameId(
  placement: WebAdPlacement,
  size: { width: number; height: number },
): string | null {
  const key = `${size.width}x${size.height}`;
  if (placement === 'home') {
    if (key === '728x90') return ids.slotHome728x90;
    if (key === '320x100') return ids.slotHome320x100;
    return null;
  }
  return key === '320x100' ? ids.slotResult320x100 : null;
}

export interface AdMaxAnchorChoice {
  id: string;
  width: number;
  height: number;
}

/**
 * The widest configured anchor frame that fits the viewport, or null (no bar
 * at all — never a frame wider than the screen, and never an empty shelf for
 * a frame that was not configured).
 */
export function adMaxAnchorChoice(viewportWidth: number): AdMaxAnchorChoice | null {
  if (viewportWidth >= 728 && ids.anchor728x90) {
    return { id: ids.anchor728x90, width: 728, height: 90 };
  }
  if (viewportWidth >= 320 && ids.anchor320x100) {
    return { id: ids.anchor320x100, width: 320, height: 100 };
  }
  return null;
}

const ADMAX_SRC = 'https://adm.shinobi.jp/st/t.js';
export const ADMAX_SCRIPT_MARKER = 'data-sg-admax';
const ADMAX_FAILED_MARKER = 'data-sg-admax-failed';
const ADMAX_ERROR_EVENT = 'sg-admax-error';

/**
 * AdMax's async tag: each unit is a `.admax-ads` div plus one entry in the
 * `admaxads` queue, and t.js turns those into requests.
 *
 * The part that shapes this whole module: **t.js does that exactly once per
 * page.** Its bundle ends in `if (void 0 !== window.__admax_tag__) ; else
 * { …scan the DOM, drain the queue… }`, so the first load wins and every
 * later load returns immediately. A screen this app mounts afterwards — the
 * home slot arrives with a lazily-imported chunk, the result slot minutes
 * into a session — pushes into a queue nothing will ever read again.
 *
 * That is not a hypothesis: in production only the anchor (mounted at boot,
 * so it triggered the single pass) was ever requested, while the home slot
 * sat in the queue unserved. Clearing the guard and loading t.js again with
 * the queue holding only the new frame served it immediately, which is what
 * requestAdMaxFrame does below.
 */
type AdMaxWindow = Window & {
  admaxads?: { admax_id: string; type: 'banner' }[];
  __admax_tag__?: unknown;
};

let pendingFrames: string[] = [];
let loadInFlight = false;

/**
 * Ask AdMax for one frame. The div must already be in the DOM — callers
 * render it first (React effects run after render; boot.ts appends the bar
 * before calling).
 *
 * Loads are serialised rather than fired per call: frames that ask while a
 * load is in flight ride the next one together, and the queue is REPLACED
 * with just that batch. Replacing is what keeps a second load from
 * re-requesting frames the first one already filled — t.js pops elements by
 * `admax_id`, so an id that is not in the queue is left alone.
 */
export function requestAdMaxFrame(id: string): void {
  try {
    pendingFrames.push(id);
    drainAdMaxQueue();
  } catch {
    // Ads never block play.
  }
}

function drainAdMaxQueue(): void {
  if (loadInFlight || pendingFrames.length === 0 || adMaxScriptFailed()) return;

  const batch = pendingFrames;
  pendingFrames = [];
  loadInFlight = true;

  const w = window as AdMaxWindow;
  w.admaxads = batch.map((admax_id) => ({ admax_id, type: 'banner' as const }));
  // Both halves of t.js's one-shot behaviour have to be reset together: the
  // queue it drains, and the guard that makes it skip the scan entirely.
  w.__admax_tag__ = undefined;

  const script = document.createElement('script');
  script.async = true;
  script.src = ADMAX_SRC;
  script.setAttribute(ADMAX_SCRIPT_MARKER, '');
  script.addEventListener('load', () => {
    loadInFlight = false;
    drainAdMaxQueue();
  });
  // Failure is silent and final for this page view — no retry loop
  // (docs/OFFLINE_POLICY.md). The marker lets later mounts collapse quietly
  // instead of queueing for a loader that will not come.
  script.addEventListener('error', () => {
    loadInFlight = false;
    pendingFrames = [];
    script.setAttribute(ADMAX_FAILED_MARKER, '');
    document.dispatchEvent(new Event(ADMAX_ERROR_EVENT));
  });
  document.head.appendChild(script);
}

/** Test hook: forget any batch a previous test left queued. */
export function resetAdMaxLoaderForTesting(): void {
  pendingFrames = [];
  loadInFlight = false;
}

export function adMaxScriptFailed(): boolean {
  try {
    return document.querySelector(`script[${ADMAX_FAILED_MARKER}]`) !== null;
  } catch {
    return false;
  }
}

/**
 * Runs the callback when (or if it already has) the AdMax loader fails —
 * the caller's cue to take its empty box back out of the layout. Returns an
 * unsubscribe for React effect cleanup.
 */
export function onAdMaxScriptError(callback: () => void): () => void {
  if (adMaxScriptFailed()) {
    callback();
    return () => undefined;
  }
  document.addEventListener(ADMAX_ERROR_EVENT, callback);
  return () => document.removeEventListener(ADMAX_ERROR_EVENT, callback);
}

/** Test hook (same pattern as setWebAdsConfigForTesting). `null` restores env values. */
export function setAdMaxIdsForTesting(partial: Partial<AdMaxIds> | null): void {
  ids = partial === null ? fromEnv() : { ...ids, ...partial };
}
