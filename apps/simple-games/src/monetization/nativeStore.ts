/**
 * The real `AdRemovalStore`: Google Play Billing on Android and StoreKit 2 on
 * iOS, both through @capgo/native-purchases. No third-party billing server —
 * the plugin talks straight to the platform store, which stays the source of
 * truth for the entitlement (docs/ADS_POLICY.md).
 *
 * One store object serves both platforms because the purchase FLOW is the
 * same; what differs is what each store means by "available" and by "this
 * transaction grants the entitlement". Those two answers — and only those —
 * live in the `PlatformRules` adapters below, so a reader can see the whole
 * per-OS surface in one place instead of hunting for `if (ios)` in the flow.
 *
 * Design:
 * - Availability is probed asynchronously at boot; until (and unless) the
 *   store answers, the purchase UI simply stays hidden. Registering the store
 *   re-notifies subscribers, so the settings screen picks the buttons up
 *   whenever the probe completes.
 * - The plugin auto-acknowledges non-consumable purchases (Play) and finishes
 *   the StoreKit transaction (iOS), so a completed flow never hits Play's
 *   3-day unacknowledged-refund window nor leaves an unfinished iOS
 *   transaction to be replayed on every launch.
 * - Every method resolves instead of throwing: a store failure, a pending
 *   purchase ("Ask to Buy") or a user cancel is a quiet `false`/`null`, never
 *   an error surface of its own.
 */
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';
import { AD_REMOVAL_PRODUCT_ID, setAdRemovalStore, type AdRemovalStore } from './adRemoval';

interface PlatformRules {
  /**
   * Whether this launch can offer the purchase at all. Resolves false rather
   * than throwing; a false answer hides the buy/restore buttons.
   */
  probeAvailability(): Promise<boolean>;
  /** Whether a transaction actually grants the entitlement. */
  isEntitling(transaction: Transaction): boolean;
  /**
   * Extra options for the ownership query behind "Restore purchase" — the
   * one call whose correct arguments differ per store.
   */
  purchasesQuery(): { productType: PURCHASE_TYPE; onlyCurrentEntitlements?: boolean };
}

/**
 * Play reports the purchase state as a numeric string ("1" = PURCHASED); a
 * pending purchase ("2") grants nothing yet — if it later completes, Restore
 * picks it up. Availability is Play's own answer: on a sideloaded build
 * `isBillingSupported` is false and no purchase UI appears, which is normal
 * (docs/RELEASE_CHECKLIST.md §5).
 */
const androidRules: PlatformRules = {
  async probeAvailability() {
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      return isBillingSupported;
    } catch {
      // No Play services: the purchase UI stays hidden, ads keep their rules.
      return false;
    }
  },
  isEntitling: (transaction) => transaction.purchaseState === '1',
  purchasesQuery: () => ({ productType: PURCHASE_TYPE.INAPP }),
};

/**
 * StoreKit answers differently in both places:
 *
 * - `isBillingSupported` is hardcoded true on iOS (the App Store is always
 *   present), so it cannot tell us whether there is anything to sell. The
 *   real question is whether App Store Connect actually has the product, so
 *   the probe asks for the product itself. A launch that starts offline
 *   therefore hides the purchase UI until the next launch — the same shape as
 *   Android with Play unavailable, and it never shows a button that could
 *   only fail.
 * - There is no `purchaseState` field; StoreKit only returns settled
 *   transactions (a pending "Ask to Buy" purchase rejects instead, and a
 *   cancel does too). What it does return is refunded ones, so `revocationDate`
 *   is the field that decides. `onlyCurrentEntitlements` already filters those
 *   out of the ownership query — the check stays because it also guards the
 *   purchase path, which has no such option.
 */
const iosRules: PlatformRules = {
  async probeAvailability() {
    try {
      await NativePurchases.getProduct({
        productIdentifier: AD_REMOVAL_PRODUCT_ID,
        productType: PURCHASE_TYPE.INAPP,
      });
      return true;
    } catch {
      // Product not configured yet, or the App Store is unreachable.
      return false;
    }
  },
  isEntitling: (transaction) => transaction.revocationDate === undefined,
  purchasesQuery: () => ({
    productType: PURCHASE_TYPE.INAPP,
    onlyCurrentEntitlements: true,
  }),
};

/** Null off a native platform (the web build sells nothing). */
function platformRules(): PlatformRules | null {
  switch (Capacitor.getPlatform()) {
    case 'android':
      return androidRules;
    case 'ios':
      return iosRules;
    default:
      return null;
  }
}

/** The rules for this launch; null until `initNativeStore` has run. */
let rules: PlatformRules | null = null;
/** True once the platform's availability probe resolved true this launch. */
let storeAvailable = false;

/**
 * Whether a transaction grants the entitlement, by this platform's rules.
 * Exported for the tests that pin each store's answer.
 */
export function isEntitlingTransaction(transaction: Transaction): boolean {
  return rules ? rules.isEntitling(transaction) : false;
}

const nativeStore: AdRemovalStore = {
  isAvailable: () => storeAvailable,

  async getPrice() {
    try {
      const { product } = await NativePurchases.getProduct({
        productIdentifier: AD_REMOVAL_PRODUCT_ID,
        productType: PURCHASE_TYPE.INAPP,
      });
      return product.priceString ?? null;
    } catch {
      // Product missing or store unreachable: the button renders priceless.
      return null;
    }
  },

  async purchase() {
    try {
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: AD_REMOVAL_PRODUCT_ID,
        productType: PURCHASE_TYPE.INAPP,
      });
      return isEntitlingTransaction(transaction);
    } catch {
      // Cancelled, pending approval, or the store failed; either way nothing
      // was granted. A purchase that completes later is found by Restore.
      return false;
    }
  },

  async restore() {
    try {
      // Play: also finishes any owned-but-unacknowledged purchase from an
      // interrupted flow. iOS: AppStore.sync(), which may ask the player to
      // sign in — correct for a button they pressed themselves.
      await NativePurchases.restorePurchases();
    } catch {
      // The ownership query below is the actual decider.
    }
    try {
      const { purchases } = await NativePurchases.getPurchases(rules?.purchasesQuery());
      return purchases.some(
        (purchase) =>
          purchase.productIdentifier === AD_REMOVAL_PRODUCT_ID &&
          isEntitlingTransaction(purchase),
      );
    } catch {
      return false;
    }
  },
};

/**
 * Fire-and-forget at app boot, native platforms only. Never a startup
 * condition: until the availability probe answers, the app behaves exactly
 * like a build with no billing at all.
 */
export async function initNativeStore(): Promise<void> {
  const platform = platformRules();
  if (!platform) return;
  rules = platform;
  setAdRemovalStore(nativeStore);
  if (await platform.probeAvailability()) {
    storeAvailable = true;
    // Re-register to notify subscribers that the purchase UI may appear.
    setAdRemovalStore(nativeStore);
  }
}

/** Test hook. */
export function resetNativeStoreForTesting(): void {
  rules = null;
  storeAvailable = false;
}
