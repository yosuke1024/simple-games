/**
 * Reserved banner area (docs/ADS_POLICY.md): on native platforms a
 * fixed-height slot is reserved from mount so the board and action buttons
 * never shift when an ad loads. The slot only grows (never shrinks) if the
 * actual ad is taller. Offline or on ad failure it stays as quiet empty
 * space. On the web (dev) no space is reserved, and once the ad-removal
 * purchase is active the slot disappears entirely.
 */
import { useEffect, useState } from 'react';
import { useAdRemovalPurchased } from '../../monetization/useAdRemoval';
import { isNativeAdsPlatform, onBannerSize, setBannerVisible } from '../../services/ads/banner';

const DEFAULT_SLOT_HEIGHT = 64;

export function BannerSlot() {
  const purchased = useAdRemovalPurchased();
  const reserved = isNativeAdsPlatform() && !purchased;
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
