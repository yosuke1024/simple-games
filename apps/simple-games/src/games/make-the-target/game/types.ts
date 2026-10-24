/**
 * The shapes Make the Target's rules talk about (docs/MAKE_THE_TARGET_RULES.md).
 * Type declarations and the small guards that go with them — nothing here
 * imports anything, so every other module, the leaf `tiers.ts` included, may
 * read it.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'medium' || value === 'hard';

/** Free Play or the Daily Challenge (§8). */
export type GameMode = 'free' | 'daily';
export const isGameMode = (value: unknown): value is GameMode =>
  value === 'free' || value === 'daily';

/**
 * The four operators in their stored form (§10「手の文字列」): one ASCII
 * character each. The board draws `+ − × ÷` (OPERATOR_SYMBOLS in engine.ts);
 * the two are different things and only this one is ever saved.
 */
export type Operator = '+' | '-' | '*' | '/';
export const OPERATORS: readonly Operator[] = ['+', '-', '*', '/'];
export const isOperator = (value: unknown): value is Operator =>
  value === '+' || value === '-' || value === '*' || value === '/';

/**
 * One move (§2): the value in slot `left`, the operator, the value in slot
 * `right`. The result goes into `right` and `left` is left empty (§1).
 */
export interface Move {
  readonly left: number;
  readonly op: Operator;
  readonly right: number;
}

/** The board's fixed positions (§1): a number, or null once it has been used. */
export type Slots = readonly (number | null)[];

/**
 * `playing` / `missed` (n−1 moves made, the last number is not the target)
 * / `solved` / `revealed` (a solution was shown, §5). The last two are final.
 */
export type GameStatus = 'playing' | 'missed' | 'solved' | 'revealed';

/**
 * One problem (§1, §6): the numbers dealt (ascending), the target, and the
 * solution kept with it — the one the generator built, as moves over the
 * dealt slots, used only by「解を 1 つ見る」(§5).
 */
export interface Problem {
  readonly difficulty: Difficulty;
  readonly numbers: readonly number[];
  readonly target: number;
  readonly solution: readonly Move[];
}
