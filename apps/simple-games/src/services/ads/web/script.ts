/**
 * The AdSense loader — the web build's single script-injection point
 * (docs/ADS_POLICY.md「Web 版」). Loaded from two places, once per page:
 * boot.ts (for the Auto-ads anchor) and AdUnit.tsx (manual display units).
 * Like every module in this folder except config.ts, it must never reach the
 * native bundle (verified by check-dist-ads-separation.sh).
 */

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export const SCRIPT_MARKER = 'data-sg-adsense';

/**
 * DOM-marker guarded (not a module flag) so tests and HMR see the real
 * state. Failures are silent and final for this page view — no retry loop
 * (docs/OFFLINE_POLICY.md).
 */
export function ensureAdSenseScript(client: string): void {
  try {
    if (document.querySelector(`script[${SCRIPT_MARKER}]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(client)}`;
    script.setAttribute(SCRIPT_MARKER, '');
    document.head.appendChild(script);
  } catch {
    // Ads never block play.
  }
}
