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
 * A title earns its link by having a page, not by shipping: the id has to be
 * in PUBLISHED_GAME_IDS below, which is the list of guides actually deployed
 * on the landing site. A "Learn More" wired up before the page exists is a 404
 * inside our own site, in front of a first-time visitor — so a new game ships
 * without the button, and the button appears in the release that follows its
 * guide.
 */
import { LANDING_BASE_URL } from '@simple-games/brand';

/** Set to false if the pages ever come down; it is what keeps 404s away. */
const GAME_PAGES_PUBLISHED = true;

/**
 * The written languages, and the same list as LOCALES in the landing site's
 * tools/game-guides-content.js. Everything else falls back to English.
 * Adding one here before the pages are deployed is how you ship a 404.
 */
const PAGE_LOCALES = ['en', 'ja', 'es', 'pt-br', 'fr', 'id', 'de', 'th', 'vi', 'ko'] as const;

/**
 * The titles whose guides are live at `${LANDING_BASE_URL}/games/<id>/<locale>/`
 * in every PAGE_LOCALES language. All thirty shipped titles have one. The
 * mechanism stays: a future title ships without an entry until its guides are
 * deployed, and until then the tutorial simply ends without a "Learn More" —
 * which is honest, where a dead link would not be.
 */
const PUBLISHED_GAME_IDS: readonly string[] = [
  'sudoku',
  'minesweeper',
  'nonogram',
  'number-match',
  'sliding-puzzle',
  'solitaire',
  'brick-breaker',
  'water-sort',
  'memory-match',
  'sky-fighter',
  'spider-solitaire',
  'freecell',
  '2048',
  'block-puzzle',
  'checkers',
  'reversi',
  'connect-four',
  'gomoku',
  'quick-math',
  'schulte-table',
  'number-recall',
  'bunny-hop',
  'hearts',
  'gin-rummy',
  'mahjong-solitaire',
  'ludo',
  'bubble-pop',
  'takuzu',
  'futoshiki',
  'kakuro',
];

/** The game's landing page, or null while there is nothing to link to. */
export function gameLandingUrl(gameId: string, locale: string): string | null {
  if (!GAME_PAGES_PUBLISHED) return null;
  if (!PUBLISHED_GAME_IDS.includes(gameId)) return null;
  const pageLocale = (PAGE_LOCALES as readonly string[]).includes(locale) ? locale : 'en';
  return `${LANDING_BASE_URL}/games/${gameId}/${pageLocale}/`;
}
