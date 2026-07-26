/**
 * Reserved banner area (docs/ADS_POLICY.md): on native platforms with the
 * banner enabled, a fixed-height slot is reserved from mount so the board and
 * action buttons never shift when an ad loads. The slot only grows (never
 * shrinks) if the actual ad is taller. Offline or on ad failure it stays as
 * quiet empty space. On the web (dev) no space is reserved.
 */
import { useEffect, useState } from 'react';
import {
  isNativeAdsPlatform,
  onBannerSize,
  setBannerVisible,
} from '../../services/ads/adsController';
import { getRemoteConfig } from '../../services/remoteConfig';

const DEFAULT_SLOT_HEIGHT = 64;

export function BannerSlot() {
  const reserved = isNativeAdsPlatform() && getRemoteConfig().banner_enabled;
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
