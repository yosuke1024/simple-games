/** React binding for the ad-removal entitlement. */
import { useSyncExternalStore } from 'react';
import { isAdRemovalPurchased, subscribeAdRemoval } from './adRemoval';

export function useAdRemovalPurchased(): boolean {
  return useSyncExternalStore(subscribeAdRemoval, isAdRemovalPurchased, isAdRemovalPurchased);
}
