/**
 * Online/offline tracking. Offline is a normal state, never an error
 * (docs/OFFLINE_POLICY.md). Used only to skip network work while offline:
 * banner-ad work, and the one-time Meta install report (issue #204), which
 * waits for the way back online through {@link onNextOnline} rather than
 * trying again on a timer.
 */
import { Network } from '@capacitor/network';

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;

const onlineWaiters = new Set<() => void>();

function setOnline(value: boolean): void {
  const cameOnline = value && !online;
  online = value;
  if (!cameOnline) return;
  const waiters = [...onlineWaiters];
  onlineWaiters.clear();
  for (const waiter of waiters) waiter();
}

export async function initNetwork(): Promise<void> {
  try {
    setOnline((await Network.getStatus()).connected);
    await Network.addListener('networkStatusChange', (status) => {
      setOnline(status.connected);
    });
  } catch {
    // Plugin unavailable (e.g. plain browser tests): keep navigator.onLine value.
  }
}

export function isOnline(): boolean {
  return online;
}

/**
 * Runs `listener` once, the next time the device goes from offline to
 * online, and then forgets it. Returns the canceller. This is a single wait
 * for an event the OS raises anyway, not a poll: nothing is scheduled, and a
 * device that never comes back online never runs it.
 */
export function onNextOnline(listener: () => void): () => void {
  onlineWaiters.add(listener);
  return () => {
    onlineWaiters.delete(listener);
  };
}

/** Test hook. */
export function setOnlineForTesting(value: boolean): void {
  setOnline(value);
}
