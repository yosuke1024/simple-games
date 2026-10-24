/**
 * Invite URLs (docs/architecture/club.md §7-1): `https://<endpoint>/join#invite=<token>`.
 * The token rides in the fragment, so it never reaches a server log; the
 * endpoint is the URL's origin and must pass the same rule as a stored
 * connection (https, or http to the loopback for development).
 */
import { isClubEndpoint } from '@/storage/schemas';
import type { ClubInvite } from '@/ui/clubBridge';

const TOKEN = /(?:^#|&)invite=([A-Za-z0-9_-]{16,128})(?:&|$)/;

export function inviteFromHref(href: string): ClubInvite | null {
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return null;
  }
  if (!/\/join\/?$/.test(url.pathname)) return null;
  const match = TOKEN.exec(url.hash);
  if (match === null) return null;
  const params = new URLSearchParams(url.hash.slice(1));
  const club = params.get('club');
  if (params.getAll('club').length > 1 || params.getAll('invite').length !== 1) return null;
  if (club !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(club)) return null;
  const endpoint = club === null ? url.origin : `${url.origin}/clubs/${club}`;
  if (!isClubEndpoint(endpoint)) return null;
  return { endpoint, token: match[1]! };
}
