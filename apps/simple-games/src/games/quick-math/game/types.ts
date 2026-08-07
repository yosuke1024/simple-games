/**
 * Core Quick Math types. See docs/QUICK_MATH_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A question is the tokens the screen shows, plus its answer. The tokens are
 * digits and the four operator signs and nothing else (§1): those signs mean
 * the same thing in all fourteen locales, so this game adds **no i18n keys for
 * its questions at all**. A worded question ("what is seven plus eight?")
 * would need fourteen translations and would collide head-on with the rule
 * against building sentences by concatenation (docs/I18N_POLICY.md).
 */

/**
 * The four signs, as the characters actually drawn. U+2212 MINUS SIGN rather
 * than a hyphen, and the real multiplication and division signs — a hyphen
 * standing in for a minus reads as a dash at display size.
 */
export type Operator = '+' | '−' | '×' | '÷';
export const OPERATORS: readonly Operator[] = ['+', '−', '×', '÷'];

/** The slot the player is filling in. */
export const BLANK = '?';

/** One element of a question, in display order. */
export type Token = number | Operator | '=' | typeof BLANK;

/** Which shape a question takes (§5). */
export type QuestionForm = 'binary' | 'missing' | 'chain';

export interface Question {
  readonly form: QuestionForm;
  /** Terms, signs, `=` and exactly one BLANK, in display order. */
  readonly tokens: readonly Token[];
  /** Always a whole number, never negative (§5). */
  readonly answer: number;
}

/**
 * The kinds of level, which are also the buckets statistics are kept in (§10).
 * `daily` is not a level band — it is where daily sets are counted, so a
 * daily's time never competes with a level record.
 */
export type Track = 'addSub' | 'multiply' | 'divide' | 'missing' | 'mixed';
export const TRACKS: readonly Track[] = ['addSub', 'multiply', 'divide', 'missing', 'mixed'];

export type StatsBucket = Track | 'daily';

export const isTrack = (value: unknown): value is Track => TRACKS.includes(value as Track);

export type GameMode = 'level' | 'daily';
export type GameStatus = 'playing' | 'cleared';

/** The most digits any answer may have — the keypad's patience limit (§5). */
export const MAX_ANSWER_DIGITS = 3;
