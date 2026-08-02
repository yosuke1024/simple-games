/**
 * The web-build ad bootstrap: test mode mounts the local anchor placeholder
 * and contacts no ad network; production loads the AdSense loader exactly
 * once, and only while online; without a client nothing happens at all.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setOnlineForTesting } from '../../network';
import { initWebAds } from './boot';
import { setWebAdsConfigForTesting } from './config';

const bar = () => document.querySelector('.web-anchor-test');
const adsScript = () => document.head.querySelector('script[data-sg-adsense]');

afterEach(() => {
  setWebAdsConfigForTesting(null);
  setOnlineForTesting(true);
  bar()?.remove();
  adsScript()?.remove();
});

describe('initWebAds', () => {
  it('test mode: mounts one placeholder anchor, zero network', () => {
    initWebAds();
    initWebAds(); // idempotent
    expect(document.querySelectorAll('.web-anchor-test')).toHaveLength(1);
    expect(bar()).toHaveTextContent('Test ad');
    expect(adsScript()).toBeNull();
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
