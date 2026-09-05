/**
 * The fail-safe from issue #96, proven end to end across the two real
 * modules that make it up: `monetization/adRemoval.ts`, which decides
 * whether this launch's entitlement read succeeded, and `app/boot.ts`, which
 * asks it before starting the ad SDK.
 *
 * `boot.test.ts` mocks `../monetization/adRemoval` entirely, so a slip in
 * `startAdsUnlessRemoved()` from `isAdRemovalActive()` to
 * `isAdRemovalPurchased()` — "not purchased" instead of "not known to be
 * purchased" — would still pass it: the mock answers whatever the test tells
 * it to, regardless of which export was actually called.
 * `adRemoval.test.ts` proves `isAdRemovalActive()` in isolation, but never
 * touches `boot.ts`. Neither file would catch the wiring breaking between
 * them. Only `initAds` is mocked here — everything from a rejected KV read
 * through `isAdRemovalActive()`'s fallback to `startAdsUnlessRemoved()`'s
 * branch is the real, unmocked code path.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAdRemoval, resetAdRemovalForTesting } from '../monetization/adRemoval';
import type { KVStore } from '../storage/kv';
import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
import { startAdsUnlessRemoved } from './boot';

const mocks = vi.hoisted(() => ({
  initAds: vi.fn<() => Promise<void>>(),
}));

// The only seam mocked: everything under test — the KV read, adRemoval's
// entitlementKnown fallback, and boot's isAdRemovalActive() check — stays real.
vi.mock('../services/ads/banner', () => ({ initAds: mocks.initAds }));

const unreadableKV = (): KVStore => ({
  get: () => Promise.reject(new Error('storage unavailable')),
  set: () => Promise.resolve(),
  remove: () => Promise.resolve(),
});

beforeEach(() => {
  mocks.initAds.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  resetAdRemovalForTesting();
});

describe('ad-removal entitlement read failure keeps ads off (issue #120)', () => {
  it('an unreadable entitlement never starts the ad SDK', async () => {
    await initAdRemoval(unreadableKV());
    startAdsUnlessRemoved();
    expect(mocks.initAds).not.toHaveBeenCalled();
  });

  it('a readable, empty entitlement starts the ad SDK on an ordinary launch', async () => {
    await initAdRemoval(createMemoryKV());
    startAdsUnlessRemoved();
    expect(mocks.initAds).toHaveBeenCalledTimes(1);
  });

  it('a readable, cached purchase never starts the ad SDK', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.iap]: JSON.stringify({
        schemaVersion: 1,
        adRemovalPurchased: true,
        purchasedAt: 123,
      }),
    });
    await initAdRemoval(kv);
    startAdsUnlessRemoved();
    expect(mocks.initAds).not.toHaveBeenCalled();
  });
});

/**
 * Static, like `test/refLeading.test.ts`, because the ordering it pins lives
 * in `main.tsx`'s call sequence, not in any function signature a unit test
 * can drive directly.
 *
 * `monetization/adRemoval.ts` starts `entitlementKnown` at `true` — "known"
 * — until `initAdRemoval()` has actually run once; only then can a failed
 * read flip it to `false`. `initShellState()` (`app/boot.ts`) is what runs
 * `initAdRemoval()`. So calling `startAdsUnlessRemoved()` before awaiting
 * `initShellState()` finishes "for speed" would read the still-default
 * `entitlementKnown: true` and start the ad SDK regardless of whether the
 * entitlement cache is readable — for exactly the player this fail-safe
 * exists to protect (issue #96, issue #120).
 */
describe('main.tsx starts ads only after the entitlement read has run (issue #120)', () => {
  it('calls startAdsUnlessRemoved() after awaiting initShellState()', () => {
    const mainPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'main.tsx');
    const source = readFileSync(mainPath, 'utf8');

    const shellIndex = source.indexOf('await initShellState()');
    const adsIndex = source.indexOf('startAdsUnlessRemoved()');
    expect(shellIndex, 'main.tsx must still await initShellState()').toBeGreaterThan(-1);
    expect(adsIndex, 'main.tsx must still call startAdsUnlessRemoved()').toBeGreaterThan(-1);

    expect(
      adsIndex,
      'startAdsUnlessRemoved() must run after `await initShellState()`: entitlementKnown ' +
        '(monetization/adRemoval.ts) starts as "known" until initAdRemoval() has actually run, ' +
        'so starting ads earlier would start the SDK for exactly the player the fail-safe protects',
    ).toBeGreaterThan(shellIndex);
  });
});
