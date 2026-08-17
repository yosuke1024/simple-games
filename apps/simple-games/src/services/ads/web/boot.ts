/**
 * Web-build ad bootstrap, dynamically imported by main.tsx behind the
 * `--mode web` gate — the native bundle never contains this module.
 *
 * Its one production job is loading the AdSense script at boot so the
 * Auto-ads ANCHOR can appear: the anchor is Google's own bottom-edge
 * overlay, enabled per-format in the AdSense console (anchor ON, every
 * other Auto-ads format OFF — docs/ADS_POLICY.md「Web 版」), so no ad
 * element is rendered here. The layout answer to an overlay ad lives in
 * styles.css: `data-sg-web-ads` (set by main.tsx before first paint)
 * reserves bottom space on every screen so the anchor can never cover
 * game controls.
 *
 * In test mode this contacts no ad network and mounts a fixed placeholder
 * bar with the anchor's geometry instead. Offline: not a single request and
 * no retry — the next page load while online tries again
 * (docs/OFFLINE_POLICY.md).
 *
 * Its second job is the anchor's runtime fallback: if the AdSense loader
 * fails to load, a fixed bottom bar with a 忍者AdMax frame stands in for the
 * Google anchor that now cannot exist (mountAdMaxAnchor below).
 */
import './admax.css';
import { isOnline } from '../../network';
import {
  adMaxAnchorChoice,
  adMaxScriptFailed,
  ensureAdMaxScript,
  onAdMaxScriptError,
  pushAdMaxAd,
} from './admax';
import { webAdsConfig } from './config';
import { ensureAdSenseScript, onAdSenseScriptError } from './script';

const ANCHOR_TEST_CLASS = 'web-anchor-test';
const ADMAX_ANCHOR_CLASS = 'web-admax-anchor';

function mountAnchorTestPlaceholder(): void {
  try {
    if (document.querySelector(`.${ANCHOR_TEST_CLASS}`)) return;
    const bar = document.createElement('div');
    bar.className = ANCHOR_TEST_CLASS;
    bar.textContent = 'Test ad';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  } catch {
    // Ads never block play.
  }
}

/**
 * The anchor's runtime fallback (docs/ADS_POLICY.md「Web 版」フォールバック):
 * mounted ONLY when the AdSense loader itself failed to load — the single
 * anchor-level failure that is detectable (Auto ads has no per-ad status).
 * With no AdSense there is no Google anchor, so this bar replaces it rather
 * than doubling it, inside the bottom space every screen already reserves
 * (`data-sg-web-ads` — the bar can never cover game controls). Fixed size
 * chosen at mount from the viewport, like AdUnit: nothing shifts later.
 * If AdMax's own loader then fails too (typically an ad blocker), the bar is
 * removed — a quiet nothing, not an empty shelf.
 */
function mountAdMaxAnchor(): void {
  try {
    if (document.querySelector(`.${ADMAX_ANCHOR_CLASS}`)) return;
    if (!isOnline() || adMaxScriptFailed()) return;
    const choice = adMaxAnchorChoice(window.innerWidth);
    if (!choice) return;

    const bar = document.createElement('div');
    bar.className = ADMAX_ANCHOR_CLASS;
    bar.style.height = `calc(${choice.height}px + env(safe-area-inset-bottom))`;
    const unit = document.createElement('div');
    unit.className = 'admax-ads';
    unit.setAttribute('data-admax-id', choice.id);
    unit.style.display = 'inline-block';
    unit.style.width = `${choice.width}px`;
    unit.style.height = `${choice.height}px`;
    bar.appendChild(unit);
    // The div must be in the DOM before its queue entry is processed.
    document.body.appendChild(bar);
    pushAdMaxAd(choice.id);
    ensureAdMaxScript();
    onAdMaxScriptError(() => bar.remove());
  } catch {
    // Ads never block play.
  }
}

export function initWebAds(): void {
  const { testMode, client } = webAdsConfig();
  if (testMode) {
    mountAnchorTestPlaceholder();
    return;
  }
  // Truthiness: an empty client is an absent client (see config.ts). Getting
  // this wrong here is what sends a request from a build that promises none.
  if (!client || !isOnline()) return;
  ensureAdSenseScript(client);
  onAdSenseScriptError(mountAdMaxAnchor);
}
