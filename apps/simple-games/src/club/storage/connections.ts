/** Club credentials through `sg.club`: never exported, and wiped by Reset Local Data. */
import { loadRecord, recordRemovalVersion, updateRecord } from '@/storage/repo';
import { noteManagedOwnerAdRemoval, revokeManagedOwnerAdRemoval } from '@/monetization/adRemoval';
import {
  asManagedAdRemovalBenefit,
  CLUB_CONNECTIONS_MAX,
  CLUB_DEPARTED_MAX,
  clubConnectionsSchema,
  type ClubConnection,
  type ClubConnections,
  type ManagedClubOwner,
  type ManagedAdRemovalBenefit,
  type PendingClubJoin,
} from '@/storage/schemas';
import { preferencesKV, preferencesKVWithReadStatus, type KVStore } from '@/storage/kv';
import type { ClubConnectionSummary } from '@/ui/clubBridge';
import { MANAGED_CLUB_ORIGIN } from '@/ui/clubFeatures';

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
  owner: Omit<ManagedClubOwner, 'adRemoval'> | null,
  kv?: KVStore,
): Promise<void> {
  const saved = await changeManagedOwner((r) => {
    // Never accept an entitlement on an unverified key installation, even
    // when a structurally wider object was passed by a caller.
    if (owner !== null)
      return {
        ...r,
        managedOwner: {
          origin: owner.origin,
          ownerToken: owner.ownerToken,
          ...(owner.pendingTrial ? { pendingTrial: true } : {}),
        },
      };
    const { managedOwner: _removed, ...rest } = r;
    return rest;
  }, kv);
  // Trial must not POST a new credential that this device failed to retain.
  if (!saved) throw new Error('owner_key_not_saved');
}

/**
 * Read-back and publication stay INSIDE the repo operation: Reset cannot
 * remove the record between the write and a stale entitlement notification.
 * A silent Preferences write failure is detected before claiming a durable
 * benefit (the web ad SDK must only be restarted after this cache is saved).
 */
async function changeManagedOwner(
  update: (record: ClubConnections) => ClubConnections,
  kv: KVStore = preferencesKVWithReadStatus,
  revokedCredential?: OwnerCredential,
): Promise<boolean> {
  let saved = false;
  let readable = true;
  const removalVersion = recordRemovalVersion(clubConnectionsSchema.key);
  const current = () => removalVersion === recordRemovalVersion(clubConnectionsSchema.key);
  const verifiedKV: KVStore = {
    get: async (key) => {
      // A 401 or verified inactive answer is authoritative for this key even
      // when disk is unreadable. Run in the queue, after older publications,
      // and compare the runtime key so a stale denial cannot affect its replacement.
      if (current() && revokedCredential) revokeManagedOwnerAdRemoval(revokedCredential);
      try {
        return await kv.get(key);
      } catch (error) {
        readable = false;
        throw error;
      }
    },
    remove: (key) => kv.remove(key),
    set: async (key, payload) => {
      // updateRecord normally permits defaults on an unreadable preference.
      // An owner-key change must not replace unknown credentials/connections.
      if (!readable) return;
      await kv.set(key, payload);
      if ((await kv.get(key)) !== payload || !current()) return;
      const next = clubConnectionsSchema.validate(JSON.parse(payload));
      saved = true;
      noteManagedOwnerAdRemoval(next?.managedOwner ?? null);
    },
  };
  await change((record) => {
    if (!current() || !readable) return record;
    const next = update(record);
    // Revocation/replacement takes effect even if storage has stopped
    // accepting writes. Granting waits for the verified write above.
    if (!next.managedOwner?.adRemoval?.active || next.managedOwner.pendingTrial)
      noteManagedOwnerAdRemoval(next.managedOwner ?? null);
    return next;
  }, verifiedKV);
  return saved;
}

type OwnerCredential = Pick<ManagedClubOwner, 'origin' | 'ownerToken'>;

function sameOwner(owner: ManagedClubOwner | undefined, credential: OwnerCredential): boolean {
  return owner?.origin === credential.origin && owner.ownerToken === credential.ownerToken;
}

/** A late response cannot recreate a forgotten/reset owner or overwrite a replacement key. */
export async function saveVerifiedManagedOwner(
  credential: OwnerCredential,
  benefit: ManagedAdRemovalBenefit,
  kv?: KVStore,
): Promise<boolean> {
  let matched = false;
  const adRemoval =
    credential.origin === MANAGED_CLUB_ORIGIN ? asManagedAdRemovalBenefit(benefit) : null;
  const saved = await changeManagedOwner(
    (record) => {
      if (!sameOwner(record.managedOwner, credential)) return record;
      matched = true;
      return {
        ...record,
        managedOwner: {
          origin: credential.origin,
          ownerToken: credential.ownerToken,
          ...(adRemoval === null ? {} : { adRemoval }),
        },
      };
    },
    kv,
    adRemoval?.active === false ? credential : undefined,
  );
  return matched && saved;
}

/** Authenticated 401 invalidates only the key whose request failed. */
export async function clearManagedOwnerAdRemoval(
  credential: OwnerCredential,
  kv?: KVStore,
): Promise<boolean> {
  let matched = false;
  const saved = await changeManagedOwner(
    (record) => {
      if (!sameOwner(record.managedOwner, credential)) return record;
      matched = true;
      const { adRemoval: _removed, ...owner } = record.managedOwner!;
      return { ...record, managedOwner: owner };
    },
    kv,
    credential,
  );
  return matched && saved;
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
