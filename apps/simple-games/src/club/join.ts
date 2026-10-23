/**
 * Joining a Club, or coming back to it (club.md §7-3, decision 43). Nothing
 * identifies a device — no device id, no account — so "the same device" means
 * one thing only: the credentials Disconnect kept on it (`departed`). If the
 * server still accepts that token, joining again restores the same member
 * (same id, same records, same role); if it does not (the owner removed the
 * member, or the Club was rebuilt), the departed entry is dropped and the join
 * is an ordinary new one. A network failure changes nothing.
 */
import type { KVStore } from '@/storage/kv';
import type { ClubConnection, PendingClubJoin } from '@/storage/schemas';
import { createClient } from './api/client';
import { ClubApiError } from './api/errors';
import {
  findDeparted,
  forgetDeparted,
  loadClubConnections,
  loadPendingJoins,
} from './storage/connections';

/** The server no longer knows this token: the way back is closed, not merely out of reach. */
const isGone = (e: unknown): boolean =>
  e instanceof ClubApiError && (e.code === 'unauthorized' || e.code === 'not_found');

export interface JoinRequest {
  endpoint: string;
  /** Null joins an open server (the Public Club House). */
  inviteToken: string | null;
  nickname: string;
  allowPending?: true;
}

export interface JoinOutcome {
  connection: ClubConnection;
  /** True when an existing membership is reused instead of a new one being made. */
  restored: boolean;
}

export interface PendingJoinOutcome {
  pending: PendingClubJoin;
}

export function joinOrRestore(
  request: JoinRequest & { allowPending: true },
  kv?: KVStore,
  fetchImpl?: typeof fetch,
): Promise<JoinOutcome | PendingJoinOutcome>;
export function joinOrRestore(
  request: JoinRequest,
  kv?: KVStore,
  fetchImpl?: typeof fetch,
): Promise<JoinOutcome>;
export async function joinOrRestore(
  { endpoint, inviteToken, nickname, allowPending }: JoinRequest,
  kv?: KVStore,
  fetchImpl?: typeof fetch,
): Promise<JoinOutcome | PendingJoinOutcome> {
  // An invite may be pasted again or a listed Club opened after joining.
  // Reuse the local receipt before any unauthenticated join can create a
  // second member and replace the credentials for the original one.
  const existing = (await loadClubConnections(kv)).find((c) => c.endpoint === endpoint);
  if (existing) return { connection: existing, restored: true };
  if (allowPending) {
    const pending = (await loadPendingJoins(kv)).find((p) => p.endpoint === endpoint);
    if (pending) return { pending };
  }
  const departed = await findDeparted(endpoint, kv);
  if (departed !== null) {
    const client = createClient(endpoint, departed.memberToken, fetchImpl);
    let club;
    try {
      // Reading the Club is the cheapest authenticated request: it tells whether the token lives.
      club = await client.club();
    } catch (e) {
      if (!isGone(e)) throw e;
      await forgetDeparted(endpoint, kv);
    }
    if (club !== undefined) {
      // Outside the "gone" check on purpose: a server without PATCH /me answers 404, and that must
      // not cost the still-valid credentials (it would create the duplicate member this prevents).
      // The typed name wins; the server's own is kept when they already agree.
      const renamed = club.me.nickname === nickname ? club.me : await client.renameSelf(nickname);
      return {
        restored: true,
        connection: {
          ...departed,
          clubId: club.club.id,
          clubName: club.club.name,
          memberId: club.me.id,
          nickname: renamed.nickname,
          role: club.me.role,
          // The disclosure was on the screen that asked for this join.
          autoSend: true,
        },
      };
    }
  }
  const api = createClient(endpoint, null, fetchImpl);
  const joined = allowPending
    ? await api.requestJoin(inviteToken, nickname)
    : await api.join(inviteToken, nickname);
  if ('requestToken' in joined) {
    return {
      pending: {
        endpoint,
        requestId: joined.request.id,
        requestToken: joined.requestToken,
        clubName: joined.club.name,
        nickname: joined.request.nickname,
        createdAt: joined.request.createdAt,
        expiresAt: joined.request.expiresAt,
      },
    };
  }
  return {
    restored: false,
    connection: {
      endpoint,
      clubId: joined.club.id,
      clubName: joined.club.name,
      memberId: joined.member.id,
      memberToken: joined.memberToken,
      nickname: joined.member.nickname,
      role: joined.member.role,
      joinedAt: joined.member.joinedAt,
      autoSend: true,
    },
  };
}
