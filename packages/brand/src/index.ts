/**
 * Simple Games by PixApps — brand constants.
 *
 * Simple Games is a label (series name) owned by PixApps, not a separate company.
 * Keep this package tiny: names, taglines, and the shared palette only.
 * Game-specific concepts must not leak into this package.
 */

export const SERIES_NAME = 'Simple Games';
export const SERIES_BY_LINE = 'by PixApps';
export const SERIES_ATTRIBUTION = 'A Simple Game by PixApps';
export const SERIES_CREDIT = 'Simple Games by PixApps';

/**
 * The public repository — part of the product, not just of development:
 * "Honest by design" means every brand promise is verifiable here.
 * The About screen links straight to it.
 */
export const SOURCE_REPO_URL = 'https://github.com/yosuke1024/simple-games';

/**
 * Per-game landing pages (static, on the PixApps site). The app keeps only
 * Quick Rules; long-form rules, examples and FAQs live at
 * `${LANDING_BASE_URL}/games/<game-id>/<locale>/` behind a "Learn More" link.
 */
export const LANDING_BASE_URL = 'https://pixapps.ai/simple-games';

/**
 * Where the in-app "not really" feedback path opens a mail draft. Also the
 * public support address on the store listing and in the privacy policy, so
 * every road leads to the same inbox — which is why this value is not free to
 * drift: Play Console and `docs/PRIVACY_POLICY.md` carry it too
 * (`docs/RELEASE_CHECKLIST.md` §5.5).
 */
export const SUPPORT_EMAIL = 'suzuki.yosuke@pixapps.ai';

/**
 * The collection's Play Store listing — the fallback review destination when
 * the native in-app review card cannot be shown.
 */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.pixapps.simplegames';

/** Primary series message (English). */
export const SERIES_TAGLINE_EN = 'Fully free. Fully offline. Simply playable.';
/** Supporting series message (English). */
export const SERIES_SUBLINE_EN = 'No account. No purchases. No internet required.';
/** Primary series message (Japanese). */
export const SERIES_TAGLINE_JA = '完全無課金。完全オフライン。すぐ遊べる。';

/**
 * The series base: a warm, paper-like surface that stays readable for a long
 * sitting and calm in a dark cabin. Every Simple Games title shares these —
 * they are what makes two different games look like the same series.
 */
export const seriesColors = {
  /** Page background. */
  paper: '#f3f0e9',
  /** Raised surfaces: tiles, cards, rows. */
  surface: '#fffdf8',
  /** Recessed surfaces: a cleared cell. */
  surfaceRecessed: '#e8e4d9',
  /** Hairlines and borders. */
  line: '#ddd7ca',
  /** Primary text. */
  ink: '#232a33',
  /** Secondary text. */
  inkSoft: '#5c6772',

  paperDark: '#14171c',
  surfaceDark: '#212730',
  surfaceRecessedDark: '#1a1f26',
  lineDark: '#333b47',
  inkDark: '#e9e6df',
  inkSoftDark: '#8b95a3',

  /** Gentle warning (game over, destructive confirm). Never alarm-red. */
  warn: '#c2603f',
  warnSoft: '#f6e4db',
  warnDark: '#d9805f',
  warnSoftDark: '#3a2a22',
} as const;

/**
 * One accent per title — the only colour that changes between games. Keeping
 * the base fixed and swapping just this is what lets a new title read as
 * "another Simple Game" at a glance. Add the next game's entry here when it
 * exists; do not invent accents for games that do not.
 */
export const titleAccents = {
  /** Number Match — indigo: quiet in a dark cabin, uncommon among puzzle apps. */
  numberMatch: {
    light: '#3f5b8f',
    /** Text/icons drawn on top of `light`. */
    onLight: '#ffffff',
    /** Tinted surface in the light theme. */
    softLight: '#e2e8f3',
    dark: '#7d9ccf',
    onDark: '#12161c',
    softDark: '#243043',
  },
  /**
   * Sudoku — muted teal. Far enough from the indigo to tell the two games
   * apart at a glance, and still cool and low-saturation so a full grid of
   * accent-coloured entries stays restful to read.
   */
  sudoku: {
    light: '#2f6f62',
    onLight: '#ffffff',
    softLight: '#dcebe6',
    dark: '#6fb3a3',
    onDark: '#101815',
    softDark: '#1e3b34',
  },
  /**
   * Minesweeper — slate blue. The board carries its own colour scale for the
   * numbers, so the chrome stays close to the series ink and lets those
   * numbers be the only thing on screen competing for attention.
   */
  minesweeper: {
    light: '#4a5a72',
    onLight: '#ffffff',
    softLight: '#e3e7ee',
    dark: '#93a4bd',
    onDark: '#12151b',
    softDark: '#262d3a',
  },
  /**
   * Nonogram — muted plum. The board itself is drawn in ink on paper (painted
   * cells carry no accent), so the accent lives in the chrome, the hints and
   * the selection — a quiet violet reads as a marker pen beside the ink, and
   * sits apart from every other title on the collection list.
   */
  nonogram: {
    light: '#6d5192',
    onLight: '#ffffff',
    softLight: '#eae4f2',
    dark: '#a893cf',
    onDark: '#161020',
    softDark: '#2e2740',
  },
  /**
   * Sliding Puzzle — warm clay. The board is a solid field of tiles, so the
   * accent covers more area here than in any other title; a warm, muted tone
   * carries that much surface without shouting.
   */
  slidingPuzzle: {
    light: '#9c5b3c',
    onLight: '#ffffff',
    softLight: '#f2e2d8',
    dark: '#d1926f',
    onDark: '#1a120e',
    softDark: '#3a2820',
  },
  /**
   * Memory Match — dusty rose. The card faces carry their own fifteen-colour
   * symbol palette, so the chrome keeps to one warm, muted hue that none of
   * the symbols use — the accent marks the game, never a card.
   */
  memoryMatch: {
    light: '#9e5468',
    onLight: '#ffffff',
    softLight: '#f2e0e7',
    dark: '#cf8fa4',
    onDark: '#1a1116',
    softDark: '#3a2530',
  },
  /**
   * Water Sort — muted aqua. The tubes carry the game's own nine-colour
   * water palette, so — like Minesweeper — the chrome stays out of the
   * board's way; a watery blue-green marks the game without joining the
   * palette it referees.
   */
  waterSort: {
    light: '#33708c',
    onLight: '#ffffff',
    softLight: '#dfeaf0',
    dark: '#7fb4c9',
    onDark: '#0f171c',
    softDark: '#21333d',
  },
  /**
   * Solitaire — muted felt green. The one color a card table already owns;
   * kept far from the card red so selection and hearts never blur, and
   * desaturated so a full tableau of white cards stays the bright thing on
   * screen.
   */
  solitaire: {
    light: '#557a48',
    onLight: '#ffffff',
    softLight: '#e3ecdf',
    dark: '#97bd8a',
    onDark: '#121810',
    softDark: '#273a22',
  },
} as const;

export type SeriesColors = typeof seriesColors;
export type TitleAccent = (typeof titleAccents)[keyof typeof titleAccents];
