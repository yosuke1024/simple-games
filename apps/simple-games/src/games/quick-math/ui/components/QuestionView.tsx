/**
 * One question, drawn from its tokens (docs/QUICK_MATH_RULES.md §1, §12).
 *
 * Every element is a separate node so a screen reader reads the equation as a
 * sequence rather than as one run-together string, and so the blank can hold
 * the digits being typed without the rest of the line moving.
 *
 * There is no translated text here at all — the signs are the same characters
 * in every locale, which is the whole reason the question is drawn from tokens
 * rather than from a sentence.
 */
import { BLANK, type Question, type Token } from '../../game';

export interface QuestionViewProps {
  question: Question;
  /** Digits typed so far, as a string (may be empty). */
  entry: string;
  /** How many digits the blank is waiting for — sizes the box (§3). */
  digits: number;
}

function tokenClass(token: Token): string {
  if (typeof token === 'number') return 'qmath-term';
  if (token === '=') return 'qmath-equals';
  return 'qmath-op';
}

export function QuestionView({ question, entry, digits }: QuestionViewProps) {
  return (
    <p className="qmath-question">
      {question.tokens.map((token, index) => {
        if (token === BLANK) {
          return (
            <span
              key={index}
              className={`qmath-blank ${entry === '' ? 'qmath-blank-empty' : ''}`}
              // Sized by the answer's length so the line does not jump as
              // digits arrive. The extra em is the box's own padding: without
              // it a one-digit slot comes out narrower than it is tall and
              // reads as a pill rather than as a space to write in.
              style={{ minWidth: `calc(${Math.max(1, digits)}ch + 0.45em)` }}
            >
              {entry}
            </span>
          );
        }
        return (
          <span key={index} className={tokenClass(token)}>
            {token}
          </span>
        );
      })}
    </p>
  );
}
