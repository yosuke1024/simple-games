/**
 * Simple Games by PixApps — brand constants.
 *
 * Simple Games is a label (series name) owned by PixApps, not a separate company.
 * Keep this package tiny: names, shared URLs, and the palette only.
 * Game-specific concepts must not leak into this package.
 *
 * Marketing copy does not belong here. On-screen wording lives in the locale
 * catalogs, where the `Messages` type forces every shipped language to carry it;
 * store and screenshot copy lives in docs/BRAND.md. A hard-coded English and
 * Japanese pair could serve neither: it covers two languages, not the catalog,
 * and because nothing imports it, it drifts out of step with the wording rules
 * in docs/BRAND.md without anything failing.
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
 * The privacy policy and terms of use. These pages are the SINGLE SOURCE for
 * both documents (2026-08-02): the app links to them instead of carrying its
 * own copy.
 *
 * The copy it used to carry was five bundled sentences in fourteen languages,
 * which meant the same facts lived in three places and had to be kept in step
 * by hand — and twelve of those languages were machine translations of exactly
 * the wording docs/I18N_POLICY.md names as "a mistranslation here hands out a
 * promise we cannot keep". One page, reviewed once, beats fourteen copies
 * nobody has read.
 *
 * The cost is real and deliberate: these need a connection. Offline they do
 * nothing, like the GitHub links beside them. What a player can still read
 * offline is the part that affects them directly — what deleting their data
 * removes, and that one banner and one optional purchase exist — because
 * those strings are needed by the Settings screen anyway.
 */
export const PRIVACY_URL = `${LANDING_BASE_URL}/privacy`;
export const TERMS_URL = `${LANDING_BASE_URL}/terms`;

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
  /**
   * Brick Breaker — ochre. The bricks themselves are drawn in the accent, so
   * it has to carry a full wall without shouting; a muted brick-yellow is the
   * one warm slot the series still had open, a clear step yellower than
   * Sliding Puzzle's clay.
   */
  brickBreaker: {
    light: '#8a6a2b',
    onLight: '#ffffff',
    softLight: '#f0e8d3',
    dark: '#c9a765',
    onDark: '#191308',
    softDark: '#3a3018',
  },
  /**
   * Sky Fighter — dusk blue. The enemy craft are drawn in the accent (the
   * player flies in ink), so the sky's color is the *other* side's color: a
   * violet-leaning evening blue, kept between Number Match's navy and
   * Nonogram's plum without touching either, and away from Water Sort's aqua.
   */
  skyFighter: {
    light: '#5d5aa8',
    onLight: '#ffffff',
    softLight: '#e7e6f4',
    dark: '#9d9be0',
    onDark: '#131226',
    softDark: '#2b2a4a',
  },
  /**
   * 2048 — jade. The board is a full field of tiles drawn in tints of the
   * accent, so it covers more area than in any other title and has to stay
   * calm at every value. Green also settles the one question this title
   * raises: the original 2048 is a warm sand palette, and the series does not
   * imitate another game's look (docs/BRAND.md). It sits between Solitaire's
   * felt green and Sudoku's teal, greener and lighter than either.
   */
  game2048: {
    light: '#2b7d59',
    onLight: '#ffffff',
    softLight: '#dcece4',
    dark: '#79c39c',
    onDark: '#0f1a15',
    softDark: '#1e3a2d',
  },
  /**
   * Block Puzzle — orchid. Placed blocks are drawn in the accent and stay on
   * the board for the whole game, so this is the second-largest accent area in
   * the collection; a muted magenta carries it without shouting. It takes the
   * one hue gap left between Nonogram's plum and Memory Match's rose.
   */
  blockPuzzle: {
    light: '#8b4f80',
    onLight: '#ffffff',
    softLight: '#f0e2ee',
    dark: '#c795bd',
    onDark: '#1c1019',
    softDark: '#3a2a38',
  },
  /**
   * Bunny Hop — meadow. The bushes, fences and birds are drawn in the accent
   * while the rabbit and the ground are ink, so the accent is what the player
   * reads as "in the way"; a grass green keeps that legible against both
   * papers without turning the meadow into a warning sign. It takes the
   * yellow-green gap between Solitaire's felt green and Brick Breaker's ochre
   * — the two neighbours it must not be mistaken for on the collection home.
   */
  bunnyHop: {
    light: '#6e7a34',
    onLight: '#ffffff',
    softLight: '#e8ecd6',
    dark: '#b6c274',
    onDark: '#171a0d',
    softDark: '#343a1c',
  },
  /**
   * Reversi — violet. The board is felt and black-and-white discs (all of it
   * game content), so the accent lives in the chrome alone; even the mark on
   * the last disc played is drawn in the other disc's colour, because a
   * single accent cannot be legible on black and white at once.
   *
   * It was moss until Bunny Hop landed with a meadow green one shade away
   * (#6e7a34 against #6d7a3a) — two titles that would have been the same
   * colour on the collection home. Violet is the widest gap the series has
   * left, between Nonogram's plum and Block Puzzle's orchid, and it is the
   * more saturated and bluer of the three; with fifteen titles the palette
   * holds families rather than fifteen separate hues, and this one says so
   * plainly rather than pretending otherwise.
   */
  reversi: {
    light: '#7f4a9c',
    onLight: '#ffffff',
    softLight: '#ece2f4',
    dark: '#c48ad6',
    onDark: '#1b1020',
    softDark: '#33253f',
  },
  /**
   * Connect Four — muted red. Here the accent *is* the player's disc, so it
   * has to hold its own against the opponent's fixed teal at arm's length:
   * red against blue-green is the one high-contrast pair that survives the
   * common colour-vision deficiencies, and the winning line is ringed as
   * well as coloured so the ending never rests on hue alone. Red was the
   * last hue family the series had not used — Sliding Puzzle's clay is
   * orange and Memory Match's rose is pink, and this sits squarely between
   * them. It is desaturated well past the warning colour (`warn`), which no
   * game may be mistaken for.
   */
  connectFour: {
    light: '#a8433d',
    onLight: '#ffffff',
    softLight: '#f5e0dd',
    dark: '#dd8f89',
    onDark: '#1e100e',
    softDark: '#3f2320',
  },
  /**
   * Spider Solitaire — a deeper, truer green than Solitaire's felt. Both are
   * card tables, so both belong in the green a card table has always been; the
   * pair reads as two games of one family without blurring, because this one is
   * greener and colder (dE 22 apart, where the closest pair already shipped is
   * dE 11). Green also keeps the accent away from the card red: this title
   * shows more face-down cards than any other, and their backs are drawn in
   * `--accent-ring-soft` — a warm accent would make a back and a heart answer
   * to the same glance.
   */
  spiderSolitaire: {
    light: '#31802f',
    onLight: '#ffffff',
    softLight: '#dff5de',
    dark: '#7fcc7d',
    onDark: '#0c1a0c',
    softDark: '#183a17',
  },
  /**
   * FreeCell — deep indigo. This was violet until Reversi shipped and took
   * that gap for the same reason this title wanted it; measured against the
   * merged palette the two were dE 10.6 apart in light and dE 2.3 in dark,
   * which is not two colours. Indigo is the slot left: dE 23 from Nonogram's
   * plum and from Sky Fighter's dusk blue, which it separates from by being
   * far darker and more saturated rather than by hue.
   *
   * It is the darkest accent in the series, and that suits the one solitaire
   * where nothing is hidden — every card face up from the deal, the whole
   * problem visible at once. It also sits directly under Solitaire on the
   * collection home, so it takes a hue far from felt green rather than
   * becoming a third card-table colour.
   */
  freecell: {
    light: '#25256a',
    onLight: '#ffffff',
    softLight: '#e0e0f2',
    dark: '#6e6ecf',
    onDark: '#060614',
    softDark: '#1e1e42',
  },
  /**
   * Quick Math — mustard. The board is an equation in ink with one accent
   * blank, so the accent covers almost nothing here and can afford to be the
   * saturated one: it marks the slot being filled in and nothing else. Yellow
   * is the pencil-and-workbook colour, and it takes the gap between Brick
   * Breaker's ochre and Bunny Hop's meadow — the two it must not be mistaken
   * for on the collection home. It is darker and purer than either, which is
   * what separates three neighbours fifteen degrees apart.
   */
  quickMath: {
    light: '#776e18',
    onLight: '#ffffff',
    softLight: '#eeead0',
    dark: '#c4ba6b',
    onDark: '#191807',
    softDark: '#39351a',
  },
  /**
   * Schulte Table — petrol. The grid is deliberately colourless (a coloured
   * cell would be doing the searching, docs/SCHULTE_TABLE_RULES.md §1), so the
   * accent lives on the one number above the board that says what to look for.
   * It sits between Sudoku's muted teal and Water Sort's aqua and is far more
   * saturated than both, which is how three titles share a hue family without
   * sharing a colour — the same trick Minesweeper's slate and Number Match's
   * indigo already play three degrees apart.
   */
  schulteTable: {
    light: '#18787b',
    onLight: '#ffffff',
    softLight: '#dbecec',
    dark: '#6cbcc1',
    onDark: '#0d1a1b',
    softDark: '#1d3739',
  },
  /**
   * Number Recall — deep emerald. Tiles are told apart by their face rather
   * than by hue (a colour-coded face-down tile would hand a different game to a
   * player with a colour vision deficiency), so the accent marks the number
   * wanted next and the ring around a missed tile.
   *
   * It took the gap between Solitaire's felt green and 2048's jade — and then
   * Spider Solitaire landed in the same gap while this branch was open,
   * `#31802f` / `#7fcc7d`. Against the first choice (`#2f7a3e` / `#76c37f`)
   * that measured ΔE 11.0 light and 6.2 dark, and 6.2 would have been the
   * closest pair in the whole collection (the existing closest is 7.9). So the
   * green went deeper and more saturated: Spider is now 14.5 / 15.1 away, and
   * the nearest colour of any title is 2048 at 14.4 light / 12.4 dark. The
   * wheel is full either way — the next title differentiates by lightness and
   * saturation, not by hue (docs/BRAND.md「アクセントを選ぶ手順」).
   */
  numberRecall: {
    light: '#1d6b33',
    onLight: '#ffffff',
    softLight: '#dcefe2',
    dark: '#92dfa8',
    onDark: '#0b1a10',
    softDark: '#1c3a27',
  },
  /**
   * Checkers — walnut. The accent *is* the player's twelve pieces, so this is
   * one of the largest accent areas in the collection, and a wooden draughts
   * set is what the colour should say before anything else; the opponent takes
   * the game's own slate, which is the pair that survives a colour vision
   * deficiency (games/checkers/ui/checkers.css).
   *
   * Measured against all twenty shipped titles it is ΔE 26.8 from Sliding
   * Puzzle's clay in light and ΔE 15.8 from Brick Breaker's ochre in dark —
   * comfortably past the floor, which is the closest pair already shipped
   * (10.9 light, 7.9 dark). The warm quarter of the wheel holds four titles
   * within thirty degrees, so what separates this one is not hue but value:
   * at L27% it is the darkest and least saturated of the five, where Brick
   * Breaker's ochre and Quick Math's mustard are light and pure
   * (docs/BRAND.md「アクセントを選ぶ手順」).
   */
  checkers: {
    light: '#5a4632',
    onLight: '#ffffff',
    softLight: '#ede6de',
    dark: '#cbb08a',
    onDark: '#161310',
    softDark: '#36302b',
  },
  /**
   * Gomoku — peony. The board is black and white stones on a wood field, all
   * of it game content, so the accent lives in the chrome alone (Reversi's
   * arrangement) and can afford to be the saturated one: it never has to sit
   * behind a stone.
   *
   * The magenta band between Reversi's violet, Block Puzzle's orchid and
   * Memory Match's rose is the widest gap the wheel has left at twenty-one
   * titles, and this takes it by being deeper and far more saturated than any
   * of the three: ΔE 22.2 from Block Puzzle in light, 16.2 in dark, against
   * floors of 10.9 and 7.9. It is a magenta rather than a pink on purpose —
   * Memory Match already holds the muted rose, and two quiet pinks would be
   * one colour on the collection home.
   */
  gomoku: {
    light: '#a32d76',
    onLight: '#ffffff',
    softLight: '#f3d8e9',
    dark: '#e086bb',
    onDark: '#190d15',
    softDark: '#3c2533',
  },
  /**
   * Hearts — steel blue. The one title whose name names the colour it cannot
   * have. Its board is a felt table covered in red hearts and diamonds, and
   * the series red is Connect Four's, which measures ΔE 3.1 from the card red
   * all three solitaires draw (#b0483f) — the same colour, not a neighbour of
   * it. A third card-table green is closed too; FreeCell refused that slot for
   * the same reason. Blue is what the wheel had left, and it suits the work
   * the accent does here: it marks which cards may legally be played, so it
   * sits on white card faces among red and black pips and must be neither
   * (ΔE 86.9 from the card red, 58.4 from the black of Q♠).
   *
   * Four blues already ship, so this one separates by saturation rather than by
   * hue — the move docs/BRAND.md prescribes once the wheel is full. At S67% it
   * is the most saturated blue by a wide margin (Minesweeper's slate is 21%,
   * Number Match's indigo 39%, Water Sort's aqua 47%) and sits level with the
   * two most saturated colours the series has, Schulte Table's petrol and Quick
   * Math's mustard. Measured against all twenty-two: ΔE 15.5 from Sky Fighter in
   * light, 12.2 from Water Sort in dark, against floors of 10.9 and 7.9
   * (docs/BRAND.md「アクセントを選ぶ手順」).
   */
  hearts: {
    light: '#2763c4',
    onLight: '#ffffff',
    softLight: '#dce3ef',
    dark: '#96bde4',
    onDark: '#0e141b',
    softDark: '#23303e',
  },
  /**
   * Gin Rummy — deep violet. The accent is chrome alone here (the deadwood
   * count and the knock button; the cards themselves are game content), which
   * is the arrangement that can afford to be the saturated one — Gomoku's
   * reasoning. Like Hearts it may not be red, because the ♢ on its own cards
   * is, and it may not be a card-table green.
   *
   * It shares Reversi's hue, 282° against 285°, and separates the way the
   * series separates colours now: by depth and saturation rather than by hue.
   * L38% S56% against Reversi's L45% S36% is ΔE 16.7 in light and 27.9 in dark
   * (floors 10.9 / 7.9), and the two are never adjacent — Reversi is on the
   * board shelf, this is the last tile of the cards shelf, directly under
   * FreeCell's indigo at ΔE 30.8 light / 28.8 dark.
   */
  ginRummy: {
    light: '#772b97',
    onLight: '#ffffff',
    softLight: '#e9dcef',
    dark: '#b35dd5',
    onDark: '#170e1b',
    softDark: '#36233e',
  },
  /**
   * Takuzu — wine. The board is a field of noughts and ones drawn in ink on two
   * quiet ground tints of its own, so the accent stays in the chrome and on the
   * selected cell: a small area, which is why it can be a mid-tone rather than
   * the near-black a large one would need.
   *
   * At twenty-two titles no hue is free — a sweep in 1° steps found an existing
   * accent within 30° of every band — so this is separated by depth and
   * saturation inside the magenta quarter, sitting below Gomoku's peony and
   * beside Block Puzzle's orchid without being either: ΔE 14.6 from Block
   * Puzzle in light and 9.8 from Gomoku in dark, against floors of 10.9 and
   * 7.9. It is also the tile that shares the logic shelf with Nonogram's plum,
   * where the grid puts them one row apart; that pair measures 29.4 light and
   * 25.5 dark, so the two read as different colours where it matters most.
   *
   * Re-measured when Hearts and Gin Rummy merged: 55.6 / 44.0 from Hearts and
   * 39.4 / 44.9 from Gin Rummy, so the magenta quarter still holds it.
   */
  takuzu: {
    light: '#88355e',
    onLight: '#ffffff',
    softLight: '#f1dce6',
    dark: '#cb7ea4',
    onDark: '#1c0c14',
    softDark: '#3d202e',
  },
  /**
   * Futoshiki — pine. The board is digits and inequality signs in ink, with the
   * accent on the selected cell, its row and column, and the digit pad, so like
   * Sudoku's teal this is a colour a whole grid of entries has to stay restful
   * under — which is why it is deep and only moderately saturated rather than
   * the brighter green the gap could have taken.
   *
   * The green quarter is the collection's most crowded (Solitaire, Spider,
   * Number Recall, 2048, Bunny Hop), and at twenty-three titles no hue is free
   * at all — a 1 degree sweep finds a neighbour within 30 degrees everywhere.
   * This separates on depth: ΔE 12.6 from Number Recall in light and 9.4 in
   * dark, against floors of 10.9 and 7.9. Chosen at the same time as Takuzu's
   * wine and Kakuro's tobacco, since the three share the logic shelf and
   * deciding adjacent tiles one at a time spends the next one's options.
   *
   * Re-measured when Hearts and Gin Rummy merged: nothing either of them took
   * comes near the green quarter (85.1 light is the closest of the four).
   */
  futoshiki: {
    light: '#29603a',
    onLight: '#ffffff',
    softLight: '#ddf0e3',
    dark: '#74c88d',
    onDark: '#0c1c11',
    softDark: '#203d29',
  },
  /**
   * Kakuro — tobacco. A newspaper pencil puzzle, and the colour says so: the
   * board is sums in ink on paper, with the accent on the selected white cell
   * and the two runs it belongs to, so a warm brown reads as the pencil rather
   * than as a second kind of clue.
   *
   * The warm quarter is where Checkers found there was no hue left at twenty
   * titles, and there is still none at twenty-four; this separates on depth
   * and saturation between Sliding Puzzle's clay and Checkers' walnut — ΔE
   * 12.6 from the clay in light and 9.2 in dark, against floors of 10.9 and
   * 7.9. Chosen together with Takuzu's wine and Futoshiki's pine, since the
   * three share the logic shelf.
   *
   * Re-measured when Hearts and Gin Rummy merged: both are cool hues, so the
   * warm quarter is untouched (49.9 dark is the closest of the four).
   */
  kakuro: {
    light: '#794e2f',
    onLight: '#ffffff',
    softLight: '#f1e5dc',
    dark: '#cb9e7e',
    onDark: '#1c130c',
    softDark: '#3d2c20',
  },
  /**
   * Mahjong Solitaire — deep blue-violet. The board is a field of paper
   * tiles whose faces carry the set's own red and green (game content, like
   * the cards), and the accent sits ON those faces as the selection and hint
   * rings — which is why red and green were excluded before measuring, and
   * the tiles themselves stay paper in both themes.
   *
   * Chosen in the three-title selection of docs/plans/2026-08-08-mahjong-
   * bubble-ludo.md Phase 1 (with Bubble Pop's oxblood and Ludo's magenta,
   * since the three ship together and mutual distance is part of the floor):
   * candidates were clamped to the shipped palette's median band (|S−44| ≤
   * 10, |L−37| ≤ 7) and the weakest margin over every floor maximized,
   * rather than maximizing raw distance — the unconstrained winners were
   * primaries that read as another product. Re-measured at registration
   * against everything in main (27 accents + --warn + the two reserved
   * parallels), per BRAND.md step 5: closest light is Gin Rummy at ΔE 19.1,
   * closest dark Sky Fighter at 13.9, against floors of 10.9 / 7.9 with the
   * 1.15 margin required; home neighbours (2048 right, Block Puzzle below)
   * are 40.0+ light / 28.3+ dark against their 15 / 11 floor. White ink
   * 10.17; the dark value clears the dark paper at 4.52 — above FreeCell's
   * shipped 4.10, and depth was chosen over brightness on purpose: at L65%
   * this would sit ΔE 8.3 from Sky Fighter's dusk, below the floor.
   */
  mahjongSolitaire: {
    light: '#3b3196',
    onLight: '#ffffff',
    softLight: '#e4e2f4',
    dark: '#7e77c0',
    onDark: '#161225',
    softDark: '#2c2946',
  },
  /**
   * Bubble Pop — oxblood. The trajectory guide is drawn in the accent, laid
   * directly over the bubbles it aims — which runs the constraint the
   * opposite way from every other title here: the accent was picked first,
   * and the ball palette (docs/BUBBLE_POP_RULES.md §12) is chosen to leave
   * this hue family clear, rather than the accent dodging a palette the
   * board already owned.
   *
   * Chosen in the three-title selection of docs/plans/2026-08-08-mahjong-
   * bubble-ludo.md Phase 1 (with Mahjong Solitaire's blue-violet and Ludo's
   * magenta, since the three ship together and mutual distance is part of
   * the floor): candidates were clamped to the shipped palette's median band
   * (|S−44| ≤ 10, |L−37| ≤ 7) and the weakest margin over every floor
   * maximized, rather than maximizing raw distance — the unconstrained
   * winners were primaries that read as another product. Re-measured at
   * registration against everything in main (28 accents + --warn + the
   * reserved Ludo colour), per BRAND.md step 5: closest light is Memory
   * Match at ΔE 20.5, closest dark Connect Four at 15.0, against floors of
   * 10.9 / 7.9 with the 1.15 margin required; home neighbours (Brick Breaker
   * right, Sky Fighter below the arcade section head) are 39.8 light / 43.9
   * dark against their 15 / 11 floor. White ink 9.91; the dark value clears
   * the dark paper at 5.03.
   */
  bubblePop: {
    light: '#712d2f',
    onLight: '#ffffff',
    softLight: '#f0dbdb',
    dark: '#cd6a6d',
    onDark: '#1c0d0d',
    softDark: '#3b1c1d',
  },
} as const;

export type SeriesColors = typeof seriesColors;
export type TitleAccent = (typeof titleAccents)[keyof typeof titleAccents];
