/**
 * The web build's AdSense unit (docs/ADS_POLICY.md「Web 版」): test mode is a
 * local placeholder with zero network contact, production mounts one <ins>
 * and loads the loader script once, unfilled/offline placements collapse,
 * and missing IDs render nothing. (That this module stays OUT of the native
 * bundle is verified against the built artifacts by
 * .github/scripts/check-dist-ads-separation.sh, not here — the bundler
 * decides that, not the runtime.)
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setOnlineForTesting } from '../../network';
import AdUnit, { pickAdSize } from './AdUnit';
import { setAdMaxIdsForTesting } from './admax';
import { adIdFromEnv, setWebAdsConfigForTesting, webAdsEnabled, webAdsSlotEnabled } from './config';
import { ensureAdSenseScript } from './script';

type AdsWindow = Window & { adsbygoogle?: unknown[]; admaxads?: unknown[] };

const adsScript = () => document.head.querySelector('script[data-sg-adsense]');
const admaxScript = () => document.head.querySelector('script[data-sg-admax]');

afterEach(() => {
  setWebAdsConfigForTesting(null);
  setAdMaxIdsForTesting(null);
  setOnlineForTesting(true);
  adsScript()?.remove();
  admaxScript()?.remove();
  delete (window as AdsWindow).adsbygoogle;
  delete (window as AdsWindow).admaxads;
});

describe('AdUnit in test mode', () => {
  it('renders the placeholder and contacts no ad network', () => {
    // Vitest runs as a dev-mode build, so test mode is already on — the same
    // default a `pnpm dev:web` session gets.
    render(<AdUnit slot="test-slot" placement="home" />);
    expect(screen.getByText('Test ad')).toBeInTheDocument();
    expect(adsScript()).toBeNull();
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
    // The fallback network is no exception to "zero network in test mode".
    expect(admaxScript()).toBeNull();
    expect((window as AdsWindow).admaxads).toBeUndefined();
  });
});

describe('AdUnit in production mode', () => {
  it('renders one <ins> and requests the loader script once', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    const { container } = render(
      <>
        <AdUnit slot="slot-a" placement="home" />
        <AdUnit slot="slot-b" placement="home" />
      </>,
    );
    const units = container.querySelectorAll('ins.adsbygoogle');
    expect(units).toHaveLength(2);
    expect(units[0]).toHaveAttribute('data-ad-client', 'test-client');
    expect(units[0]).toHaveAttribute('data-ad-slot', 'slot-a');
    // One loader for the page, no matter how many units mount.
    expect(document.head.querySelectorAll('script[data-sg-adsense]')).toHaveLength(1);
    expect(adsScript()).toHaveAttribute('src', expect.stringContaining('client=test-client'));
    // Each unit announced itself to the queue.
    expect((window as AdsWindow).adsbygoogle).toHaveLength(2);
  });

  it('collapses an unfilled placement and restores it if AdSense reports filled', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit slot="slot-a" placement="home" />
      </div>,
    );
    const placement = container.querySelector<HTMLElement>('.web-ad-slot');
    const unit = container.querySelector<HTMLElement>('ins.adsbygoogle');
    expect(placement).not.toBeNull();
    expect(unit).not.toBeNull();
    expect(placement).not.toHaveAttribute('hidden');
    expect(placement).not.toHaveStyle({ display: 'none' });

    unit?.setAttribute('data-ad-status', 'unfilled');
    await waitFor(() => {
      expect(placement).toHaveAttribute('hidden');
      expect(placement).toHaveStyle({ display: 'none' });
    });

    unit?.setAttribute('data-ad-status', 'filled');
    await waitFor(() => {
      expect(placement).not.toHaveAttribute('hidden');
      expect(placement?.style.display).toBe('');
    });
  });

  it('offline: collapses the placement and sends zero requests', () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setOnlineForTesting(false);
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit slot="slot-a" placement="home" />
      </div>,
    );
    // The unit remains in the DOM for a future fresh mount, but the unused
    // reserved placement is not left as a blank rectangle.
    expect(container.querySelector('ins.adsbygoogle')).not.toBeNull();
    const placement = container.querySelector<HTMLElement>('.web-ad-slot');
    expect(placement).toHaveAttribute('hidden');
    expect(placement).toHaveStyle({ display: 'none' });
    // Nothing was requested, and nothing will retry.
    expect(adsScript()).toBeNull();
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
  });

  it('renders nothing without an injected client or slot', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null });
    const { container } = render(<AdUnit slot="slot-a" placement="home" />);
    expect(container).toBeEmptyDOMElement();

    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    const { container: noSlot } = render(<AdUnit slot={null} placement="home" />);
    expect(noSlot).toBeEmptyDOMElement();
    expect(adsScript()).toBeNull();
  });
});

/**
 * The runtime fallback (docs/ADS_POLICY.md「Web 版」フォールバック): only a
 * demonstrable AdSense failure — `unfilled`, or the loader itself erroring —
 * swaps the reserved box to a same-size 忍者AdMax frame. jsdom reports a
 * desktop-wide viewport, so these placements size to 728×90 and the fallback
 * frame under test is the home slot's wide one.
 */
describe('AdUnit fallback to 忍者AdMax', () => {
  const renderPlacement = () =>
    render(
      <div className="web-ad-slot">
        <AdUnit slot="slot-a" placement="home" />
      </div>,
    );

  it('unfilled with a configured frame: swaps the same box to AdMax instead of collapsing', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    const { container } = renderPlacement();
    const placement = container.querySelector<HTMLElement>('.web-ad-slot');

    container.querySelector('ins.adsbygoogle')?.setAttribute('data-ad-status', 'unfilled');
    await waitFor(() => {
      expect(container.querySelector('.admax-ads')).toHaveAttribute('data-admax-id', 'home-wide');
    });
    // The AdSense unit is gone, the box stays visible at the same size, and
    // the AdMax queue plus its loader carry exactly this one frame.
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(placement).not.toHaveAttribute('hidden');
    expect((window as AdsWindow).admaxads).toEqual([{ admax_id: 'home-wide', type: 'banner' }]);
    expect(admaxScript()).not.toBeNull();
  });

  it('loader failure: the mounted unit falls over to AdMax', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    const { container } = renderPlacement();
    adsScript()?.dispatchEvent(new Event('error'));
    await waitFor(() => {
      expect(container.querySelector('.admax-ads')).toHaveAttribute('data-admax-id', 'home-wide');
    });
  });

  it('loader already failed before mount: straight to AdMax, no AdSense push', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    ensureAdSenseScript('test-client');
    adsScript()?.dispatchEvent(new Event('error'));

    const { container } = renderPlacement();
    await waitFor(() => {
      expect(container.querySelector('.admax-ads')).toHaveAttribute('data-admax-id', 'home-wide');
    });
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
  });

  it('without a frame for the size, unfilled still collapses (no near-miss serving)', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ slotHome728x90: null, slotHome320x100: 'home-mobile' });
    const { container } = renderPlacement();
    container.querySelector('ins.adsbygoogle')?.setAttribute('data-ad-status', 'unfilled');
    await waitFor(() => {
      expect(container.querySelector('.web-ad-slot')).toHaveAttribute('hidden');
    });
    expect(container.querySelector('.admax-ads')).toBeNull();
    expect((window as AdsWindow).admaxads).toBeUndefined();
  });

  it('AdMax loader failing too collapses the placement — no empty shelf', async () => {
    setWebAdsConfigForTesting({ testMode: false, client: 'test-client' });
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    const { container } = renderPlacement();
    container.querySelector('ins.adsbygoogle')?.setAttribute('data-ad-status', 'unfilled');
    await waitFor(() => expect(admaxScript()).not.toBeNull());

    admaxScript()?.dispatchEvent(new Event('error'));
    await waitFor(() => {
      expect(container.querySelector('.web-ad-slot')).toHaveAttribute('hidden');
    });
  });
});

/**
 * Regression: the size used to come from `window.innerWidth`, which is not the
 * width the unit actually gets. Inside the result overlay the two differ by
 * 48px of gutter, so on a 360px phone — the most common Android width — a
 * 320px unit overflowed its container.
 */
describe('pickAdSize', () => {
  it('takes the largest standard size that fits the measured space', () => {
    expect(pickAdSize(1280)).toEqual({ width: 728, height: 90 });
    expect(pickAdSize(728)).toEqual({ width: 728, height: 90 });
    expect(pickAdSize(727)).toEqual({ width: 320, height: 100 });
    // 360px viewport minus the overlay's 48px gutter: no longer picks 320.
    expect(pickAdSize(312)).toEqual({ width: 234, height: 60 });
    // 320px viewport, full-width slot: exactly fits.
    expect(pickAdSize(320)).toEqual({ width: 320, height: 100 });
  });

  it('renders nothing rather than an ad that would overflow', () => {
    expect(pickAdSize(233)).toBeNull();
    expect(pickAdSize(0)).toBeNull();
  });
});

describe('web ads config', () => {
  it('webAdsEnabled: test mode or an injected client (the anchor needs no slot)', () => {
    setWebAdsConfigForTesting({ testMode: true, client: null, slotHome: null, slotResult: null });
    expect(webAdsEnabled()).toBe(true);
    setWebAdsConfigForTesting({ testMode: false });
    expect(webAdsEnabled()).toBe(false);
    setWebAdsConfigForTesting({ client: 'test-client' });
    expect(webAdsEnabled()).toBe(true);
  });

  /**
   * Regression: the workflows pass '' for every mode except production, and
   * Vite embeds an empty variable as the empty STRING, not undefined. `?? null`
   * kept that '', so an `ads: disabled` build reserved the anchor space, told
   * the reader it served AdSense, and requested the loader with an empty
   * client — from the one mode documented to make no request at all.
   */
  it('treats an empty injected ID as no ID at all', () => {
    expect(adIdFromEnv('')).toBeNull();
    expect(adIdFromEnv('   ')).toBeNull();
    expect(adIdFromEnv(undefined)).toBeNull();
    expect(adIdFromEnv(' test-client ')).toBe('test-client');

    setWebAdsConfigForTesting({ testMode: false, client: '', slotHome: '', slotResult: '' });
    expect(webAdsEnabled()).toBe(false);
    expect(webAdsSlotEnabled('')).toBe(false);
  });

  it('webAdsSlotEnabled: each display slot needs its own ID beside the client', () => {
    setWebAdsConfigForTesting({ testMode: false, client: null, slotHome: null, slotResult: null });
    expect(webAdsSlotEnabled('test-slot')).toBe(false);
    setWebAdsConfigForTesting({ client: 'test-client' });
    expect(webAdsSlotEnabled(null)).toBe(false);
    expect(webAdsSlotEnabled('test-slot')).toBe(true);
    setWebAdsConfigForTesting({ testMode: true, client: null });
    expect(webAdsSlotEnabled(null)).toBe(true);
  });
});
