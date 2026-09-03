import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { plugin, capacitorMock } = vi.hoisted(() => ({
  plugin: {
    isBillingSupported: vi.fn(),
    getProduct: vi.fn(),
    purchaseProduct: vi.fn(),
    restorePurchases: vi.fn(),
    getPurchases: vi.fn(),
  },
  capacitorMock: { platform: 'android' as string },
}));

vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: plugin,
  PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => capacitorMock.platform },
}));

import { createMemoryKV } from '../storage/kv';
import {
  getAdRemovalPrice,
  initAdRemoval,
  isPurchaseAvailable,
  purchaseAdRemoval,
  resetAdRemovalForTesting,
  restoreAdRemoval,
} from './adRemoval';
import { initNativeStore, isEntitlingTransaction, resetNativeStoreForTesting } from './nativeStore';

beforeEach(async () => {
  vi.clearAllMocks();
  capacitorMock.platform = 'android';
  plugin.isBillingSupported.mockResolvedValue({ isBillingSupported: true });
  plugin.getProduct.mockResolvedValue({ product: { priceString: '¥580' } });
  await initAdRemoval(createMemoryKV());
});

afterEach(() => {
  resetNativeStoreForTesting();
  resetAdRemovalForTesting();
});

describe('platform selection', () => {
  it('stays unavailable on the web, without probing any store', async () => {
    capacitorMock.platform = 'web';
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(false);
    expect(plugin.isBillingSupported).not.toHaveBeenCalled();
    expect(plugin.getProduct).not.toHaveBeenCalled();
  });

  it('probes Play on Android and the product itself on iOS', async () => {
    await initNativeStore();
    expect(plugin.isBillingSupported).toHaveBeenCalled();
    expect(plugin.getProduct).not.toHaveBeenCalled();

    resetNativeStoreForTesting();
    vi.clearAllMocks();
    capacitorMock.platform = 'ios';
    await initNativeStore();
    // The App Store is always "supported" on iOS, so that probe would say
    // nothing about whether there is anything to sell.
    expect(plugin.isBillingSupported).not.toHaveBeenCalled();
    expect(plugin.getProduct).toHaveBeenCalledWith({
      productIdentifier: 'remove_ads',
      productType: 'inapp',
    });
  });
});

describe('isEntitlingTransaction', () => {
  it('grants nothing before a platform is chosen', () => {
    expect(isEntitlingTransaction({ purchaseState: '1' } as never)).toBe(false);
  });

  it('accepts only Play’s settled state on Android', async () => {
    await initNativeStore();
    expect(isEntitlingTransaction({ purchaseState: '1' } as never)).toBe(true);
    expect(isEntitlingTransaction({ purchaseState: '2' } as never)).toBe(false);
    expect(isEntitlingTransaction({ purchaseState: '0' } as never)).toBe(false);
  });

  it('accepts a StoreKit transaction unless it was revoked', async () => {
    capacitorMock.platform = 'ios';
    await initNativeStore();
    expect(isEntitlingTransaction({ transactionId: 't1' } as never)).toBe(true);
    expect(
      isEntitlingTransaction({
        transactionId: 't1',
        revocationDate: '2026-08-17T00:00:00Z',
      } as never),
    ).toBe(false);
  });
});

describe('availability', () => {
  it('becomes available only after Play confirms billing support', async () => {
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(true);
  });

  it('stays unavailable when Play reports no billing support', async () => {
    plugin.isBillingSupported.mockResolvedValue({ isBillingSupported: false });
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(false);
  });

  it('stays unavailable when the support probe throws (no Play services)', async () => {
    plugin.isBillingSupported.mockRejectedValue(new Error('no play services'));
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(false);
  });

  it('stays unavailable on iOS when the product is not configured', async () => {
    capacitorMock.platform = 'ios';
    plugin.getProduct.mockRejectedValue(new Error('Product not found'));
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(false);
  });

  it('becomes available on iOS once the product resolves', async () => {
    capacitorMock.platform = 'ios';
    await initNativeStore();
    expect(isPurchaseAvailable()).toBe(true);
  });
});

describe('price', () => {
  it('reads the localized price from the store product', async () => {
    await initNativeStore();
    expect(await getAdRemovalPrice()).toBe('¥580');
    expect(plugin.getProduct).toHaveBeenCalledWith({
      productIdentifier: 'remove_ads',
      productType: 'inapp',
    });
  });

  it('returns a null price when the product is missing', async () => {
    plugin.getProduct.mockRejectedValue(new Error('Product not found'));
    await initNativeStore();
    expect(await getAdRemovalPrice()).toBeNull();
  });
});

describe('purchase', () => {
  it('grants the entitlement on a settled purchase', async () => {
    plugin.purchaseProduct.mockResolvedValue({ transactionId: 't1', purchaseState: '1' });
    await initNativeStore();
    expect(await purchaseAdRemoval()).toBe(true);
  });

  it('grants nothing on a pending purchase', async () => {
    plugin.purchaseProduct.mockResolvedValue({ transactionId: 't1', purchaseState: '2' });
    await initNativeStore();
    expect(await purchaseAdRemoval()).toBe(false);
  });

  it('treats a cancelled purchase as a quiet no', async () => {
    plugin.purchaseProduct.mockRejectedValue(new Error('User cancelled'));
    await initNativeStore();
    expect(await purchaseAdRemoval()).toBe(false);
  });

  it('treats an iOS "Ask to Buy" deferral as a quiet no', async () => {
    capacitorMock.platform = 'ios';
    // StoreKit rejects rather than returning a pending transaction.
    plugin.purchaseProduct.mockRejectedValue(new Error('Transaction pending'));
    await initNativeStore();
    expect(await purchaseAdRemoval()).toBe(false);
  });
});

describe('restore', () => {
  it('finds a previously settled remove_ads purchase', async () => {
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({
      purchases: [
        { productIdentifier: 'other_thing', purchaseState: '1' },
        { productIdentifier: 'remove_ads', purchaseState: '1' },
      ],
    });
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(true);
    expect(plugin.getPurchases).toHaveBeenCalledWith({ productType: 'inapp' });
  });

  it('asks StoreKit for current entitlements only', async () => {
    capacitorMock.platform = 'ios';
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({
      purchases: [{ productIdentifier: 'remove_ads', transactionId: 't1' }],
    });
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(true);
    expect(plugin.getPurchases).toHaveBeenCalledWith({
      productType: 'inapp',
      onlyCurrentEntitlements: true,
    });
  });

  it('does not restore a refunded iOS purchase', async () => {
    capacitorMock.platform = 'ios';
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({
      purchases: [
        {
          productIdentifier: 'remove_ads',
          transactionId: 't1',
          revocationDate: '2026-08-17T00:00:00Z',
        },
      ],
    });
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(false);
  });

  it('still checks ownership when restorePurchases itself fails', async () => {
    plugin.restorePurchases.mockRejectedValue(new Error('offline'));
    plugin.getPurchases.mockResolvedValue({
      purchases: [{ productIdentifier: 'remove_ads', purchaseState: '1' }],
    });
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(true);
  });

  it('finds nothing without a purchase', async () => {
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({ purchases: [] });
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(false);
  });

  it('grants nothing when the ownership query fails', async () => {
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockRejectedValue(new Error('offline'));
    await initNativeStore();
    expect(await restoreAdRemoval()).toBe(false);
  });
});
