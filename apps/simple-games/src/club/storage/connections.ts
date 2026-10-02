/** `sg.club` through its Core schema (club.md §4-1). Tokens never leave this file except to the client. */
import { loadRecord, saveRecord } from '@/storage/repo';
import {
  CLUB_CONNECTIONS_MAX,
  clubConnectionsSchema,
  type ClubConnection,
} from '@/storage/schemas';
import type { KVStore } from '@/storage/kv';
import type { ClubConnectionSummary } from '@/ui/clubBridge';

async function load(kv?: KVStore): Promise<ClubConnection[]> {
  return (await loadRecord(clubConnectionsSchema, kv)).connections;
}

async function save(connections: ClubConnection[], kv?: KVStore): Promise<ClubConnection[]> {
  await saveRecord(clubConnectionsSchema, { schemaVersion: 1, connections }, kv);
  return connections;
}

export function loadClubConnections(kv?: KVStore): Promise<ClubConnection[]> {
  return load(kv);
}

/** Replaces a connection to the same endpoint; throws `too_many_connections` at the cap. */
export async function addClubConnection(
  connection: ClubConnection,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const current = await load(kv);
  const index = current.findIndex((c) => c.endpoint === connection.endpoint);
  if (index >= 0) {
    const next = current.slice();
    next[index] = connection;
    return save(next, kv);
  }
  if (current.length >= CLUB_CONNECTIONS_MAX) throw new Error('too_many_connections');
  return save([...current, connection], kv);
}

export async function removeClubConnection(
  endpoint: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const current = await load(kv);
  return save(
    current.filter((c) => c.endpoint !== endpoint),
    kv,
  );
}

export async function updateClubName(
  endpoint: string,
  clubName: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const current = await load(kv);
  return save(
    current.map((c) => (c.endpoint === endpoint ? { ...c, clubName } : c)),
    kv,
  );
}

export function summarize(connection: ClubConnection): ClubConnectionSummary {
  return {
    endpoint: connection.endpoint,
    clubId: connection.clubId,
    clubName: connection.clubName,
    nickname: connection.nickname,
    role: connection.role,
  };
}
