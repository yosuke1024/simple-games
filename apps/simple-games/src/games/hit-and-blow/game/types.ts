/**
 * Core Hit & Blow types. See docs/HIT_AND_BLOW_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A code is a row of symbol indices (§1). The symbols are drawn, never
 * written, so a row reads the same in every language (docs/I18N_POLICY.md);
 * their order and ids are fixed because saves store the index and the
 * catalog names the id.
 */

/** The eight symbols, in index order (§1). Never reorder: saves hold the index. */
export const SYMBOL_IDS = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'star',
  'cross',
  'hexagon',
  'heart',
] as const;

export type SymbolId = (typeof SYMBOL_IDS)[number];

/** Every symbol any difficulty can use. */
export const SYMBOL_COUNT = SYMBOL_IDS.length;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** How many positions the code has (§1). */
export const SLOTS_FOR: Readonly<Record<Difficulty, number>> = { easy: 4, normal: 4, hard: 5 };

/** How many symbols are in play: indices 0 up to this, exclusive (§1). */
export const POOL_FOR: Readonly<Record<Difficulty, number>> = { easy: 6, normal: 8, hard: 8 };

/** A code — the secret or a guess — as symbol indices, one per position. */
export type Code = readonly number[];

/** A slot in the row being composed: a symbol index, or empty. */
export type DraftSlot = number | null;

/** What a guess scored against the secret (§4). */
export interface Feedback {
  /** Right symbol, right position. */
  readonly hits: number;
  /** Right symbol, wrong position. */
  readonly blows: number;
}

export type GameStatus = 'playing' | 'won';
