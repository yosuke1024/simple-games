/**
 * The collection's ONLY in-app product: a one-time "Remove Ads" purchase
 * (docs/ADS_POLICY.md). No subscriptions, no game-feature purchases — the
 * absence of any other product in this folder is part of the brand promise.
 *
 * Design:
 * - `AdRemovalStore` is the seam for a real billing implementation (Google
 *   Play Billing via a Capacitor plugin). Wiring it requires the product to
 *   exist in Play Console first — a human store-side task — so the default
 *   is `unavailableStore`: the purchase UI stays hidden, nothing breaks.
 * - The entitlement is cached on device (sg.iap) so it works offline and at
 *   boot without a store round-trip. The store remains the source of truth;
 *   a lost cache is recovered with "Restore purchase".
 * - State lives at module level with a subscribe hook for React, mirroring
 *   the services/ pattern. Failures never affect gameplay.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecordWithStatus, saveRecord } from '../storage/repo';
import { iapSchema, type IapState } from '../storage/schemas';

/** Play Console managed product ID (not a secret; must exist in the console). */
export const AD_REMOVAL_PRODUCT_ID = 'remove_ads';

export interface AdRemovalStore {
  /** Whether this build can talk to a billing backend at all. */
  isAvailable(): boolean;
  /** Localized price string ("¥580") or null when unknown. */
  getPrice(): Promise<string | null>;
  /** Resolves true when the purchase completed (false on cancel). Throws never. */
  purchase(): Promise<boolean>;
  /** Resolves true when a previous purchase was found and restored. */
  restore(): Promise<boolean>;
}

/**
 * Default backend: billing not wired in this build. The quiet support message
 * still renders; the buy/restore buttons do not.
 */
const unavailableStore: AdRemovalStore = {
  isAvailable: () => false,
  getPrice: () => Promise.resolve(null),
  purchase: () => Promise.resolve(false),
  restore: () => Promise.resolve(false),
};

let store: AdRemovalStore = unavailableStore;
let state: IapState = iapSchema.defaultValue();
/**
 * Whether `state` is what the device actually holds. False for exactly one
 * reason — the entitlement could not be read — which is not the same as
 * "nothing is purchased" (see `isAdRemovalActive`).
 */
let entitlementKnown = true;
let kvStore: KVStore = preferencesKV;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * A billing implementation registers itself here (app boot). Notifies
 * subscribers because availability affects what the settings screen renders,
 * and the billing backend reports it asynchronously.
 */
export function setAdRemovalStore(next: AdRemovalStore): void {
  store = next;
  notify();
}

/**
 * Loads the cached entitlement at boot. Never blocks the app, and never
 * throws: a store that cannot be read is recorded as unread here rather than
 * escaping into the boot sequence, where nobody could tell it from "this
 * player has not bought anything".
 */
export async function initAdRemoval(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  const { value, readable } = await loadRecordWithStatus(iapSchema, kv);
  state = value;
  entitlementKnown = readable;
  notify();
}

/**
 * Whether this player owns the entitlement. The settings screen asks this,
 * because it must not claim a purchase nobody made. Ad-side callers ask
 * `isAdRemovalActive()`, which answers a different question.
 */
export function isAdRemovalPurchased(): boolean {
  return state.adRemovalPurchased;
}

/**
 * Whether the ad removal takes effect on this launch — what `app/boot.ts`
 * asks before initializing the ad SDK, and what `BannerSlot` asks before
 * reserving its strip. Deliberately NOT the negation of
 * `isAdRemovalPurchased()`.
 *
 * A launch whose entitlement read failed knows nothing about what the player
 * owns, and the two ways of being wrong do not cost the same. Guessing "not
 * purchased" shows a banner to someone who paid to remove it — the one thing
 * the purchase promises, and nothing on screen or in the log would say why.
 * Guessing "purchased" costs a free player one launch without a banner. So an
 * unread entitlement falls to the no-banner side (issue #96), the same
 * direction consent already falls in when UMP gives no answer
 * (`services/ads/consent.ts`): without an answer, nothing is requested.
 */
export function isAdRemovalActive(): boolean {
  return state.adRemovalPurchased || !entitlementKnown;
}

export function isPurchaseAvailable(): boolean {
  return store.isAvailable();
}

export function getAdRemovalPrice(): Promise<string | null> {
  return store.getPrice();
}

function markPurchased(): void {
  state = { schemaVersion: 1, adRemovalPurchased: true, purchasedAt: Date.now() };
  // The store just answered, so a launch that started without a readable
  // cache is no longer guessing.
  entitlementKnown = true;
  void saveRecord(iapSchema, state, kvStore);
  notify();
}

/** Runs the store purchase flow. Returns true when the entitlement is active. */
export async function purchaseAdRemoval(): Promise<boolean> {
  if (state.adRemovalPurchased) return true;
  try {
    if (await store.purchase()) {
      markPurchased();
      return true;
    }
  } catch {
    // Store errors are the store UI's problem; ours is to never break.
  }
  return false;
}

/** Restores a previous purchase (device change, reinstall, lost cache). */
export async function restoreAdRemoval(): Promise<boolean> {
  try {
    if (await store.restore()) {
      markPurchased();
      return true;
    }
  } catch {
    // Ignore; the player can retry.
  }
  return false;
}

/** Subscribe for React (useSyncExternalStore). Returns the unsubscriber. */
export function subscribeAdRemoval(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook. */
export function resetAdRemovalForTesting(): void {
  store = unavailableStore;
  state = iapSchema.defaultValue();
  entitlementKnown = true;
  kvStore = preferencesKV;
  listeners.clear();
}
