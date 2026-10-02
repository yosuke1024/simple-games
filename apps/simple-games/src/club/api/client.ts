/**
 * The Club server's HTTP client (docs/architecture/club.md §5, §10) and the
 * only file under src/ outside services/ that touches `fetch`. One operation
 * is one request; 10-second timeout; no retry, no timer-driven anything.
 * The member token goes in the Authorization header and nowhere else.
 */
import { ClubApiError, SERVER_ERROR_CODES, type ClubErrorCode } from './errors';
import {
  validateChallenge,
  validateClub,
  validateClubRecord,
  validateClubResponse,
  validateHosting,
  validateInviteResponse,
  validateJoinResponse,
  validateList,
  validateResult,
  type Challenge,
  type ChallengeCreate,
  type Club,
  type ClubRecord,
  type ClubResponse,
  type Hosting,
  type InviteResponse,
  type JoinResponse,
  type Result,
  type ResultSubmission,
} from './types';

export interface ClubClient {
  readonly endpoint: string;
  /** `open`: the deployment accepts a join with a nickname alone (the Public Club House). */
  health(): Promise<{ ok: boolean; api: number; claimed: boolean; open: boolean }>;
  /** A null token joins an open server (the Public Club House). */
  join(inviteToken: string | null, nickname: string): Promise<JoinResponse>;
  club(): Promise<ClubResponse>;
  challenges(options?: { after?: string; daily?: string }): Promise<Challenge[]>;
  challenge(id: string): Promise<Challenge>;
  createChallenge(body: ChallengeCreate): Promise<Challenge>;
  results(id: string): Promise<Result[]>;
  submitResult(id: string, body: ResultSubmission): Promise<Result>;
  records(): Promise<ClubRecord[]>;
  hosting(): Promise<Hosting>;
  invite(): Promise<InviteResponse>;
  rotateInvite(): Promise<InviteResponse>;
  removeMember(id: string): Promise<void>;
  deleteChallenge(id: string): Promise<void>;
  renameClub(name: string): Promise<Club>;
}

export const REQUEST_TIMEOUT_MS = 10_000;

const malformed = (status: number): ClubApiError =>
  new ClubApiError('malformed_response', status, 'Unexpected response shape');

function errorCodeOf(body: unknown): ClubErrorCode {
  if (typeof body === 'object' && body !== null) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'object' && error !== null) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string' && (SERVER_ERROR_CODES as readonly string[]).includes(code)) {
        return code as ClubErrorCode;
      }
    }
  }
  return 'internal_error';
}

export function createClient(
  endpoint: string,
  memberToken?: string | null,
  fetchImpl?: typeof fetch,
): ClubClient {
  const base = `${endpoint}/api/v1`;

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (memberToken) headers.Authorization = `Bearer ${memberToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ClubApiError('unreachable', null, 'No response');
    } finally {
      clearTimeout(timer);
    }
    if (response.headers.get('X-Club-Api') !== '1') {
      throw new ClubApiError('unsupported_server', response.status, 'Unsupported server');
    }
    if (response.status === 204) return undefined;
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }
    if (!response.ok) {
      throw new ClubApiError(errorCodeOf(json), response.status);
    }
    if (json === undefined) throw malformed(response.status);
    return json;
  }

  function check<T>(value: T | null): T {
    if (value === null) throw malformed(0);
    return value;
  }

  return {
    endpoint,
    async health() {
      const raw = await request('GET', '/health');
      if (typeof raw !== 'object' || raw === null) throw malformed(0);
      const r = raw as Record<string, unknown>;
      if (typeof r.ok !== 'boolean' || typeof r.api !== 'number') throw malformed(0);
      return { ok: r.ok, api: r.api, claimed: r.claimed === true, open: r.open === true };
    },
    async join(inviteToken, nickname) {
      return check(
        validateJoinResponse(
          await request(
            'POST',
            '/join',
            inviteToken === null ? { nickname } : { inviteToken, nickname },
          ),
        ),
      );
    },
    async club() {
      return check(validateClubResponse(await request('GET', '/club')));
    },
    async challenges(options) {
      const parts: string[] = [];
      if (options?.after !== undefined) parts.push(`after=${encodeURIComponent(options.after)}`);
      if (options?.daily !== undefined) parts.push(`daily=${encodeURIComponent(options.daily)}`);
      const query = parts.length === 0 ? '' : `?${parts.join('&')}`;
      return check(validateList(await request('GET', `/challenges${query}`), validateChallenge));
    },
    async challenge(id) {
      return check(
        validateChallenge(await request('GET', `/challenges/${encodeURIComponent(id)}`)),
      );
    },
    async createChallenge(body) {
      return check(validateChallenge(await request('POST', '/challenges', body)));
    },
    async results(id) {
      return check(
        validateList(
          await request('GET', `/challenges/${encodeURIComponent(id)}/results`),
          validateResult,
        ),
      );
    },
    async submitResult(id, body) {
      return check(
        validateResult(
          await request('POST', `/challenges/${encodeURIComponent(id)}/results`, body),
        ),
      );
    },
    async records() {
      return check(validateList(await request('GET', '/records'), validateClubRecord));
    },
    async hosting() {
      return check(validateHosting(await request('GET', '/hosting')));
    },
    async invite() {
      return check(validateInviteResponse(await request('GET', '/invite')));
    },
    async rotateInvite() {
      return check(validateInviteResponse(await request('POST', '/invite', { role: 'member' })));
    },
    async removeMember(id) {
      await request('DELETE', `/members/${encodeURIComponent(id)}`);
    },
    async deleteChallenge(id) {
      await request('DELETE', `/challenges/${encodeURIComponent(id)}`);
    },
    async renameClub(name) {
      return check(validateClub(await request('PATCH', '/club', { name })));
    },
  };
}
