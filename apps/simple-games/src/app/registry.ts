/**
 * The collection's game list. Deliberately thin — an entry is a title card,
 * the keys the game owns, and a loader for the game's code, not a plugin
 * system. A new game adds one keys import and one array element; the shell
 * never reaches deeper than this.
 *
 * The loaders are the reason the home stays fast at fifty games as well as
 * ten (issue #26): a game's code lives in its own lazy chunk (`game-<id>`,
 * vite.config.ts) and is parsed only when the game is opened. Everything the
 * shell needs while a game is closed — title, glyph, storage keys for "Reset
 * Local Data" — sits here synchronously, imported from each game's zero-import
 * `storage/keys.ts` leaf so no game logic rides into the home's initial
 * chunk. All chunks ship inside the app: opening a game offline is a load
 * from disk, never from the network (docs/OFFLINE_POLICY.md).
 *
 * The home shows the list grouped by category (GAME_CATEGORIES below): at
 * twenty games one long grid made every search a scan of the whole screen, so
 * the grid is cut into sections a reader can skip whole. Each game names its
 * category here; the order of this array is the order within a section, most
 * searched-for first. Neither has to carry the burden of "most played": the
 * home puts the games somebody actually opens in a shortcut row above the
 * sections (app/recentGames.ts), so a category is a stable place to find a
 * title, not a ranking that has to be kept current.
 */
import type { ComponentType } from 'react';
import type { Messages } from '../i18n/locales/en';
import { BB_STORAGE_KEYS } from '../games/brick-breaker/storage/keys';
import { BP_STORAGE_KEYS } from '../games/block-puzzle/storage/keys';
import { BH_STORAGE_KEYS } from '../games/bunny-hop/storage/keys';
import { BU_STORAGE_KEYS } from '../games/bubble-pop/storage/keys';
import { C4_STORAGE_KEYS } from '../games/connect-four/storage/keys';
import { CK_STORAGE_KEYS } from '../games/checkers/storage/keys';
import { GM_STORAGE_KEYS } from '../games/gomoku/storage/keys';
import { FC_STORAGE_KEYS } from '../games/freecell/storage/keys';
import { HT_STORAGE_KEYS } from '../games/hearts/storage/keys';
import { GR_STORAGE_KEYS } from '../games/gin-rummy/storage/keys';

import { FT_STORAGE_KEYS } from '../games/futoshiki/storage/keys';
import { KK_STORAGE_KEYS } from '../games/kakuro/storage/keys';
import { LD_STORAGE_KEYS } from '../games/ludo/storage/keys';
import { MJ_STORAGE_KEYS } from '../games/mahjong-solitaire/storage/keys';
import { MM_STORAGE_KEYS } from '../games/memory-match/storage/keys';
import { MS_STORAGE_KEYS } from '../games/minesweeper/storage/keys';
import { NG_STORAGE_KEYS } from '../games/nonogram/storage/keys';
import { NM_STORAGE_KEYS } from '../games/number-match/storage/keys';
import { NR_STORAGE_KEYS } from '../games/number-recall/storage/keys';
import { QM_STORAGE_KEYS } from '../games/quick-math/storage/keys';
import { RV_STORAGE_KEYS } from '../games/reversi/storage/keys';
import { SD_STORAGE_KEYS } from '../games/sudoku/storage/keys';
import { ST_STORAGE_KEYS } from '../games/schulte-table/storage/keys';
import { SF_STORAGE_KEYS } from '../games/sky-fighter/storage/keys';
import { SO_STORAGE_KEYS } from '../games/solitaire/storage/keys';
import { SS_STORAGE_KEYS } from '../games/spider-solitaire/storage/keys';
import { SP_STORAGE_KEYS } from '../games/sliding-puzzle/storage/keys';
import { TK_STORAGE_KEYS } from '../games/takuzu/storage/keys';
import { TM_STORAGE_KEYS } from '../games/2048/storage/keys';
import { WS_STORAGE_KEYS } from '../games/water-sort/storage/keys';
import { CG_STORAGE_KEYS } from '../games/crown-grid/storage/keys';
import { NP_STORAGE_KEYS } from '../games/number-path/storage/keys';
import { SR_STORAGE_KEYS } from '../games/shape-regions/storage/keys';
import { YT_STORAGE_KEYS } from '../games/yacht/storage/keys';
import { MC_STORAGE_KEYS } from '../games/mancala/storage/keys';
import { DM_STORAGE_KEYS } from '../games/dominoes/storage/keys';
import { HB_STORAGE_KEYS } from '../games/hit-and-blow/storage/keys';
import { DB_STORAGE_KEYS } from '../games/dots-and-boxes/storage/keys';
import { BN_STORAGE_KEYS } from '../games/binary-balance/storage/keys';
import { S6_STORAGE_KEYS } from '../games/sudoku-6x6/storage/keys';
import { BR_STORAGE_KEYS } from '../games/box-regions/storage/keys';
import { UB_STORAGE_KEYS } from '../games/unblock-puzzle/storage/keys';
import { SN_STORAGE_KEYS } from '../games/snake/storage/keys';
import { LP_STORAGE_KEYS } from '../games/loop-puzzle/storage/keys';
import { BG_STORAGE_KEYS } from '../games/bridges/storage/keys';
import { PG_STORAGE_KEYS } from '../games/peg-solitaire/storage/keys';
import { CH_STORAGE_KEYS } from '../games/chess/storage/keys';
import { GS_STORAGE_KEYS } from '../games/gem-swap/storage/keys';
import { PN_STORAGE_KEYS } from '../games/pipe-link/storage/keys';
import { BO_STORAGE_KEYS } from '../games/bounce-up/storage/keys';
import { EP_STORAGE_KEYS } from '../games/echo-pads/storage/keys';
import { OT_STORAGE_KEYS } from '../games/overtake/storage/keys';
import { TG_STORAGE_KEYS } from '../games/make-the-target/storage/keys';
import { NT_STORAGE_KEYS } from '../games/nested-tic-tac-toe/storage/keys';
import { SC_STORAGE_KEYS } from '../games/scopa/storage/keys';
import { TN_STORAGE_KEYS } from '../games/tangram/storage/keys';
import { SUDOKU_CHALLENGE } from '../games/sudoku/challenge/contract';
import { MINESWEEPER_CHALLENGE } from '../games/minesweeper/challenge/contract';
import { WATER_SORT_CHALLENGE } from '../games/water-sort/challenge/contract';
import { GAME_2048_CHALLENGE } from '../games/2048/challenge/contract';
import { BINARY_BALANCE_CHALLENGE } from '../games/binary-balance/challenge/contract';
import { BLOCK_PUZZLE_CHALLENGE } from '../games/block-puzzle/challenge/contract';
import { BOX_REGIONS_CHALLENGE } from '../games/box-regions/challenge/contract';
import { BUNNY_HOP_CHALLENGE } from '../games/bunny-hop/challenge/contract';
import { CROWN_GRID_CHALLENGE } from '../games/crown-grid/challenge/contract';
import { DOMINOES_CHALLENGE } from '../games/dominoes/challenge/contract';
import { DOTS_AND_BOXES_CHALLENGE } from '../games/dots-and-boxes/challenge/contract';
import { FREECELL_CHALLENGE } from '../games/freecell/challenge/contract';
import { FUTOSHIKI_CHALLENGE } from '../games/futoshiki/challenge/contract';
import { GIN_RUMMY_CHALLENGE } from '../games/gin-rummy/challenge/contract';
import { HEARTS_CHALLENGE } from '../games/hearts/challenge/contract';
import { HIT_AND_BLOW_CHALLENGE } from '../games/hit-and-blow/challenge/contract';
import { KAKURO_CHALLENGE } from '../games/kakuro/challenge/contract';
import { MAHJONG_SOLITAIRE_CHALLENGE } from '../games/mahjong-solitaire/challenge/contract';
import { MANCALA_CHALLENGE } from '../games/mancala/challenge/contract';
import { MEMORY_MATCH_CHALLENGE } from '../games/memory-match/challenge/contract';
import { NONOGRAM_CHALLENGE } from '../games/nonogram/challenge/contract';
import { NUMBER_MATCH_CHALLENGE } from '../games/number-match/challenge/contract';
import { NUMBER_PATH_CHALLENGE } from '../games/number-path/challenge/contract';
import { NUMBER_RECALL_CHALLENGE } from '../games/number-recall/challenge/contract';
import { QUICK_MATH_CHALLENGE } from '../games/quick-math/challenge/contract';
import { REVERSI_CHALLENGE } from '../games/reversi/challenge/contract';
import { SCHULTE_TABLE_CHALLENGE } from '../games/schulte-table/challenge/contract';
import { SHAPE_REGIONS_CHALLENGE } from '../games/shape-regions/challenge/contract';
import { SKY_FIGHTER_CHALLENGE } from '../games/sky-fighter/challenge/contract';
import { SLIDING_PUZZLE_CHALLENGE } from '../games/sliding-puzzle/challenge/contract';
import { SOLITAIRE_CHALLENGE } from '../games/solitaire/challenge/contract';
import { SPIDER_SOLITAIRE_CHALLENGE } from '../games/spider-solitaire/challenge/contract';
import { SUDOKU_6X6_CHALLENGE } from '../games/sudoku-6x6/challenge/contract';
import { TAKUZU_CHALLENGE } from '../games/takuzu/challenge/contract';
import { YACHT_CHALLENGE } from '../games/yacht/challenge/contract';

export type GameId =
  | 'sudoku'
  | 'minesweeper'
  | 'nonogram'
  | 'mahjong-solitaire'
  | 'number-match'
  | 'quick-math'
  | 'schulte-table'
  | 'number-recall'
  | 'sliding-puzzle'
  | 'memory-match'
  | 'water-sort'
  | 'solitaire'
  | 'spider-solitaire'
  | 'freecell'
  | 'hearts'
  | 'gin-rummy'
  | 'bubble-pop'
  | 'brick-breaker'
  | 'sky-fighter'
  | 'bunny-hop'
  | '2048'
  | 'block-puzzle'
  | 'checkers'
  | 'reversi'
  | 'connect-four'
  | 'gomoku'
  | 'takuzu'
  | 'futoshiki'
  | 'kakuro'
  | 'ludo'
  | 'crown-grid'
  | 'number-path'
  | 'shape-regions'
  | 'yacht'
  | 'mancala'
  | 'dominoes'
  | 'hit-and-blow'
  | 'dots-and-boxes'
  | 'binary-balance'
  | 'sudoku-6x6'
  | 'box-regions'
  | 'unblock-puzzle'
  | 'snake'
  | 'loop-puzzle'
  | 'bridges'
  | 'peg-solitaire'
  | 'chess'
  | 'gem-swap'
  | 'pipe-link'
  | 'bounce-up'
  | 'echo-pads'
  | 'overtake'
  | 'make-the-target'
  | 'nested-tic-tac-toe'
  | 'scopa'
  | 'tangram';

/**
 * The genre shelves the collection home is divided into. An id is styling- and
 * storage-free — it exists only to group the grid — so adding one costs a
 * heading string in the shell catalog (14 locales) and nothing anywhere else.
 */
export type GameCategoryId = 'logic' | 'cards' | 'puzzle' | 'board' | 'arcade' | 'drills';

export interface GameCategory {
  id: GameCategoryId;
  /**
   * The section heading on the collection home. A key into the shell catalog
   * (typed, so a renamed key fails the build), not a literal: category names
   * are common nouns, and unlike the game titles they do translate.
   */
  headingKey: keyof Messages;
}

/**
 * The sections of the collection home, in display order — the categories with
 * the most searched-for titles first, matching how GAMES itself is ordered.
 * Every game must name one of these ids as its `category`; a game whose
 * category is missing here would silently vanish from the home, which is why
 * CollectionHomeScreen.test.tsx checks the sections cover GAMES exactly.
 */
export const GAME_CATEGORIES: readonly GameCategory[] = [
  { id: 'logic', headingKey: 'categoryLogic' },
  { id: 'cards', headingKey: 'categoryCards' },
  { id: 'puzzle', headingKey: 'categoryPuzzle' },
  { id: 'board', headingKey: 'categoryBoard' },
  { id: 'arcade', headingKey: 'categoryArcade' },
  { id: 'drills', headingKey: 'categoryDrills' },
];

/**
 * How the player got to a game — a fact about the door, not an instruction.
 * The shell knows which door was used and nothing else; what a door means is
 * the game's own answer (issue #113).
 *
 * `'shortcut'` is a home-screen shortcut pinned to this game
 * (app/shortcutLaunch.ts). A game that keeps exactly one suspended game of
 * its own may open straight onto it rather than onto its home screen; a game
 * with none, with more than one, or with nothing it can read may ignore this
 * entirely, and most of the collection does. The shell asks no questions
 * about any of that: it never learns a save schema, and a game that answers
 * "my home screen, thanks" needs no code at all.
 */
export type GameEntry = 'collection' | 'shortcut';

/**
 * What the shell and the Club layer know about a game's challenges without
 * loading the game (club.md §6-1): how to validate the `params` a challenge
 * carries and the `facts` a result carries, which param names the mode a
 * club record is kept for, and which fact is the comparison axis. Declared by
 * the game in its zero-import `challenge/contract.ts` leaf — the same
 * arrangement as `storage/keys.ts`, for the same reason: the registry imports
 * it eagerly, so it must tow nothing. The game writes the shape out itself rather than
 * importing this type; the assignment below is what checks the two agree.
 */
export interface GameChallengeContract {
  contractVersion: 1;
  /** The params a challenge may carry, or null when the shape is not this game's. Never throws. */
  validateParams(raw: unknown): Record<string, unknown> | null;
  /** The facts a result may carry — the result screen's own figures, nothing else. Never throws. */
  validateFacts(raw: unknown): Record<string, unknown> | null;
  /** The mode a club record is kept for (`hard`, `medium`, …), from validated params. */
  paramsKey(params: Record<string, unknown>): string;
  /**
   * For a game whose tables are level bands (Mahjong Solitaire's layouts): the
   * levels a paramsKey covers, or null. The Club House names such a table by
   * its levels ("Levels 90–100") rather than by the key.
   */
  levelRange?(paramsKey: string): readonly [number, number] | null;
  /** The one fact results are ordered by, ascending. */
  order: string;
  /**
   * Which way the axis points (club.md §6-1): `asc` = lower is better (time,
   * moves), `desc` = higher is better (score).
   */
  direction: 'asc' | 'desc';
}

/**
 * Everything the shell hands a game. Games declare these props themselves
 * rather than importing this type — `onExit` has always been duplicated that
 * way, and the assignment in `loadRoot` is what checks the two agree.
 */
export interface GameRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Which door this launch came through. Absent means the ordinary one. */
  entry?: GameEntry;
}

export interface GameDefinition {
  id: GameId;
  /**
   * Title as a proper noun — identical in every language. That is what lets
   * the collection home lay the whole list out as a grid of short cards in all
   * fourteen locales; a translated sentence could not hold that shape.
   */
  title: string;
  /** Which home section the game is listed under (GAME_CATEGORIES). */
  category: GameCategoryId;
  /**
   * The series mark: one glyph on an accent tile identifies the game. The
   * accent is the title's own (`.accent-<id>` in ui/styles.css), so on the
   * home a game can be found by colour as well as by name.
   */
  glyph: string;
  /**
   * Every key this game persists, for "Reset Local Data". Listed here so the
   * shell can wipe honestly without knowing any game's storage internals —
   * and without loading the game's chunk to ask.
   */
  storageKeys: readonly string[];
  /**
   * Where this title ships. Absent means everywhere: the app on both stores
   * and the browser version alike. `'web-beta'` is the early-release channel
   * of docs/WEB_VERSION.md「先行公開(ベータ)」: the game is in the browser
   * version only, wearing a BETA mark, while its schema may still change.
   * `'in-development'` ships nowhere yet: the entry is in the registry — its
   * keys, schemas, folder and catalogs exist, so every gate that reads the
   * registry already covers it — but no build offers it on any door, because
   * there is no game behind it yet (a scaffold of scripts/new-game.mjs, or one
   * still being built; WEB_VERSION.md「遊べるものだけを出す」). It turns into
   * `'web-beta'` in the change that makes it playable, and that is also when
   * the landing's sync lists it as beta (WEB_VERSION.md「landing 側のガード」).
   * The code ships in every bundle regardless (one build, no forks —
   * 「実装上の約束」); the shell's runtime guard (app/gameChannel.ts) is what
   * keeps a beta title off the app's home, out of its search, and out of any
   * shortcut address it could be opened from, and an in-development title off
   * the browser's doors too. `storageKeys` are listed from day one, so "Reset
   * Local Data" tells the truth in the browser too.
   */
  channel?: 'web-beta' | 'in-development';
  /**
   * Loads the game's root component from its own bundled chunk. Roots are
   * named exports; the shim to `{ default }` is what React.lazy expects
   * (app/lazyRoots.ts caches the lazy wrapper per game).
   */
  loadRoot: () => Promise<{ default: ComponentType<GameRootProps> }>;
  /**
   * Loads the game's record schemas — the same `SchemaDef`s the game itself
   * validates and migrates its saves with (`storage/schemas.ts`).
   *
   * Required, not optional, and that is the whole point: Backup & Restore
   * refuses any record it cannot put through its owner's validator
   * (src/backup/), so a game that did not name its schemas here would be a
   * game whose data exports and then always fails to come back. Making the
   * field mandatory turns "did anyone remember?" into a compile error the
   * day the thirty-first game is added.
   *
   * The shell still learns nothing about any save format. It reads the
   * module's exports for the `SchemaDef` shape and hands each one the value
   * from the file; what counts as valid stays entirely the game's answer
   * (src/backup/owners.ts).
   *
   * Lazy, like `loadRoot`: the schemas ride in the game's chunk, and they are
   * loaded only for the games a backup actually mentions.
   */
  loadStorageSchemas: () => Promise<Readonly<Record<string, unknown>>>;
  /**
   * Optional: the game's own settings, rendered inside the shared settings
   * screen. A game owns its options; the shell only lends them a place.
   * Loading one pulls the game's chunk — acceptable, because it happens on
   * the settings screen, never on the home.
   */
  loadSettingsSection?: () => Promise<{ default: ComponentType }>;
  /**
   * Optional: this game can be a Club House challenge (club.md §6). The
   * contract is a zero-import leaf like `storageKeys`, so the Club layer can
   * list and validate challenges without loading a single game chunk. A game
   * without one is simply not offered there — nothing is added mechanically
   * to all thirty (PRODUCT_PRINCIPLES「Club House」).
   */
  challenge?: GameChallengeContract;
}

export const GAMES: readonly GameDefinition[] = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    category: 'logic',
    glyph: '⌗',
    storageKeys: Object.values(SD_STORAGE_KEYS),
    challenge: SUDOKU_CHALLENGE,
    loadRoot: () =>
      import('../games/sudoku/ui/SudokuRoot').then((m) => ({ default: m.SudokuRoot })),
    loadStorageSchemas: () => import('../games/sudoku/storage/schemas'),
    loadSettingsSection: () =>
      import('../games/sudoku/ui/SudokuSettingsSection').then((m) => ({
        default: m.SudokuSettingsSection,
      })),
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    category: 'cards',
    glyph: '♠',
    storageKeys: Object.values(SO_STORAGE_KEYS),
    challenge: SOLITAIRE_CHALLENGE,
    loadRoot: () =>
      import('../games/solitaire/ui/SolitaireRoot').then((m) => ({ default: m.SolitaireRoot })),
    loadStorageSchemas: () => import('../games/solitaire/storage/schemas'),
  },
  {
    id: 'spider-solitaire',
    title: 'Spider Solitaire',
    category: 'cards',
    glyph: '♣',
    storageKeys: Object.values(SS_STORAGE_KEYS),
    challenge: SPIDER_SOLITAIRE_CHALLENGE,
    loadRoot: () =>
      import('../games/spider-solitaire/ui/SpiderRoot').then((m) => ({ default: m.SpiderRoot })),
    loadStorageSchemas: () => import('../games/spider-solitaire/storage/schemas'),
  },
  {
    id: 'freecell',
    title: 'FreeCell',
    category: 'cards',
    glyph: '♥',
    storageKeys: Object.values(FC_STORAGE_KEYS),
    challenge: FREECELL_CHALLENGE,
    loadRoot: () =>
      import('../games/freecell/ui/FreeCellRoot').then((m) => ({ default: m.FreeCellRoot })),
    loadStorageSchemas: () => import('../games/freecell/storage/schemas'),
  },
  {
    id: 'hearts',
    // The more searched-for of the two games with opponents, so it opens that
    // half of the shelf directly after the three patiences. Its outlined heart
    // pairs with Gin Rummy's outlined diamond: filled suits are the solo
    // patiences, outlined ones have somebody sitting opposite
    // (docs/HEARTS_RULES.md §1 — here, three somebodies).
    title: 'Hearts',
    category: 'cards',
    glyph: '♡',
    storageKeys: Object.values(HT_STORAGE_KEYS),
    challenge: HEARTS_CHALLENGE,
    loadRoot: () =>
      import('../games/hearts/ui/HeartsRoot').then((m) => ({ default: m.HeartsRoot })),
    loadStorageSchemas: () => import('../games/hearts/storage/schemas'),
  },
  {
    id: 'gin-rummy',
    // An outlined suit, where the three patiences take filled ones: the shelf
    // now holds two kinds of card game, and the marks say which is which
    // (docs/GIN_RUMMY_RULES.md §1 — this one has an opponent).
    title: 'Gin Rummy',
    category: 'cards',
    glyph: '♢',
    storageKeys: Object.values(GR_STORAGE_KEYS),
    challenge: GIN_RUMMY_CHALLENGE,
    loadRoot: () =>
      import('../games/gin-rummy/ui/GinRummyRoot').then((m) => ({ default: m.GinRummyRoot })),
    loadStorageSchemas: () => import('../games/gin-rummy/storage/schemas'),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    category: 'logic',
    glyph: '◆',
    storageKeys: Object.values(MS_STORAGE_KEYS),
    challenge: MINESWEEPER_CHALLENGE,
    loadRoot: () =>
      import('../games/minesweeper/ui/MinesweeperRoot').then((m) => ({
        default: m.MinesweeperRoot,
      })),
    loadStorageSchemas: () => import('../games/minesweeper/storage/schemas'),
  },
  {
    id: 'mahjong-solitaire',
    // Head of the puzzle shelf: sections order by name-search demand, and
    // "mahjong" out-searches every other title here. The mark is the one
    // dot — the circle tile itself, and the collection's only concentric
    // circles (Reversi's ◐ lives on the board shelf and is half-filled, so
    // the silhouettes never blur). The first choice ⧈ was dropped: it drew
    // almost identically to Block Puzzle's ▣, which sits directly below in
    // this very section (docs/plans/2026-08-08-mahjong-bubble-ludo.md,
    // Phase 1). Not "Mahjong" alone — in ja / zh / ko that names the
    // four-player game, and this is the solitaire (docs/MAHJONG_SOLITAIRE_RULES.md).
    title: 'Mahjong Solitaire',
    category: 'puzzle',
    glyph: '◎',
    storageKeys: Object.values(MJ_STORAGE_KEYS),
    challenge: MAHJONG_SOLITAIRE_CHALLENGE,
    loadRoot: () =>
      import('../games/mahjong-solitaire/ui/MahjongRoot').then((m) => ({
        default: m.MahjongRoot,
      })),
    loadStorageSchemas: () => import('../games/mahjong-solitaire/storage/schemas'),
  },
  {
    id: '2048',
    title: '2048',
    category: 'puzzle',
    glyph: '⊞',
    storageKeys: Object.values(TM_STORAGE_KEYS),
    challenge: GAME_2048_CHALLENGE,
    loadRoot: () =>
      import('../games/2048/ui/Game2048Root').then((m) => ({ default: m.Game2048Root })),
    loadStorageSchemas: () => import('../games/2048/storage/schemas'),
  },
  {
    id: 'block-puzzle',
    title: 'Block Puzzle',
    category: 'puzzle',
    glyph: '▣',
    storageKeys: Object.values(BP_STORAGE_KEYS),
    challenge: BLOCK_PUZZLE_CHALLENGE,
    loadRoot: () =>
      import('../games/block-puzzle/ui/BlockPuzzleRoot').then((m) => ({
        default: m.BlockPuzzleRoot,
      })),
    loadStorageSchemas: () => import('../games/block-puzzle/storage/schemas'),
  },
  {
    id: 'ludo',
    // Head of the board shelf: sections order by name-search demand, and
    // "ludo" out-searches the four titles under it
    // (docs/plans/2026-08-08-mahjong-bubble-ludo.md, Phase 1).
    //
    // The mark is a die showing six. This is the only game in the collection
    // that has a die at all, and six is the roll that sends a piece out of its
    // yard — the mark is the game's one object and its one rule at once. It
    // comes from Miscellaneous Symbols, the block the shipped `♠ ♣ ♥ ♡ ♢`
    // already draw from, so it takes the font route those five prove. The near
    // miss is the dot family, and it parts on the frame: Connect Four's `⁘`
    // and Gomoku's `⁙` are bare dots where this one boxes them, and the two
    // are not adjacent to it either — they close this section, this opens it.
    //
    // What is NOT settled is whether it draws everywhere. Of the three glyphs
    // chosen in that plan it has the thinnest font coverage by a wide margin —
    // 8 of this environment's 59 fonts, where `♠` reaches 19 — and it has not
    // yet been looked at on a low-spec handset (Chromium 88, system fonts
    // only). If it lands there as a box or an unreadable smudge the fallback
    // is `⚄`, and then `◈`.
    title: 'Ludo',
    category: 'board',
    glyph: '⚅',
    storageKeys: Object.values(LD_STORAGE_KEYS),
    loadRoot: () => import('../games/ludo/ui/LudoRoot').then((m) => ({ default: m.LudoRoot })),
    loadStorageSchemas: () => import('../games/ludo/storage/schemas'),
  },
  {
    id: 'checkers',
    // The mark is the board itself: two dark squares on the diagonal, which
    // is the one picture no other title in the collection could be. The
    // draughts piece that was the first choice is a filled circle, and it
    // would have sat beside Reversi's half-filled one.
    title: 'Checkers',
    category: 'board',
    glyph: '▚',
    storageKeys: Object.values(CK_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/checkers/ui/CheckersRoot').then((m) => ({ default: m.CheckersRoot })),
    loadStorageSchemas: () => import('../games/checkers/storage/schemas'),
  },
  {
    id: 'reversi',
    title: 'Reversi',
    category: 'board',
    glyph: '◐',
    storageKeys: Object.values(RV_STORAGE_KEYS),
    challenge: REVERSI_CHALLENGE,
    loadRoot: () =>
      import('../games/reversi/ui/ReversiRoot').then((m) => ({ default: m.ReversiRoot })),
    loadStorageSchemas: () => import('../games/reversi/storage/schemas'),
  },
  {
    id: 'connect-four',
    title: 'Connect Four',
    category: 'board',
    glyph: '⁘',
    storageKeys: Object.values(C4_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/connect-four/ui/ConnectFourRoot').then((m) => ({
        default: m.ConnectFourRoot,
      })),
    loadStorageSchemas: () => import('../games/connect-four/storage/schemas'),
  },
  {
    id: 'gomoku',
    // Five dots, where Connect Four has four (U+2058 and U+2059): the two
    // titles are the same idea at different lengths, and the marks say so.
    title: 'Gomoku',
    category: 'board',
    glyph: '⁙',
    storageKeys: Object.values(GM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/gomoku/ui/GomokuRoot').then((m) => ({ default: m.GomokuRoot })),
    loadStorageSchemas: () => import('../games/gomoku/storage/schemas'),
  },
  {
    // Head of the arcade shelf: sections order by name-search demand, and
    // "bubble" out-searches "brick breaker" (docs/plans/2026-08-08-mahjong-bubble-ludo.md).
    id: 'bubble-pop',
    title: 'Bubble Pop',
    category: 'arcade',
    glyph: '○',
    storageKeys: Object.values(BU_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/bubble-pop/ui/BubblePopRoot').then((m) => ({
        default: m.BubblePopRoot,
      })),
    loadStorageSchemas: () => import('../games/bubble-pop/storage/schemas'),
  },
  {
    id: 'brick-breaker',
    title: 'Brick Breaker',
    category: 'arcade',
    glyph: '≡',
    storageKeys: Object.values(BB_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/brick-breaker/ui/BrickBreakerRoot').then((m) => ({
        default: m.BrickBreakerRoot,
      })),
    loadStorageSchemas: () => import('../games/brick-breaker/storage/schemas'),
  },
  {
    id: 'nonogram',
    title: 'Nonogram',
    category: 'logic',
    glyph: '▦',
    storageKeys: Object.values(NG_STORAGE_KEYS),
    challenge: NONOGRAM_CHALLENGE,
    loadRoot: () =>
      import('../games/nonogram/ui/NonogramRoot').then((m) => ({ default: m.NonogramRoot })),
    loadStorageSchemas: () => import('../games/nonogram/storage/schemas'),
  },
  {
    id: 'takuzu',
    // Two characters, like Number Match's `10`: the mark names the puzzle's
    // two digits, which is the whole of what a Takuzu cell can hold. The one
    // thing worth checking was whether `01` reads as `10` at tile size, and it
    // does not have to: the two live in different sections (logic and puzzle,
    // with the cards between them), so the grid never sets them side by side,
    // and each card carries its own accent and its title underneath. The
    // alternative on the table, `◧`, would have landed in this same section
    // beside Nonogram's `▦` — two squares telling each other apart by their
    // fill, which is the closer call of the two.
    title: 'Takuzu',
    category: 'logic',
    glyph: '01',
    storageKeys: Object.values(TK_STORAGE_KEYS),
    challenge: TAKUZU_CHALLENGE,
    loadRoot: () =>
      import('../games/takuzu/ui/TakuzuRoot').then((m) => ({ default: m.TakuzuRoot })),
    loadStorageSchemas: () => import('../games/takuzu/storage/schemas'),
  },
  {
    id: 'futoshiki',
    // U+2276, the two signs the game is played with folded into one figure:
    // the mark IS the rule, the way Takuzu's `01` is its two digits.
    //
    // Unique against the other twenty-six, and the near misses were looked
    // at rather than assumed. Brick Breaker's `≡` and Water Sort's `≋` are the
    // only other stacked-stroke marks, and both sit in other sections (arcade
    // and puzzle) under their own accents. In this one it stands beside `⌗`,
    // `◆`, `▦` and `01`, and it is the only mark here built from strokes
    // rather than a filled shape.
    //
    // It renders, and that was checked rather than hoped at: the bundled
    // Nunito subset (@fontsource/nunito latin-700/800) carries 230 glyphs and
    // none of this collection's symbol marks — not `⌗`, `◆`, `▦`, `≡` or `≋`.
    // Every one of them already resolves through the `ui-rounded, system-ui,
    // sans-serif` tail of --font-display, so five shipped titles are the
    // evidence that this path draws. `≶` sits in Mathematical Operators, the
    // same block `≡` and `≋` come from, and takes exactly the same route.
    title: 'Futoshiki',
    category: 'logic',
    glyph: '≶',
    storageKeys: Object.values(FT_STORAGE_KEYS),
    challenge: FUTOSHIKI_CHALLENGE,
    loadRoot: () =>
      import('../games/futoshiki/ui/FutoshikiRoot').then((m) => ({ default: m.FutoshikiRoot })),
    loadStorageSchemas: () => import('../games/futoshiki/storage/schemas'),
    loadSettingsSection: () =>
      import('../games/futoshiki/ui/FutoshikiSettingsSection').then((m) => ({
        default: m.FutoshikiSettingsSection,
      })),
  },
  {
    id: 'kakuro',
    // U+2211, the summation sign: the mark IS the rule here, the way
    // Futoshiki's `≶` is its two signs and Takuzu's `01` is its two digits.
    // Every clue square on this board is a sum, and nothing else on it means
    // anything.
    //
    // Unique against the other twenty-six, and the near misses were looked at
    // rather than assumed. In this section it stands beside `⌗`, `◆`, `▦`, `01`
    // and `≶`; the closest call is `≶`, since both are built from strokes
    // rather than a filled shape, but a folded pair of angle brackets and a
    // capital sigma share no silhouette, and the two cards carry different
    // accents and their titles underneath.
    //
    // It renders by the same route the other symbol marks take: the bundled
    // Nunito subset (@fontsource/nunito latin-700/800) carries none of them,
    // and all of them resolve through the `ui-rounded, system-ui, sans-serif`
    // tail of --font-display. `∑` sits in Mathematical Operators, the same
    // block `≡`, `≋` and `≶` come from.
    title: 'Kakuro',
    category: 'logic',
    glyph: '∑',
    storageKeys: Object.values(KK_STORAGE_KEYS),
    challenge: KAKURO_CHALLENGE,
    loadRoot: () =>
      import('../games/kakuro/ui/KakuroRoot').then((m) => ({ default: m.KakuroRoot })),
    loadStorageSchemas: () => import('../games/kakuro/storage/schemas'),
    loadSettingsSection: () =>
      import('../games/kakuro/ui/KakuroSettingsSection').then((m) => ({
        default: m.KakuroSettingsSection,
      })),
  },
  {
    id: 'number-match',
    title: 'Number Match',
    category: 'puzzle',
    glyph: '10',
    storageKeys: Object.values(NM_STORAGE_KEYS),
    challenge: NUMBER_MATCH_CHALLENGE,
    loadRoot: () =>
      import('../games/number-match/ui/NumberMatchRoot').then((m) => ({
        default: m.NumberMatchRoot,
      })),
    loadStorageSchemas: () => import('../games/number-match/storage/schemas'),
  },
  // The three drills lead the drills section: they are the shortest sittings
  // in the collection and the only titles measured in seconds.
  {
    id: 'quick-math',
    title: 'Quick Math',
    category: 'drills',
    glyph: '÷',
    storageKeys: Object.values(QM_STORAGE_KEYS),
    challenge: QUICK_MATH_CHALLENGE,
    loadRoot: () =>
      import('../games/quick-math/ui/QuickMathRoot').then((m) => ({ default: m.QuickMathRoot })),
    loadStorageSchemas: () => import('../games/quick-math/storage/schemas'),
  },
  {
    id: 'schulte-table',
    title: 'Schulte Table',
    category: 'drills',
    glyph: '⌖',
    storageKeys: Object.values(ST_STORAGE_KEYS),
    challenge: SCHULTE_TABLE_CHALLENGE,
    loadRoot: () =>
      import('../games/schulte-table/ui/SchulteTableRoot').then((m) => ({
        default: m.SchulteTableRoot,
      })),
    loadStorageSchemas: () => import('../games/schulte-table/storage/schemas'),
  },
  {
    id: 'number-recall',
    title: 'Number Recall',
    category: 'drills',
    glyph: '?',
    storageKeys: Object.values(NR_STORAGE_KEYS),
    challenge: NUMBER_RECALL_CHALLENGE,
    loadRoot: () =>
      import('../games/number-recall/ui/NumberRecallRoot').then((m) => ({
        default: m.NumberRecallRoot,
      })),
    loadStorageSchemas: () => import('../games/number-recall/storage/schemas'),
  },
  {
    id: 'water-sort',
    title: 'Water Sort',
    category: 'puzzle',
    glyph: '≋',
    storageKeys: Object.values(WS_STORAGE_KEYS),
    challenge: WATER_SORT_CHALLENGE,
    loadRoot: () =>
      import('../games/water-sort/ui/WaterSortRoot').then((m) => ({ default: m.WaterSortRoot })),
    loadStorageSchemas: () => import('../games/water-sort/storage/schemas'),
  },
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    category: 'puzzle',
    glyph: '⇄',
    storageKeys: Object.values(SP_STORAGE_KEYS),
    challenge: SLIDING_PUZZLE_CHALLENGE,
    loadRoot: () =>
      import('../games/sliding-puzzle/ui/SlidingPuzzleRoot').then((m) => ({
        default: m.SlidingPuzzleRoot,
      })),
    loadStorageSchemas: () => import('../games/sliding-puzzle/storage/schemas'),
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    category: 'drills',
    glyph: '⧉',
    storageKeys: Object.values(MM_STORAGE_KEYS),
    challenge: MEMORY_MATCH_CHALLENGE,
    loadRoot: () =>
      import('../games/memory-match/ui/MemoryMatchRoot').then((m) => ({
        default: m.MemoryMatchRoot,
      })),
    loadStorageSchemas: () => import('../games/memory-match/storage/schemas'),
  },
  {
    id: 'sky-fighter',
    title: 'Sky Fighter',
    category: 'arcade',
    glyph: '▲',
    storageKeys: Object.values(SF_STORAGE_KEYS),
    challenge: SKY_FIGHTER_CHALLENGE,
    loadRoot: () =>
      import('../games/sky-fighter/ui/SkyFighterRoot').then((m) => ({
        default: m.SkyFighterRoot,
      })),
    loadStorageSchemas: () => import('../games/sky-fighter/storage/schemas'),
  },
  {
    id: 'bunny-hop',
    title: 'Bunny Hop',
    category: 'arcade',
    glyph: '⌃',
    storageKeys: Object.values(BH_STORAGE_KEYS),
    challenge: BUNNY_HOP_CHALLENGE,
    loadRoot: () =>
      import('../games/bunny-hop/ui/BunnyHopRoot').then((m) => ({
        default: m.BunnyHopRoot,
      })),
    loadStorageSchemas: () => import('../games/bunny-hop/storage/schemas'),
  },
  {
    // The three board puzzles of issue #194, first in the browser's early
    // release (docs/WEB_VERSION.md「先行公開」) and in the app from the
    // release after it (2026-10-02). Listed after the first thirty, in the
    // order the issue names them. A crown for the one object the board
    // asks you to place — one per row, column and region (docs/CROWN_GRID_RULES.md).
    id: 'crown-grid',
    title: 'Crown Grid',
    category: 'logic',
    glyph: '♛',
    storageKeys: Object.values(CG_STORAGE_KEYS),
    challenge: CROWN_GRID_CHALLENGE,
    loadRoot: () =>
      import('../games/crown-grid/ui/CrownGridRoot').then((m) => ({ default: m.CrownGridRoot })),
    loadStorageSchemas: () => import('../games/crown-grid/storage/schemas'),
  },
  {
    // A wave arrow: one continuous line through every square, in number order
    // (docs/NUMBER_PATH_RULES.md). From the Arrows block, which every system
    // font covers.
    id: 'number-path',
    title: 'Number Path',
    category: 'logic',
    glyph: '↝',
    storageKeys: Object.values(NP_STORAGE_KEYS),
    challenge: NUMBER_PATH_CHALLENGE,
    loadRoot: () =>
      import('../games/number-path/ui/NumberPathRoot').then((m) => ({ default: m.NumberPathRoot })),
    loadStorageSchemas: () => import('../games/number-path/storage/schemas'),
  },
  {
    // Three quadrants of four: a board being cut into shapes
    // (docs/SHAPE_REGIONS_RULES.md). Block Elements, like Checkers' ▚, and
    // far enough from it — three quadrants where that one has two on a diagonal.
    id: 'shape-regions',
    title: 'Shape Regions',
    category: 'logic',
    glyph: '▙',
    storageKeys: Object.values(SR_STORAGE_KEYS),
    challenge: SHAPE_REGIONS_CHALLENGE,
    loadRoot: () =>
      import('../games/shape-regions/ui/ShapeRegionsRoot').then((m) => ({
        default: m.ShapeRegionsRoot,
      })),
    loadStorageSchemas: () => import('../games/shape-regions/storage/schemas'),
  },
  {
    // The five new genres of issue #197, in the order the issue names them,
    // first in the browser's early release (docs/WEB_VERSION.md「先行公開」). A
    // die face for the collection's first game about the dice themselves:
    // five to roll, three throws, one category (docs/YACHT_RULES.md).
    id: 'yacht',
    title: 'Yacht',
    category: 'board',
    glyph: '⚄',
    storageKeys: Object.values(YT_STORAGE_KEYS),
    challenge: YACHT_CHALLENGE,
    loadRoot: () => import('../games/yacht/ui/YachtRoot').then((m) => ({ default: m.YachtRoot })),
    loadStorageSchemas: () => import('../games/yacht/storage/schemas'),
  },
  {
    // A pit with a stone in it: sowing, one seed per pit around the board
    // (docs/MANCALA_RULES.md). From the Mathematical Operators block, which
    // every system font covers.
    id: 'mancala',
    title: 'Mancala',
    category: 'board',
    glyph: '⊚',
    storageKeys: Object.values(MC_STORAGE_KEYS),
    challenge: MANCALA_CHALLENGE,
    loadRoot: () =>
      import('../games/mancala/ui/MancalaRoot').then((m) => ({ default: m.MancalaRoot })),
    loadStorageSchemas: () => import('../games/mancala/storage/schemas'),
  },
  {
    // A tile split in two — the domino, read end to end
    // (docs/DOMINOES_RULES.md). Mathematical Operators again, rather than the
    // Domino Tiles block whose glyphs low-spec Android fonts do not carry.
    id: 'dominoes',
    title: 'Dominoes',
    category: 'board',
    glyph: '⊟',
    storageKeys: Object.values(DM_STORAGE_KEYS),
    challenge: DOMINOES_CHALLENGE,
    loadRoot: () =>
      import('../games/dominoes/ui/DominoesRoot').then((m) => ({ default: m.DominoesRoot })),
    loadStorageSchemas: () => import('../games/dominoes/storage/schemas'),
  },
  {
    // A fisheye: the target a guess is aimed at, hits and blows counted
    // against it (docs/HIT_AND_BLOW_RULES.md).
    id: 'hit-and-blow',
    title: 'Hit & Blow',
    category: 'logic',
    glyph: '◉',
    storageKeys: Object.values(HB_STORAGE_KEYS),
    challenge: HIT_AND_BLOW_CHALLENGE,
    loadRoot: () =>
      import('../games/hit-and-blow/ui/HitAndBlowRoot').then((m) => ({
        default: m.HitAndBlowRoot,
      })),
    loadStorageSchemas: () => import('../games/hit-and-blow/storage/schemas'),
  },
  {
    // A box with a dot inside: the dots, and the box four lines make of
    // them (docs/DOTS_AND_BOXES_RULES.md).
    id: 'dots-and-boxes',
    title: 'Dots and Boxes',
    category: 'board',
    glyph: '⊡',
    storageKeys: Object.values(DB_STORAGE_KEYS),
    challenge: DOTS_AND_BOXES_CHALLENGE,
    loadRoot: () =>
      import('../games/dots-and-boxes/ui/DotsAndBoxesRoot').then((m) => ({
        default: m.DotsAndBoxesRoot,
      })),
    loadStorageSchemas: () => import('../games/dots-and-boxes/storage/schemas'),
  },
  {
    // The three practice-set titles of issue #210, in the order the issue
    // names them, first in the browser's early release (docs/WEB_VERSION.md
    // 「先行公開」, docs/PUZZLE_PRACTICE_SET.md). A circled equals sign for
    // the rule that sets this two-symbol puzzle apart from Takuzu: the
    // links that say two neighbours match or differ
    // (docs/BINARY_BALANCE_RULES.md). Mathematical Operators, the block
    // Futoshiki's ≶ and Kakuro's ∑ already draw from.
    id: 'binary-balance',
    title: 'Binary Balance',
    category: 'logic',
    glyph: '⊜',
    storageKeys: Object.values(BN_STORAGE_KEYS),
    challenge: BINARY_BALANCE_CHALLENGE,
    loadRoot: () =>
      import('../games/binary-balance/ui/BinaryBalanceRoot').then((m) => ({
        default: m.BinaryBalanceRoot,
      })),
    loadStorageSchemas: () => import('../games/binary-balance/storage/schemas'),
  },
  {
    // The board's one number: six digits, six rows, six columns, six 2×3
    // boxes (docs/SUDOKU_6X6_RULES.md). A bare digit, like Number Recall's
    // ?, so the card says "the small one" beside Sudoku's ⌗ at a glance.
    id: 'sudoku-6x6',
    title: 'Sudoku 6×6',
    category: 'logic',
    glyph: '6',
    storageKeys: Object.values(S6_STORAGE_KEYS),
    challenge: SUDOKU_6X6_CHALLENGE,
    loadRoot: () =>
      import('../games/sudoku-6x6/ui/Sudoku6x6Root').then((m) => ({ default: m.Sudoku6x6Root })),
    loadStorageSchemas: () => import('../games/sudoku-6x6/storage/schemas'),
    loadSettingsSection: () =>
      import('../games/sudoku-6x6/ui/Sudoku6x6SettingsSection').then((m) => ({
        default: m.Sudoku6x6SettingsSection,
      })),
  },
  {
    // A wide rectangle: the grid is cut into boxes, and the clue marks say
    // square, tall, wide or any (docs/BOX_REGIONS_RULES.md). Geometric
    // Shapes, like Minesweeper's ◆ and Bubble Pop's ○.
    id: 'box-regions',
    title: 'Box Regions',
    category: 'logic',
    glyph: '▭',
    storageKeys: Object.values(BR_STORAGE_KEYS),
    challenge: BOX_REGIONS_CHALLENGE,
    loadRoot: () =>
      import('../games/box-regions/ui/BoxRegionsRoot').then((m) => ({ default: m.BoxRegionsRoot })),
    loadStorageSchemas: () => import('../games/box-regions/storage/schemas'),
  },
  // The five new genres of docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md
  // (Nos. 42–46), in the plan's order, all in the browser's early release
  // (docs/WEB_VERSION.md「先行公開」) and not in the app until a person decides
  // they graduate (docs/RELEASE_CHECKLIST.md §0). None is a Club House
  // challenge (no `challenge`) while its saves and results may still change.
  //
  // The glyphs were checked rather than hoped at, as Futoshiki's was: the
  // bundled Nunito subset (latin-700/800, 230 code points) carries none of
  // the five, so each resolves through the `ui-rounded, system-ui, sans-serif`
  // tail of --font-display like every other symbol mark here. Coverage counts
  // are font families in this environment's fc-list (42 in all), against the
  // shipped marks: Sudoku's ⌗ 4, Memory Match's ⧉ 5, Crown Grid's ♛ 7, Ludo's
  // ⚅ 8, Sliding Puzzle's ⇄ 11. None has yet been looked at on a low-spec
  // handset (Chromium 88, system fonts only); each names its fallback, or says
  // it has none. Neighbours were looked at on every width the home grid has
  // (2 columns on a phone, 3 / 4 / 5 from 600 / 900 / 1280px), not the phone
  // alone; ΔE pairs below are light / dark accent distances (CIE76).
  {
    // A rightwards arrow to a bar: the one block that must leave, sliding out
    // through the exit at the right edge of its row (docs/UNBLOCK_PUZZLE_RULES.md).
    // Arrows, like Sliding Puzzle's ⇄ — the near miss looked at: one shaft
    // that stops at a wall, where that one is two shafts passing each other.
    // On a phone ⇄ is only its diagonal neighbour; at 4 and 5 columns it sits
    // right beside, and was kept there — the shapes still part (one arrow and
    // a wall against two arrows) and so do the accents (ΔE 34.2 / 34.5, far
    // past the 15 / 11 a shelf is held to). 25 families, more than either
    // arrow already shipped (⇄ 11, Number Path's ↝ 8). Fallback ▬, the plain
    // bar: set aside only because it is Box Regions' ▭ filled in, and Box
    // Regions is on the logic shelf — the two never share a row on the home,
    // and could meet only in search results or the favourites row.
    id: 'unblock-puzzle',
    title: 'Unblock Puzzle',
    category: 'puzzle',
    glyph: '⇥',
    channel: 'web-beta',
    storageKeys: Object.values(UB_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/unblock-puzzle/ui/UnblockPuzzleRoot').then((m) => ({
        default: m.UnblockPuzzleRoot,
      })),
    loadStorageSchemas: () => import('../games/unblock-puzzle/storage/schemas'),
  },
  {
    // A sine wave: the snake itself, one body bending across the board
    // (docs/SNAKE_RULES.md). Mathematical Operators, the block Brick Breaker's
    // ≡ on this same shelf draws from — one curved stroke where that one is
    // three straight ones (Water Sort's three waves ≋ live on the puzzle
    // shelf, Number Path's ↝ on the logic one). ≡ is right above it at 3
    // columns and Bubble Pop's ○ at 4 — a curve against bars, and against a
    // ring; at 5 the shelf is one row, with Bunny Hop's ⌃ beside it. The
    // thinnest coverage of the five: 6 families, above ⌗ / ⌖ (4) and ⧉ (5),
    // under ♛ (7). Fallback ≀ (7 families), the same wave stood on end.
    id: 'snake',
    title: 'Snake',
    category: 'arcade',
    glyph: '∿',
    channel: 'web-beta',
    storageKeys: Object.values(SN_STORAGE_KEYS),
    loadRoot: () => import('../games/snake/ui/SnakeRoot').then((m) => ({ default: m.SnakeRoot })),
    loadStorageSchemas: () => import('../games/snake/storage/schemas'),
  },
  {
    // A dotted square: one closed loop drawn along the dotted lattice of a
    // square board (docs/LOOP_PUZZLE_RULES.md). Miscellaneous Symbols and
    // Arrows; 9 families, no emoji presentation. It replaced the dotted
    // circle ◌ in the plan's Phase 4 review: measured on the real tile, ◌
    // was the faintest mark of all 46 — 0.5–0.7% of the tile in ink at 360 /
    // 768 / 1024 / 1280px, both themes, DPR 1 and 2, and 0.5% in the recent
    // row, where the next faintest is about 1.0% — while ⬚ is 2.6–2.9%, the
    // 14th–15th faintest. ▢ (4.4%) is a second outlined rectangle beside Box
    // Regions' ▭; ∮ reads as calculus before it reads as a loop; ⬡ (7
    // families) is a cell of a hexagonal board this game does not have; the
    // plain ring ○ is Bubble Pop's. ⬚ sits beside ▭ too, at every width, and
    // above or below it when both are in the recent row — kept there because
    // a square of dashes against a solid 2:1 bar parts at a glance, and so do
    // the accents (ΔE 52.7 / 49.3). On wider layouts it stacks under Binary
    // Balance's ⊜ (3 columns), Hit & Blow's ◉ (4) and Shape Regions' ▙ (5),
    // with Bridges' ⊶ beside it from 3 columns on — an open square against a
    // circled sign, a bullseye, a solid block and a dumbbell (ΔE 114.7 /
    // 125.2, 26.8 / 33.6, 19.8 / 14.4, 46.1 / 37.0). Under hi the fallback is
    // FreeSans, whose dashes all but close at tile size: there it reads as a
    // plain square (observed; still square, not ▭'s bar). Under ko it is
    // Unifont's finer dots. No fallback in hand.
    id: 'loop-puzzle',
    title: 'Loop Puzzle',
    category: 'logic',
    glyph: '⬚',
    channel: 'web-beta',
    storageKeys: Object.values(LP_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/loop-puzzle/ui/LoopPuzzleRoot').then((m) => ({ default: m.LoopPuzzleRoot })),
    loadStorageSchemas: () => import('../games/loop-puzzle/storage/schemas'),
  },
  {
    // Two islands and the bridge between them (U+22B6): the rule in one
    // figure (docs/BRIDGES_RULES.md). Mathematical Operators, the block Binary
    // Balance's ⊜ and Kakuro's ∑ on this shelf draw from; it is the only mark
    // here made of two shapes joined by a line. On wider layouts it stacks
    // under circled marks — Binary Balance's ⊜ directly above at 4 columns,
    // Hit & Blow's ◉ at 5 (each diagonal at another width) — and was judged
    // distinct: one ring holding a sign against a ring and a dot held apart
    // by a line, with the accents apart too (ΔE 76.5 / 90.0 to ⊜, 43.6 / 30.2
    // to ◉). 7 families, the same as Crown Grid's ♛ and Connect Four's ⁘.
    // Fallback ⊷, its mirror image, at the same coverage.
    id: 'bridges',
    title: 'Bridges',
    category: 'logic',
    glyph: '⊶',
    channel: 'web-beta',
    storageKeys: Object.values(BG_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/bridges/ui/BridgesRoot').then((m) => ({ default: m.BridgesRoot })),
    loadStorageSchemas: () => import('../games/bridges/storage/schemas'),
  },
  {
    // A dotted cross: the English board's cross of holes, with the pegs in it
    // (docs/PEG_SOLITAIRE_RULES.md). Not Solitaire's ♠ or anything from the
    // card suits — this is a different game under a different id. General
    // Punctuation, the dot family Connect Four's ⁘ and Gomoku's ⁙ come from
    // (7 families, as theirs), and they are on the board shelf. The near miss
    // on this shelf is 2048's ⊞, also a cross in four: that one is a framed
    // box, this one an open cross with dots. ⊕ was dropped for exactly that
    // reason — a circled plus beside a squared one — so if ⁜ fails to draw on
    // a handset, that call has to be made again rather than ⊕ dropped in.
    // ⊞ is never beside it at any width, only diagonal at 5 columns (ΔE 79.9
    // / 72.9); the mark directly above it there is Block Puzzle's framed ▣
    // (15.6 / 12.4). Its proportions follow the fallback font: FreeSans under
    // hi draws a squatter cross than DejaVu Sans elsewhere, and Unifont under
    // ko a smaller one (observed; legible in each).
    id: 'peg-solitaire',
    title: 'Peg Solitaire',
    category: 'puzzle',
    glyph: '⁜',
    channel: 'web-beta',
    storageKeys: Object.values(PG_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/peg-solitaire/ui/PegSolitaireRoot').then((m) => ({
        default: m.PegSolitaireRoot,
      })),
    loadStorageSchemas: () => import('../games/peg-solitaire/storage/schemas'),
  },
  // The titles of docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md
  // (Nos. 47–51), in number order, all built for the browser's early release
  // (docs/WEB_VERSION.md「先行公開」) and not yet on it: each is still the
  // scaffold of scripts/new-game.mjs until its own phase of the plan lands.
  // Chess (No. 47) comes in a commit of its own and ships in a PR of its own
  // (the plan's decision 4), so the other four never wait on it. None is a
  // Club House challenge (no `challenge`).
  //
  // The glyphs were measured as Nos. 42–46's were above: none is in the bundled
  // Nunito subset, so each resolves through the tail of --font-display.
  // Coverage counts are font families in this environment's fc-list (42 in
  // all). Tile ink is the share of the tile the mark inks, measured on the
  // built web home with all five present (51 titles), at 360 to 1280px, light
  // and dark, before the accents existed. Neighbours were looked at on every
  // width (2 to 5 columns). The numbers are in the plan's Phase 1 results.
  {
    // A knight (U+265E): the one piece that says chess at a glance (docs/CHESS_RULES.md). Not ♟,
    // which iOS draws as an emoji. ♞ has neither Emoji nor Emoji_Presentation, only
    // Extended_Pictographic, like Crown Grid's ♛ (checked against the Unicode 16 property data). 7
    // families, the same as ♛ and Connect Four's ⁘. On the board shelf it sits after Dots and
    // Boxes' ⊡, under Dominoes' ⊟ (2 columns), Mancala's ⊚ (3), Yacht's ⚄ (4) and Gomoku's ⁙ (5).
    // None of them is a piece. Crown Grid's ♛ is on the logic shelf, and the two meet only in the
    // favourites, recent and search rows, where a horse's head and a crown part. Tile ink 4.6-4.8%
    // (35th of the 51 measured, from the thinnest). Fallback ♜, at the same coverage. Not yet seen
    // on a low-spec handset.
    id: 'chess',
    title: 'Chess',
    category: 'board',
    glyph: '♞',
    channel: 'in-development',
    storageKeys: Object.values(CH_STORAGE_KEYS),
    loadRoot: () => import('../games/chess/ui/ChessRoot').then((m) => ({ default: m.ChessRoot })),
    loadStorageSchemas: () => import('../games/chess/storage/schemas'),
  },
  {
    // A gem cut into four (U+2756): the stone the board is made of (docs/GEM_SWAP_RULES.md). Not
    // Minesweeper's ◆, which is one solid diamond. The two are drawn by the same fallback face, and
    // four small diamonds against one solid diamond part at tile size and at row size. ◆ is on the
    // logic shelf, so the two meet only in the favourites, recent and search rows. On the puzzle
    // shelf the near miss is Peg Solitaire's ⁜, beside it at 3 and 5 columns and diagonal at 2: a
    // cross of dots against four filled diamonds. The in-game gems are separate cut silhouettes and
    // do not reuse Bubble Pop's ● ▲ ■ ◆ ✦ ☾. Neither Emoji nor Extended_Pictographic. 27 families
    // (fc-list lists Inter's weights apart; 13 distinct). Tile ink 5.1-5.2% (38th of the 51
    // measured). No fallback in hand: ◆ is Minesweeper's. Not yet seen on a low-spec handset.
    id: 'gem-swap',
    title: 'Gem Swap',
    category: 'puzzle',
    glyph: '❖',
    channel: 'in-development',
    storageKeys: Object.values(GS_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/gem-swap/ui/GemSwapRoot').then((m) => ({ default: m.GemSwapRoot })),
    loadStorageSchemas: () => import('../games/gem-swap/storage/schemas'),
  },
  {
    // A heavy T-junction (U+2523): one pipe fitting, the tile the player turns
    // (docs/PIPE_LINK_RULES.md). From Box Drawing, so it fills the full line height and stands
    // taller than its neighbours (observed: 18x51 device px against about 33 for the others). It is
    // the only box-drawing piece on the logic shelf. It sits after Bridges' ⊶ (2 and 4 columns),
    // under Loop Puzzle's ⬚ (2), Box Regions' ▭ (3), Sudoku 6x6's 6 (4) and Binary Balance's ⊜ (5).
    // The frames there are outlined boxes, not a solid T. Neither Emoji nor Extended_Pictographic.
    // 14 families. Tile ink 4.2% (30th-31st of the 51 measured). Not checked on handsets whose
    // fallback is a full-width CJK face, where the stub may sit off centre. Fallback ⊢, which is
    // thinner (2.0%). Not ┗, its corner sibling. Not yet seen on a low-spec handset.
    id: 'pipe-link',
    title: 'Pipe Link',
    category: 'logic',
    glyph: '┣',
    channel: 'in-development',
    storageKeys: Object.values(PN_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/pipe-link/ui/PipeLinkRoot').then((m) => ({ default: m.PipeLinkRoot })),
    loadStorageSchemas: () => import('../games/pipe-link/storage/schemas'),
  },
  {
    // A dashed upward arrow (U+21E1): climbing a step at a time, platform by platform
    // (docs/BOUNCE_UP_RULES.md). ◠, the bounce arc, was first choice and is not thin (1.6% tile
    // ink). It was set aside for its neighbours. At 2 columns it sits directly under Bunny Hop's ⌃,
    // and the two read as one thin upward hump, rounded against pointed. At 5 columns it sits under
    // Bubble Pop's ○, of which it is the top half. This mark's dotted shaft parts from ⌃, from ○
    // and from Sky Fighter's ▲ above it at 3 columns, with Snake's ∿ beside it from 2 to 4 columns.
    // Neither Emoji nor Extended_Pictographic. 9 families. Tile ink 1.9% (10th of the 51 measured,
    // from the thinnest). No fallback in hand: ◠ is the one ruled out above. Not yet seen on a
    // low-spec handset. The owner's spec kept ◠ unless it was thin, and it is not; the switch is for
    // the Bunny Hop neighbour, and the owner approved it on 2026-10-20
    // (docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md, decision 7).
    id: 'bounce-up',
    title: 'Bounce Up',
    category: 'arcade',
    glyph: '⇡',
    channel: 'in-development',
    storageKeys: Object.values(BO_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/bounce-up/ui/BounceUpRoot').then((m) => ({ default: m.BounceUpRoot })),
    loadStorageSchemas: () => import('../games/bounce-up/storage/schemas'),
  },
  {
    // Two beamed notes (U+266B): the sounds the pads play back (docs/ECHO_PADS_RULES.md). The
    // single note ♪ was first choice and was dropped because it was the thinnest mark on the home
    // at every width and theme, at 0.75-0.77% tile ink against about 1.0% for the next. This mark
    // has Extended_Pictographic only, neither Emoji nor Emoji_Presentation, like Crown Grid's ♛
    // (checked against the Unicode 16 property data). 17 families. Its ink follows the fallback
    // face: 1.2% in Liberation Sans, the face here, and 2.0% in DejaVu Sans. Its rank, 4th of the
    // 51 measured from the thinnest, is only just clear of Quick Math's ÷. No note-like mark is on
    // the drills shelf. It sits beside Memory Match's ⧉ (3 and 5 columns) and under Number Recall's
    // ?, Schulte Table's ⌖ and Quick Math's ÷ (2, 3 and 4 columns). Heavier fallback ♬ (U+266C,
    // same coverage). Not yet seen on a low-spec handset.
    id: 'echo-pads',
    title: 'Echo Pads',
    category: 'drills',
    glyph: '♫',
    channel: 'in-development',
    storageKeys: Object.values(EP_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/echo-pads/ui/EchoPadsRoot').then((m) => ({ default: m.EchoPadsRoot })),
    loadStorageSchemas: () => import('../games/echo-pads/storage/schemas'),
  },
  // The titles of docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md
  // (Nos. 52–56), in number order. Each is playable. Make the Target, Nested
  // Tic-Tac-Toe and Tangram are on the browser's early-release channel
  // (docs/WEB_VERSION.md「先行公開」): the change that made them playable turned
  // them from `'in-development'` to `'web-beta'` on 2026-10-21, and the
  // browser version has carried them since 2026-10-22 JST (2026-10-21 17:38
  // UTC — the landing's publish of main `11a3036`, after landing #204 listed
  // them as beta; WEB_VERSION.md「landing 側のガード」). They are not in the
  // app until a person decides they graduate (docs/RELEASE_CHECKLIST.md §0).
  // Overtake and Scopa stay `'in-development'` (their chunks ship in that
  // same build, but no door opens them — app/gameChannel.ts) although
  // playable, because their rules documents hold the switch back:
  // Overtake until the Phase 0 device result is recorded in
  // docs/OVERTAKE_RULES.md §3 (or until it ships with `DRAG_MAPPING` `'B'`),
  // Scopa until the product owner decides how its CPU beat resumes when the
  // app comes back to the foreground (docs/SCOPA_RULES.md §4.2). Nos. 47–51
  // above are still `'in-development'`. None is a Club House challenge (no
  // `challenge`) while its saves and results may still change.
  //
  // The glyphs were measured as Nos. 42–51's were above: none is in the bundled
  // Nunito subset, so each resolves through the tail of --font-display, except
  // Make the Target's =, which Nunito draws itself. Coverage counts are font
  // families in this environment's fc-list (42 in all; the plan's brief carried
  // higher counts from another machine). Tile ink is the share of the tile the
  // mark inks, measured on the built web home with these five present (51
  // titles: before Nos. 47–51 merged ahead of them), at 360 to 1280px, light
  // and dark, before the accents existed. Neighbours were looked at on every
  // width (2 to 5 columns) as the shelves stood then, and computed from the
  // registry order for the shelves as they stand now with Nos. 47–51 ahead
  // (that arrangement is not yet seen on a built home). The numbers are in the
  // plan's Phase 1 results.
  {
    // A dashed centre line (U+2507): the road the player threads traffic on
    // (docs/OVERTAKE_RULES.md). From Box Drawing, like Pipe Link's ┣, so it fills the full line
    // height and stands taller than its neighbours (observed: 8x47 device px against about 33 for
    // the others). Unlike ┣ it is symmetric, so a full-width CJK fallback cell leaves it on centre
    // (observed: 0 px offset in WenQuanYi Zen Hei and Unifont, where ┣ drifts 3.6 px right); the
    // bar stays thin there, it does not go full width. On the arcade shelf it sits after Snake's ∿
    // (2 to 4 columns), under Bunny Hop's ⌃ (2), Sky Fighter's ▲ (3), Brick Breaker's ≡ (4) and
    // Bubble Pop's ○ (5); with Bounce Up's ⇡ ahead of it, as it now is, after ⇡ (4 and 5 columns), under ∿
    // (2), ⌃ (3), ▲ (4) and ≡ (5). ≡ is three short horizontal bars, 20x18 device px, against one
    // tall vertical dashed bar: orientation and proportion both differ. ┣ is on the logic shelf and
    // the two meet only in the favourites, recent and search rows, where a heavy T parts from a
    // dashed bar. Neither Emoji nor Extended_Pictographic. 12 families. Tile ink 2.9% (21st of the
    // 51 measured, from the thinnest); 1.6-2.1% in the thinner fallback faces (FreeSans, WenQuanYi,
    // Unifont), still clear of the bottom three. Fallback ∥, which reads as a pause mark, or the
    // same shape with one more dash, ┋. Not ⫼, ⇈, ⛐, ⛟ or ⚑ (the plan's reasons). Not yet seen on a
    // low-spec handset.
    id: 'overtake',
    title: 'Overtake',
    category: 'arcade',
    glyph: '┇',
    channel: 'in-development',
    storageKeys: Object.values(OT_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/overtake/ui/OvertakeRoot').then((m) => ({ default: m.OvertakeRoot })),
    loadStorageSchemas: () => import('../games/overtake/storage/schemas'),
  },
  {
    // An equals sign (U+003D): the last number left has to equal the target
    // (docs/MAKE_THE_TARGET_RULES.md). ∴, three dots converging on a conclusion, was first choice
    // and was dropped because it was the thinnest mark on the home at every width and theme, at
    // 0.97-1.01% tile ink against 1.04-1.08% for Reversi's ◐ next, and no fallback face lifts it
    // past 1.2%; in the favourites, recent and search rows it also read as one more small cluster
    // of dots beside Connect Four's ⁘ and Gomoku's ⁙. Not 24: it is the target that a trademarked
    // product is named after, which docs/BRAND.md keeps out of the app, and the targets here vary
    // by tier. ASCII is in the bundled Nunito subset, so this tile is drawn by Nunito ExtraBold
    // like Number Match's 10, Takuzu's 01, Sudoku 6x6's 6 and Quick Math's ÷: no fallback face, no
    // coverage question (39 families regardless), no emoji property. A small mark, two bold bars of
    // 10.5x6.5 CSS px. Tile ink 1.5-1.6% (6th-7th of the 51 measured, from the thinnest: clear of
    // the bottom three, level with Bunny Hop's ⌃, Gin Rummy's ♢ and Brick Breaker's ≡). On the
    // puzzle shelf no other mark is a bar: it sits before Tangram's ⊿ (2, 4 and 5 columns), after
    // Peg Solitaire's ⁜ (3 and 5), under Unblock Puzzle's ⇥ (2), Sliding Puzzle's ⇄ (3), Water
    // Sort's ≋ (4) and, at 5 columns only, directly under Number Match's 10, where the two read as
    // "10 / ="; with Gem Swap's ❖ ahead of it, as it now is, after ❖ (2, 4 and 5 columns) and 10 is
    // diagonal instead. ≡ (arcade), Binary Balance's ⊜ (logic) and 01 (logic) meet it only in the
    // favourites, recent and search rows: three thin bars, a circled equals and two digits against
    // two bold bars, ≡ being the nearest (16x13 against 16x10 px at row size, accents apart).
    // Fallback ± (U+00B1, also Nunito, 1.9-2.0%, 9th-10th), which names only two of the four
    // operations and shares a cross with ⁜ beside it at 3 and 5 columns and with Quick Math's ÷ in
    // the rows. Not ∗ (3.0%, 10 families: a radiating mark like ⁜, and reads as a star), +
    // (4th-5th, and the shape of the shell's IconAdd), ⁼ (as thin as ∴), ≟ (muddy at 16px), ⁂
    // (reads as a clover), ∵ ∷ ⋰ (as thin as ∴), nor any circled mark (◎ is on this shelf). Not yet
    // seen on a low-spec handset.
    id: 'make-the-target',
    title: 'Make the Target',
    category: 'puzzle',
    glyph: '=',
    channel: 'web-beta',
    storageKeys: Object.values(TG_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/make-the-target/ui/MakeTheTargetRoot').then((m) => ({
        default: m.MakeTheTargetRoot,
      })),
    loadStorageSchemas: () => import('../games/make-the-target/storage/schemas'),
  },
  {
    // The X of noughts and crosses in one character (U+2573): the mark the player sets in the small
    // boards (docs/NESTED_TIC_TAC_TOE_RULES.md). From Box Drawing, so it fills the full line height
    // and is taller than wide (observed: 31x51 device px, strokes about 2.2 CSS px). The shell's
    // close button is not a character but IconClose in ui/components/icons.tsx, a square X of
    // 1.75-unit strokes on a 24-unit grid (13x13 CSS px at its 22px size, in --ink-soft), shown
    // only in a tutorial header; no × ✕ ✖ ╳ appears anywhere in the shell's copy. Beside it this
    // mark is tall, heavier and sits in accent on an accent tile, and on the board shelf it read as
    // a letter X. The usual close characters of the web are × and ✕, so neither is a better answer
    // to that worry; ⌧ is an X in a box, the clear key; ⊠ would be the seventh framed mark on this
    // shelf (⊚ ⊟ ⊡ ⊜ ⊞ ⊶), the reason ⊗ was ruled out; ✖ has the Emoji property, becomes an RGI
    // emoji with U+FE0F and is in Noto Color Emoji here. This one has neither Emoji nor
    // Extended_Pictographic. 12 families. On the board shelf it sits after Dots and Boxes' ⊡ (2, 4
    // and 5 columns), under Dominoes' ⊟ (2), Mancala's ⊚ (3), Yacht's ⚄ (4) and Gomoku's ⁙ (5);
    // with Chess's ♞ ahead of it, as it now is, after ♞ (3 and 4 columns), under ⊡ (2), ⊟ (3), ⊚ (4) and ⚄
    // (5). No other X is on the home. In a full-width fallback face (FreeSans, WenQuanYi) it
    // becomes a square X of 44x44 device px, still an X. Tile ink 4.3-4.5% (33rd-34th of the 51
    // measured, from the thinnest). Fallback ✕ (U+2715, 8 families, 2.8%), with the caveat above.
    // Not yet seen on a low-spec handset.
    id: 'nested-tic-tac-toe',
    title: 'Nested Tic-Tac-Toe',
    category: 'board',
    glyph: '╳',
    channel: 'web-beta',
    storageKeys: Object.values(NT_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/nested-tic-tac-toe/ui/NestedTicTacToeRoot').then((m) => ({
        default: m.NestedTicTacToeRoot,
      })),
    loadStorageSchemas: () => import('../games/nested-tic-tac-toe/storage/schemas'),
  },
  {
    // A white club (U+2667): the third hollow suit on the cards shelf, where hollow has meant
    // somebody sits across the table since Hearts' ♡ and Gin Rummy's ♢ (docs/SCOPA_RULES.md). Not
    // ♣, which is Spider Solitaire's, has the Emoji property, becomes an RGI emoji with U+FE0F and
    // is in Noto Color Emoji here; this one has Extended_Pictographic only, like ♡ ♢ ♛ (checked
    // against the Unicode 16 property data), and is not in that emoji font. 14 families. It sits
    // after Gin Rummy's ♢ (2 to 4 columns), under Hearts' ♡ (2), FreeCell's ♥ (3), Spider
    // Solitaire's ♣ (4) and Solitaire's ♠ (5); ♣ is diagonal at 3 and 5. Hollow against filled is
    // the pair ♡ and ♥ already make side by side at 2, 4 and 5 columns, and here the faces add
    // size: DejaVu Sans draws this one 30x32 device px, Liberation Sans draws ♣ 25x25 (the size
    // difference goes where both fall to one face). Both parted at tile size and at row size. Tile
    // ink 2.5-2.6% (15th of the 51 measured, from the thinnest; ♣ is 3.0%). No fallback in hand: ♤
    // is thinner (2.0%) and sits on the same shelf as ♠. Not yet seen on a low-spec handset.
    id: 'scopa',
    title: 'Scopa',
    category: 'cards',
    glyph: '♧',
    channel: 'in-development',
    storageKeys: Object.values(SC_STORAGE_KEYS),
    loadRoot: () => import('../games/scopa/ui/ScopaRoot').then((m) => ({ default: m.ScopaRoot })),
    loadStorageSchemas: () => import('../games/scopa/storage/schemas'),
  },
  {
    // A right triangle (U+22BF): the piece the set has most of, and the one every silhouette is cut
    // from (docs/TANGRAM_RULES.md). Not ◩, ⟁ or ⬠, which the plan feared were thin: measured, they
    // are 6.9-7.1%, 4.2% and 3.3% tile ink, heavier than this mark, and only their coverage is low
    // (9, 6 and 7 families). This one is 11 families, neither Emoji nor Extended_Pictographic. It
    // is small, a math operator rather than a geometric shape in DejaVu Sans (26x25 device px, a
    // quarter of the tile, and set a little low and right), but not thin: tile ink 2.7-2.9%
    // (17th-19th of the 51 measured, from the thinnest, just above Loop Puzzle's ⬚). On the puzzle
    // shelf it sits after Make the Target (2, 4 and 5 columns), under Peg Solitaire's ⁜ (2),
    // Unblock Puzzle's ⇥ (3), Sliding Puzzle's ⇄ (4) and Water Sort's ≋ (5); with Gem Swap's ❖ ahead of
    // these, as it now is, under ❖ (2), ⁜ (3), ⇥ (4) and ⇄ (5). No triangle is on this shelf. Sky
    // Fighter's ▲ (arcade) and Shape Regions' ▙ (logic) meet it only in the favourites, recent and
    // search rows, where a hollow right triangle parts from a solid isosceles and a solid block.
    // Its size follows the fallback face: IPAGothic and WenQuanYi draw it at 34-37 px, Unifont at
    // 18. Fallback ◿ (U+25FF, 9 families, 3.2-3.3%), the same orientation drawn larger. Not yet
    // seen on a low-spec handset.
    id: 'tangram',
    title: 'Tangram',
    category: 'puzzle',
    glyph: '⊿',
    channel: 'web-beta',
    storageKeys: Object.values(TN_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/tangram/ui/TangramRoot').then((m) => ({ default: m.TangramRoot })),
    loadStorageSchemas: () => import('../games/tangram/storage/schemas'),
  },
];
