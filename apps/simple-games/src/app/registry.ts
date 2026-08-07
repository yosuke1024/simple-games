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
import { C4_STORAGE_KEYS } from '../games/connect-four/storage/keys';
import { CK_STORAGE_KEYS } from '../games/checkers/storage/keys';
import { GM_STORAGE_KEYS } from '../games/gomoku/storage/keys';
import { FC_STORAGE_KEYS } from '../games/freecell/storage/keys';
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
import { TM_STORAGE_KEYS } from '../games/2048/storage/keys';
import { WS_STORAGE_KEYS } from '../games/water-sort/storage/keys';

export type GameId =
  | 'sudoku'
  | 'minesweeper'
  | 'nonogram'
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
  | 'brick-breaker'
  | 'sky-fighter'
  | 'bunny-hop'
  | '2048'
  | 'block-puzzle'
  | 'checkers'
  | 'reversi'
  | 'connect-four'
  | 'gomoku';

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
   * Loads the game's root component from its own bundled chunk. Roots are
   * named exports; the shim to `{ default }` is what React.lazy expects
   * (app/lazyRoots.ts caches the lazy wrapper per game).
   */
  loadRoot: () => Promise<{ default: ComponentType<{ onExit: () => void }> }>;
  /**
   * Optional: the game's own settings, rendered inside the shared settings
   * screen. A game owns its options; the shell only lends them a place.
   * Loading one pulls the game's chunk — acceptable, because it happens on
   * the settings screen, never on the home.
   */
  loadSettingsSection?: () => Promise<{ default: ComponentType }>;
}

export const GAMES: readonly GameDefinition[] = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    category: 'logic',
    glyph: '⌗',
    storageKeys: Object.values(SD_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/sudoku/ui/SudokuRoot').then((m) => ({ default: m.SudokuRoot })),
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
    loadRoot: () =>
      import('../games/solitaire/ui/SolitaireRoot').then((m) => ({ default: m.SolitaireRoot })),
  },
  {
    id: 'spider-solitaire',
    title: 'Spider Solitaire',
    category: 'cards',
    glyph: '♣',
    storageKeys: Object.values(SS_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/spider-solitaire/ui/SpiderRoot').then((m) => ({ default: m.SpiderRoot })),
  },
  {
    id: 'freecell',
    title: 'FreeCell',
    category: 'cards',
    glyph: '♥',
    storageKeys: Object.values(FC_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/freecell/ui/FreeCellRoot').then((m) => ({ default: m.FreeCellRoot })),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    category: 'logic',
    glyph: '◆',
    storageKeys: Object.values(MS_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/minesweeper/ui/MinesweeperRoot').then((m) => ({
        default: m.MinesweeperRoot,
      })),
  },
  {
    id: '2048',
    title: '2048',
    category: 'puzzle',
    glyph: '⊞',
    storageKeys: Object.values(TM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/2048/ui/Game2048Root').then((m) => ({ default: m.Game2048Root })),
  },
  {
    id: 'block-puzzle',
    title: 'Block Puzzle',
    category: 'puzzle',
    glyph: '▣',
    storageKeys: Object.values(BP_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/block-puzzle/ui/BlockPuzzleRoot').then((m) => ({
        default: m.BlockPuzzleRoot,
      })),
  },
  {
    id: 'checkers',
    // The mark is the board itself: two dark squares on the diagonal, which
    // is the one picture no other title in the collection could be. The
    // draughts piece that was the first choice is a filled circle, and it
    // would have sat beside Reversi's half-filled one.
    title: 'Checkers',
    glyph: '▚',
    storageKeys: Object.values(CK_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/checkers/ui/CheckersRoot').then((m) => ({ default: m.CheckersRoot })),
  },
  {
    id: 'reversi',
    title: 'Reversi',
    category: 'board',
    glyph: '◐',
    storageKeys: Object.values(RV_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/reversi/ui/ReversiRoot').then((m) => ({ default: m.ReversiRoot })),
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
  },
  {
    id: 'gomoku',
    // Five dots, where Connect Four has four (U+2058 and U+2059): the two
    // titles are the same idea at different lengths, and the marks say so.
    title: 'Gomoku',
    glyph: '⁙',
    storageKeys: Object.values(GM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/gomoku/ui/GomokuRoot').then((m) => ({ default: m.GomokuRoot })),
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
  },
  {
    id: 'nonogram',
    title: 'Nonogram',
    category: 'logic',
    glyph: '▦',
    storageKeys: Object.values(NG_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/nonogram/ui/NonogramRoot').then((m) => ({ default: m.NonogramRoot })),
  },
  {
    id: 'number-match',
    title: 'Number Match',
    category: 'puzzle',
    glyph: '10',
    storageKeys: Object.values(NM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/number-match/ui/NumberMatchRoot').then((m) => ({
        default: m.NumberMatchRoot,
      })),
  },
  // The three drills lead the drills section: they are the shortest sittings
  // in the collection and the only titles measured in seconds.
  {
    id: 'quick-math',
    title: 'Quick Math',
    category: 'drills',
    glyph: '÷',
    storageKeys: Object.values(QM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/quick-math/ui/QuickMathRoot').then((m) => ({ default: m.QuickMathRoot })),
  },
  {
    id: 'schulte-table',
    title: 'Schulte Table',
    category: 'drills',
    glyph: '⌖',
    storageKeys: Object.values(ST_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/schulte-table/ui/SchulteTableRoot').then((m) => ({
        default: m.SchulteTableRoot,
      })),
  },
  {
    id: 'number-recall',
    title: 'Number Recall',
    category: 'drills',
    glyph: '?',
    storageKeys: Object.values(NR_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/number-recall/ui/NumberRecallRoot').then((m) => ({
        default: m.NumberRecallRoot,
      })),
  },
  {
    id: 'water-sort',
    title: 'Water Sort',
    category: 'puzzle',
    glyph: '≋',
    storageKeys: Object.values(WS_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/water-sort/ui/WaterSortRoot').then((m) => ({ default: m.WaterSortRoot })),
  },
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    category: 'puzzle',
    glyph: '⇄',
    storageKeys: Object.values(SP_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/sliding-puzzle/ui/SlidingPuzzleRoot').then((m) => ({
        default: m.SlidingPuzzleRoot,
      })),
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    category: 'drills',
    glyph: '⧉',
    storageKeys: Object.values(MM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/memory-match/ui/MemoryMatchRoot').then((m) => ({
        default: m.MemoryMatchRoot,
      })),
  },
  {
    id: 'sky-fighter',
    title: 'Sky Fighter',
    category: 'arcade',
    glyph: '▲',
    storageKeys: Object.values(SF_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/sky-fighter/ui/SkyFighterRoot').then((m) => ({
        default: m.SkyFighterRoot,
      })),
  },
  {
    id: 'bunny-hop',
    title: 'Bunny Hop',
    category: 'arcade',
    glyph: '⌃',
    storageKeys: Object.values(BH_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/bunny-hop/ui/BunnyHopRoot').then((m) => ({
        default: m.BunnyHopRoot,
      })),
  },
];
