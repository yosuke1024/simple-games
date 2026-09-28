/** React bindings for the Meta install measurement state (metaInstall.ts). */
import { useSyncExternalStore } from 'react';
import { getMetaInstallState, subscribeMetaInstall } from './metaInstall';
import type { MetaInstallState } from './plugin';

/**
 * Subscribed because the native side answers after boot, and the answer
 * changes when the player changes it in Settings.
 */
export function useMetaInstallState(): MetaInstallState {
  return useSyncExternalStore(subscribeMetaInstall, getMetaInstallState, getMetaInstallState);
}
