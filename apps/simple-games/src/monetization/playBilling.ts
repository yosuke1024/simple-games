/**
 * The real `AdRemovalStore`: Google Play Billing via @capgo/native-purchases.
 * No third-party billing server — the plugin talks straight to Play, which
 * stays the source of truth for the entitlement (docs/ADS_POLICY.md).
 *
 * Design:
 * - Availability is probed asynchronously at boot; until (and unless) Play
 *   answers "billing supported", the purchase UI simply stays hidden.
 *   Registering the store re-notifies subscribers, so the settings screen
 *   picks the buttons up whenever the probe completes.
 * - The plugin auto-acknowledges non-consumable purchases (verified in its
 *   Android source), so a completed flow never hits Play's 3-day
 *   unacknowledged-refund window.
 * - Every method resolves instead of throwing: a store failure or a user
 *   cancel is a quiet `false`/`null`, never an error surface of its own.
 */
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';
import { AD_REMOVAL_PRODUCT_ID, setAdRemovalStore, type AdRemovalStore } from './adRemoval';

/**
 * Whether a transaction actually grants the entitlement. Android reports
 * Play's numeric state as a string ("1" = PURCHASED); a pending purchase
 * ("2") grants nothing yet — if it later completes, Restore picks it up.
 * Platforms that omit the field only return settled transactions.
 */
export function isEntitlingTransaction(transaction: Transaction): boolean {
  return transaction.purchaseState === undefined || transaction.purchaseState === '1';
}

/** True once `isBillingSupported` resolved true on this launch. */
let billingSupported = false;

const playBillingStore: AdRemovalStore = {
  isAvailable: () => billingSupported,

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
      // User cancelled or the store failed; either way nothing was granted.
      return false;
    }
  },

  async restore() {
    try {
      // Also finishes any owned-but-unacknowledged purchase from an
      // interrupted flow (the plugin acknowledges while processing).
      await NativePurchases.restorePurchases();
    } catch {
      // The ownership query below is the actual decider.
    }
    try {
      const { purchases } = await NativePurchases.getPurchases({
        productType: PURCHASE_TYPE.INAPP,
      });
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
export async function initPlayBilling(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  setAdRemovalStore(playBillingStore);
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (isBillingSupported) {
      billingSupported = true;
      // Re-register to notify subscribers that the purchase UI may appear.
      setAdRemovalStore(playBillingStore);
    }
  } catch {
    // No Play services: the purchase UI stays hidden, ads keep their rules.
  }
}

/** Test hook. */
export function resetPlayBillingForTesting(): void {
  billingSupported = false;
}
