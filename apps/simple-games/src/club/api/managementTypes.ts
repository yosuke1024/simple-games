/** Additive Club House management contracts; old servers continue to use API v1. */
import {
  validateClub,
  validateJoinResponse,
  validateList,
  type Club,
  type JoinResponse,
} from './types';

export interface ClubSettings {
  visibility: 'public' | 'private';
  approvalRequired: boolean;
  allowedGameIds: string[] | null;
}
export interface Admission extends ClubSettings {
  club: { id: string; name: string };
  memberCount: number;
}
export interface JoinApplication {
  id: string;
  nickname: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
}
export interface PendingJoinResponse {
  status: 'pending';
  club: Club;
  request: JoinApplication;
  requestToken: string;
}
export type JoinStatus = {
  status: JoinApplication['status'];
  request?: JoinApplication;
  club: Club;
} & Partial<JoinResponse>;

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const isText = (v: unknown): v is string => typeof v === 'string';

export function validateClubSettings(raw: unknown): ClubSettings | null {
  if (
    !isObject(raw) ||
    (raw.visibility !== 'public' && raw.visibility !== 'private') ||
    typeof raw.approvalRequired !== 'boolean'
  )
    return null;
  if (
    raw.allowedGameIds !== null &&
    (!Array.isArray(raw.allowedGameIds) ||
      !raw.allowedGameIds.every((id) => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)))
  )
    return null;
  return {
    visibility: raw.visibility,
    approvalRequired: raw.approvalRequired,
    allowedGameIds: raw.allowedGameIds as string[] | null,
  };
}
export function validateAdmission(raw: unknown): Admission | null {
  const settings = validateClubSettings(raw);
  if (
    !settings ||
    !isObject(raw) ||
    !isObject(raw.club) ||
    !isText(raw.club.id) ||
    !isText(raw.club.name) ||
    !isCount(raw.memberCount)
  )
    return null;
  return {
    ...settings,
    club: { id: raw.club.id, name: raw.club.name },
    memberCount: raw.memberCount,
  };
}
export function validateJoinApplication(raw: unknown): JoinApplication | null {
  if (
    !isObject(raw) ||
    !isText(raw.id) ||
    !isText(raw.nickname) ||
    !isText(raw.createdAt) ||
    !isText(raw.expiresAt) ||
    !['pending', 'approved', 'rejected', 'cancelled', 'expired'].includes(raw.status as string)
  )
    return null;
  return {
    id: raw.id,
    nickname: raw.nickname,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
    status: raw.status as JoinApplication['status'],
  };
}
export function validateJoinOrPending(raw: unknown): JoinResponse | PendingJoinResponse | null {
  if (isObject(raw) && raw.status === 'pending') {
    const club = validateClub(raw.club);
    const request = validateJoinApplication(raw.request);
    if (
      !club ||
      !request ||
      request.status !== 'pending' ||
      !isText(raw.requestToken) ||
      raw.requestToken.length < 16
    )
      return null;
    return { status: 'pending', club, request, requestToken: raw.requestToken };
  }
  return validateJoinResponse(raw);
}
export function validateJoinStatus(raw: unknown): JoinStatus | null {
  if (!isObject(raw)) return null;
  // Once approved, the member token itself is the durable receipt. The
  // bounded pending-request ledger no longer has to retain an application.
  if (raw.status === 'approved') {
    const joined = validateJoinResponse(raw);
    if (!joined) return null;
    return { ...joined, status: 'approved' };
  }
  const club = validateClub(raw.club);
  const request = validateJoinApplication(raw.request);
  if (!club || !request || raw.status !== request.status) return null;
  return { status: request.status, request, club };
}
export function validateApplicationDecision(raw: unknown): JoinApplication | null {
  if (!isObject(raw)) return null;
  const application = validateJoinApplication(raw.request);
  return application && raw.status === application.status ? application : null;
}
export const validateApplications = (raw: unknown): JoinApplication[] | null =>
  validateList(raw, validateJoinApplication);
