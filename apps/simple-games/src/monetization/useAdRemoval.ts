/** React bindings for the ad-removal entitlement. */
import { useSyncExternalStore } from 'react';
import {
  isAdRemovalActive,
  isAdRemovalPurchased,
  isPurchaseAvailable,
  subscribeAdRemoval,
} from './adRemoval';

export function useAdRemovalPurchased(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isAdRemovalPurchased, isAdRemovalPurchased);
}

/**
 * Whether the ad removal takes effect on this launch — the purchase is
 * active, or the entitlement could not be read and falls to the no-banner
 * side (issue #96). What the banner area asks; the settings screen asks
 * `useAdRemovalPurchased()`, which answers only for a real purchase.
 */
export function useAdRemovalActive(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isAdRemovalActive, isAdRemovalActive);
}

/**
 * Whether the buy/restore buttons should render. Subscribed because the
 * billing backend reports availability asynchronously after boot.
 */
export function usePurchaseAvailable(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isPurchaseAvailable, isPurchaseAvailable);
}
