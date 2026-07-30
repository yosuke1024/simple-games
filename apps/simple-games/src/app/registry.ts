/**
 * The collection's game list. Deliberately thin — an entry is a title card
 * plus a mount point, not a plugin system. A new game adds one import and one
 * array element; the shell never reaches deeper than this file.
 */
import type { ComponentType } from 'react';
import { NM_STORAGE_KEYS } from '../games/number-match/storage/schemas';
import { NumberMatchRoot } from '../games/number-match/ui/NumberMatchRoot';
import type { MessageKey } from '../i18n';

export type GameId = 'number-match';

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
];
