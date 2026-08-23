/**
 * The web build's display unit (docs/ADS_POLICY.md「Web 版」): test mode is a
 * local placeholder with zero network contact, an AdSense build mounts one
 * <ins> and loads the loader script once, an AdMax build mounts the frame and
 * contacts Google nowhere, failures collapse the placement, and missing IDs
 * render nothing. (That this module stays OUT of the native bundle is
 * verified against the built artifacts by
 * .github/scripts/check-dist-ads-separation.sh, not here — the bundler
 * decides that, not the runtime.)
 *
 * jsdom reports a desktop-wide viewport, so every placement here sizes to
 * 728×90 unless a test says otherwise, and the AdMax frame under test is the
 * corresponding wide one.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setOnlineForTesting } from '../../network';
import AdUnit, { pickAdSize } from './AdUnit';
import { resetAdMaxLoaderForTesting, setAdMaxIdsForTesting } from './admax';
import {
  adIdFromEnv,
  setWebAdsConfigForTesting,
  webAdsSlotEnabled,
  webAnchorEnabled,
} from './config';
import { ensureAdSenseScript } from './script';

type AdsWindow = Window & { adsbygoogle?: unknown[]; admaxads?: unknown[]; __admax_tag__?: unknown };

const adsScript = () => document.head.querySelector('script[data-sg-adsense]');
const admaxScripts = () => document.head.querySelectorAll('script[data-sg-admax]');
const admaxScript = () => document.head.querySelector('script[data-sg-admax]');

/** An AdSense build: the client and both display slots are injected. */
const adSenseBuild = () =>
  setWebAdsConfigForTesting({
    testMode: false,
    client: 'test-client',
    slotHome: 'slot-a',
    slotResult: 'slot-b',
  });

/** An AdMax build: no AdSense client at all, frames instead. */
const adMaxBuild = () =>
  setWebAdsConfigForTesting({
    testMode: false,
    client: null,
    slotHome: null,
    slotResult: null,
    frames: { anchor: true, home: true, result: true },
  });

afterEach(() => {
  setWebAdsConfigForTesting(null);
  setAdMaxIdsForTesting(null);
  resetAdMaxLoaderForTesting();
  setOnlineForTesting(true);
  adsScript()?.remove();
  admaxScripts().forEach((script) => script.remove());
  delete (window as AdsWindow).adsbygoogle;
  delete (window as AdsWindow).admaxads;
  delete (window as AdsWindow).__admax_tag__;
});

describe('AdUnit in test mode', () => {
  it('renders the placeholder and contacts no ad network', () => {
    // Vitest runs as a dev-mode build, so test mode is already on — the same
    // default a `pnpm dev:web` session gets.
    render(<AdUnit placement="home" />);
    expect(screen.getByText('Test ad')).toBeInTheDocument();
    expect(adsScript()).toBeNull();
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
    // Neither network is an exception to "zero network in test mode".
    expect(admaxScript()).toBeNull();
    expect((window as AdsWindow).admaxads).toBeUndefined();
  });
});

describe('AdUnit in an AdSense build', () => {
  it('renders one <ins> per placement and requests the loader script once', () => {
    adSenseBuild();
    const { container } = render(
      <>
        <AdUnit placement="home" />
        <AdUnit placement="result" />
      </>,
    );
    const units = container.querySelectorAll('ins.adsbygoogle');
    expect(units).toHaveLength(2);
    expect(units[0]).toHaveAttribute('data-ad-client', 'test-client');
    expect(units[0]).toHaveAttribute('data-ad-slot', 'slot-a');
    expect(units[1]).toHaveAttribute('data-ad-slot', 'slot-b');
    // One loader for the page, no matter how many units mount.
    expect(document.head.querySelectorAll('script[data-sg-adsense]')).toHaveLength(1);
    expect(adsScript()).toHaveAttribute('src', expect.stringContaining('client=test-client'));
    // Each unit announced itself to the queue.
    expect((window as AdsWindow).adsbygoogle).toHaveLength(2);
  });

  it('collapses an unfilled placement and restores it if AdSense reports filled', async () => {
    adSenseBuild();
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
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
    adSenseBuild();
    setOnlineForTesting(false);
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
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
    setWebAdsConfigForTesting({ testMode: false, client: null, slotHome: 'slot-a' });
    const { container } = render(<AdUnit placement="home" />);
    expect(container).toBeEmptyDOMElement();

    setWebAdsConfigForTesting({ client: 'test-client', slotHome: null });
    const { container: noSlot } = render(<AdUnit placement="home" />);
    expect(noSlot).toBeEmptyDOMElement();
    expect(adsScript()).toBeNull();
  });
});

/**
 * The AdSense build's runtime fallback (docs/ADS_POLICY.md「Web 版」): only a
 * demonstrable AdSense failure — `unfilled`, or the loader itself erroring —
 * hands the reserved box to a same-size 忍者AdMax frame.
 */
describe('AdUnit falling back from AdSense to 忍者AdMax', () => {
  const renderPlacement = () =>
    render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
      </div>,
    );

  it('unfilled with a configured frame: swaps the same box to AdMax instead of collapsing', async () => {
    adSenseBuild();
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
    adSenseBuild();
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    const { container } = renderPlacement();
    adsScript()?.dispatchEvent(new Event('error'));
    await waitFor(() => {
      expect(container.querySelector('.admax-ads')).toHaveAttribute('data-admax-id', 'home-wide');
    });
  });

  it('loader already failed before mount: straight to AdMax, no AdSense push', async () => {
    adSenseBuild();
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
    adSenseBuild();
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
    adSenseBuild();
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
 * A build with no AdSense client at all (docs/ADS_POLICY.md「Web 版」の
 * 「二つのネットワーク」): 忍者AdMax fills every placement itself, and not one
 * request reaches Google — which is the whole point of publishing this way
 * while AdSense cannot serve.
 */
describe('AdUnit in an AdMax build', () => {
  it('mounts the frame directly and contacts Google nowhere', () => {
    adMaxBuild();
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
      </div>,
    );

    const frame = container.querySelector('.admax-ads');
    expect(frame).toHaveAttribute('data-admax-id', 'home-wide');
    expect(frame).toHaveStyle({ width: '728px', height: '90px' });
    expect(container.querySelector('.web-ad-slot')).not.toHaveAttribute('hidden');
    expect((window as AdsWindow).admaxads).toEqual([{ admax_id: 'home-wide', type: 'banner' }]);
    expect(admaxScript()).not.toBeNull();
    // No <ins>, no loader, no queue: Google is not part of this page view.
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(adsScript()).toBeNull();
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
  });

  it("uses each placement's own frame", () => {
    adMaxBuild();
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide', slotResult320x100: 'result-mobile' });
    const { container } = render(
      <>
        <AdUnit placement="home" />
        <AdUnit placement="result" compact />
      </>,
    );
    const ids = [...container.querySelectorAll('.admax-ads')].map((el) =>
      el.getAttribute('data-admax-id'),
    );
    // The compact placement is capped at 320 wide, so it takes the 320×100
    // frame while the home slot takes the wide one — never the same frame
    // twice on one page.
    expect(ids).toEqual(['home-wide', 'result-mobile']);
  });

  /**
   * The narrow result overlay falls to 234×60, a size AdMax has no frame for.
   * The box must never be reserved and then taken away: this assertion runs
   * with no `waitFor`, so it fails if the collapse waits for a post-paint
   * effect instead of the layout effect that measures.
   */
  it('collapses before paint when no frame fits the measured size', () => {
    adMaxBuild();
    setAdMaxIdsForTesting({ slotHome320x100: 'home-mobile' });
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
      </div>,
    );
    expect(container.querySelector('.admax-ads')).toBeNull();
    expect(container.querySelector('.web-ad-slot')).toHaveAttribute('hidden');
    expect((window as AdsWindow).admaxads).toBeUndefined();
    expect(admaxScript()).toBeNull();
  });

  it('offline: collapses the placement and sends zero requests', () => {
    adMaxBuild();
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    setOnlineForTesting(false);
    const { container } = render(
      <div className="web-ad-slot">
        <AdUnit placement="home" />
      </div>,
    );
    expect(container.querySelector('.web-ad-slot')).toHaveAttribute('hidden');
    expect(admaxScript()).toBeNull();
    expect((window as AdsWindow).admaxads).toBeUndefined();
  });

  it('renders nothing when the build carries no frames at all', () => {
    setWebAdsConfigForTesting({
      testMode: false,
      client: null,
      slotHome: null,
      frames: { anchor: false, home: false, result: false },
    });
    const { container } = render(<AdUnit placement="home" />);
    expect(container).toBeEmptyDOMElement();
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
  it('webAnchorEnabled: test mode, an injected client, or an AdMax anchor frame', () => {
    setWebAdsConfigForTesting({
      testMode: true,
      client: null,
      slotHome: null,
      slotResult: null,
      frames: { anchor: false, home: false, result: false },
    });
    expect(webAnchorEnabled()).toBe(true);
    setWebAdsConfigForTesting({ testMode: false });
    expect(webAnchorEnabled()).toBe(false);
    // Either network alone is enough — neither the Auto-ads anchor nor the
    // AdMax bar that stands in for it has a slot ID.
    setWebAdsConfigForTesting({ client: 'test-client' });
    expect(webAnchorEnabled()).toBe(true);
    setWebAdsConfigForTesting({ client: null, frames: { anchor: true, home: true, result: true } });
    expect(webAnchorEnabled()).toBe(true);
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

    setWebAdsConfigForTesting({
      testMode: false,
      client: '',
      slotHome: '',
      slotResult: '',
      frames: { anchor: false, home: false, result: false },
    });
    expect(webAnchorEnabled()).toBe(false);
    expect(webAdsSlotEnabled('home')).toBe(false);
  });

  it('webAdsSlotEnabled: an AdSense slot beside the client, or any AdMax frame', () => {
    setWebAdsConfigForTesting({
      testMode: false,
      client: null,
      slotHome: null,
      slotResult: null,
      frames: { anchor: false, home: false, result: false },
    });
    expect(webAdsSlotEnabled('home')).toBe(false);

    // AdSense serves only the placements whose own slot ID was injected.
    setWebAdsConfigForTesting({ client: 'test-client', slotHome: 'slot-a' });
    expect(webAdsSlotEnabled('home')).toBe(true);
    expect(webAdsSlotEnabled('result')).toBe(false);

    // AdMax frames carry the placements AdSense cannot.
    setWebAdsConfigForTesting({ frames: { anchor: true, home: true, result: true } });
    expect(webAdsSlotEnabled('result')).toBe(true);

    setWebAdsConfigForTesting({
      testMode: true,
      client: null,
      slotHome: null,
      frames: { anchor: false, home: false, result: false },
    });
    expect(webAdsSlotEnabled('home')).toBe(true);
  });

  /**
   * A partly-configured frame set is a supported state — the publish workflow
   * injects whichever secrets exist — and each surface has to answer for
   * itself. An aggregate "this build has frames" flag said yes for surfaces
   * with no frame, which reserved 116px of bottom space no bar could fill,
   * and mounted display boxes that the lazy unit then took away after the
   * first paint.
   */
  it('answers per surface when only some frames are configured', () => {
    const noneConfigured = {
      testMode: false,
      client: null,
      slotHome: null,
      slotResult: null,
    };

    setWebAdsConfigForTesting({
      ...noneConfigured,
      frames: { anchor: true, home: false, result: false },
    });
    expect(webAnchorEnabled()).toBe(true);
    expect(webAdsSlotEnabled('home')).toBe(false);
    expect(webAdsSlotEnabled('result')).toBe(false);

    setWebAdsConfigForTesting({
      ...noneConfigured,
      frames: { anchor: false, home: true, result: false },
    });
    expect(webAnchorEnabled()).toBe(false);
    expect(webAdsSlotEnabled('home')).toBe(true);
    expect(webAdsSlotEnabled('result')).toBe(false);
  });
});
