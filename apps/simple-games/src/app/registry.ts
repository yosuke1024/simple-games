/**
 * The collection's game list. Deliberately thin — an entry is a title card, a
 * mount point, and the keys the game owns, not a plugin system. A new game adds
 * one import and one array element; the shell never reaches deeper than this.
 *
 * The order here is the order on the collection home. Games are listed by how
 * likely someone is to be looking for them by name, not by when they were
 * built, so the list stays useful as it grows. It does not have to carry the
 * whole burden of that: the home puts the games somebody actually plays in a
 * shortcut row above the list (app/recentGames.ts), so this order is a stable
 * place to find a title, not a ranking that has to be kept current.
 */
import type { ComponentType } from 'react';
import { BB_STORAGE_KEYS } from '../games/brick-breaker/storage/schemas';
import { BrickBreakerRoot } from '../games/brick-breaker/ui/BrickBreakerRoot';
import { MM_STORAGE_KEYS } from '../games/memory-match/storage/schemas';
import { MemoryMatchRoot } from '../games/memory-match/ui/MemoryMatchRoot';
import { MS_STORAGE_KEYS } from '../games/minesweeper/storage/schemas';
import { MinesweeperRoot } from '../games/minesweeper/ui/MinesweeperRoot';
import { NG_STORAGE_KEYS } from '../games/nonogram/storage/schemas';
import { NonogramRoot } from '../games/nonogram/ui/NonogramRoot';
import { NM_STORAGE_KEYS } from '../games/number-match/storage/schemas';
import { NumberMatchRoot } from '../games/number-match/ui/NumberMatchRoot';
import { SP_STORAGE_KEYS } from '../games/sliding-puzzle/storage/schemas';
import { SlidingPuzzleRoot } from '../games/sliding-puzzle/ui/SlidingPuzzleRoot';
import { SO_STORAGE_KEYS } from '../games/solitaire/storage/schemas';
import { SolitaireRoot } from '../games/solitaire/ui/SolitaireRoot';
import { SD_STORAGE_KEYS } from '../games/sudoku/storage/schemas';
import { SF_STORAGE_KEYS } from '../games/sky-fighter/storage/schemas';
import { SkyFighterRoot } from '../games/sky-fighter/ui/SkyFighterRoot';
import { SudokuRoot } from '../games/sudoku/ui/SudokuRoot';
import { SudokuSettingsSection } from '../games/sudoku/ui/SudokuSettingsSection';
import { WS_STORAGE_KEYS } from '../games/water-sort/storage/schemas';
import { WaterSortRoot } from '../games/water-sort/ui/WaterSortRoot';

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
  | 'sky-fighter';

export interface GameModule {
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
  Root: ComponentType<{ onExit: () => void }>;
  /**
   * Every key this game persists, for "Reset Local Data". Listed here so the
   * shell can wipe honestly without knowing any game's storage internals.
   */
  storageKeys: readonly string[];
  /**
   * Optional: the game's own settings, rendered inside the shared settings
   * screen. A game owns its options; the shell only lends them a place.
   */
  SettingsSection?: ComponentType;
}

export const GAMES: readonly GameModule[] = [
  {
    id: 'sudoku',
    title: 'Sudoku',
    glyph: '⌗',
    Root: SudokuRoot,
    storageKeys: Object.values(SD_STORAGE_KEYS),
    SettingsSection: SudokuSettingsSection,
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    glyph: '♠',
    Root: SolitaireRoot,
    storageKeys: Object.values(SO_STORAGE_KEYS),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    glyph: '◆',
    Root: MinesweeperRoot,
    storageKeys: Object.values(MS_STORAGE_KEYS),
  },
  {
    id: 'brick-breaker',
    title: 'Brick Breaker',
    glyph: '≡',
    Root: BrickBreakerRoot,
    storageKeys: Object.values(BB_STORAGE_KEYS),
  },
  {
    id: 'nonogram',
    title: 'Nonogram',
    glyph: '▦',
    Root: NonogramRoot,
    storageKeys: Object.values(NG_STORAGE_KEYS),
  },
  {
    id: 'number-match',
    title: 'Number Match',
    glyph: '10',
    Root: NumberMatchRoot,
    storageKeys: Object.values(NM_STORAGE_KEYS),
  },
  {
    id: 'water-sort',
    title: 'Water Sort',
    glyph: '≋',
    Root: WaterSortRoot,
    storageKeys: Object.values(WS_STORAGE_KEYS),
  },
  {
    id: 'sliding-puzzle',
    title: 'Sliding Puzzle',
    glyph: '⇄',
    Root: SlidingPuzzleRoot,
    storageKeys: Object.values(SP_STORAGE_KEYS),
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    glyph: '⧉',
    Root: MemoryMatchRoot,
    storageKeys: Object.values(MM_STORAGE_KEYS),
  },
  {
    id: 'sky-fighter',
    title: 'Sky Fighter',
    glyph: '▲',
    Root: SkyFighterRoot,
    storageKeys: Object.values(SF_STORAGE_KEYS),
  },
];
