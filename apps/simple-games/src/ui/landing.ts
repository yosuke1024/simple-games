/**
 * Where "Learn More" goes: the per-game landing pages on the PixApps site
 * (docs/plans/2026-07-30-collection-and-sudoku.md §8). The app keeps only Quick
 * Rules; long-form rules, examples and FAQs live there.
 *
 * The link is offered only for locales that actually have a page. A "Learn
 * More" that lands on a 404 is worse than no link — and in the browser build
 * (docs/WEB_VERSION.md) it would 404 inside our own site, in front of a
 * first-time visitor.
 *
 * A language appears here only once someone has written every published guide
 * in it, because long-form rules are exactly the kind of text that must not be
 * machine-translated at scale (docs/I18N_POLICY.md). The app ships fourteen
 * locales, so the rest read the English page — which is honest, if not ideal,
 * and better than either a 404 or a machine-translated rulebook.
 *
 * Titles with no guide on the landing site yet (Memory Match, Water Sort,
 * Solitaire) simply do not render a "Learn More" button; building a URL here
 * would 404 for every locale.
 */
import { LANDING_BASE_URL } from '@simple-games/brand';

/** Set to false if the pages ever come down; it is what keeps 404s away. */
const GAME_PAGES_PUBLISHED = true;

/**
 * The written languages, and the same list as LOCALES in the landing site's
 * tools/game-guides-content.js. Everything else falls back to English.
 * Adding one here before the pages are deployed is how you ship a 404.
 */
const PAGE_LOCALES = ['en', 'ja', 'es'] as const;

/** The game's landing page, or null while there is nothing to link to. */
export function gameLandingUrl(gameId: string, locale: string): string | null {
  if (!GAME_PAGES_PUBLISHED) return null;
  const pageLocale = (PAGE_LOCALES as readonly string[]).includes(locale) ? locale : 'en';
  return `${LANDING_BASE_URL}/games/${gameId}/${pageLocale}/`;
}
