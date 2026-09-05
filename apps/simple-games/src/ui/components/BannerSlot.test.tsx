/**
 * Two BannerSlot contracts from issue #120:
 *
 * - **The reserved strip never moves the board.** The slot's height is fixed
 *   from the very first render, before any ad has answered, so a size that
 *   arrives later can only grow the strip — never shrink it mid-play, and
 *   never shift the board or the action buttons below it
 *   (docs/ADS_POLICY.md「予約領域」).
 * - **A fail-safe direction when the entitlement cannot be read (issue
 *   #96).** BannerSlot asks the same question `app/boot.ts` asks before
 *   initializing the ad SDK: an unread entitlement is treated the same as an
 *   active purchase, so no strip is reserved and nothing is asked to show.
 *
 * The ad SDK itself (services/ads/banner.ts) is replaced with a small
 * controllable stand-in; what is under test is BannerSlot's reaction to a
 * size report and to the ad-removal entitlement, not the SDK. The entitlement
 * side uses the real monetization/adRemoval module, the same way
 * adRemoval.test.ts drives it, so the fail-safe direction is pinned against
 * the actual state machine rather than a mock of it.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initAdRemoval,
  purchaseAdRemoval,
  resetAdRemovalForTesting,
  setAdRemovalStore,
  type AdRemovalStore,
} from '../../monetization/adRemoval';
import type { KVStore } from '../../storage/kv';
import { createMemoryKV } from '../../storage/kv';
import { STORAGE_KEYS } from '../../storage/schemas';
import { BannerSlot } from './BannerSlot';

const { bannerMock } = vi.hoisted(() => {
  const listeners = new Set<(height: number) => void>();
  return {
    bannerMock: {
      native: true,
      listeners,
      setBannerVisible: vi.fn(() => Promise.resolve()),
      /** Delivers one reported ad height to every listener BannerSlot registered. */
      fireBannerSize(height: number) {
        for (const listener of listeners) listener(height);
      },
    },
  };
});

vi.mock('../../services/ads/banner', () => ({
  isNativeAdsPlatform: () => bannerMock.native,
  onBannerSize: (listener: (height: number) => void) => {
    bannerMock.listeners.add(listener);
    return () => {
      bannerMock.listeners.delete(listener);
    };
  },
  setBannerVisible: bannerMock.setBannerVisible,
}));

const unreadableKV = (): KVStore => ({
  get: () => Promise.reject(new Error('storage unavailable')),
  set: () => Promise.resolve(),
  remove: () => Promise.resolve(),
});

afterEach(() => {
  cleanup();
  resetAdRemovalForTesting();
  bannerMock.native = true;
  bannerMock.listeners.clear();
  bannerMock.setBannerVisible.mockClear();
});

describe('the reserved slot never shifts the board (issue #120)', () => {
  it('is reserved at DEFAULT height on the very first render, before any ad has answered', async () => {
    await initAdRemoval(createMemoryKV());
    const { container } = render(<BannerSlot />);

    const slot = container.querySelector('.banner-slot');
    expect(slot).not.toBeNull();
    expect(slot).toHaveStyle({ height: '64px' });
    // Decorative: nothing here is meant to reach a screen reader.
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    // Shown from mount, not deferred until a size arrives — a delayed show
    // would be the same board-jump this slot exists to prevent.
    expect(bannerMock.setBannerVisible).toHaveBeenCalledTimes(1);
    expect(bannerMock.setBannerVisible).toHaveBeenCalledWith(true);
  });

  it('grows for a taller ad but never shrinks back down mid-play', async () => {
    await initAdRemoval(createMemoryKV());
    const { container } = render(<BannerSlot />);
    const slot = () => container.querySelector('.banner-slot');

    act(() => bannerMock.fireBannerSize(50));
    expect(slot()).toHaveStyle({ height: '64px' });

    act(() => bannerMock.fireBannerSize(90));
    expect(slot()).toHaveStyle({ height: '90px' });

    // A later, smaller report must not pull the board back up underneath it.
    act(() => bannerMock.fireBannerSize(50));
    expect(slot()).toHaveStyle({ height: '90px' });
  });

  it('hides the banner and unsubscribes on unmount (docs/GAME_LIFECYCLE.md)', async () => {
    await initAdRemoval(createMemoryKV());
    const { unmount } = render(<BannerSlot />);
    expect(bannerMock.listeners.size).toBe(1);

    unmount();

    expect(bannerMock.setBannerVisible).toHaveBeenCalledTimes(2);
    expect(bannerMock.setBannerVisible).toHaveBeenLastCalledWith(false);
    expect(bannerMock.listeners.size).toBe(0);

    // A size report that arrives after teardown must reach nobody.
    expect(() => bannerMock.fireBannerSize(120)).not.toThrow();
  });

  it('reserves nothing off the native ad platform (web/dev)', async () => {
    bannerMock.native = false;
    await initAdRemoval(createMemoryKV());
    const { container } = render(<BannerSlot />);

    expect(container).toBeEmptyDOMElement();
    expect(bannerMock.setBannerVisible).not.toHaveBeenCalled();
  });
});

describe('a fail-safe read of the ad-removal entitlement', () => {
  it('reserves nothing once the purchase is cached on device', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.iap]: JSON.stringify({
        schemaVersion: 1,
        adRemovalPurchased: true,
        purchasedAt: 123,
      }),
    });
    await initAdRemoval(kv);
    const { container } = render(<BannerSlot />);

    expect(container).toBeEmptyDOMElement();
    expect(bannerMock.setBannerVisible).not.toHaveBeenCalled();
  });

  it('reserves nothing when the entitlement could not be read at all (issue #96)', async () => {
    await initAdRemoval(unreadableKV());
    const { container } = render(<BannerSlot />);

    // An unread entitlement falls to the same side as an active purchase:
    // guessing "not purchased" here would show a banner to someone who paid
    // to remove it.
    expect(container).toBeEmptyDOMElement();
    expect(bannerMock.setBannerVisible).not.toHaveBeenCalled();
  });

  it('drops the slot the moment a purchase completes, without a remount', async () => {
    await initAdRemoval(createMemoryKV());
    const { container } = render(<BannerSlot />);
    expect(container.querySelector('.banner-slot')).not.toBeNull();
    bannerMock.setBannerVisible.mockClear();

    const purchasingStore: AdRemovalStore = {
      isAvailable: () => true,
      getPrice: () => Promise.resolve('$3.99'),
      purchase: () => Promise.resolve(true),
      restore: () => Promise.resolve(false),
    };
    setAdRemovalStore(purchasingStore);

    await act(async () => {
      await purchaseAdRemoval();
    });

    expect(container).toBeEmptyDOMElement();
    expect(bannerMock.setBannerVisible).toHaveBeenCalledWith(false);
  });
});
