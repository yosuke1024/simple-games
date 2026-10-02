/** Errors of the Club API client (docs/architecture/club.md §5-1, §10). */
export type ClubErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'already_submitted'
  | 'board_mismatch'
  | 'invite_expired'
  | 'setup_key_used'
  | 'last_owner'
  | 'too_many_owners'
  | 'too_many_members'
  | 'too_large'
  | 'rate_limited'
  | 'internal_error'
  | 'unsupported_version'
  /** Network failure or timeout: no response. */
  | 'unreachable'
  /** `X-Club-Api` missing or not '1' (club.md §10). */
  | 'unsupported_server'
  /** JSON not in the §5-2 shape. */
  | 'malformed_response';

export const SERVER_ERROR_CODES: readonly ClubErrorCode[] = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'already_submitted',
  'board_mismatch',
  'invite_expired',
  'setup_key_used',
  'last_owner',
  'too_many_owners',
  'too_many_members',
  'too_large',
  'rate_limited',
  'internal_error',
  'unsupported_version',
];

/**
 * Codes a retry can never turn into success (club.md §10): a result answered
 * with one of these is dropped, not queued. The first four are §10's list;
 * the rest refuse the body itself, and a queued item answered that way would
 * sit at the head of its Club's queue and block everything behind it. A server
 * whose `X-Club-Api` this client does not know is final too: §10 says nothing
 * more is sent to it, and a queued result would be re-sent on every opening.
 */
export const FINAL_CODES: ReadonlySet<ClubErrorCode> = new Set<ClubErrorCode>([
  'already_submitted',
  'board_mismatch',
  'not_found',
  'unauthorized',
  'invalid_request',
  'forbidden',
  'too_large',
  'unsupported_version',
  'unsupported_server',
]);

export const isFinalError = (error: unknown): boolean =>
  error instanceof ClubApiError && FINAL_CODES.has(error.code);

export class ClubApiError extends Error {
  readonly code: ClubErrorCode;
  readonly status: number | null;

  constructor(code: ClubErrorCode, status: number | null, message?: string) {
    super(message ?? code);
    this.name = 'ClubApiError';
    this.code = code;
    this.status = status;
  }
}
