import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAdRemoval, resetAdRemovalForTesting } from '@/monetization/adRemoval';
import { initAds, resetBannerForTesting, setBannerVisible } from '@/services/ads/banner';
import { createMemoryKV } from '@/storage/kv';
import { STORAGE_KEYS, type ManagedAdRemovalBenefit } from '@/storage/schemas';
import { saveVerifiedManagedOwner } from './connections';

const { ads, consent } = vi.hoisted(() => ({
  ads: {
    initialize: vi.fn(() => Promise.resolve()),
    addListener: vi.fn(() => Promise.resolve({ remove: () => Promise.resolve() })),
    showBanner: vi.fn(() => Promise.resolve()),
    hideBanner: vi.fn(() => Promise.resolve()),
    resumeBanner: vi.fn(() => Promise.resolve()),
    removeBanner: vi.fn(() => Promise.resolve()),
  },
  consent: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/ui/clubFeatures', () => ({ MANAGED_CLUB_ORIGIN: 'https://managed.example' }));
vi.mock('@capacitor/core', async (original) => ({
  ...(await original<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: ads,
  BannerAdPluginEvents: { SizeChanged: 'size', FailedToLoad: 'failed' },
  BannerAdPosition: { BOTTOM_CENTER: 'bottom' },
  BannerAdSize: { ADAPTIVE_BANNER: 'adaptive' },
}));
vi.mock('@/services/ads/consent', () => ({ canRequestAds: consent }));
vi.mock('@/services/network', () => ({ isOnline: () => true }));

const owner = { origin: 'https://managed.example', ownerToken: 'owner-key-0123456789' };
const benefit: ManagedAdRemovalBenefit = {
  requiredMembers: 50,
  memberCount: 50,
  active: true,
  validUntil: '2036-11-23T00:00:00.000Z',
};
function cache(active = false) {
  return createMemoryKV({
    [STORAGE_KEYS.club]: JSON.stringify({
      schemaVersion: 1,
      connections: [],
      managedOwner: { ...owner, ...(active ? { adRemoval: benefit } : {}) },
    }),
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  resetBannerForTesting();
  resetAdRemovalForTesting();
});

describe('native owner ad removal', () => {
  it('does not initialize the SDK, ask for consent, or request a banner at cached offline boot', async () => {
    await initAdRemoval(cache(true));
    await initAds();
    await setBannerVisible(true);
    expect(ads.initialize).not.toHaveBeenCalled();
    expect(consent).not.toHaveBeenCalled();
    expect(ads.showBanner).not.toHaveBeenCalled();
  });

  it('destroys a visible native banner on qualification and refuses subsequent requests', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    await initAds();
    await setBannerVisible(true);
    expect(ads.showBanner).toHaveBeenCalledOnce();
    await saveVerifiedManagedOwner(owner, benefit, kv);
    expect(ads.removeBanner).toHaveBeenCalledOnce();
    await setBannerVisible(true);
    expect(ads.showBanner).toHaveBeenCalledOnce();
    expect(ads.resumeBanner).not.toHaveBeenCalled();
  });

  it.each(['showBanner', 'resumeBanner', 'hideBanner'] as const)(
    'destroys the view if qualification arrives while %s is in flight',
    async (operation) => {
      const kv = cache();
      await initAdRemoval(kv);
      await initAds();
      if (operation !== 'showBanner') await setBannerVisible(true);
      if (operation === 'resumeBanner') await setBannerVisible(false);
      let entered!: () => void;
      let finish!: () => void;
      const started = new Promise<void>((resolve) => (entered = resolve));
      const pending = new Promise<void>((resolve) => (finish = resolve));
      ads[operation].mockImplementationOnce(() => {
        entered();
        return pending;
      });
      const transition = setBannerVisible(operation !== 'hideBanner');
      await started;
      await saveVerifiedManagedOwner(owner, benefit, kv);
      expect(ads.removeBanner).not.toHaveBeenCalled();
      finish();
      await transition;
      expect(ads.removeBanner).toHaveBeenCalledOnce();
      const requests = ads.showBanner.mock.calls.length;
      await setBannerVisible(true);
      expect(ads.showBanner).toHaveBeenCalledTimes(requests);
    },
  );

  it('does not request an ad if qualification arrives while consent is being checked', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    await initAds();
    let consentAnswer!: (allowed: boolean) => void;
    consent.mockImplementationOnce(() => new Promise((resolve) => (consentAnswer = resolve)));
    const showing = setBannerVisible(true);
    await saveVerifiedManagedOwner(owner, benefit, kv);
    consentAnswer(true);
    await showing;
    expect(ads.showBanner).not.toHaveBeenCalled();
  });
});
