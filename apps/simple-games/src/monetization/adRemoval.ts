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
 * - A configured Managed Club owner can independently qualify for temporary
 *   ad removal. Its server answer stays with that owner key in sg.club; Core
 *   reads only the local cache and never loads the Club layer to check ads.
 * - State lives at module level with a subscribe hook for React, mirroring
 *   the services/ pattern. Failures never affect gameplay.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKVWithReadStatus } from '../storage/kv';
import { loadRecordWithStatus, recordRemovalVersion, saveRecord } from '../storage/repo';
import {
  asManagedAdRemovalBenefit,
  clubConnectionsSchema,
  iapSchema,
  type IapState,
  type ManagedClubOwner,
} from '../storage/schemas';
import { MANAGED_CLUB_ORIGIN } from '../ui/clubFeatures';

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
let kvStore: KVStore = preferencesKVWithReadStatus;
let managedOwner: ManagedClubOwner | null = null;
let managedCacheKnown = true;
let managedRevision = 0;
let managedRemovalVersion = recordRemovalVersion(clubConnectionsSchema.key);
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

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
export async function initAdRemoval(kv: KVStore = preferencesKVWithReadStatus): Promise<void> {
  kvStore = kv;
  const revision = ++managedRevision;
  const removalVersion = recordRemovalVersion(clubConnectionsSchema.key);
  const [purchase, clubs] = await Promise.all([
    loadRecordWithStatus(iapSchema, kv),
    MANAGED_CLUB_ORIGIN ? loadRecordWithStatus(clubConnectionsSchema, kv) : null,
  ]);
  state = purchase.value;
  entitlementKnown = purchase.readable;
  // An explicit owner-screen save may have finished while the other local
  // record was being read. Boot must not replace that newer answer.
  if (
    revision === managedRevision &&
    removalVersion === recordRemovalVersion(clubConnectionsSchema.key)
  ) {
    managedOwner = clubs?.value.managedOwner ?? null;
    managedCacheKnown = clubs?.readable ?? true;
    managedRemovalVersion = removalVersion;
    scheduleManagedExpiry();
  }
  notify();
}

/** Local-only: no Club import or server request is reachable from ad boot. */
export function isManagedOwnerAdRemovalActive(): boolean {
  return (
    managedRemovalVersion === recordRemovalVersion(clubConnectionsSchema.key) &&
    ownerHasAdRemoval(managedOwner)
  );
}

function ownerHasAdRemoval(owner: ManagedClubOwner | null): boolean {
  if (!MANAGED_CLUB_ORIGIN || owner?.origin !== MANAGED_CLUB_ORIGIN || owner.pendingTrial)
    return false;
  const benefit = asManagedAdRemovalBenefit(owner.adRemoval);
  return (
    benefit?.active === true &&
    benefit.validUntil !== null &&
    Date.parse(benefit.validUntil) > Date.now()
  );
}

/** A web SDK restart must not discard the answer that made ads disappear. */
export async function isManagedOwnerAdRemovalPersisted(): Promise<boolean> {
  if (!isManagedOwnerAdRemovalActive()) return false;
  const owner = managedOwner!;
  const clubs = await loadRecordWithStatus(clubConnectionsSchema, kvStore);
  const saved = clubs.value.managedOwner ?? null;
  return (
    isManagedOwnerAdRemovalActive() &&
    managedOwner?.origin === owner.origin &&
    managedOwner.ownerToken === owner.ownerToken &&
    clubs.readable &&
    saved?.origin === owner.origin &&
    saved.ownerToken === owner.ownerToken &&
    ownerHasAdRemoval(saved)
  );
}

function scheduleManagedExpiry(): void {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  if (!isManagedOwnerAdRemovalActive()) return;
  const remaining = Date.parse(managedOwner!.adRemoval!.validUntil!) - Date.now();
  // A hosting term can exceed setTimeout's signed 32-bit range. This timer
  // only expires a local answer; it never refreshes it or contacts a server.
  expiryTimer = setTimeout(
    () => {
      expiryTimer = null;
      scheduleManagedExpiry();
      notify();
    },
    Math.min(remaining, 2_147_483_647),
  );
}

/**
 * The Club storage operation grants a verified answer only after its write
 * was read back, while still in the same queue as Reset Local Data. Revoking
 * an answer takes effect immediately even when a device cannot save it.
 * It is separate from sg.iap: buying/restoring remains possible and survives
 * this benefit expiring, being revoked, or the owner key being forgotten.
 */
export function noteManagedOwnerAdRemoval(owner: ManagedClubOwner | null): void {
  ++managedRevision;
  managedOwner = owner;
  managedCacheKnown = true;
  managedRemovalVersion = recordRemovalVersion(clubConnectionsSchema.key);
  scheduleManagedExpiry();
  notify();
}

/** An authoritative denial still revokes this key when its local record cannot be read. */
export function revokeManagedOwnerAdRemoval(
  credential: Pick<ManagedClubOwner, 'origin' | 'ownerToken'>,
): void {
  if (
    managedRemovalVersion !== recordRemovalVersion(clubConnectionsSchema.key) ||
    managedOwner?.origin !== credential.origin ||
    managedOwner.ownerToken !== credential.ownerToken
  )
    return;
  const { adRemoval: _removed, ...owner } = managedOwner;
  noteManagedOwnerAdRemoval(owner);
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
  return (
    state.adRemovalPurchased ||
    !entitlementKnown ||
    !managedCacheKnown ||
    isManagedOwnerAdRemovalActive()
  );
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
  kvStore = preferencesKVWithReadStatus;
  managedOwner = null;
  managedCacheKnown = true;
  managedRemovalVersion = recordRemovalVersion(clubConnectionsSchema.key);
  ++managedRevision;
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  listeners.clear();
}
