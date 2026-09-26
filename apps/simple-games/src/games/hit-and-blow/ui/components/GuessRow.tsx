/**
 * One line of the history (docs/HIT_AND_BLOW_RULES.md §4, §10): the guess's
 * symbols, its pegs, and the two counts. The pegs put every Hit before every
 * Blow — they say how many, never which positions — and the counts repeat
 * them as numbers, so neither colour nor the peg shapes carry the result
 * alone. The row's spoken form is one sentence in visually hidden text; the
 * drawing beside it is hidden from screen readers.
 *
 * The tutorial draws its figures with the same component, so what Quick
 * Rules shows is what the board will look like.
 */
import type { CSSProperties } from 'react';
import type { Code, Feedback } from '../../game';
import { SymbolGlyph } from './Symbol';

export function Pegs({ feedback, slots }: { feedback: Feedback; slots: number }) {
  return (
    <span
      className="hb-pegs"
      aria-hidden="true"
      // Two rows at most: 4 pegs sit 2×2, 5 sit 3 over 2.
      style={{ '--hb-peg-cols': Math.ceil(slots / 2) } as CSSProperties}
    >
      {Array.from({ length: slots }, (_, index) => {
        const kind =
          index < feedback.hits ? 'hit' : index < feedback.hits + feedback.blows ? 'blow' : 'none';
        return <span key={index} className={`hb-peg hb-peg-${kind}`} />;
      })}
    </span>
  );
}

export interface GuessRowProps {
  guess: Code;
  feedback: Feedback;
  /** Row number, shown and spoken (1 = the first guess). */
  number: number;
  /** The row's spoken sentence; absent for a decorative figure. */
  label?: string;
}

export function GuessRow({ guess, feedback, number, label }: GuessRowProps) {
  return (
    <div className="hb-row">
      {label ? <span className="visually-hidden">{label}</span> : null}
      <span className="hb-row-number" aria-hidden="true">
        {number}
      </span>
      <span className="hb-row-code" aria-hidden="true">
        {guess.map((symbol, index) => (
          <span key={index} className="hb-row-cell">
            <SymbolGlyph symbol={symbol} />
          </span>
        ))}
      </span>
      <Pegs feedback={feedback} slots={guess.length} />
      <span className="hb-row-counts" aria-hidden="true">
        {feedback.hits} · {feedback.blows}
      </span>
    </div>
  );
}
