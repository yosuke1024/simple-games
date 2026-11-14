/**
 * Club House features that ship switched off (docs/architecture/club.md §14, decision 44).
 * One leaf file with no imports, so the shell (`app/clubGate.ts`) and the Club
 * layer can both read it without a dependency in either direction
 * (src/test/importBoundaries.test.ts).
 */

/**
 * Private Clubs — joining a self-hosted Club by invite link and the owner's
 * invite panel. They were meant to arrive with the host flow (club.md §8),
 * which the product owner declined on 2026-11-14 (club.md §14, decision 56),
 * so this stays false. While it is false only managed invites (switched on
 * separately below) are taken: a self-hosted Club's link is refused when
 * pasted, its web invite URL is not acted on, and a self-hosted Club has no
 * invite panel. The code stays so that turning it on is this one line.
 */
export const PRIVATE_CLUBS_ENABLED = false;

/**
 * Managed Club Houses — Trial clubs, owner tools and their invites — are served
 * by the same deployment as the Public Club House, on its origin
 * (docs/architecture/managed-clubs.md §7). While this is false no managed
 * service is advertised or contacted; turning it on is this one line, after
 * the server at that origin carries managed hosting.
 */
export const MANAGED_CLUBS_ENABLED = true;

/**
 * The origin PixApps serves managed Club Houses from: the Public Club House's
 * (`club/public.ts` `PUBLIC_CLUB_ENDPOINT`, restated because this file imports
 * nothing; `src/club/managed.test.ts` keeps the two equal).
 */
export const PIXAPPS_CLUB_ORIGIN = 'https://club.pixapps.ai';

/** A build-time override for staging and local checks only; the release workflows never set it. */
function managedOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const url = new URL(value);
    if (url.origin !== value) return null;
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
      ? value
      : null;
  } catch {
    return null;
  }
}

export const MANAGED_CLUB_ORIGIN =
  managedOrigin(import.meta.env.VITE_MANAGED_CLUB_ORIGIN) ??
  (MANAGED_CLUBS_ENABLED ? PIXAPPS_CLUB_ORIGIN : null);
