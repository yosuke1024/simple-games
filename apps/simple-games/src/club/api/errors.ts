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
