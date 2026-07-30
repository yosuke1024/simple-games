/**
 * The collection's game list. Deliberately thin — an entry is a title card, a
 * mount point, and the keys the game owns, not a plugin system. A new game adds
 * one import and one array element; the shell never reaches deeper than this.
 */
import type { ComponentType } from 'react';
import { NM_STORAGE_KEYS } from '../games/number-match/storage/schemas';
import { NumberMatchRoot } from '../games/number-match/ui/NumberMatchRoot';
import { SD_STORAGE_KEYS } from '../games/sudoku/storage/schemas';
import { SudokuRoot } from '../games/sudoku/ui/SudokuRoot';
import { SudokuSettingsSection } from '../games/sudoku/ui/SudokuSettingsSection';
import type { MessageKey } from '../i18n';

export type GameId = 'number-match' | 'sudoku';

export interface GameModule {
  id: GameId;
  /** Title as a proper noun — identical in every language. */
  title: string;
  /** Localized one-liner under the title on the collection card. */
  blurbKey: MessageKey;
  /** The series mark: one glyph on an accent tile identifies the game. */
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
    id: 'number-match',
    title: 'Number Match',
    blurbKey: 'numberMatchBlurb',
    glyph: '10',
    Root: NumberMatchRoot,
    storageKeys: Object.values(NM_STORAGE_KEYS),
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    blurbKey: 'sudokuBlurb',
    glyph: '⌗',
    Root: SudokuRoot,
    storageKeys: Object.values(SD_STORAGE_KEYS),
    SettingsSection: SudokuSettingsSection,
  },
];
