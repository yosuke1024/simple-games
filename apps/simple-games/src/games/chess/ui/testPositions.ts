/**
 * Saved games for the screen tests, written as the move lists play makes
 * (docs/CHESS_RULES.md §7.1). Every list below is legal from the standard
 * position — the loader replays it, so a wrong one would simply load as no
 * game at all and the test using it would say so.
 */
import { CH_STORAGE_KEYS } from '../storage/keys';
import type { PersistedGame } from '../storage/schemas';

export interface SavedOptions {
  readonly side?: 'white' | 'black';
  readonly difficulty?: PersistedGame['difficulty'];
  readonly elapsedSeconds?: number;
  readonly seed?: string;
}

/** The record a game with these moves would have saved. */
export function savedRecord(moves: string, options: SavedOptions = {}): string {
  const record: PersistedGame = {
    schemaVersion: 1,
    seed: options.seed ?? 'chess-uitest',
    difficulty: options.difficulty ?? 'easy',
    side: options.side ?? 'white',
    moves,
    elapsedSeconds: options.elapsedSeconds ?? 0,
    savedAt: 1,
  };
  return JSON.stringify(record);
}

export const SAVE_KEY = CH_STORAGE_KEYS.game;

/** White to move with a pawn on b7: b8 to promote by a push, a8 and c8 by capture. */
export const PROMOTION = 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 b8d7';

/** Black (the player) to move after 2. g4: Qh4 is mate — the fool's mate. */
export const FOOLS_MATE_FOR_BLACK = 'f2f3 e7e5 g2g4';

/** Black (the player) in check from Qh5: g6 is the one legal move. */
export const BLACK_IN_CHECK = 'e2e4 f7f5 d1h5';

/** White (the player) has moved; the CPU is to answer. */
export const CPU_TO_MOVE = 'e2e4';
