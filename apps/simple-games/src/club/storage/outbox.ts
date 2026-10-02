/**
 * `sg.clubOutbox` and its flush (club.md §4-2, §10). A finished result is
 * written here first and removed once its Club answers (write-ahead), so the
 * queue is the record of what has still to go. Flushed right after the
 * player's own action and never on a timer.
 */
import { loadRecordWithStatus, saveRecord } from '@/storage/repo';
import {
  CLUB_OUTBOX_MAX,
  CLUB_OUTBOX_MAX_ATTEMPTS,
  clubOutboxSchema,
  type ClubOutboxItem,
} from '@/storage/schemas';
import type { KVStore } from '@/storage/kv';
import { ClubApiError, isFinalError } from '../api/errors';
import type { ClubClient } from '../api/client';
import { contractFor } from '../contract/challenge';

/**
 * Every outbox mutation — a load, a change, a save — goes through this chain,
 * one at a time. `repo.ts` orders single reads and writes per key, but a
 * mutation is two of them: with several Clubs failing at once, two loads would
 * see the same list and the second save would erase the first's item. The chain
 * is never held across network I/O; only the storage round trip is inside it.
 */
let mutations: Promise<unknown> = Promise.resolve();

function mutate<T>(change: () => Promise<T>): Promise<T> {
  const run = mutations.then(change, change);
  mutations = run.catch(() => undefined);
  return run;
}

async function loadAll(kv?: KVStore): Promise<{ items: ClubOutboxItem[]; readable: boolean }> {
  const { value, readable } = await loadRecordWithStatus(clubOutboxSchema, kv);
  return { items: value.items, readable };
}

async function save(items: ClubOutboxItem[], kv?: KVStore): Promise<void> {
  await saveRecord(
    clubOutboxSchema,
    { schemaVersion: 1, items: items.slice(-CLUB_OUTBOX_MAX) },
    kv,
  );
}

/** What two queued items share when they are the same thing to the server. */
export function itemKey(item: ClubOutboxItem): string {
  switch (item.kind) {
    case 'daily':
      return `daily|${item.endpoint}|${item.body.gameId}|${item.body.seed}|${item.body.boardDigest}`;
    case 'ranking':
      return `ranking|${item.endpoint}|${item.body.gameId}|${item.body.paramsKey}`;
    default:
      return `result|${item.endpoint}|${item.challengeId}`;
  }
}

/** The item's request body, as sent; two attempts with different bodies are different items. */
const bodyOf = (item: ClubOutboxItem): string =>
  JSON.stringify(item.kind === undefined ? item.result : item.body);

/**
 * True when `candidate` beats `held` on the game's own axis (club.md §6-1) —
 * the server keeps a member's best, so a queued worse result is dead weight.
 */
function isBetter(candidate: ClubOutboxItem, held: ClubOutboxItem): boolean {
  if (candidate.kind !== 'ranking' || held.kind !== 'ranking') return false;
  const contract = contractFor(candidate.body.gameId);
  if (contract === null) return false;
  const a = candidate.body.facts[contract.order];
  const b = held.body.facts[contract.order];
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return contract.direction === 'asc' ? a < b : a > b;
}

/**
 * Queues one item, merging it into an equal one: a ranking keeps the better
 * value, a daily and an old-form result keep the first (the server's own
 * rules). Resolves false when storage could not be read, in which case nothing
 * was written — the caller must not claim the result is safe.
 */
export function enqueueResult(item: ClubOutboxItem, kv?: KVStore): Promise<boolean> {
  return mutate(async () => {
    const { items, readable } = await loadAll(kv);
    if (!readable) return false;
    const key = itemKey(item);
    const at = items.findIndex((i) => itemKey(i) === key);
    if (at < 0) {
      items.push(item);
    } else if (isBetter(item, items[at]!)) {
      // A new value is a new item: a flush already holding the old one must
      // not remove this one when it finishes (see `remove`).
      items[at] = item;
    } else {
      return true;
    }
    await save(items, kv);
    return true;
  });
}

export async function pendingFor(endpoint: string, kv?: KVStore): Promise<ClubOutboxItem[]> {
  return (await loadAll(kv)).items.filter((i) => i.endpoint === endpoint);
}

/**
 * Forgets every result queued for an endpoint — when the connection goes
 * (club.md §4-2: an item whose connection is gone is dropped), since nothing
 * could ever send it and it would only crowd out the others at the cap.
 */
export function dropOutboxFor(endpoint: string, kv?: KVStore): Promise<void> {
  return mutate(async () => {
    const { items, readable } = await loadAll(kv);
    if (!readable) return;
    const kept = items.filter((i) => i.endpoint !== endpoint);
    if (kept.length !== items.length) await save(kept, kv);
  });
}

/** Takes out the exact item that was sent; one that was replaced meanwhile stays. */
function remove(item: ClubOutboxItem, kv?: KVStore): Promise<void> {
  return mutate(async () => {
    const { items, readable } = await loadAll(kv);
    if (!readable) return;
    const key = itemKey(item);
    const body = bodyOf(item);
    const at = items.findIndex((i) => itemKey(i) === key && bodyOf(i) === body);
    if (at < 0) return;
    items.splice(at, 1);
    await save(items, kv);
  });
}

/** Counts a failed delivery against the item; resolves true when it has used them all up and was dropped. */
function countAttempt(item: ClubOutboxItem, kv?: KVStore): Promise<boolean> {
  return mutate(async () => {
    const { items, readable } = await loadAll(kv);
    if (!readable) return false;
    const key = itemKey(item);
    const body = bodyOf(item);
    const at = items.findIndex((i) => itemKey(i) === key && bodyOf(i) === body);
    if (at < 0) return false;
    const attempts = (items[at]!.attempts ?? 0) + 1;
    if (attempts >= CLUB_OUTBOX_MAX_ATTEMPTS) {
      items.splice(at, 1);
      await save(items, kv);
      return true;
    }
    items[at] = { ...items[at]!, attempts };
    await save(items, kv);
    return false;
  });
}

/** What became of one queued item during a flush (the same words as ClubSendOutcome). */
export type ItemFate = 'sent' | 'queued' | 'rejected' | 'already';

export interface FlushReport {
  /** Items the server accepted. */
  sent: number;
  /** The flush stopped at a failure that a later try may get past; the items behind it were not attempted. */
  blocked: boolean;
  /** Every item this flush attempted, in order. */
  outcomes: { item: ClubOutboxItem; fate: ItemFate }[];
}

/**
 * What recent flushes settled, so a result whose item was sent by another
 * Club-flush that started between its enqueue and its own flush still learns
 * its fate. Bounded; `queued` is never recorded (the queue itself says so).
 */
const settled = new Map<string, ItemFate>();
const SETTLED_MAX = 200;

function settle(item: ClubOutboxItem, fate: ItemFate): void {
  if (fate === 'queued') return;
  settled.set(`${itemKey(item)}|${bodyOf(item)}`, fate);
  if (settled.size > SETTLED_MAX) settled.delete(settled.keys().next().value as string);
}

/** The fate of `item` according to `report`, or to an earlier flush, or `queued`. */
export function fateOf(item: ClubOutboxItem, report: FlushReport): ItemFate {
  const key = itemKey(item);
  const own = report.outcomes.find((o) => itemKey(o.item) === key);
  if (own !== undefined) return own.fate;
  return settled.get(`${key}|${bodyOf(item)}`) ?? 'queued';
}

function deliver(client: ClubClient, item: ClubOutboxItem): Promise<unknown> {
  switch (item.kind) {
    case 'daily':
      return client.createChallenge(item.body);
    case 'ranking':
      return client.submitRanking(item.body);
    default:
      return client.submitResult(item.challengeId, item.result);
  }
}

/**
 * Failures that say nothing about the item: no answer at all, or a server
 * that asked us to slow down. They never count against it — an hour in a
 * tunnel must not cost a good score.
 */
const isNetworkTrouble = (error: unknown): boolean =>
  error instanceof ClubApiError && (error.code === 'unreachable' || error.code === 'rate_limited');

/**
 * One flush at a time per Club: a second caller waits and then sees what the
 * first left. Without it a result's own flush and a Club screen's would send
 * the same item twice, and each would wait out its own timeout.
 */
const flushing = new Map<string, Promise<unknown>>();

/**
 * Oldest first. An item answered with a code that can never succeed
 * (api/errors.ts) is dropped and the flush goes on; any other failure stops it,
 * keeping the rest. Failures that are not the network's are counted, and an
 * item that has failed {@link CLUB_OUTBOX_MAX_ATTEMPTS} times is dropped, so one
 * item a server cannot digest cannot block its Club for good.
 */
export function flushOutbox(
  endpoint: string,
  client: ClubClient,
  kv?: KVStore,
): Promise<FlushReport> {
  const run = (flushing.get(endpoint) ?? Promise.resolve()).then(
    () => flushNow(endpoint, client, kv),
    () => flushNow(endpoint, client, kv),
  );
  const tail = run.catch(() => undefined);
  flushing.set(endpoint, tail);
  void tail.then(() => {
    if (flushing.get(endpoint) === tail) flushing.delete(endpoint);
  });
  return run;
}

async function flushNow(endpoint: string, client: ClubClient, kv?: KVStore): Promise<FlushReport> {
  const report: FlushReport = { sent: 0, blocked: false, outcomes: [] };
  for (const item of await pendingFor(endpoint, kv)) {
    let fate: ItemFate = 'sent';
    try {
      await deliver(client, item);
      report.sent += 1;
    } catch (error) {
      if (isFinalError(error)) {
        fate =
          error instanceof ClubApiError && error.code === 'already_submitted'
            ? 'already'
            : 'rejected';
      } else {
        const gaveUp = !isNetworkTrouble(error) && (await countAttempt(item, kv));
        report.outcomes.push({ item, fate: gaveUp ? 'rejected' : 'queued' });
        if (gaveUp) {
          settle(item, 'rejected');
          continue;
        }
        report.blocked = true;
        break;
      }
    }
    report.outcomes.push({ item, fate });
    settle(item, fate);
    await remove(item, kv);
  }
  return report;
}
