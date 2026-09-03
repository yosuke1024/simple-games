/**
 * Reserved banner area (docs/ADS_POLICY.md): on native platforms a
 * fixed-height slot is reserved from mount so the board and action buttons
 * never shift when an ad loads. The slot only grows (never shrinks) if the
 * actual ad is taller. Offline or on ad failure it stays as quiet empty
 * space. On the web (dev) no space is reserved, and on a launch that will
 * never initialize the ad SDK — the ad-removal purchase is active, or the
 * entitlement could not be read (issue #96) — the slot disappears entirely.
 * It is the same condition `app/boot.ts` uses before initializing the SDK, so
 * the strip is reserved exactly when something can arrive to fill it.
 */
import { useEffect, useState } from 'react';
import { useAdRemovalActive } from '../../monetization/useAdRemoval';
import { isNativeAdsPlatform, onBannerSize, setBannerVisible } from '../../services/ads/banner';

const DEFAULT_SLOT_HEIGHT = 64;

export function BannerSlot() {
  const removed = useAdRemovalActive();
  const reserved = isNativeAdsPlatform() && !removed;
  const [height, setHeight] = useState(DEFAULT_SLOT_HEIGHT);

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
