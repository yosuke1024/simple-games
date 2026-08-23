/**
 * The web-build ad bootstrap: test mode mounts the local anchor placeholder
 * and contacts no ad network; production loads the AdSense loader exactly
 * once, and only while online; without a client nothing happens at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setOnlineForTesting } from '../../network';
import { resetAdMaxLoaderForTesting, setAdMaxIdsForTesting } from './admax';
import { initWebAds } from './boot';
import { setWebAdsConfigForTesting } from './config';

type AdMaxWindow = Window & { admaxads?: unknown[]; __admax_tag__?: unknown };

const bar = () => document.querySelector('.web-anchor-test');
const adsScript = () => document.head.querySelector('script[data-sg-adsense]');
const admaxBar = () => document.querySelector('.web-admax-anchor');
const admaxScripts = () => document.head.querySelectorAll('script[data-sg-admax]');
const admaxScript = () => document.head.querySelector('script[data-sg-admax]');

afterEach(() => {
  setWebAdsConfigForTesting(null);
  setAdMaxIdsForTesting(null);
  resetAdMaxLoaderForTesting();
  setOnlineForTesting(true);
  bar()?.remove();
  adsScript()?.remove();
  admaxBar()?.remove();
  admaxScripts().forEach((script) => script.remove());
  delete (window as AdMaxWindow).admaxads;
  delete (window as AdMaxWindow).__admax_tag__;
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

/**
 * A no-fill is silent in AdMax: the bar keeps standing with an empty frame in
 * it. The bar goes, and so does the bottom space every screen was keeping
 * clear for it — an empty strip under every screen is worse than the single
 * layout change that releasing it costs (the trade recorded in
 * docs/ADS_POLICY.md「Web 版」).
 */
describe('initWebAds when the anchor frame comes back empty', () => {
  const reservedSpace = () => document.documentElement.hasAttribute('data-sg-web-ads');

  const mountAnchor = () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide' });
    document.documentElement.dataset.sgWebAds = '';
    initWebAds();
  };

  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.sgWebAds;
  });

  it('takes the bar and the reserved space away when nothing rendered', () => {
    vi.useFakeTimers();
    mountAnchor();
    expect(admaxBar()).not.toBeNull();
    expect(reservedSpace()).toBe(true);

    vi.runAllTimers();

    expect(admaxBar()).toBeNull();
    expect(reservedSpace()).toBe(false);
  });

  it('leaves both alone when a creative did render', () => {
    vi.useFakeTimers();
    mountAnchor();

    // What a filled frame looks like: t.js writes an iframe into the unit and
    // the exchange puts a creative inside it. jsdom gives every element a zero
    // rect, and the check asks for real dimensions (a 1×1 pixel is not a
    // creative), so the creative's size has to be spelled out.
    const unit = admaxBar()?.querySelector('.admax-ads');
    const frame = document.createElement('iframe');
    unit?.appendChild(frame);
    const doc = frame.contentDocument;
    if (doc) {
      doc.body.innerHTML = '<img src="creative.png">';
      const image = doc.querySelector('img');
      if (image) {
        Object.defineProperty(image, 'getBoundingClientRect', {
          value: () => ({ width: 728, height: 90 }),
        });
      }
    }

    vi.runAllTimers();

    expect(admaxBar()).not.toBeNull();
    expect(reservedSpace()).toBe(true);
  });
});
