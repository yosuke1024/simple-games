/**
 * 忍者AdMax — the web build's RUNTIME fallback ad network
 * (docs/ADS_POLICY.md「Web 版」の「フォールバック(忍者AdMax)」).
 *
 * AdMax never runs on its own: a unit mounts only after AdSense demonstrably
 * failed on this page view — the loader script erroring, or a display unit
 * reporting `unfilled`. A build without an AdSense client contacts no ad
 * network at all, AdMax included (the fallback is runtime-only by decision,
 * not a second ad network), and test mode never touches AdMax either.
 *
 * Like every module in this folder except config.ts, it must never reach the
 * native bundle (verified by check-dist-ads-separation.sh, which greps the
 * built artifacts for the identifiers below).
 *
 * ID handling mirrors AdSense (config.ts): frame IDs are injected at build
 * time via VITE_ADMAX_* and never committed. AdMax frames are fixed-size, so
 * each (placement, size) pair is its own frame — a frame must not appear
 * twice on one page, and the home slot and the anchor can be visible
 * together. AdMax has no 234×60, so that size simply has no fallback.
 */
import { adIdFromEnv } from './config';

export interface AdMaxIds {
  /** Home display slot, 728×90 (desktop widths). */
  slotHome728x90: string | null;
  /** Home display slot, 320×100 (phone widths). */
  slotHome320x100: string | null;
  /** Result display slot, 320×100 (the compact placement's only size). */
  slotResult320x100: string | null;
  /** Anchor-replacement bar, 728×90 (desktop widths). */
  anchor728x90: string | null;
  /** Anchor-replacement bar, 320×100 (phone widths). */
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

export type AdPlacement = 'home' | 'result';

/**
 * The AdMax frame that can stand in for one display placement at one exact
 * size, or null when no frame exists for the pair — then the placement
 * collapses exactly as an unfilled AdSense unit always has.
 */
export function adMaxSlotId(
  placement: AdPlacement,
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
 * `admaxads` queue, processed by a single t.js load. Pushing the same frame
 * again on a later mount is the documented SPA pattern, so the queue is
 * append-only. The div must be in the DOM before the push is processed —
 * callers render it first (React effects run after render; boot.ts appends
 * the bar before pushing).
 */
type AdMaxWindow = Window & { admaxads?: { admax_id: string; type: 'banner' }[] };

export function pushAdMaxAd(id: string): void {
  try {
    const w = window as AdMaxWindow;
    (w.admaxads = w.admaxads ?? []).push({ admax_id: id, type: 'banner' });
  } catch {
    // Ads never block play.
  }
}

/**
 * DOM-marker guarded like ensureAdSenseScript, and the same failure rule:
 * silent and final for this page view — no retry loop (docs/OFFLINE_POLICY.md).
 * The error marker lets later mounts collapse quietly instead of pushing to a
 * queue nothing will ever read.
 */
export function ensureAdMaxScript(): void {
  try {
    if (document.querySelector(`script[${ADMAX_SCRIPT_MARKER}]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = ADMAX_SRC;
    script.setAttribute(ADMAX_SCRIPT_MARKER, '');
    script.addEventListener('error', () => {
      script.setAttribute(ADMAX_FAILED_MARKER, '');
      document.dispatchEvent(new Event(ADMAX_ERROR_EVENT));
    });
    document.head.appendChild(script);
  } catch {
    // Ads never block play.
  }
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
