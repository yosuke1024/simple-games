/** React bindings for the UMP consent state. */
import { useSyncExternalStore } from 'react';
import { isPrivacyOptionsRequired, subscribeConsent } from './consent';

/**
 * Whether the "Ad Privacy Options" row should render. Subscribed because UMP
 * answers asynchronously after boot — and answers "not required" for most of
 * the world, where the row must not appear at all.
 */
export function usePrivacyOptionsRequired(): boolean {
  return useSyncExternalStore(
    subscribeConsent,
    isPrivacyOptionsRequired,
    isPrivacyOptionsRequired,
  );
}
