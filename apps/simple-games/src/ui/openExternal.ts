/**
 * Opens a URL in the system browser. Failing quietly is the offline
 * contract: the app never blocks or errors because a link could not open
 * (docs/OFFLINE_POLICY.md).
 */
import { isOnline } from '../services/network';

export function openExternal(url: string): void {
  if (!isOnline()) return;
  try {
    window.open(url, '_blank', 'noopener');
  } catch {
    // Blocked or unavailable: the tap does nothing; the app keeps running.
  }
}
