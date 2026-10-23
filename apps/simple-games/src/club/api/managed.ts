import { isClubEndpoint } from '@/storage/schemas';
import { createApiRequest } from './client';
import { ClubApiError } from './errors';
import {
  isCount,
  isObject,
  isText,
  validateClubSettings,
  type ClubSettings,
} from './managementTypes';
import { validateJoinResponse, validateList, type JoinResponse } from './types';

export interface ManagedClub extends ClubSettings {
  id: string;
  name: string;
  endpoint: string;
  createdAt: string;
  memberCount: number;
  status: 'ready' | 'provisioning';
}
export interface OwnerSpace {
  owner: { id: string; plan: 'basic'; validUntil: string; status: 'active' | 'expired' };
  limits: { maxClubs: number; maxMembersPerClub: number };
  clubs: ManagedClub[];
}
export interface ManagedMembership extends JoinResponse {
  endpoint: string;
}
export interface DirectoryPage {
  clubs: ManagedClub[];
  nextCursor: string | null;
}

function check<T>(value: T | null): T {
  if (value === null) throw new ClubApiError('malformed_response', 0);
  return value;
}
function clubValidator(origin: string) {
  return (raw: unknown): ManagedClub | null => {
    const settings = validateClubSettings(raw);
    if (
      !settings ||
      !isObject(raw) ||
      !isText(raw.id) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ||
      !isText(raw.name) ||
      !isText(raw.createdAt) ||
      !isCount(raw.memberCount) ||
      !['ready', 'provisioning'].includes(raw.status as string)
    )
      return null;
    // Never send member credentials to a URL supplied by an unexpected host/path.
    const endpoint = `${origin}/clubs/${raw.id}`;
    if (raw.endpoint !== endpoint || !isClubEndpoint(endpoint)) return null;
    return {
      ...settings,
      id: raw.id,
      name: raw.name,
      endpoint,
      createdAt: raw.createdAt,
      memberCount: raw.memberCount,
      status: raw.status as ManagedClub['status'],
    };
  };
}
export function createManagedClient(
  origin: string,
  ownerToken?: string | null,
  fetchImpl?: typeof fetch,
) {
  if (!isClubEndpoint(origin) || new URL(origin).origin !== origin)
    throw new ClubApiError('invalid_request', 0);
  const request = createApiRequest(origin, ownerToken, fetchImpl);
  const validateClub = clubValidator(origin);
  const membership = (raw: unknown): ManagedMembership => {
    const joined = check(validateJoinResponse(raw));
    const endpoint = `${origin}/clubs/${joined.club.id}`;
    if (!isObject(raw) || raw.endpoint !== endpoint || !isClubEndpoint(endpoint))
      throw new ClubApiError('malformed_response', 0);
    return { ...joined, endpoint };
  };
  return {
    async owner(): Promise<OwnerSpace> {
      const raw = await request('GET', '/managed/owner');
      if (!isObject(raw) || !isObject(raw.owner) || !isObject(raw.limits))
        throw new ClubApiError('malformed_response', 0);
      const owner = raw.owner,
        limits = raw.limits;
      if (
        !isText(owner.id) ||
        owner.plan !== 'basic' ||
        !isText(owner.validUntil) ||
        (owner.status !== 'active' && owner.status !== 'expired') ||
        !isCount(limits.maxClubs) ||
        !isCount(limits.maxMembersPerClub)
      )
        throw new ClubApiError('malformed_response', 0);
      return {
        owner: { id: owner.id, plan: 'basic', validUntil: owner.validUntil, status: owner.status },
        limits: { maxClubs: limits.maxClubs, maxMembersPerClub: limits.maxMembersPerClub },
        clubs: check(validateList(raw.clubs, validateClub)),
      };
    },
    async directory(after?: string): Promise<DirectoryPage> {
      const raw = await request(
        'GET',
        `/managed/directory${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      );
      if (!isObject(raw) || !(raw.nextCursor === null || isText(raw.nextCursor)))
        throw new ClubApiError('malformed_response', 0);
      const clubs = check(validateList(raw.clubs, validateClub));
      if (clubs.some((c) => c.visibility !== 'public'))
        throw new ClubApiError('malformed_response', 0);
      return { clubs, nextCursor: raw.nextCursor };
    },
    async create(name: string, nickname: string, clientId: string): Promise<ManagedMembership> {
      return membership(await request('POST', '/managed/clubs', { name, nickname, clientId }));
    },
    async connect(id: string): Promise<ManagedMembership> {
      const result = membership(
        await request('POST', `/managed/clubs/${encodeURIComponent(id)}/connect`, {}),
      );
      if (result.club.id !== id) throw new ClubApiError('malformed_response', 0);
      return result;
    },
  };
}

/** An idempotency key names an operation, never a device. */
export function operationId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
