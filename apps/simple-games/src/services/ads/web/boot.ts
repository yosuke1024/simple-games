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
 */
import { isOnline } from '../../network';
import { webAdsConfig } from './config';
import { ensureAdSenseScript } from './script';

const ANCHOR_TEST_CLASS = 'web-anchor-test';

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
}
