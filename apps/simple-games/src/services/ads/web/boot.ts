/**
 * Web-build ad bootstrap, dynamically imported by main.tsx behind the
 * `--mode web` gate — the native bundle never contains this module.
 *
 * Its production job is putting the ANCHOR — the bottom-edge ad — on the
 * page, which takes a different shape per network (docs/ADS_POLICY.md
 * 「Web 版」の「二つのネットワーク」):
 * - AdSense: load the script and stop. The anchor is Google's own overlay,
 *   enabled per-format in the AdSense console (anchor ON, every other
 *   Auto-ads format OFF), so no ad element is rendered here. Should the
 *   loader fail, the AdMax bar below stands in for the anchor that now
 *   cannot exist.
 * - 忍者AdMax (no AdSense client in this build): AdMax has no overlay format,
 *   so the bar below IS the anchor, mounted at boot.
 *
 * Either way the layout answer is the same and predates the ad:
 * `data-sg-web-ads` (set by main.tsx before first paint) reserves bottom
 * space on every screen, so nothing at the bottom edge can cover game
 * controls and the bar's arrival shifts nothing.
 *
 * In test mode this contacts no ad network and mounts a fixed placeholder
 * bar with the anchor's geometry instead. Offline: not a single request and
 * no retry — the next page load while online tries again
 * (docs/OFFLINE_POLICY.md).
 */
import './admax.css';
import { isOnline } from '../../network';
import {
  adMaxAnchorChoice,
  adMaxScriptFailed,
  collapseIfAdMaxUnitEmpty,
  onAdMaxScriptError,
  requestAdMaxFrame,
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
 * The 忍者AdMax anchor bar: this build's anchor when no AdSense client was
 * injected, and the stand-in for Google's overlay when the AdSense loader
 * failed to load (the single anchor-level failure that is detectable — Auto
 * ads has no per-ad status). It never doubles a working Google anchor: both
 * paths below mount it only where Google's cannot exist.
 *
 * It sits inside the bottom space every screen already reserves
 * (`data-sg-web-ads`), so it can never cover game controls. Fixed size
 * chosen at mount from the viewport, like AdUnit: nothing shifts later.
 * If AdMax's own loader then fails (typically an ad blocker), the bar is
 * removed — a quiet nothing, not an empty shelf.
 */
/**
 * Take the bar away, and with it the bottom space every screen was keeping
 * clear for it.
 *
 * That reservation exists so a bottom-edge ad can never cover game controls,
 * and it is set before the first paint precisely so nothing moves when the ad
 * arrives. Releasing it therefore does move the layout, once — which is the
 * trade accepted deliberately (docs/ADS_POLICY.md「Web 版」): when no ad is
 * coming, an empty strip across the bottom of every screen is the worse of
 * the two. Nothing re-reserves it afterwards, because nothing will mount
 * there for the rest of this page view.
 */
function removeAnchorBar(bar: HTMLElement): void {
  try {
    bar.remove();
    delete document.documentElement.dataset.sgWebAds;
  } catch {
    // Ads never block play.
  }
}

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
    // The div must be in the DOM before the frame is requested.
    document.body.appendChild(bar);
    requestAdMaxFrame(choice.id);

    onAdMaxScriptError(() => removeAnchorBar(bar));
    // A no-fill leaves an empty bar rather than saying anything (admax.ts),
    // and an empty strip across the bottom of every screen is worse than the
    // one layout change that taking it away costs.
    collapseIfAdMaxUnitEmpty(unit, () => removeAnchorBar(bar));
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
  if (!isOnline()) return;
  // Truthiness: an empty client is an absent client (see config.ts). Getting
  // this wrong here is what sends a request from a build that promises none.
  if (client) {
    ensureAdSenseScript(client);
    onAdSenseScriptError(mountAdMaxAnchor);
    return;
  }
  // No AdSense in this build: AdMax is the anchor, and Google is contacted
  // nowhere on the page.
  mountAdMaxAnchor();
}
