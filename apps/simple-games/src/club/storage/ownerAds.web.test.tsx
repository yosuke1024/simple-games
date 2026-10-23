import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initAdRemoval,
  isAdRemovalActive,
  resetAdRemovalForTesting,
} from '@/monetization/adRemoval';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { clearLocalData } from '@/storage/repo';
import { STORAGE_KEYS, type ManagedAdRemovalBenefit } from '@/storage/schemas';
import { initWebAds } from '@/services/ads/web/boot';
import AdUnit from '@/services/ads/web/AdUnit';
import {
  requestAdMaxFrame,
  resetAdMaxLoaderForTesting,
  setAdMaxIdsForTesting,
} from '@/services/ads/web/admax';
import { setWebAdsConfigForTesting } from '@/services/ads/web/config';
import { resetWebAdLifecycleForTesting } from '@/services/ads/web/lifecycle';
import { recordResultView, resetResultCadenceForTesting } from '@/services/ads/web/resultCadence';
import { ensureAdSenseScript } from '@/services/ads/web/script';
import { WebAdSlot } from '@/ui/components/WebAdSlot';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { consumeManagedOwnerReturn } from '@/ui/managedOwnerReturn';
import { saveVerifiedManagedOwner } from './connections';

vi.hoisted(() => vi.stubEnv('MODE', 'web'));
vi.mock('@/ui/clubFeatures', () => ({ MANAGED_CLUB_ORIGIN: 'https://managed.example' }));

const owner = { origin: 'https://managed.example', ownerToken: 'owner-key-0123456789' };
const benefit: ManagedAdRemovalBenefit = {
  requiredMembers: 50,
  memberCount: 50,
  active: true,
  validUntil: '2036-11-23T00:00:00.000Z',
};
type AdsWindow = Window & { adsbygoogle?: unknown[]; admaxads?: unknown[] };
const scripts = () => document.querySelectorAll('script[data-sg-adsense], script[data-sg-admax]');
const reload = vi.fn();
function cache(active = false) {
  return createMemoryKV({
    [STORAGE_KEYS.club]: JSON.stringify({
      schemaVersion: 1,
      connections: [],
      managedOwner: { ...owner, ...(active ? { adRemoval: benefit } : {}) },
    }),
  });
}
function adSenseBuild() {
  setWebAdsConfigForTesting({
    testMode: false,
    client: 'test-client',
    slotHome: 'home-slot',
    slotResult: 'result-slot',
  });
}

beforeEach(() => {
  reload.mockClear();
  resetWebAdLifecycleForTesting(reload);
});
afterEach(() => {
  cleanup();
  resetWebAdLifecycleForTesting();
  resetAdRemovalForTesting();
  resetAdMaxLoaderForTesting();
  resetResultCadenceForTesting();
  setWebAdsConfigForTesting(null);
  setAdMaxIdsForTesting(null);
  scripts().forEach((script) => script.remove());
  document
    .querySelectorAll('.web-anchor-test, .web-admax-anchor, .google-auto-placed')
    .forEach((element) => element.remove());
  delete document.documentElement.dataset.sgWebAds;
  delete (window as AdsWindow).adsbygoogle;
  delete (window as AdsWindow).admaxads;
  consumeManagedOwnerReturn();
});
afterAll(() => vi.unstubAllEnvs());

describe('web owner ad removal', () => {
  it('skips the anchor, home/result slots and both network loaders with a cached benefit', async () => {
    await initAdRemoval(cache(true));
    adSenseBuild();
    setAdMaxIdsForTesting({ anchor728x90: 'anchor', slotHome728x90: 'home' });
    document.documentElement.dataset.sgWebAds = '';
    initWebAds();
    recordResultView();
    recordResultView();
    const { container } = render(
      <>
        <WebAdSlot />
        <ResultAdSlot />
        <AdUnit placement="home" />
      </>,
    );
    ensureAdSenseScript('test-client');
    requestAdMaxFrame('a-late-request');
    expect(container).toBeEmptyDOMElement();
    expect(scripts()).toHaveLength(0);
    expect((window as AdsWindow).adsbygoogle).toBeUndefined();
    expect((window as AdsWindow).admaxads).toBeUndefined();
    expect(document.documentElement).not.toHaveAttribute('data-sg-web-ads');
    expect(reload).not.toHaveBeenCalled();
    expect(consumeManagedOwnerReturn()).toBe(false);
  });

  it('hides live slots and the automatic anchor, then restarts once after durable activation', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    adSenseBuild();
    document.documentElement.dataset.sgWebAds = '';
    initWebAds();
    recordResultView();
    recordResultView();
    const { container } = render(
      <>
        <WebAdSlot />
        <ResultAdSlot />
      </>,
    );
    await waitFor(() => expect(container.querySelectorAll('.adsbygoogle')).toHaveLength(2));
    const anchor = document.createElement('div');
    anchor.className = 'google-auto-placed';
    document.body.appendChild(anchor);
    expect(scripts()).toHaveLength(1);

    await act(async () => {
      await saveVerifiedManagedOwner(owner, benefit, kv);
    });
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
    expect(getComputedStyle(anchor).display).toBe('none');
    expect(document.documentElement).not.toHaveAttribute('data-sg-web-ads');
    expect(scripts()).toHaveLength(0);
    expect(JSON.parse((await kv.get(STORAGE_KEYS.club))!)).toHaveProperty(
      'managedOwner.adRemoval.active',
      true,
    );
    expect(consumeManagedOwnerReturn()).toBe(true);
    expect(consumeManagedOwnerReturn()).toBe(false);

    ensureAdSenseScript('test-client');
    requestAdMaxFrame('a-late-request');
    await act(async () => {
      await saveVerifiedManagedOwner(owner, benefit, kv);
    });
    expect(scripts()).toHaveLength(0);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reserves space for an automatic anchor when a new ad unit follows a cached-benefit revocation', async () => {
    const kv = cache(true);
    await initAdRemoval(kv);
    adSenseBuild();
    // Match main.tsx: no ad bootstrap is imported on an ad-free cold start.
    expect(scripts()).toHaveLength(0);
    expect(document.documentElement).not.toHaveAttribute('data-sg-web-ads');
    await saveVerifiedManagedOwner(owner, { ...benefit, active: false, memberCount: 49 }, kv);

    const { container } = render(<WebAdSlot />);
    await waitFor(() => expect(container.querySelector('.adsbygoogle')).not.toBeNull());
    expect(scripts()).toHaveLength(1);
    expect(document.documentElement).toHaveAttribute('data-sg-web-ads');
    expect(reload).not.toHaveBeenCalled();
  });

  it('removes an AdMax anchor and never drains a queued frame after activation', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    setWebAdsConfigForTesting({ testMode: false, client: null });
    setAdMaxIdsForTesting({ anchor728x90: 'anchor' });
    initWebAds();
    const loading = document.querySelector('script[data-sg-admax]')!;
    expect(loading).not.toBeNull();
    requestAdMaxFrame('waiting-frame');
    await saveVerifiedManagedOwner(owner, benefit, kv);
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    loading.dispatchEvent(new Event('load'));
    expect(document.querySelector('.web-admax-anchor')).toBeNull();
    expect(scripts()).toHaveLength(0);
    expect((window as AdsWindow).admaxads).toEqual([]);
  });

  it('coalesces two qualified answers for the same owner into one SDK restart', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    adSenseBuild();
    initWebAds();
    await Promise.all([
      saveVerifiedManagedOwner(owner, benefit, kv),
      saveVerifiedManagedOwner(owner, { ...benefit, memberCount: 51 }, kv),
    ]);
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(JSON.parse((await kv.get(STORAGE_KEYS.club))!)).toHaveProperty(
      'managedOwner.adRemoval.memberCount',
      51,
    );
  });

  it('removes local test ads without a page restart when no SDK was loaded', async () => {
    const kv = cache();
    await initAdRemoval(kv);
    setWebAdsConfigForTesting({ testMode: true });
    initWebAds();
    expect(document.querySelector('.web-anchor-test')).not.toBeNull();
    await saveVerifiedManagedOwner(owner, benefit, kv);
    expect(document.querySelector('.web-anchor-test')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload or revive a pending grant when Reset was requested during its save', async () => {
    const memory = cache();
    await initAdRemoval(memory);
    adSenseBuild();
    initWebAds();
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const kv: KVStore = {
      ...memory,
      set: async (key, value) => {
        enter();
        await blocked;
        await memory.set(key, value);
      },
    };
    const saving = saveVerifiedManagedOwner(owner, benefit, kv);
    await entered;
    const resetting = clearLocalData([STORAGE_KEYS.club], kv);
    release();
    expect(await saving).toBe(false);
    await resetting;
    expect(isAdRemovalActive()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(consumeManagedOwnerReturn()).toBe(false);
  });
});
