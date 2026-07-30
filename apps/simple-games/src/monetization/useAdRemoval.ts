/** React bindings for the ad-removal entitlement. */
import { useSyncExternalStore } from 'react';
import { isAdRemovalPurchased, isPurchaseAvailable, subscribeAdRemoval } from './adRemoval';

export function useAdRemovalPurchased(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isAdRemovalPurchased, isAdRemovalPurchased);
}

/**
 * Whether the buy/restore buttons should render. Subscribed because the
 * billing backend reports availability asynchronously after boot.
 */
export function usePurchaseAvailable(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isPurchaseAvailable, isPurchaseAvailable);
}
