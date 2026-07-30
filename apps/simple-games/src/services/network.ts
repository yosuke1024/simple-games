/**
 * Online/offline tracking. Offline is a normal state, never an error
 * (docs/OFFLINE_POLICY.md). Used only to skip banner-ad work.
 */
import { Network } from '@capacitor/network';

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;

export async function initNetwork(): Promise<void> {
  try {
    online = (await Network.getStatus()).connected;
    await Network.addListener('networkStatusChange', (status) => {
      online = status.connected;
    });
  } catch {
    // Plugin unavailable (e.g. plain browser tests): keep navigator.onLine value.
  }
}

export function isOnline(): boolean {
  return online;
}

/** Test hook. */
export function setOnlineForTesting(value: boolean): void {
  online = value;
}
