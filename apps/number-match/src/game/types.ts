export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Cell {
  readonly value: Digit;
  readonly cleared: boolean;
}

/** Flat board in reading order (left→right, top→bottom), 9 columns per row. */
export type Board = readonly Cell[];

export type GameStatus = 'playing' | 'cleared' | 'gameOver';

export type GameMode = 'classic' | 'daily';
