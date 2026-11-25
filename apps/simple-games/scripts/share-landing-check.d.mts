/**
 * `share-landing-check.mjs` is release tooling run by node directly, so it is
 * plain JS. These are only the types src/test needs to call it.
 */

/** The address the app shares a game under (packages/brand SHARE_BASE_URL). */
export const SHARE_LANDING_BASE: string;

/** One registry title card as a literal reader sees it. */
export interface RegistryGame {
  id: string;
  title: string;
  glyph: string;
  channel?: 'web-beta' | 'in-development';
}

/** Parses registry.ts without running it; throws on shapes a literal reader could misread. */
export function readRegistryGames(source: string): RegistryGame[];

/** The ids a native build offers and shares: no channel, registry order. */
export function appGameIds(games: readonly RegistryGame[]): string[];

export interface LandingResponse {
  status: number;
  location?: string | null;
  contentType: string;
  body: string;
}

/** Why the response is not the game's own share landing, or null when it is. */
export function landingProblem(id: string, response: LandingResponse): string | null;
