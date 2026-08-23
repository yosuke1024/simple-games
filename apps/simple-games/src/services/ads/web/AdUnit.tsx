/**
 * One web-build display unit (docs/ADS_POLICY.md「Web 版」,
 * docs/WEB_VERSION.md). The anchor is NOT rendered here: with AdSense it is
 * Google's own overlay and with 忍者AdMax it is a bar of ours, and either way
 * boot.ts owns it.
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
 *
 * WHICH NETWORK fills this box is settled by the build (config.ts): an
 * injected AdSense client makes AdSense primary and AdMax its fallback, and
 * with no client the AdMax frame is simply what mounts. The box, its fixed
 * size and its position are identical either way — the network is the only
 * thing that differs, so nothing about the layout depends on the outcome.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isOnline } from '../../network';
import {
  adMaxFrameId,
  adMaxScriptFailed,
  ensureAdMaxScript,
  onAdMaxScriptError,
  pushAdMaxAd,
} from './admax';
import { type WebAdPlacement, webAdsConfig, webAdsSlotEnabled } from './config';
import { adSenseScriptFailed, ensureAdSenseScript, onAdSenseScriptError } from './script';

type AdsWindow = Window & { adsbygoogle?: unknown[] };

interface AdSize {
  width: number;
  height: number;
}

/**
 * Standard sizes, largest first. Fixed sizes — not responsive — so the slot's
 * height is known before the ad loads and the layout never shifts (the same
 * rule BannerSlot enforces for the native banner). AdMax carries frames for
 * the first two; 234×60 is AdSense-only.
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
 * defect and an ad-policy problem, so rendering nothing is the correct
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
  /** Which placement this is — keys both networks' slot/frame lookup. */
  placement: WebAdPlacement;
  /** Never use the wide size, even if the container could hold it. */
  compact?: boolean;
}

/**
 * The placement wrapper owns the reserved height, not this component. Hide
 * that wrapper whenever this box cannot be filled, so an unavailable ad does
 * not leave a blank rectangle: AdSense reports that as `data-ad-status`, and
 * for AdMax it is known from the measured size (no frame that narrow).
 *
 * `.web-ad-slot` has an explicit `display: flex`, which can override the
 * browser's default rendering for `[hidden]`. Keep the semantic attribute and
 * set the inline display value as the authoritative visual state.
 */
function setPlacementHidden(host: HTMLDivElement | null, hidden: boolean): void {
  const placement = host?.closest<HTMLElement>('.web-ad-slot');
  if (!placement) return;

  placement.hidden = hidden;
  placement.style.display = hidden ? 'none' : '';
}

export default function AdUnit({ placement, compact = false }: AdUnitProps) {
  const { testMode, client, slotHome, slotResult } = webAdsConfig();
  const slot = placement === 'home' ? slotHome : slotResult;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<AdSize | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);
  // Set once AdSense demonstrably failed for this mount (loader error, or
  // `unfilled`). One-way: a placement never flips back and forth between
  // networks while the reader is looking at it.
  const [adSenseFailed, setAdSenseFailed] = useState(false);
  const frameRequestedRef = useRef(false);

  // Whether AdSense is this build's network for this placement at all. Not a
  // question about the ad that comes back — that is `adSenseFailed`.
  const adSenseConfigured = !testMode && Boolean(client) && Boolean(slot);
  const adSenseLive = adSenseConfigured && !adSenseFailed;
  const frameId = !testMode && !adSenseLive && size ? adMaxFrameId(placement, size) : null;

  // Before paint, so the unit is sized on its first appearance. The host box
  // is already the slot's reserved height, so filling it in shifts nothing —
  // and when nothing can fill it, the box leaves the layout in this same
  // pre-paint pass rather than appearing and then collapsing.
  useLayoutEffect(() => {
    const measured = hostRef.current?.clientWidth ?? 0;
    // jsdom and any pre-layout render report 0; fall back to the viewport,
    // which is what this used to do everywhere.
    const available =
      measured > 0 ? measured : typeof window === 'undefined' ? 0 : window.innerWidth;
    const limit = compact ? Math.min(available, COMPACT_MAX_WIDTH) : available;
    const picked = pickAdSize(limit);
    setSize(picked);

    const fillable =
      picked !== null &&
      (testMode || adSenseConfigured || Boolean(adMaxFrameId(placement, picked)));
    setPlacementHidden(hostRef.current, !fillable);
  }, [compact, placement, testMode, adSenseConfigured]);

  useEffect(() => {
    // No size means nothing was rendered to fill: requesting an ad for a box
    // that does not exist would be a request the reader never sees.
    if (!adSenseLive || !client || !size || requestedRef.current || !insRef.current) return;

    // Every AdSense failure below lands here: hand the box to the AdMax frame
    // for this exact placement×size, or — with no frame configured — collapse
    // the placement as an unfilled unit always has.
    const hasFrame = Boolean(adMaxFrameId(placement, size));
    const failOver = () => {
      if (hasFrame) setAdSenseFailed(true);
      else setPlacementHidden(hostRef.current, true);
    };

    // The loader already failed earlier this page view: go straight to the
    // fallback rather than queueing a push nothing will read (re-requesting
    // the loader would be the retry loop we don't do).
    if (adSenseScriptFailed()) {
      failOver();
      return;
    }

    const unit = insRef.current;
    const syncFillState = () => {
      const status = unit.getAttribute('data-ad-status');
      if (status === 'unfilled') failOver();
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
    const unsubscribe = onAdSenseScriptError(failOver);
    try {
      const w = window as AdsWindow;
      (w.adsbygoogle = w.adsbygoogle ?? []).push({});
    } catch {
      failOver();
    }

    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [adSenseLive, client, size, placement]);

  // The AdMax mount — this build's only network, or the fallback after an
  // AdSense failure; the code is the same either way. Render happens first
  // (the .admax-ads div must be in the DOM before its queue entry is
  // processed), then this pushes exactly once per mount. AdMax's loader
  // failing too — typically an ad blocker — collapses the placement like a
  // plain unfilled: no empty shelf.
  useEffect(() => {
    if (!frameId || frameRequestedRef.current) return;
    if (!isOnline() || adMaxScriptFailed()) {
      setPlacementHidden(hostRef.current, true);
      return;
    }
    frameRequestedRef.current = true;
    setPlacementHidden(hostRef.current, false);
    pushAdMaxAd(frameId);
    ensureAdMaxScript();
    return onAdMaxScriptError(() => setPlacementHidden(hostRef.current, true));
  }, [frameId]);

  // Nothing can ever appear here (no network configured for this placement):
  // render nothing at all rather than an empty host, so a build with no ad IDs
  // stays literally empty.
  if (!webAdsSlotEnabled(placement)) return null;

  // Otherwise the host is always present so it can be measured.
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
      ) : adSenseLive ? (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'inline-block', width: size.width, height: size.height }}
          data-ad-client={client}
          data-ad-slot={slot}
        />
      ) : frameId ? (
        <div
          className="admax-ads"
          data-admax-id={frameId}
          style={{ display: 'inline-block', width: size.width, height: size.height }}
        />
      ) : null}
    </div>
  );
}
