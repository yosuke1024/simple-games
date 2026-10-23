/**
 * Club House features that ship switched off (docs/architecture/club.md §14, decision 44).
 * One leaf file with no imports, so the shell (`app/clubGate.ts`) and the Club
 * layer can both read it without a dependency in either direction
 * (src/test/importBoundaries.test.ts).
 */

/**
 * Private Clubs — joining by invite link and the owner's invite panel — arrive
 * in the next version. While this is false there is no "Join with a link"
 * entry, a web invite URL is not acted on, and the invite panel is not
 * reachable; the code stays so that turning it on is this one line.
 */
export const PRIVATE_CLUBS_ENABLED = false;

/** Hosting is opt-in per build. No origin means no managed service is advertised or contacted. */
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

export const MANAGED_CLUB_ORIGIN = managedOrigin(import.meta.env.VITE_MANAGED_CLUB_ORIGIN);
