import { afterEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, admobMock, networkMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'android' as string },
  admobMock: {
    initialize: vi.fn(() => Promise.resolve()),
    addListener: vi.fn(() => Promise.resolve({ remove: () => Promise.resolve() })),
    showBanner: vi.fn(() => Promise.resolve()),
    hideBanner: vi.fn(() => Promise.resolve()),
    resumeBanner: vi.fn(() => Promise.resolve()),
    removeBanner: vi.fn(() => Promise.resolve()),
  },
  networkMock: { online: true },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: admobMock,
  BannerAdPluginEvents: { SizeChanged: 'bannerAdSizeChanged', FailedToLoad: 'bannerAdFailedToLoad' },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
}));

vi.mock('../network', () => ({
  isOnline: () => networkMock.online,
}));

vi.mock('./consent', () => ({
  canRequestAds: () => Promise.resolve(true),
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
    for (const fn of Object.values(admobMock)) fn.mockClear();
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
});
