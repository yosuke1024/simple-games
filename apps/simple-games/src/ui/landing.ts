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
 * Only English and Japanese are written: those are the two languages that get a
 * human review (docs/I18N_POLICY.md), and long-form rules are exactly the kind
 * of text that must not be machine-translated at scale. The app ships fourteen
 * locales, so the other twelve read the English page — which is honest, if not
 * ideal, and better than either a 404 or a machine-translated rulebook.
 */
import { LANDING_BASE_URL } from '@simple-games/brand';

/** Set to false if the pages ever come down; it is what keeps 404s away. */
const GAME_PAGES_PUBLISHED = true;

/** The written languages. Everything else falls back to English. */
const PAGE_LOCALES = ['en', 'ja'] as const;

/** The game's landing page, or null while there is nothing to link to. */
export function gameLandingUrl(gameId: string, locale: string): string | null {
  if (!GAME_PAGES_PUBLISHED) return null;
  const pageLocale = (PAGE_LOCALES as readonly string[]).includes(locale) ? locale : 'en';
  return `${LANDING_BASE_URL}/games/${gameId}/${pageLocale}/`;
}
