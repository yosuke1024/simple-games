/**
 * The result screens' display ad (docs/ADS_POLICY.md「Web 版」): web build
 * only, and only every few finished games — recordResultView() implements
 * "every 3rd result of the session, never the first" so a result screen is
 * usually just the result. Games render this inside their result overlay,
 * AFTER the dialog card (kept apart from the action buttons — no accidental
 * taps), the same shared-UI import shape as BannerSlot.
 *
 * On the native app this renders nothing and counts nothing. The AdSense
 * reference sits behind the same build-time `--mode web` gate as WebAdSlot,
 * so the native bundle carries no ad-network code (CI-verified by
 * check-dist-ads-separation.sh).
 */
import { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react';
import { webAdsConfig, webAdsSlotEnabled } from '../../services/ads/web/config';
import { recordResultView } from '../../services/ads/web/resultCadence';

const AdUnit =
  import.meta.env.MODE === 'web' ? lazy(() => import('../../services/ads/web/AdUnit')) : null;

/**
 * Below this the ad would be taking room the result itself needs: the overlay
 * already reserves 164px for the anchor, and a 114px slot on top squeezes the
 * dialog to about 100px on a landscape phone. An ad that shrinks the thing the
 * player came to read is the interference this collection promises not to do
 * (docs/ADS_POLICY.md), so on short viewports there is simply no ad.
 */
const MIN_VIEWPORT_HEIGHT = 560;

export function ResultAdSlot() {
  const [show, setShow] = useState(false);
  // One count per mounted result view, even under StrictMode's double-invoked
  // effects (the ref survives the invoke-cleanup-invoke cycle).
  const counted = useRef(false);
  const { slotResult } = webAdsConfig();
  const tallEnough = typeof window === 'undefined' || window.innerHeight >= MIN_VIEWPORT_HEIGHT;
  const enabled = AdUnit !== null && tallEnough && webAdsSlotEnabled(slotResult);

  // Layout effect so the reserved box is part of the overlay's first painted
  // frame — the dialog never grows after it becomes visible.
  useLayoutEffect(() => {
    if (!enabled || counted.current) return;
    counted.current = true;
    setShow(recordResultView());
  }, [enabled]);

  if (!AdUnit || !show) return null;
  return (
    <div className="web-ad-slot web-ad-slot-result">
      <Suspense fallback={null}>
        <AdUnit slot={slotResult} placement="result" compact />
      </Suspense>
    </div>
  );
}
