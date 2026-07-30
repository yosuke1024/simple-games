import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { plugin, capacitorMock } = vi.hoisted(() => ({
  plugin: {
    isBillingSupported: vi.fn(),
    getProduct: vi.fn(),
    purchaseProduct: vi.fn(),
    restorePurchases: vi.fn(),
    getPurchases: vi.fn(),
  },
  capacitorMock: { isNative: true },
}));

vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: plugin,
  PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.isNative },
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
import {
  initPlayBilling,
  isEntitlingTransaction,
  resetPlayBillingForTesting,
} from './playBilling';

beforeEach(async () => {
  vi.clearAllMocks();
  capacitorMock.isNative = true;
  plugin.isBillingSupported.mockResolvedValue({ isBillingSupported: true });
  await initAdRemoval(createMemoryKV());
});

afterEach(() => {
  resetPlayBillingForTesting();
  resetAdRemovalForTesting();
});

describe('isEntitlingTransaction', () => {
  it('accepts a settled Android purchase ("1") and platforms without the field', () => {
    expect(isEntitlingTransaction({ purchaseState: '1' } as never)).toBe(true);
    expect(isEntitlingTransaction({} as never)).toBe(true);
  });

  it('rejects pending and unspecified Android states', () => {
    expect(isEntitlingTransaction({ purchaseState: '2' } as never)).toBe(false);
    expect(isEntitlingTransaction({ purchaseState: '0' } as never)).toBe(false);
  });
});

describe('play billing store', () => {
  it('stays unavailable on the web', async () => {
    capacitorMock.isNative = false;
    await initPlayBilling();
    expect(isPurchaseAvailable()).toBe(false);
    expect(plugin.isBillingSupported).not.toHaveBeenCalled();
  });

  it('becomes available only after Play confirms billing support', async () => {
    await initPlayBilling();
    expect(isPurchaseAvailable()).toBe(true);
  });

  it('stays unavailable when Play reports no billing support', async () => {
    plugin.isBillingSupported.mockResolvedValue({ isBillingSupported: false });
    await initPlayBilling();
    expect(isPurchaseAvailable()).toBe(false);
  });

  it('stays unavailable when the support probe throws (no Play services)', async () => {
    plugin.isBillingSupported.mockRejectedValue(new Error('no play services'));
    await initPlayBilling();
    expect(isPurchaseAvailable()).toBe(false);
  });

  it('reads the localized price from the store product', async () => {
    plugin.getProduct.mockResolvedValue({ product: { priceString: '¥580' } });
    await initPlayBilling();
    expect(await getAdRemovalPrice()).toBe('¥580');
    expect(plugin.getProduct).toHaveBeenCalledWith({
      productIdentifier: 'remove_ads',
      productType: 'inapp',
    });
  });

  it('returns a null price when the product is missing', async () => {
    plugin.getProduct.mockRejectedValue(new Error('Product not found'));
    await initPlayBilling();
    expect(await getAdRemovalPrice()).toBeNull();
  });

  it('grants the entitlement on a settled purchase', async () => {
    plugin.purchaseProduct.mockResolvedValue({ transactionId: 't1', purchaseState: '1' });
    await initPlayBilling();
    expect(await purchaseAdRemoval()).toBe(true);
  });

  it('grants nothing on a pending purchase', async () => {
    plugin.purchaseProduct.mockResolvedValue({ transactionId: 't1', purchaseState: '2' });
    await initPlayBilling();
    expect(await purchaseAdRemoval()).toBe(false);
  });

  it('treats a cancelled purchase as a quiet no', async () => {
    plugin.purchaseProduct.mockRejectedValue(new Error('User cancelled'));
    await initPlayBilling();
    expect(await purchaseAdRemoval()).toBe(false);
  });

  it('restore finds a previously settled remove_ads purchase', async () => {
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({
      purchases: [
        { productIdentifier: 'other_thing', purchaseState: '1' },
        { productIdentifier: 'remove_ads', purchaseState: '1' },
      ],
    });
    await initPlayBilling();
    expect(await restoreAdRemoval()).toBe(true);
  });

  it('restore still checks ownership when restorePurchases itself fails', async () => {
    plugin.restorePurchases.mockRejectedValue(new Error('offline'));
    plugin.getPurchases.mockResolvedValue({
      purchases: [{ productIdentifier: 'remove_ads', purchaseState: '1' }],
    });
    await initPlayBilling();
    expect(await restoreAdRemoval()).toBe(true);
  });

  it('restore finds nothing without a purchase', async () => {
    plugin.restorePurchases.mockResolvedValue(undefined);
    plugin.getPurchases.mockResolvedValue({ purchases: [] });
    await initPlayBilling();
    expect(await restoreAdRemoval()).toBe(false);
  });
});
