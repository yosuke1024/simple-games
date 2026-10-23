/** Club credentials through `sg.club`: never exported, and wiped by Reset Local Data. */
import { loadRecord, updateRecord } from '@/storage/repo';
import {
  CLUB_CONNECTIONS_MAX,
  CLUB_DEPARTED_MAX,
  clubConnectionsSchema,
  type ClubConnection,
  type ClubConnections,
  type ManagedClubOwner,
  type PendingClubJoin,
} from '@/storage/schemas';
import { preferencesKV, type KVStore } from '@/storage/kv';
import type { ClubConnectionSummary } from '@/ui/clubBridge';

// The whole read/modify/write shares the repo's queue with Reset Local Data.
// A separate queue would let a delayed credential write outlive that reset.
function change(
  update: (record: ClubConnections) => ClubConnections,
  kv: KVStore = preferencesKV,
): Promise<ClubConnections> {
  return updateRecord(
    clubConnectionsSchema,
    (record) => {
      const updated = update(record);
      return clubConnectionsSchema.validate(updated) ?? updated;
    },
    kv,
  );
}

export async function loadClubConnections(kv?: KVStore): Promise<ClubConnection[]> {
  return (await loadRecord(clubConnectionsSchema, kv)).connections;
}

/** One membership per endpoint; returning removes the departed and pending entries. */
export async function addClubConnection(
  connection: ClubConnection,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  const next = await change((record) => {
    const connections = record.connections.slice();
    const index = connections.findIndex((c) => c.endpoint === connection.endpoint);
    if (index >= 0) connections[index] = connection;
    else {
      if (connections.length >= CLUB_CONNECTIONS_MAX) throw new Error('too_many_connections');
      connections.push(connection);
    }
    return {
      ...record,
      connections,
      ...(record.departed
        ? { departed: record.departed.filter((c) => c.endpoint !== connection.endpoint) }
        : {}),
      ...(record.pending
        ? { pending: record.pending.filter((p) => p.endpoint !== connection.endpoint) }
        : {}),
    };
  }, kv);
  return next.connections;
}

export async function removeClubConnection(
  endpoint: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return (
    await change(
      (r) => ({ ...r, connections: r.connections.filter((c) => c.endpoint !== endpoint) }),
      kv,
    )
  ).connections;
}

/** Disconnect keeps the credential for returning as the same member; departed entries never send. */
export async function departClubConnection(
  endpoint: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return (
    await change((record) => {
      const leaving = record.connections.find((c) => c.endpoint === endpoint);
      if (!leaving) return record;
      return {
        ...record,
        connections: record.connections.filter((c) => c.endpoint !== endpoint),
        departed: [
          ...(record.departed ?? []).filter((c) => c.endpoint !== endpoint),
          leaving,
        ].slice(-CLUB_DEPARTED_MAX),
      };
    }, kv)
  ).connections;
}

export async function findDeparted(endpoint: string, kv?: KVStore): Promise<ClubConnection | null> {
  return (
    (await loadRecord(clubConnectionsSchema, kv)).departed?.find((c) => c.endpoint === endpoint) ??
    null
  );
}

export async function forgetDeparted(endpoint: string, kv?: KVStore): Promise<void> {
  await change(
    (r) => ({
      ...r,
      ...(r.departed ? { departed: r.departed.filter((c) => c.endpoint !== endpoint) } : {}),
    }),
    kv,
  );
}

async function updateConnection(
  endpoint: string,
  update: (c: ClubConnection) => ClubConnection,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return (
    await change(
      (r) => ({
        ...r,
        connections: r.connections.map((c) => (c.endpoint === endpoint ? update(c) : c)),
      }),
      kv,
    )
  ).connections;
}

export function updateClubName(
  endpoint: string,
  clubName: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return updateConnection(endpoint, (c) => ({ ...c, clubName }), kv);
}

export function updateNickname(
  endpoint: string,
  nickname: string,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return updateConnection(endpoint, (c) => ({ ...c, nickname }), kv);
}

export function updateClubGames(
  endpoint: string,
  allowedGameIds: string[] | null,
  kv?: KVStore,
): Promise<ClubConnection[]> {
  return updateConnection(endpoint, (c) => ({ ...c, allowedGameIds }), kv);
}

/** Only the explicit automatic-send disclosure can grant this consent. */
export function acceptAutoSend(endpoint: string, kv?: KVStore): Promise<ClubConnection[]> {
  return updateConnection(endpoint, (c) => ({ ...c, autoSend: true as const }), kv);
}

export async function loadPendingJoins(kv?: KVStore): Promise<PendingClubJoin[]> {
  return (await loadRecord(clubConnectionsSchema, kv)).pending ?? [];
}

export async function savePendingJoin(pending: PendingClubJoin, kv?: KVStore): Promise<void> {
  await change(
    (r) => ({
      ...r,
      pending: [...(r.pending ?? []).filter((p) => p.endpoint !== pending.endpoint), pending].slice(
        -CLUB_CONNECTIONS_MAX,
      ),
    }),
    kv,
  );
}

export async function forgetPendingJoin(endpoint: string, kv?: KVStore): Promise<void> {
  await change(
    (r) => ({
      ...r,
      ...(r.pending ? { pending: r.pending.filter((p) => p.endpoint !== endpoint) } : {}),
    }),
    kv,
  );
}

export async function loadManagedOwner(kv?: KVStore): Promise<ManagedClubOwner | null> {
  return (await loadRecord(clubConnectionsSchema, kv)).managedOwner ?? null;
}

export async function saveManagedOwner(
  owner: ManagedClubOwner | null,
  kv?: KVStore,
): Promise<void> {
  await change((r) => {
    if (owner !== null) return { ...r, managedOwner: owner };
    const { managedOwner: _removed, ...rest } = r;
    return rest;
  }, kv);
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
