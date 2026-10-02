/** `sg.club` through its Core schema (club.md §4-1). Tokens never leave this file except to the client. */
import { loadRecord, saveRecord } from '@/storage/repo';
import {
  CLUB_CONNECTIONS_MAX,
  CLUB_DEPARTED_MAX,
  clubConnectionsSchema,
  type ClubConnection,
} from '@/storage/schemas';
import type { KVStore } from '@/storage/kv';
import type { ClubConnectionSummary } from '@/ui/clubBridge';

/** Every writer below goes through `save`, which carries the departed list along unchanged. */
async function loadAll(
  kv?: KVStore,
): Promise<{ connections: ClubConnection[]; departed: ClubConnection[] }> {
  const record = await loadRecord(clubConnectionsSchema, kv);
  return { connections: record.connections, departed: record.departed ?? [] };
}

async function load(kv?: KVStore): Promise<ClubConnection[]> {
  return (await loadAll(kv)).connections;
}

async function save(
  connections: ClubConnection[],
  kv?: KVStore,
  departed?: ClubConnection[],
): Promise<ClubConnection[]> {
  const kept = departed ?? (await loadAll(kv)).departed;
  await saveRecord(
    clubConnectionsSchema,
    { schemaVersion: 1, connections, ...(kept.length > 0 ? { departed: kept } : {}) },
    kv,
  );
  return connections;
}

export function loadClubConnections(kv?: KVStore): Promise<ClubConnection[]> {
  return load(kv);
}

/**
 * Replaces a connection to the same endpoint; throws `too_many_connections` at
 * the cap. A Club that is connected is no longer "departed": its old entry goes.
 */
export async function addClubConnection(
  connection: ClubConnection,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const { connections: current, departed } = await loadAll(kv);
  const rest = departed.filter((c) => c.endpoint !== connection.endpoint);
  const index = current.findIndex((c) => c.endpoint === connection.endpoint);
  if (index >= 0) {
    const next = current.slice();
    next[index] = connection;
    return save(next, kv, rest);
  }
  if (current.length >= CLUB_CONNECTIONS_MAX) throw new Error('too_many_connections');
  return save([...current, connection], kv, rest);
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

/**
 * Disconnect (club.md §8-5): the connection leaves the active list but its
 * credentials stay on the device as a departed entry, so joining that Club
 * again returns the same member (decision 43). The departed entry never sends.
 */
export async function departClubConnection(
  endpoint: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const { connections, departed } = await loadAll(kv);
  const leaving = connections.find((c) => c.endpoint === endpoint);
  const next = connections.filter((c) => c.endpoint !== endpoint);
  if (leaving === undefined) return save(next, kv, departed);
  const kept = [...departed.filter((c) => c.endpoint !== endpoint), leaving];
  return save(next, kv, kept.slice(-CLUB_DEPARTED_MAX));
}

/** The departed entry for a Club, if this device ever left it (club.md §7-3「同じ端末で入り直す」). */
export async function findDeparted(endpoint: string, kv?: KVStore): Promise<ClubConnection | null> {
  return (await loadAll(kv)).departed.find((c) => c.endpoint === endpoint) ?? null;
}

/** The departed entry is no use any more (the server no longer knows that member). */
export async function forgetDeparted(endpoint: string, kv?: KVStore): Promise<void> {
  const { connections, departed } = await loadAll(kv);
  if (!departed.some((c) => c.endpoint === endpoint)) return;
  await save(
    connections,
    kv,
    departed.filter((c) => c.endpoint !== endpoint),
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

/** The server's name for this member differs from the cached one (the owner renamed them). */
export async function updateNickname(
  endpoint: string,
  nickname: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const current = await load(kv);
  return save(
    current.map((c) => (c.endpoint === endpoint ? { ...c, nickname } : c)),
    kv,
  );
}

/**
 * The player accepted `clubAutoSendDisclosure` on the Club screen: a connection
 * from before automatic sending existed starts sending from here on (club.md §4-1).
 */
export async function acceptAutoSend(endpoint: string, kv?: KVStore): Promise<ClubConnection[]> {
  const current = await load(kv);
  return save(
    current.map((c) => (c.endpoint === endpoint ? { ...c, autoSend: true as const } : c)),
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
