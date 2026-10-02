/**
 * The two functions Core calls through the bridge (ui/clubBridge.ts): a new
 * challenge from a finished game, and the active challenge's result. A new
 * challenge is never queued; a result that cannot be delivered waits in the
 * outbox (club.md §4-2, §10).
 */
import type { KVStore } from '@/storage/kv';
import type { ClubOutboxItem } from '@/storage/schemas';
import type {
  ActiveChallenge,
  ClubBridge,
  ClubConnectionSummary,
  ClubSendOutcome,
} from '@/ui/clubBridge';
import { createClient } from './api/client';
import { isFinalError } from './api/errors';
import { contractFor } from './contract/challenge';
import { loadClubConnections, summarize } from './storage/connections';
import { enqueueResult, flushOutbox } from './storage/outbox';

export function createBridge(
  active: () => ActiveChallenge | null,
  kv?: KVStore,
  fetchImpl?: typeof fetch,
): Pick<ClubBridge, 'sendToClub' | 'submitActive'> {
  return {
    async sendToClub(endpoint, payload): Promise<ClubSendOutcome> {
      const connection = (await loadClubConnections(kv)).find((c) => c.endpoint === endpoint);
      if (connection === undefined) return 'rejected';
      const contract = contractFor(payload.gameId);
      if (contract === null) return 'rejected';
      const params = contract.validateParams(payload.params);
      const facts = contract.validateFacts(payload.facts);
      if (params === null || facts === null || payload.boardDigest === null) return 'rejected';
      const client = createClient(endpoint, connection.memberToken, fetchImpl);
      try {
        await client.createChallenge({
          gameId: payload.gameId,
          contractVersion: 1,
          params,
          seed: payload.seed,
          boardDigest: payload.boardDigest,
          title: null,
          daily: payload.daily ?? null,
          result: { outcome: payload.outcome, facts },
        });
        return 'sent';
      } catch {
        // A new challenge is never queued (club.md §4-2).
        return 'rejected';
      }
    },

    async submitActive(result): Promise<ClubSendOutcome> {
      const challenge = active();
      if (challenge === null) return 'rejected';
      const connection = (await loadClubConnections(kv)).find(
        (c) => c.endpoint === challenge.endpoint,
      );
      if (connection === undefined) return 'rejected';
      const contract = contractFor(challenge.gameId);
      if (contract === null) return 'rejected';
      const facts = contract.validateFacts(result.facts);
      if (facts === null) return 'rejected';
      const client = createClient(challenge.endpoint, connection.memberToken, fetchImpl);
      const body = {
        contractVersion: 1 as const,
        boardDigest: result.boardDigest,
        outcome: result.outcome,
        facts,
      };
      try {
        await flushOutbox(challenge.endpoint, client, kv);
      } catch {
        // Best effort.
      }
      try {
        await client.submitResult(challenge.challengeId, body);
        return 'sent';
      } catch (error) {
        // club.md §10: a final answer is dropped; everything else — no
        // response, 429, 5xx, a body that did not parse — waits in the outbox
        // for the next time this Club is opened or a result is sent.
        if (isFinalError(error)) return 'rejected';
        const item: ClubOutboxItem = {
          endpoint: challenge.endpoint,
          challengeId: challenge.challengeId,
          result: body,
          createdAt: new Date().toISOString(),
        };
        await enqueueResult(item, kv);
        return 'queued';
      }
    },
  };
}

export async function loadConnections(kv?: KVStore): Promise<readonly ClubConnectionSummary[]> {
  return (await loadClubConnections(kv)).map(summarize);
}
