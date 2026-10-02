/**
 * The two functions Core calls through the bridge (ui/clubBridge.ts): a new
 * challenge from a finished game, and the active challenge's result. Both go
 * through api/client.ts; a result that cannot be delivered waits in the
 * outbox (storage/outbox.ts, club.md §10). TODO(work package A): implement.
 */
import type { ActiveChallenge, ClubBridge, ClubConnectionSummary } from '@/ui/clubBridge';

export function createBridge(
  _active: () => ActiveChallenge | null,
): Pick<ClubBridge, 'sendToClub' | 'submitActive'> {
  return {
    sendToClub: async () => 'rejected',
    submitActive: async () => 'queued',
  };
}

export async function loadConnections(): Promise<readonly ClubConnectionSummary[]> {
  return [];
}
