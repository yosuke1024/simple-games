/**
 * The web-build ad bootstrap: test mode mounts the local anchor placeholder
 * and contacts no ad network; production loads the AdSense loader exactly
 * once, and only while online; without a client nothing happens at all.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setOnlineForTesting } from '../../network';
import { setAdMaxIdsForTesting } from './admax';
import { initWebAds } from './boot';
import { setWebAdsConfigForTesting } from './config';

type AdMaxWindow = Window & { admaxads?: unknown[] };

const bar = () => document.querySelector('.web-anchor-test');
const adsScript = () => document.head.querySelector('script[data-sg-adsense]');
const admaxBar = () => document.querySelector('.web-admax-anchor');
const admaxScript = () => document.head.querySelector('script[data-sg-admax]');

afterEach(() => {
  setWebAdsConfigForTesting(null);
  setAdMaxIdsForTesting(null);
  setOnlineForTesting(true);
  bar()?.remove();
  adsScript()?.remove();
  admaxBar()?.remove();
  admaxScript()?.remove();
  delete (window as AdMaxWindow).admaxads;
});

describe('initWebAds', () => {
  it('test mode: mounts one placeholder anchor, zero network', () => {
    initWebAds();
    initWebAds(); // idempotent
    expect(document.querySelectorAll('.web-anchor-test')).toHaveLength(1);
    expect(bar()).toHaveTextContent('Test ad');
    expect(adsScript()).toBeNull();
    // The fallback network is no exception to "zero network in test mode".
    expect(admaxScript()).toBeNull();
    expect((window as AdMaxWindow).admaxads).toBeUndefined();
  });

  it('production online: loads the loader (anchor formats come from the console)', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    initWebAds();
    expect(adsScript()).not.toBeNull();
    expect(bar()).toBeNull();
  });

  it('production offline: not a single request and nothing polls', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setOnlineForTesting(false);
    initWebAds();
    expect(adsScript()).toBeNull();
  });

  it('no client: nothing at all', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    initWebAds();
    expect(adsScript()).toBeNull();
    expect(bar()).toBeNull();
  });

  // Regression: `ads: disabled` builds carry '' rather than undefined, and an
  // empty client once reached ensureAdSenseScript — a live request to the ad
  // network from the mode that promises none.
  it('empty client: still nothing, and no request', () => {
    setWebAdsConfigForTesting({ testMode: false, client: '' });
    initWebAds();
    expect(adsScript()).toBeNull();
    expect(bar()).toBeNull();
  });
});

/**
 * A build with no AdSense client (docs/ADS_POLICY.md「Web 版」の「二つの
 * ネットワーク」): AdMax has no overlay format of its own, so the bar IS the
 * anchor and mounts at boot — no failure has to happen first, and Google is
 * contacted nowhere.
 */
describe('initWebAds with 忍者AdMax as the network', () => {
  it('mounts the anchor bar at boot, with no AdSense request', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide', anchor320x100: 'anchor-mobile' });
    initWebAds();
    initWebAds(); // idempotent

    // jsdom's viewport is desktop-wide, so the 728×90 frame wins.
    expect(document.querySelectorAll('.web-admax-anchor')).toHaveLength(1);
    expect(admaxBar()?.querySelector('.admax-ads')).toHaveAttribute(
      'data-admax-id',
      'anchor-wide',
    );
    expect((window as AdMaxWindow).admaxads).toEqual([{ admax_id: 'anchor-wide', type: 'banner' }]);
    expect(admaxScript()).not.toBeNull();
    expect(adsScript()).toBeNull();
  });

  it('offline: no bar and not a single request', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide' });
    setOnlineForTesting(false);
    initWebAds();
    expect(admaxBar()).toBeNull();
    expect(admaxScript()).toBeNull();
    expect((window as AdMaxWindow).admaxads).toBeUndefined();
  });

  it('no frames either: quiet nothing, the `disabled` build', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    initWebAds();
    expect(admaxBar()).toBeNull();
    expect(admaxScript()).toBeNull();
    expect(adsScript()).toBeNull();
  });
});

/**
 * The anchor's runtime fallback (docs/ADS_POLICY.md「Web 版」フォールバック):
 * a failed AdSense loader — the one anchor-level failure that is detectable —
 * mounts a fixed bottom bar with a 忍者AdMax frame in the reserved bottom
 * space. Nothing else mounts it, and a working loader never sees AdMax.
 */
describe('initWebAds AdMax anchor fallback', () => {
  const failAdSenseLoader = () => adsScript()?.dispatchEvent(new Event('error'));

  it('loader failure with anchor frames: mounts the bar once, widest frame that fits', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide', anchor320x100: 'anchor-mobile' });
    initWebAds();
    expect(admaxBar()).toBeNull(); // nothing until the loader actually fails

    failAdSenseLoader();
    // jsdom's viewport is desktop-wide, so the 728×90 frame wins.
    expect(document.querySelectorAll('.web-admax-anchor')).toHaveLength(1);
    expect(admaxBar()?.querySelector('.admax-ads')).toHaveAttribute(
      'data-admax-id',
      'anchor-wide',
    );
    expect((window as AdMaxWindow).admaxads).toEqual([
      { admax_id: 'anchor-wide', type: 'banner' },
    ]);
    expect(admaxScript()).not.toBeNull();
  });

  it('loader success: no AdMax contact at all', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide' });
    initWebAds();
    expect(admaxBar()).toBeNull();
    expect(admaxScript()).toBeNull();
    expect((window as AdMaxWindow).admaxads).toBeUndefined();
  });

  it('loader failure without anchor frames: quiet nothing', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    initWebAds();
    failAdSenseLoader();
    expect(admaxBar()).toBeNull();
    expect(admaxScript()).toBeNull();
  });

  it('AdMax loader failing too removes the bar — no empty shelf', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide' });
    initWebAds();
    failAdSenseLoader();
    expect(admaxBar()).not.toBeNull();

    admaxScript()?.dispatchEvent(new Event('error'));
    expect(admaxBar()).toBeNull();
  });
});
