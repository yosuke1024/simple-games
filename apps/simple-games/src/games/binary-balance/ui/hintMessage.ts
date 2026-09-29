/**
 * Maps a hint to the one i18n key that explains it in plain words
 * (docs/BINARY_BALANCE_RULES.md §8). Technique names never reach the screen —
 * this mapping, keyed on a step's technique (and, for a link, on its kind), is
 * the only place in the UI that reads either.
 *
 * The visual terms a sentence refers to (§13): *highlighted* is the line the
 * reasoning was read off, *tinted* is the written cells that carry the proof
 * (`step.support`), and *outlined* is the cell the step settles.
 */
import { other, type Cell, type Hint, type Link } from '../game';

export type HintMessageKey =
  | 'binaryBalanceHintViolation'
  | 'binaryBalanceHintWrong'
  | 'binaryBalanceHintPairGap'
  | 'binaryBalanceHintLineCount'
  | 'binaryBalanceHintLinkSame'
  | 'binaryBalanceHintLinkDiff'
  | 'binaryBalanceHintLineCompletion'
  | 'binaryBalanceHintHypothesis';

export type MarkNameKey = 'binaryBalanceMarkSun' | 'binaryBalanceMarkMoon';

/** The read-aloud name of each mark, as a sentence uses it ("a sun"). */
export const MARK_NAME_KEY: Record<Cell, MarkNameKey> = {
  0: 'binaryBalanceMarkSun',
  1: 'binaryBalanceMarkMoon',
};

export interface HintMessage {
  readonly key: HintMessageKey;
  /** The mark the step proves — `{mark}` in the sentence. */
  readonly mark: MarkNameKey | null;
  /** The mark it rules out — `{other}` in the sentence. */
  readonly other: MarkNameKey | null;
}

/** The one sentence each kind of hint gets (§8) — never a technique name. */
export function hintMessage(hint: Hint, links: readonly Link[]): HintMessage {
  if (hint.kind === 'violation')
    return { key: 'binaryBalanceHintViolation', mark: null, other: null };
  if (hint.kind === 'wrong') return { key: 'binaryBalanceHintWrong', mark: null, other: null };

  const { step } = hint;
  const mark = MARK_NAME_KEY[step.value];
  const ruledOut = MARK_NAME_KEY[other(step.value)];
  const say = (key: HintMessageKey): HintMessage => ({ key, mark, other: ruledOut });
  switch (step.technique) {
    case 'pair-gap':
      return say('binaryBalanceHintPairGap');
    case 'line-count':
      return say('binaryBalanceHintLineCount');
    case 'link':
      return say(
        step.link !== null && links[step.link]?.same === false
          ? 'binaryBalanceHintLinkDiff'
          : 'binaryBalanceHintLinkSame',
      );
    case 'line-completion':
      return say('binaryBalanceHintLineCompletion');
    case 'hypothesis':
      return say('binaryBalanceHintHypothesis');
  }
}
