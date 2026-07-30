import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
import {
  initAdRemoval,
  isAdRemovalPurchased,
  isPurchaseAvailable,
  purchaseAdRemoval,
  resetAdRemovalForTesting,
  restoreAdRemoval,
  setAdRemovalStore,
  subscribeAdRemoval,
  type AdRemovalStore,
} from './adRemoval';

afterEach(() => {
  resetAdRemovalForTesting();
});

const fakeStore = (overrides: Partial<AdRemovalStore> = {}): AdRemovalStore => ({
  isAvailable: () => true,
  getPrice: () => Promise.resolve('$3.99'),
  purchase: () => Promise.resolve(true),
  restore: () => Promise.resolve(false),
  ...overrides,
});

describe('ad removal entitlement', () => {
  it('is inactive by default, with no store connected', async () => {
    await initAdRemoval(createMemoryKV());
    expect(isAdRemovalPurchased()).toBe(false);
    expect(isPurchaseAvailable()).toBe(false);
    // The default build cannot purchase — quietly, without throwing.
    expect(await purchaseAdRemoval()).toBe(false);
  });

  it('loads a cached entitlement at boot (works offline)', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.iap]: JSON.stringify({
        schemaVersion: 1,
        adRemovalPurchased: true,
        purchasedAt: 123,
      }),
    });
    await initAdRemoval(kv);
    expect(isAdRemovalPurchased()).toBe(true);
  });

  it('persists a successful purchase and notifies subscribers', async () => {
    const kv = createMemoryKV();
    await initAdRemoval(kv);
    setAdRemovalStore(fakeStore());
    const listener = vi.fn();
    subscribeAdRemoval(listener);

    expect(await purchaseAdRemoval()).toBe(true);
    expect(isAdRemovalPurchased()).toBe(true);
    expect(listener).toHaveBeenCalled();

    const raw = await kv.get(STORAGE_KEYS.iap);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ schemaVersion: 1, adRemovalPurchased: true });
  });

  it('a cancelled purchase changes nothing', async () => {
    await initAdRemoval(createMemoryKV());
    setAdRemovalStore(fakeStore({ purchase: () => Promise.resolve(false) }));
    expect(await purchaseAdRemoval()).toBe(false);
    expect(isAdRemovalPurchased()).toBe(false);
  });

  it('restore activates the entitlement when the store finds a purchase', async () => {
    const kv = createMemoryKV();
    await initAdRemoval(kv);
    setAdRemovalStore(fakeStore({ restore: () => Promise.resolve(true) }));
    expect(await restoreAdRemoval()).toBe(true);
    expect(isAdRemovalPurchased()).toBe(true);
  });

  it('a throwing store backend never breaks the app', async () => {
    await initAdRemoval(createMemoryKV());
    setAdRemovalStore(
      fakeStore({
        purchase: () => Promise.reject(new Error('billing down')),
        restore: () => Promise.reject(new Error('billing down')),
      }),
    );
    expect(await purchaseAdRemoval()).toBe(false);
    expect(await restoreAdRemoval()).toBe(false);
    expect(isAdRemovalPurchased()).toBe(false);
  });
});
