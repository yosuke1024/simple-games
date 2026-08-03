/**
 * A manual AdSense display unit (docs/ADS_POLICY.md「Web 版」,
 * docs/WEB_VERSION.md). The Auto-ads anchor is NOT rendered here — it is
 * Google's own overlay, bootstrapped by boot.ts.
 *
 * This module must never reach the native app: WebAdSlot / ResultAdSlot
 * reference it behind an `import.meta.env.MODE === 'web'` gate, so the
 * default (native-mode) build contains none of these identifiers — verified
 * against the built bundles by .github/scripts/check-dist-ads-separation.sh
 * in CI.
 *
 * Rules shared with the AdMob banner (services/ads/banner.ts):
 * - Ads never gate game features; every failure path is silent.
 * - Offline → not a single ad request, and no retry loop. A later visit to
 *   the screen while online tries again; nothing polls in between.
 * - Test mode renders a local placeholder and contacts no ad network:
 *   AdSense has no official test client ID, so honest testing is "no request
 *   at all", not "a request marked as a test".
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isOnline } from '../../network';
import { webAdsConfig } from './config';
import { ensureAdSenseScript } from './script';

type AdsWindow = Window & { adsbygoogle?: unknown[] };

interface AdSize {
  width: number;
  height: number;
}

/**
 * Standard AdSense sizes, largest first. Fixed sizes — not responsive — so the
 * slot's height is known before the ad loads and the layout never shifts (the
 * same rule BannerSlot enforces for the native banner).
 */
const SIZES = [
  { width: 728, height: 90 },
  { width: 320, height: 100 },
  { width: 234, height: 60 },
] as const satisfies readonly AdSize[];

/** The widest size a `compact` placement may use (the result overlay). */
const COMPACT_MAX_WIDTH = 320;

/**
 * The largest standard size that fits the space actually available, or null
 * when nothing does — an ad that overflows its container is both a visual
 * defect and an AdSense policy problem, so rendering nothing is the correct
 * outcome rather than the fallback.
 *
 * Measured from the container, NOT from `window.innerWidth`: inside the result
 * overlay the two differ by the overlay's 48px of gutter, which on a 360px
 * phone — the most common Android width — leaves 312px and made a 320px unit
 * overflow.
 */
export function pickAdSize(available: number): AdSize | null {
  return SIZES.find((size) => size.width <= available) ?? null;
}

export interface AdUnitProps {
  /** AdSense slot ID for this placement; null renders nothing. */
  slot: string | null;
  /** Never use the wide size, even if the container could hold it. */
  compact?: boolean;
}

/**
 * The placement wrapper owns the reserved height, not this component. AdSense
 * reports fill state on the `<ins>` via `data-ad-status`; when it says
 * `unfilled`, hide that wrapper so an unavailable ad does not leave a blank
 * white rectangle. `filled` removes the flag again for completeness.
 */
function setPlacementHidden(host: HTMLDivElement | null, hidden: boolean): void {
  const placement = host?.closest<HTMLElement>('.web-ad-slot');
  if (placement) placement.hidden = hidden;
}

export default function AdUnit({ slot, compact = false }: AdUnitProps) {
  const { testMode, client } = webAdsConfig();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<AdSize | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);

  // Before paint, so the unit is sized on its first appearance. The host box
  // is already the slot's reserved height, so filling it in shifts nothing.
  useLayoutEffect(() => {
    const measured = hostRef.current?.clientWidth ?? 0;
    // jsdom and any pre-layout render report 0; fall back to the viewport,
    // which is what this used to do everywhere.
    const available =
      measured > 0 ? measured : typeof window === 'undefined' ? 0 : window.innerWidth;
    const limit = compact ? Math.min(available, COMPACT_MAX_WIDTH) : available;
    setSize(pickAdSize(limit));
  }, [compact]);

  const live = !testMode && Boolean(client) && Boolean(slot);

  useEffect(() => {
    // No size means nothing was rendered to fill: requesting an ad for a box
    // that does not exist would be a request the reader never sees.
    if (!live || !client || !size || requestedRef.current || !insRef.current) return;

    const unit = insRef.current;
    const syncFillState = () => {
      const status = unit.getAttribute('data-ad-status');
      if (status === 'unfilled') setPlacementHidden(hostRef.current, true);
      if (status === 'filled') setPlacementHidden(hostRef.current, false);
    };
    const observer = new MutationObserver(syncFillState);
    observer.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
    syncFillState();

    // Offline: collapse the unused placement and send no request. No listener
    // waits for a reconnect — the next time the screen is opened online, a
    // fresh mount tries again (zero requests and zero polling meanwhile).
    if (!isOnline()) {
      setPlacementHidden(hostRef.current, true);
      return () => observer.disconnect();
    }

    requestedRef.current = true;
    setPlacementHidden(hostRef.current, false);
    ensureAdSenseScript(client);
    try {
      const w = window as AdsWindow;
      (w.adsbygoogle = w.adsbygoogle ?? []).push({});
    } catch {
      setPlacementHidden(hostRef.current, true);
    }

    return () => observer.disconnect();
  }, [live, client, size]);

  // Nothing can ever appear here (no client, no slot): render nothing at all
  // rather than an empty host, so a build with no ad IDs stays literally empty.
  if (!testMode && !live) return null;

  // Otherwise the host is always present so it can be measured. The placement
  // around it reserves the loading height, then collapses if AdSense marks the
  // request unfilled.
  return (
    <div className="web-ad-host" ref={hostRef}>
      {size === null ? null : testMode ? (
        <div
          className="web-ad-test"
          style={{ width: size.width, height: size.height }}
          aria-hidden="true"
        >
          Test ad
        </div>
      ) : live ? (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'inline-block', width: size.width, height: size.height }}
          data-ad-client={client}
          data-ad-slot={slot}
        />
      ) : null}
    </div>
  );
}
