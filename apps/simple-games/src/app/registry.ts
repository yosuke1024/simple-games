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
 * The order here is the order on the collection home. Games are listed by how
 * likely someone is to be looking for them by name, not by when they were
 * built, so the list stays useful as it grows. It does not have to carry the
 * whole burden of that: the home puts the games somebody actually plays in a
 * shortcut row above the list (app/recentGames.ts), so this order is a stable
 * place to find a title, not a ranking that has to be kept current.
 */
import type { ComponentType } from 'react';
import { BB_STORAGE_KEYS } from '../games/brick-breaker/storage/keys';
import { BP_STORAGE_KEYS } from '../games/block-puzzle/storage/keys';
import { DR_STORAGE_KEYS } from '../games/dino-run/storage/keys';
import { MM_STORAGE_KEYS } from '../games/memory-match/storage/keys';
import { MS_STORAGE_KEYS } from '../games/minesweeper/storage/keys';
import { NG_STORAGE_KEYS } from '../games/nonogram/storage/keys';
import { NM_STORAGE_KEYS } from '../games/number-match/storage/keys';
import { SD_STORAGE_KEYS } from '../games/sudoku/storage/keys';
import { SF_STORAGE_KEYS } from '../games/sky-fighter/storage/keys';
import { SO_STORAGE_KEYS } from '../games/solitaire/storage/keys';
import { SP_STORAGE_KEYS } from '../games/sliding-puzzle/storage/keys';
import { TM_STORAGE_KEYS } from '../games/2048/storage/keys';
import { WS_STORAGE_KEYS } from '../games/water-sort/storage/keys';

export type GameId =
  | 'sudoku'
  | 'minesweeper'
  | 'nonogram'
  | 'number-match'
  | 'sliding-puzzle'
  | 'memory-match'
  | 'water-sort'
  | 'solitaire'
  | 'brick-breaker'
  | 'sky-fighter'
  | 'dino-run'
  | '2048'
  | 'block-puzzle';

export interface GameDefinition {
  id: GameId;
  /**
   * Title as a proper noun — identical in every language. That is what lets
   * the collection home lay the whole list out as a grid of short cards in all
   * fourteen locales; a translated sentence could not hold that shape.
   */
  title: string;
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
    glyph: '♠',
    storageKeys: Object.values(SO_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/solitaire/ui/SolitaireRoot').then((m) => ({ default: m.SolitaireRoot })),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
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
    glyph: '⊞',
    storageKeys: Object.values(TM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/2048/ui/Game2048Root').then((m) => ({ default: m.Game2048Root })),
  },
  {
    id: 'block-puzzle',
    title: 'Block Puzzle',
    glyph: '▣',
    storageKeys: Object.values(BP_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/block-puzzle/ui/BlockPuzzleRoot').then((m) => ({
        default: m.BlockPuzzleRoot,
      })),
  },
  {
    id: 'brick-breaker',
    title: 'Brick Breaker',
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
    glyph: '▦',
    storageKeys: Object.values(NG_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/nonogram/ui/NonogramRoot').then((m) => ({ default: m.NonogramRoot })),
  },
  {
    id: 'number-match',
    title: 'Number Match',
    glyph: '10',
    storageKeys: Object.values(NM_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/number-match/ui/NumberMatchRoot').then((m) => ({
        default: m.NumberMatchRoot,
      })),
  },
  {
    id: 'water-sort',
    title: 'Water Sort',
    glyph: '≋',
    storageKeys: Object.values(WS_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/water-sort/ui/WaterSortRoot').then((m) => ({ default: m.WaterSortRoot })),
  },
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
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
    glyph: '▲',
    storageKeys: Object.values(SF_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/sky-fighter/ui/SkyFighterRoot').then((m) => ({
        default: m.SkyFighterRoot,
      })),
  },
  {
    id: 'dino-run',
    title: 'Dino Run',
    glyph: '⌁',
    storageKeys: Object.values(DR_STORAGE_KEYS),
    loadRoot: () =>
      import('../games/dino-run/ui/DinoRunRoot').then((m) => ({
        default: m.DinoRunRoot,
      })),
  },
];
