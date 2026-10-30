/**
 * Reserved banner area (docs/ADS_POLICY.md「バナー広告の仕様」): on native
 * platforms a 64px slot is reserved from mount, so an ad loading into it
 * never resizes the board and, while none arrives, nothing moves. The slot
 * only grows (never shrinks) if the actual ad is taller; what sits right
 * above it then rises by the growth (26px at most) and a centred board by
 * half of it, which the policy accepts — the board keeps its size. Offline
 * or on ad failure it stays as quiet empty space. On the web (dev) no space is reserved, and on a launch that will
 * never initialize the ad SDK — the ad-removal purchase is active, or the
 * entitlement could not be read (issue #96) — the slot disappears entirely.
 * It is the same condition `app/boot.ts` uses before initializing the SDK, so
 * the strip is reserved exactly when something can arrive to fill it.
 *
 * While a reserved slot is mounted, the root element carries
 * `data-sg-app-banner`, which turns on `--sg-app-banner-reserve` in
 * ui/styles.css: the worst-case strip a game that sizes its board from the
 * viewport's height has to leave free (docs/ARCHITECTURE.md). It is set in a
 * layout effect, so the first paint already has it, and counted, so two slots
 * overlapping during a screen change never drop it in between.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { useAdRemovalActive } from '../../monetization/useAdRemoval';
import { isNativeAdsPlatform, onBannerSize, setBannerVisible } from '../../services/ads/banner';

const DEFAULT_SLOT_HEIGHT = 64;
const APP_BANNER_ATTRIBUTE = 'data-sg-app-banner';

/** Reserved slots mounted right now, across every screen. */
let reservedSlots = 0;

/** Marks the root while at least one reserved slot is mounted; returns the release. */
function holdAppBannerMark(): () => void {
  reservedSlots += 1;
  document.documentElement.setAttribute(APP_BANNER_ATTRIBUTE, '');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reservedSlots -= 1;
    if (reservedSlots === 0) document.documentElement.removeAttribute(APP_BANNER_ATTRIBUTE);
  };
}

export function BannerSlot() {
  const removed = useAdRemovalActive();
  const reserved = isNativeAdsPlatform() && !removed;
  const [height, setHeight] = useState(DEFAULT_SLOT_HEIGHT);

  useLayoutEffect(() => {
    if (!reserved) return;
    return holdAppBannerMark();
  }, [reserved]);

  useEffect(() => {
    if (!reserved) return;
    void setBannerVisible(true);
    const unsubscribe = onBannerSize((adHeight) => {
      // Grow only; never shrink mid-play (no layout shift downward).
      setHeight((current) => Math.max(current, adHeight));
    });
    return () => {
      unsubscribe();
      void setBannerVisible(false);
    };
  }, [reserved]);

  if (!reserved) return null;
  return <div className="banner-slot" style={{ height }} aria-hidden="true" />;
}
