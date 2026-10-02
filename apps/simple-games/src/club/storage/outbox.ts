/** `sg.clubOutbox` and its flush (club.md §4-2, §10). Never on a timer. */
import { loadRecord, saveRecord } from '@/storage/repo';
import { CLUB_OUTBOX_MAX, clubOutboxSchema, type ClubOutboxItem } from '@/storage/schemas';
import type { KVStore } from '@/storage/kv';
import { ClubApiError } from '../api/errors';
import type { ClubClient } from '../api/client';

async function load(kv?: KVStore): Promise<ClubOutboxItem[]> {
  return (await loadRecord(clubOutboxSchema, kv)).items;
}

async function save(items: ClubOutboxItem[], kv?: KVStore): Promise<void> {
  await saveRecord(
    clubOutboxSchema,
    { schemaVersion: 1, items: items.slice(-CLUB_OUTBOX_MAX) },
    kv,
  );
}

export async function enqueueResult(item: ClubOutboxItem, kv?: KVStore): Promise<void> {
  await save([...(await load(kv)), item], kv);
}

export async function pendingFor(endpoint: string, kv?: KVStore): Promise<ClubOutboxItem[]> {
  return (await load(kv)).filter((i) => i.endpoint === endpoint);
}

const DROP_CODES = new Set(['already_submitted', 'board_mismatch', 'not_found', 'unauthorized']);

/** Oldest first. Dropped on a code that can never succeed; stops (keeping the rest) on any other failure. */
export async function flushOutbox(
  endpoint: string,
  client: ClubClient,
  kv?: KVStore,
): Promise<number> {
  const mine = await pendingFor(endpoint, kv);
  let sent = 0;
  for (const item of mine) {
    try {
      await client.submitResult(item.challengeId, item.result);
      sent += 1;
    } catch (error) {
      if (!(error instanceof ClubApiError && DROP_CODES.has(error.code))) break;
    }
    // Re-read: another writer may have appended meanwhile.
    const current = await load(kv);
    const at = current.findIndex(
      (i) =>
        i.endpoint === item.endpoint &&
        i.challengeId === item.challengeId &&
        i.createdAt === item.createdAt,
    );
    if (at >= 0) {
      current.splice(at, 1);
      await save(current, kv);
    }
  }
  return sent;
}
