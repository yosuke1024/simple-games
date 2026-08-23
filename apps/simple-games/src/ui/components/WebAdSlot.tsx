/**
 * The web build's display-ad slot (docs/ADS_POLICY.md「Web 版」,
 * docs/WEB_VERSION.md). On the native app this renders nothing — the app's
 * only ad surface remains the anchored banner (BannerSlot) — and the AdSense
 * integration below is referenced only when the bundle is built with
 * `--mode web`, so the native artifact carries no web-ad code at all
 * (verified in CI by .github/scripts/check-dist-ads-separation.sh).
 *
 * Layout rule, same as BannerSlot: whether the slot exists is decided at
 * build/boot time and its height is fixed, so a loading, failing, or offline
 * ad never moves the game list.
 */
import { Suspense, lazy } from 'react';
import { webAdsSlotEnabled } from '../../services/ads/web/config';

// `import.meta.env.MODE` is replaced at build time, so in the default
// (native-mode) build this whole expression folds to `null` and the dynamic
// import — and with it every ad-network identifier — is dropped from the
// bundle.
const AdUnit =
  import.meta.env.MODE === 'web' ? lazy(() => import('../../services/ads/web/AdUnit')) : null;

export function WebAdSlot() {
  if (!AdUnit || !webAdsSlotEnabled('home')) return null;
  return (
    <div className="web-ad-slot">
      <Suspense fallback={null}>
        <AdUnit placement="home" />
      </Suspense>
    </div>
  );
}
