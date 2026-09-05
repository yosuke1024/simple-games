import { afterEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, admobMock, networkMock } = vi.hoisted(() => {
  // Recorded so a test can play a native plugin event back (issue #120): the
  // real plugin has no test double of its own, so "the SDK told us a banner
  // failed to load" has to be reproduced by calling back in on the same
  // listener banner.ts itself registered.
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    capacitorMock: { platform: 'android' as string },
    admobMock: {
      listeners,
      initialize: vi.fn(() => Promise.resolve()),
      addListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)?.add(cb);
        return Promise.resolve({ remove: () => Promise.resolve() });
      }),
      showBanner: vi.fn(() => Promise.resolve()),
      hideBanner: vi.fn(() => Promise.resolve()),
      resumeBanner: vi.fn(() => Promise.resolve()),
      removeBanner: vi.fn(() => Promise.resolve()),
    },
    networkMock: { online: true },
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: admobMock,
  BannerAdPluginEvents: {
    SizeChanged: 'bannerAdSizeChanged',
    FailedToLoad: 'bannerAdFailedToLoad',
  },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
}));

vi.mock('../network', () => ({
  isOnline: () => networkMock.online,
}));

const { consentMock } = vi.hoisted(() => ({
  consentMock: { impl: () => Promise.resolve(true) },
}));

vi.mock('./consent', () => ({
  canRequestAds: () => consentMock.impl(),
}));

/**
 * The ad unit IDs are read once, when the module is evaluated — that is what
 * lets Vite substitute the `import.meta.env.VITE_…` expressions at build time
 * and drop the unused branch. So each case stubs the environment first and
 * then imports a fresh copy of the module.
 */
async function loadBanner(platform: string, env: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  // A production build is the interesting case: dev always uses test IDs.
  vi.stubEnv('DEV', false);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  capacitorMock.platform = platform;
  return import('./banner');
}

// Deliberately NOT shaped like real ad unit IDs. The principles guard
// (.github/scripts/check-principles.sh §5) forbids AdMob-shaped IDs anywhere
// in source outside Google's test prefix, and a test fixture is not worth a
// hole in it. These stand in for whatever the release lane injects; nothing
// here parses them.
const ANDROID_PRODUCTION = 'injected-android-banner-unit';
const IOS_PRODUCTION = 'injected-ios-banner-unit';
const BOTH = {
  VITE_ADMOB_ANDROID_BANNER_ID: ANDROID_PRODUCTION,
  VITE_ADMOB_IOS_BANNER_ID: IOS_PRODUCTION,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('adPlatform', () => {
  it('names the two ad platforms and nothing else', async () => {
    expect((await loadBanner('android')).adPlatform()).toBe('android');
    expect((await loadBanner('ios')).adPlatform()).toBe('ios');
    expect((await loadBanner('web')).adPlatform()).toBeNull();
  });
});

describe('bannerAdUnitId', () => {
  it('uses the OS-specific production unit', async () => {
    expect((await loadBanner('android', BOTH)).bannerAdUnitId()).toBe(ANDROID_PRODUCTION);
    expect((await loadBanner('ios', BOTH)).bannerAdUnitId()).toBe(IOS_PRODUCTION);
  });

  /**
   * The native bundle is built once and copied into both native projects, so
   * a build that was handed both IDs carries both. What must never happen is
   * one platform SERVING the other's unit — that would bill an iOS impression
   * to the Android app. (The release lanes also inject one ID at a time.)
   */
  it('never falls back to the other platform’s unit', async () => {
    const android = await loadBanner('android', { VITE_ADMOB_IOS_BANNER_ID: IOS_PRODUCTION });
    expect(android.bannerAdUnitId()).toBeNull();

    const ios = await loadBanner('ios', { VITE_ADMOB_ANDROID_BANNER_ID: ANDROID_PRODUCTION });
    expect(ios.bannerAdUnitId()).toBeNull();
  });

  it('shows no ad when this platform has no unit configured', async () => {
    expect((await loadBanner('android')).bannerAdUnitId()).toBeNull();
    expect((await loadBanner('ios')).bannerAdUnitId()).toBeNull();
    // The release workflow passes '' rather than omitting the variable.
    const blank = await loadBanner('ios', { VITE_ADMOB_IOS_BANNER_ID: '  ' });
    expect(blank.bannerAdUnitId()).toBeNull();
  });

  it('has no ad unit at all off a native platform', async () => {
    expect((await loadBanner('web', BOTH)).bannerAdUnitId()).toBeNull();
  });

  it('uses Google’s per-OS test units when test ads are forced', async () => {
    // Read each answer before loading the next platform: the modules share
    // the platform mock, so a stale module would answer for the new platform.
    const android = (
      await loadBanner('android', { ...BOTH, VITE_ADMOB_USE_TEST_ADS: 'true' })
    ).bannerAdUnitId();
    const ios = (
      await loadBanner('ios', { ...BOTH, VITE_ADMOB_USE_TEST_ADS: 'true' })
    ).bannerAdUnitId();

    expect(android).toBe('ca-app-pub-3940256099942544/9214589741');
    expect(ios).toBe('ca-app-pub-3940256099942544/2435281174');
    expect(ios).not.toBe(android);
  });
});

/* An adaptive banner is sized at request time, so an iPad rotation or Split
   View change must recreate it — once per settled resize, never offline,
   never while it would spend a request on a hidden banner (issue #93). */
describe('viewport-follow (issue #93)', () => {
  function setWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  }

  async function bootShownBanner() {
    setWidth(768);
    networkMock.online = true;
    for (const fn of Object.values(admobMock)) if (typeof fn === 'function') fn.mockClear();
    const banner = await loadBanner('ios', BOTH);
    await banner.initAds();
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    return banner;
  }

  async function settleResize() {
    window.dispatchEvent(new Event('resize'));
    await vi.advanceTimersByTimeAsync(700);
  }

  afterEach(() => {
    vi.useRealTimers();
    consentMock.impl = () => Promise.resolve(true);
  });

  it('rechecks the network after the consent await — no request if it dropped', async () => {
    setWidth(768);
    networkMock.online = true;
    for (const fn of Object.values(admobMock)) if (typeof fn === 'function') fn.mockClear();
    consentMock.impl = () => {
      // The connection dies while consent is being answered.
      networkMock.online = false;
      return Promise.resolve(true);
    };

    const banner = await loadBanner('ios', BOTH);
    await banner.initAds();
    await banner.setBannerVisible(true);

    expect(admobMock.showBanner).not.toHaveBeenCalled();
    banner.resetBannerForTesting();
  });

  it('recreates the shown banner once after a rotation-sized change', async () => {
    vi.useFakeTimers();
    const banner = await bootShownBanner();

    setWidth(1024);
    // A rotation produces a burst of resize events; one settle, one request.
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    await settleResize();

    expect(admobMock.removeBanner).toHaveBeenCalledTimes(1);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(2);
    banner.resetBannerForTesting();
  });

  it('leaves the banner alone for sub-threshold nudges', async () => {
    vi.useFakeTimers();
    const banner = await bootShownBanner();

    setWidth(768 + 40);
    await settleResize();

    expect(admobMock.removeBanner).not.toHaveBeenCalled();
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('makes no request offline — the stale-width banner stays', async () => {
    vi.useFakeTimers();
    const banner = await bootShownBanner();

    networkMock.online = false;
    setWidth(1024);
    await settleResize();

    expect(admobMock.removeBanner).not.toHaveBeenCalled();
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('drops a hidden banner without spending a request, and sizes the next one fresh', async () => {
    vi.useFakeTimers();
    const banner = await bootShownBanner();

    await banner.setBannerVisible(false);
    setWidth(1024);
    await settleResize();

    // Removed so the stale size cannot resume, but no new request while hidden.
    expect(admobMock.removeBanner).toHaveBeenCalledTimes(1);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);

    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(2);
    expect(admobMock.resumeBanner).not.toHaveBeenCalled();
    banner.resetBannerForTesting();
  });

  it('recreates the banner even when removing the old view is refused', async () => {
    vi.useFakeTimers();
    const banner = await bootShownBanner();

    // The old native view was already gone by the time removeBanner ran —
    // refreshBannerForViewport's own catch treats that as "nothing to
    // remove", not a reason to give up on the resize.
    admobMock.removeBanner.mockRejectedValueOnce(new Error('gone'));
    setWidth(1024);
    await settleResize();

    expect(admobMock.showBanner).toHaveBeenCalledTimes(2);
    banner.resetBannerForTesting();
  });
});

/**
 * "Ads never gate game features; every failure path is silent" and
 * "Offline → no ad requests at all, and no retry loops" are load-bearing
 * comments at the top of banner.ts, not just prose — this is the regression
 * suite that holds them there (issue #120). Init failing, a show rejecting,
 * consent being refused, staying offline, and a load failing after the view
 * was already up are the whole inventory of ways the one ad request this app
 * makes can go wrong. None of them may throw out of setBannerVisible/initAds,
 * none may spend a second request on their own, and none may schedule a
 * timer to try again — the only thing that ever asks again is the caller,
 * on the player's next honest visit to a game screen
 * (docs/OFFLINE_POLICY.md「オフライン時の広告」, docs/ADS_POLICY.md).
 */
describe('failure paths never touch the game (issue #120)', () => {
  function clearAdmobMock() {
    for (const fn of Object.values(admobMock)) if (typeof fn === 'function') fn.mockClear();
    admobMock.listeners.clear();
  }

  /** Plays back a plugin event exactly the way the real SDK would deliver it. */
  function fireAdmobEvent(event: string) {
    for (const listener of admobMock.listeners.get(event) ?? []) listener();
  }

  afterEach(() => {
    vi.useRealTimers();
    networkMock.online = true;
    consentMock.impl = () => Promise.resolve(true);
  });

  it('swallows a failed SDK init: initAds resolves, and the game is left untouched', async () => {
    vi.useFakeTimers();
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    admobMock.initialize.mockRejectedValueOnce(new Error('sdk down'));

    await expect(banner.initAds()).resolves.toBeUndefined();
    await banner.setBannerVisible(true);

    // Init never got past the failure, so nothing here polls the SDK either.
    expect(admobMock.showBanner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    banner.resetBannerForTesting();
  });

  it('requests nothing while offline, and only the next ask (not a retry) shows the ad', async () => {
    vi.useFakeTimers();
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    networkMock.online = false;
    await banner.initAds();

    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    // The connection returns, but nothing here watches for that — the
    // re-check is the caller's job on the next screen entry, not a loop
    // sitting in this module (docs/OFFLINE_POLICY.md「オンライン復帰イベントを
    // 契機に再開する」).
    networkMock.online = true;
    expect(admobMock.showBanner).not.toHaveBeenCalled();

    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('a rejected show resolves quietly, and the next ask tries fresh rather than resuming it', async () => {
    vi.useFakeTimers();
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    admobMock.showBanner.mockRejectedValueOnce(new Error('load failed'));
    await banner.initAds();

    await expect(banner.setBannerVisible(true)).resolves.toBeUndefined();
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    // The failed attempt was never recorded as "created", so the next ask
    // asks again instead of resuming a banner that never actually appeared.
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(2);
    expect(admobMock.resumeBanner).not.toHaveBeenCalled();
    banner.resetBannerForTesting();
  });

  it('a load failure after showing forgets the view, so hide/show recreates it', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);

    // The SDK destroyed the native view on its own; banner.ts hears about it
    // only through this event.
    fireAdmobEvent('bannerAdFailedToLoad');

    await banner.setBannerVisible(false);
    await banner.setBannerVisible(true);

    expect(admobMock.showBanner).toHaveBeenCalledTimes(2);
    expect(admobMock.resumeBanner).not.toHaveBeenCalled();
    banner.resetBannerForTesting();
  });

  it('control: the same hide/show resumes instead of re-requesting when nothing failed', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);

    await banner.setBannerVisible(false);
    await banner.setBannerVisible(true);

    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    expect(admobMock.resumeBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('a consent refusal requests nothing and schedules nothing', async () => {
    vi.useFakeTimers();
    consentMock.impl = () => Promise.resolve(false);
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();

    await banner.setBannerVisible(true);

    expect(admobMock.showBanner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    banner.resetBannerForTesting();
  });

  it('a want expressed before init finishes is applied once, then the next ask resumes', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();

    // The game screen can mount, and ask to show its banner, before the
    // fire-and-forget initAds() from app boot has come back.
    const initDone = banner.initAds();
    const wanted = banner.setBannerVisible(true);
    await initDone;
    await wanted;

    // initAds applies the remembered want itself, fire-and-forget; wait for
    // that in-flight request rather than assuming a tick count.
    await vi.waitFor(() => {
      expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    });

    await banner.setBannerVisible(true);
    expect(admobMock.resumeBanner).toHaveBeenCalledTimes(1);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('the web build never calls AdMob at all', async () => {
    const banner = await loadBanner('web', BOTH);
    clearAdmobMock();

    await banner.initAds();
    await banner.setBannerVisible(true);

    expect(admobMock.initialize).not.toHaveBeenCalled();
    expect(admobMock.addListener).not.toHaveBeenCalled();
    expect(admobMock.showBanner).not.toHaveBeenCalled();
    banner.resetBannerForTesting();
  });

  it('survives a plugin that refuses the event registrations', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    // banner.ts's two addListener calls in initAds both end in
    // `.catch(() => undefined)` precisely so a plugin build where the
    // registration itself rejects — not just the event it would have
    // delivered — cannot escape initAds as an unhandled rejection
    // (issue #120). Without that catch this test fails the whole file.
    admobMock.addListener.mockRejectedValue(new Error('no plugin'));
    try {
      await expect(banner.initAds()).resolves.toBeUndefined();

      // Flush microtasks so a rejection that slipped past the catch would
      // surface here: vitest fails a test file on an unhandled rejection,
      // and that failure — not an explicit assertion — is what this checks.
      await Promise.resolve();
      await Promise.resolve();

      // Init itself still succeeded, so the banner the game screen asks for
      // right after boot is still requested normally.
      await banner.setBannerVisible(true);
      expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    } finally {
      // Reinstate the hoisted mock's default implementation so later tests
      // in this file still get real listener bookkeeping.
      admobMock.addListener.mockImplementation(
        (event: string, cb: (...args: unknown[]) => void) => {
          if (!admobMock.listeners.has(event)) admobMock.listeners.set(event, new Set());
          admobMock.listeners.get(event)?.add(cb);
          return Promise.resolve({ remove: () => Promise.resolve() });
        },
      );
    }
    banner.resetBannerForTesting();
  });

  it('shows nothing when the player left the screen while consent was still being asked', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    let resolveConsent: (value: boolean) => void = () => {};
    const deferred = new Promise<boolean>((resolve) => {
      resolveConsent = resolve;
    });
    consentMock.impl = () => deferred;

    await banner.initAds();
    const asking = banner.setBannerVisible(true);
    // The player backs out to the collection home before consent answers —
    // applyBannerState is still busy awaiting it, so this call only records
    // the new want; it cannot run anything itself.
    await banner.setBannerVisible(false);
    resolveConsent(true);
    await asking;

    // Nothing was ever created, so there is nothing to hide either.
    expect(admobMock.showBanner).not.toHaveBeenCalled();
    expect(admobMock.hideBanner).not.toHaveBeenCalled();

    // The next honest ask — the player is back on a game screen — shows it.
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('a rejected hide leaves the next ask working', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();
    await banner.setBannerVisible(true);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);

    admobMock.hideBanner.mockRejectedValueOnce(new Error('hide failed'));
    await expect(banner.setBannerVisible(false)).resolves.toBeUndefined();

    // The view is still considered created (only the hide call itself
    // failed), so the next ask resumes it rather than re-requesting.
    await banner.setBannerVisible(true);
    expect(admobMock.resumeBanner).toHaveBeenCalledTimes(1);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });

  it('a rejected resume leaves the next ask working', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();
    await banner.setBannerVisible(true);
    await banner.setBannerVisible(false);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);

    admobMock.resumeBanner.mockRejectedValueOnce(new Error('resume failed'));
    await expect(banner.setBannerVisible(true)).resolves.toBeUndefined();
    expect(admobMock.resumeBanner).toHaveBeenCalledTimes(1);

    // A further hide/show pair still resumes — the created view was never
    // forgotten just because one resume call rejected — and still never
    // spends a second showBanner request.
    await banner.setBannerVisible(false);
    await banner.setBannerVisible(true);
    expect(admobMock.resumeBanner).toHaveBeenCalledTimes(2);
    expect(admobMock.showBanner).toHaveBeenCalledTimes(1);
    banner.resetBannerForTesting();
  });
});

/**
 * BannerSlot reserves layout height up front so the board/action row never
 * jumps once an ad loads — but only if it actually learns the height the SDK
 * settled on. onBannerSize is that wire: the SizeChanged plugin event carries
 * the banner's real height, and every subscriber (the reserved slot is one)
 * must see exactly that number, no more and no fewer times than it fired
 * (issue #120).
 */
describe('onBannerSize (issue #120)', () => {
  function clearAdmobMock() {
    for (const fn of Object.values(admobMock)) if (typeof fn === 'function') fn.mockClear();
    admobMock.listeners.clear();
  }

  /** Plays back the SizeChanged event with the payload shape the real SDK sends. */
  function fireSizeChanged(height: number) {
    for (const listener of admobMock.listeners.get('bannerAdSizeChanged') ?? []) {
      listener({ height });
    }
  }

  afterEach(() => {
    networkMock.online = true;
    consentMock.impl = () => Promise.resolve(true);
  });

  it('delivers the exact height the SDK reported to a subscriber', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();

    const heights: number[] = [];
    banner.onBannerSize((height) => heights.push(height));

    fireSizeChanged(96);

    expect(heights).toEqual([96]);
    banner.resetBannerForTesting();
  });

  it('fans out to every subscriber, and stops calling one that unsubscribed', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();

    const first: number[] = [];
    const second: number[] = [];
    const unsubscribeFirst = banner.onBannerSize((height) => first.push(height));
    banner.onBannerSize((height) => second.push(height));

    fireSizeChanged(96);
    expect(first).toEqual([96]);
    expect(second).toEqual([96]);

    unsubscribeFirst();
    fireSizeChanged(50);

    // The unsubscribed slot never hears about the second, smaller layout —
    // only the one still listening does.
    expect(first).toEqual([96]);
    expect(second).toEqual([96, 50]);
    banner.resetBannerForTesting();
  });

  it('throws nothing when the event arrives with no subscriber registered', async () => {
    const banner = await loadBanner('android', BOTH);
    clearAdmobMock();
    await banner.initAds();

    expect(() => fireSizeChanged(96)).not.toThrow();
    banner.resetBannerForTesting();
  });
});
