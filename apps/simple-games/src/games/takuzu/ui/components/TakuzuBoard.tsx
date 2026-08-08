/**
 * The Takuzu board (docs/TAKUZU_RULES.md §1, §4, §9, §13).
 *
 * One button per cell, each carrying its digit and its position in its label,
 * so a screen reader can read the board rather than a wall of "button". A
 * fixed cell is a disabled button: it stays in the reading order, and "not
 * tappable" is a fact about the DOM rather than a rule some handler has to
 * remember (§4).
 *
 * What a cell means is the digit written in it. The two grounds behind 0 and 1
 * are support only — they carry no meaning colour-blind eyes would have to
 * read, which is why they are two weights of one neutral rather than two hues
 * (§13).
 *
 * Violations show all the time (§9), and they are a statement about the rules,
 * never a comparison against the hidden answer: a digit that is legal but not
 * final is told nothing, because nothing is wrong with it yet.
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  EMPTY,
  ONE,
  ZERO,
  lineIndices,
  violationsOf,
  type Hint,
  type TakuzuSession,
} from '../../game';

export interface TakuzuBoardProps {
  session: TakuzuSession;
  /** The last hint: a proved cell with its reasons, or a broken line (§8). */
  hint: Hint | null;
  onTap: (index: number) => void;
}

export const TakuzuBoard = memo(function TakuzuBoard({ session, hint, onTap }: TakuzuBoardProps) {
  const { t } = useSettings();
  const { size, givens, marks } = session;
  const violations = violationsOf(session);

  // What the hint points at: the cell it proves, the written digits that carry
  // the proof, and the line (or pair of lines) they were read off (§8).
  const provedCell = hint?.kind === 'step' ? hint.step.index : null;
  const support = new Set(hint?.kind === 'step' ? hint.step.support : []);
  const reason = new Set<number>();
  if (hint?.kind === 'step') {
    for (const index of lineIndices(size, hint.step.line)) reason.add(index);
    const against = hint.step.against;
    if (against !== null) for (const index of lineIndices(size, against)) reason.add(index);
  }
  const brokenLine = new Set(hint?.kind === 'violation' ? lineIndices(size, hint.line) : []);

  return (
    <div
      className="takuzu-board"
      role="group"
      aria-label={t('takuzuBoardLabel', { size })}
      data-size={size}
      style={{ '--takuzu-size': size } as CSSProperties}
    >
      {givens.map((given, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        const fixed = given !== EMPTY;
        const digit = fixed ? given : (marks[index] ?? EMPTY);
        const position = { row: row + 1, col: col + 1 };

        const base = fixed
          ? t('takuzuCellFixed', { digit, ...position })
          : digit === ZERO
            ? t('takuzuCellZero', position)
            : digit === ONE
              ? t('takuzuCellOne', position)
              : t('takuzuCellEmpty', position);
        const broken = violations.cells[index] === true;

        const classes = [
          'takuzu-cell',
          fixed ? 'takuzu-cell-fixed' : '',
          digit === ZERO ? 'takuzu-cell-zero' : '',
          digit === ONE ? 'takuzu-cell-one' : '',
          // The halfway rules run down the middle of a line (§3, rule 2), so
          // the middle is where a divider helps: it turns "count half of ten"
          // into two groups of five to read at a glance.
          col === size / 2 ? 'takuzu-cell-half-left' : '',
          row === size / 2 ? 'takuzu-cell-half-top' : '',
          broken ? 'takuzu-cell-broken' : '',
          provedCell === index ? 'takuzu-cell-hint' : '',
          support.has(index) ? 'takuzu-cell-support' : '',
          reason.has(index) ? 'takuzu-cell-reason' : '',
          brokenLine.has(index) ? 'takuzu-cell-hint-broken' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={index}
            type="button"
            className={classes}
            disabled={fixed}
            aria-label={broken ? `${base}, ${t('takuzuRuleBroken')}` : base}
            onClick={() => onTap(index)}
          >
            <span className="takuzu-digit" aria-hidden="true">
              {digit === EMPTY ? '' : digit}
            </span>
          </button>
        );
      })}
    </div>
  );
});
