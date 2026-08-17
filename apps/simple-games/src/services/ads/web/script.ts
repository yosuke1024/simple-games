/**
 * The AdSense loader — the web build's single script-injection point
 * (docs/ADS_POLICY.md「Web 版」). Loaded from two places, once per page:
 * boot.ts (for the Auto-ads anchor) and AdUnit.tsx (manual display units).
 * Like every module in this folder except config.ts, it must never reach the
 * native bundle (verified by check-dist-ads-separation.sh).
 */

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export const SCRIPT_MARKER = 'data-sg-adsense';
const FAILED_MARKER = 'data-sg-adsense-failed';
const ERROR_EVENT = 'sg-adsense-error';

/**
 * DOM-marker guarded (not a module flag) so tests and HMR see the real
 * state. Failures are silent and final for this page view — no retry loop
 * (docs/OFFLINE_POLICY.md) — but they are RECORDED (marker + event), because
 * a failed loader is the one cue the AdMax fallback has for the anchor
 * (docs/ADS_POLICY.md「Web 版」フォールバック). The failed script element
 * stays in the DOM so the load is never re-attempted this page view.
 */
export function ensureAdSenseScript(client: string): void {
  try {
    if (document.querySelector(`script[${SCRIPT_MARKER}]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(client)}`;
    script.setAttribute(SCRIPT_MARKER, '');
    script.addEventListener('error', () => {
      script.setAttribute(FAILED_MARKER, '');
      document.dispatchEvent(new Event(ERROR_EVENT));
    });
    document.head.appendChild(script);
  } catch {
    // Ads never block play.
  }
}

export function adSenseScriptFailed(): boolean {
  try {
    return document.querySelector(`script[${FAILED_MARKER}]`) !== null;
  } catch {
    return false;
  }
}

/**
 * Runs the callback when (or immediately, if it already has) the AdSense
 * loader fails — the fallback's only trigger besides `data-ad-status`.
 * Returns an unsubscribe for React effect cleanup.
 */
export function onAdSenseScriptError(callback: () => void): () => void {
  if (adSenseScriptFailed()) {
    callback();
    return () => undefined;
  }
  document.addEventListener(ERROR_EVENT, callback);
  return () => document.removeEventListener(ERROR_EVENT, callback);
}
