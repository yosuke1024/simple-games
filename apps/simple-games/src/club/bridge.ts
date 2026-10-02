/**
 * The one function Core calls through the bridge (ui/clubBridge.ts): a
 * finished game's result goes to every Club this device has joined and has
 * accepted automatic sending for (club.md §2-2, §10). Each Club's copy is
 * written to the outbox first and then flushed, so a result that cannot be
 * delivered right now — offline, a server that is down — simply stays queued
 * for the player's next action. A connection that never accepted the
 * disclosure (one from before automatic sending existed) gets nothing: not
 * sent, not queued, not reported.
 */
import type { KVStore } from '@/storage/kv';
import {
  validateClubOutboxItem,
  type ClubConnection,
  type ClubOutboxItem,
} from '@/storage/schemas';
import type {
  ClubBridge,
  ClubConnectionSummary,
  ClubResultPayload,
  ClubSendOutcome,
  ClubSendReport,
} from '@/ui/clubBridge';
import { createClient } from './api/client';
import { contractFor } from './contract/challenge';
import { loadClubConnections, summarize } from './storage/connections';
import { enqueueResult, fateOf, flushOutbox } from './storage/outbox';

interface Plan {
  kind: 'daily' | 'ranking';
  /** The outbox item for one Club; null when it does not validate. */
  item(endpoint: string): ClubOutboxItem | null;
}

/** What to send, decided once and then copied per Club: null sends nothing, 'rejected' can never go. */
function plan(payload: ClubResultPayload): Plan | 'rejected' | null {
  // A loss or a dead end is sent nowhere: in a daily it would silently lock
  // the day (the first result counts), and rankings ignore it (club.md §16-1).
  if (payload.outcome !== 'completed') return null;
  const contract = contractFor(payload.gameId);
  if (contract === null) return 'rejected';
  const params = contract.validateParams(payload.params);
  const facts = contract.validateFacts(payload.facts);
  if (params === null || facts === null) return 'rejected';

  if (typeof payload.daily === 'string' && payload.boardDigest !== null && payload.seed !== '') {
    const { daily, boardDigest } = payload;
    // A daily whose board everyone shares meets in that day's challenge (club.md §6-3).
    return {
      kind: 'daily',
      item: (endpoint) =>
        validateClubOutboxItem({
          kind: 'daily',
          endpoint,
          createdAt: new Date().toISOString(),
          body: {
            gameId: payload.gameId,
            contractVersion: 1,
            params,
            seed: payload.seed,
            boardDigest,
            title: null,
            daily,
            result: { outcome: payload.outcome, facts },
          },
        }),
    };
  }
  // Everything else is a result in the game × mode table (club.md §16).
  const paramsKey = contract.paramsKey(params);
  return {
    kind: 'ranking',
    item: (endpoint) =>
      validateClubOutboxItem({
        kind: 'ranking',
        endpoint,
        createdAt: new Date().toISOString(),
        body: {
          gameId: payload.gameId,
          contractVersion: 1,
          paramsKey,
          params,
          seed: payload.seed,
          boardDigest: payload.boardDigest,
          outcome: payload.outcome,
          facts,
        },
      }),
  };
}

export function createBridge(
  kv?: KVStore,
  fetchImpl?: typeof fetch,
): Pick<ClubBridge, 'sendResult'> {
  /**
   * Results this session has already settled with a Club (sent, or answered
   * `already`), so a result screen that mounts twice sends once. Per
   * membership (endpoint + member): a Club joined later in the session is not
   * skipped, and neither is the same Club rejoined after a disconnect — that is
   * a new member, and the server has none of its results.
   */
  const delivered = new Map<string, ClubSendOutcome>();

  async function sendTo(
    connection: ClubConnection,
    item: ClubOutboxItem,
    fingerprint: string,
  ): Promise<ClubSendReport> {
    const report = (outcome: ClubSendOutcome): ClubSendReport => ({
      endpoint: connection.endpoint,
      clubName: connection.clubName,
      outcome,
    });
    const memo = JSON.stringify([connection.endpoint, connection.memberId, fingerprint]);
    const earlier = delivered.get(memo);
    if (earlier !== undefined) return report(earlier);
    try {
      // Write first: a result that is in flight when the app is killed is
      // still in the outbox for the next time.
      if (!(await enqueueResult(item, kv))) return report('rejected');
      const client = createClient(connection.endpoint, connection.memberToken, fetchImpl);
      // This flush starts with whatever waited before this result; if one of
      // those fails again it stops there, and this result stays queued
      // without a second timeout.
      const flushed = await flushOutbox(connection.endpoint, client, kv);
      const outcome = fateOf(item, flushed);
      if (outcome === 'sent' || outcome === 'already') delivered.set(memo, outcome);
      return report(outcome);
    } catch {
      return report('rejected');
    }
  }

  return {
    async sendResult(payload) {
      try {
        // Read now, not when the screen opened: a Club joined this session is
        // included, one just left is not, and nothing played before joining
        // was ever offered to it. Only a connection whose owner accepted the
        // disclosure counts (club.md §4-1): the rest are not this result's business.
        const connections = (await loadClubConnections(kv)).filter((c) => c.autoSend === true);
        if (connections.length === 0) return [];
        const planned = plan(payload);
        if (planned === null) return [];
        const reports = (outcome: ClubSendOutcome): ClubSendReport[] =>
          connections.map((c) => ({ endpoint: c.endpoint, clubName: c.clubName, outcome }));
        if (planned === 'rejected') return reports('rejected');
        const fingerprint = `${planned.kind}|${JSON.stringify([
          payload.gameId,
          payload.seed,
          payload.boardDigest,
          payload.daily ?? null,
          payload.params,
          payload.facts,
        ])}`;
        return await Promise.all(
          connections.map(async (connection): Promise<ClubSendReport> => {
            const item = planned.item(connection.endpoint);
            if (item === null) {
              return {
                endpoint: connection.endpoint,
                clubName: connection.clubName,
                outcome: 'rejected',
              };
            }
            return sendTo(connection, item, fingerprint);
          }),
        );
      } catch {
        return [];
      }
    },
  };
}

export async function loadConnections(kv?: KVStore): Promise<readonly ClubConnectionSummary[]> {
  return (await loadClubConnections(kv)).map(summarize);
}
