/**
 * Core Memory Match types. See docs/MEMORY_MATCH_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A deck is cols×rows symbol indices, row-major; every symbol appears exactly
 * twice (§1). Cards carry symbols and nothing else — no letters, no pictures
 * (§1, docs/I18N_POLICY.md), so a board is legible in every language at once.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'medium' || value === 'hard';

export interface Layout {
  readonly cols: number;
  readonly rows: number;
  readonly pairs: number;
}

/** The three boards this release ships (§6). */
export const LAYOUTS: Record<Difficulty, Layout> = {
  easy: { cols: 3, rows: 4, pairs: 6 },
  medium: { cols: 4, rows: 5, pairs: 10 },
  hard: { cols: 5, rows: 6, pairs: 15 },
};

/**
 * How many distinct symbols the app draws (§1). Hard uses all of them; the
 * smaller boards deal a seeded subset so two easy games rarely share a face.
 */
export const SYMBOL_COUNT = 15;

/** Symbol index per cell, row-major. Every value appears exactly twice. */
export type Deck = readonly number[];

export const cellCount = (layout: Layout): number => layout.cols * layout.rows;
export const rowOf = (index: number, layout: Layout): number => Math.floor(index / layout.cols);
export const colOf = (index: number, layout: Layout): number => index % layout.cols;

/** A deck that could have come from generation: every symbol paired (§1, §5). */
export function isValidDeck(deck: Deck, layout: Layout): boolean {
  if (deck.length !== cellCount(layout)) return false;
  const counts = new Map<number, number>();
  for (const symbol of deck) {
    if (!Number.isInteger(symbol) || symbol < 0 || symbol >= SYMBOL_COUNT) return false;
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  if (counts.size !== layout.pairs) return false;
  for (const count of counts.values()) if (count !== 2) return false;
  return true;
}

export type GameMode = 'difficulty' | 'daily';
export type GameStatus = 'playing' | 'solved';
