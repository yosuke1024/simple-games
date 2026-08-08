/**
 * The Futoshiki board (docs/FUTOSHIKI_RULES.md §1, §4, §5, §6, §13).
 *
 * One button per square, each carrying its digit, its position and every sign
 * that touches it, so a screen reader can read the board rather than a wall of
 * "button". A given is a disabled button: it stays in the reading order, and
 * "not tappable" is a fact about the DOM rather than a rule some handler has
 * to remember (§4).
 *
 * THE SIGNS ARE TEXT. Each one is a real element holding the ASCII character
 * the rules fix it to, drawn in the gap between the two squares it orders, and
 * labelled in WORDS — "column 2 is smaller than column 3", never "less than"
 * (§13). Drawn as CSS pseudo-content and hidden from assistive technology,
 * this board would become a table of numbers with holes in it and half the
 * rules would vanish from the reading. The same sentence is read again on both
 * squares the sign touches, so a listener meets it whichever way they arrive.
 *
 * The signs are display only. Only squares are pressable (§13), which the
 * stylesheet states with `pointer-events: none` rather than an empty handler.
 *
 * Violations show all the time (§5), and they are a statement about the rules,
 * never a comparison against the hidden answer: a digit that is legal but not
 * final is told nothing, because nothing is wrong with it yet. Marking a digit
 * that disagrees with the answer is the separate, optional half of §5, and
 * arrives here as `highlightMistakes`.
 */
import { memo, Fragment, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  EMPTY,
  colOf,
  constraintAxis,
  constraintCells,
  constraintSymbol,
  hasBit,
  lineIndices,
  mistakesOf,
  rowOf,
  valueAt,
  violationsOf,
  type Constraint,
  type FutoshikiSession,
  type Hint,
  type Size,
} from '../../game';

export interface FutoshikiBoardProps {
  session: FutoshikiSession;
  selected: number | null;
  /** The last hint: a settled square with its proof, or a break (§6). */
  hint: Hint | null;
  /** Whether a digit that disagrees with the answer is marked (§5, setting). */
  highlightMistakes: boolean;
  onCellTap: (index: number) => void;
}

const NO_CELLS: ReadonlySet<number> = new Set();

/** Notes sit in a shadow of the pad; three columns hold 5, 6 and 7 alike. */
const noteColumns = (size: Size): number => (size <= 4 ? 2 : 3);

export const FutoshikiBoard = memo(function FutoshikiBoard({
  session,
  selected,
  hint,
  highlightMistakes,
  onCellTap,
}: FutoshikiBoardProps) {
  const { t } = useSettings();
  const { size, board, constraints } = session;
  const violations = violationsOf(session);
  const mistakes = highlightMistakes ? mistakesOf(session) : NO_CELLS;

  // Where each sign is drawn, and which squares have to mention it. Both are
  // keyed off `constraintCells`, so the upper-left square of the pair owns the
  // drawing and both squares own the words.
  const acrossAt = new Map<number, number>();
  const downAt = new Map<number, number>();
  const touching = new Map<number, number[]>();
  constraints.forEach((constraint, position) => {
    const [first] = constraintCells(constraint);
    const axis = constraintAxis(constraint, size);
    if (axis === 'row') acrossAt.set(first, position);
    else if (axis === 'col') downAt.set(first, position);
    for (const cell of constraintCells(constraint)) {
      const held = touching.get(cell);
      if (held) held.push(position);
      else touching.set(cell, [position]);
    }
  });

  /** One sign as a sentence: the smaller side is always named first (§13). */
  const signWords = (constraint: Constraint): string => {
    const [first] = constraintCells(constraint);
    return constraintAxis(constraint, size) === 'row'
      ? t('futoshikiSignAcross', {
          row: rowOf(first, size) + 1,
          small: colOf(constraint.less, size) + 1,
          large: colOf(constraint.greater, size) + 1,
        })
      : t('futoshikiSignDown', {
          col: colOf(first, size) + 1,
          small: rowOf(constraint.less, size) + 1,
          large: rowOf(constraint.greater, size) + 1,
        });
  };

  // What the hint points at: the squares it settles (or the break it found),
  // the written digits and signs that carry the proof, and the line they were
  // read off. A break outranks a deduction, so it is drawn in the warn colour.
  const broken = hint?.kind === 'violation';
  const targets = new Set<number>(
    hint === null
      ? []
      : hint.kind === 'violation'
        ? hint.cells
        : hint.step.kind === 'placement'
          ? [hint.step.index]
          : hint.step.eliminations.map((elimination) => elimination.index),
  );
  const support = new Set<number>(hint?.kind === 'step' ? hint.step.support : []);
  const hintLine = hint === null ? null : hint.kind === 'violation' ? hint.line : hint.step.line;
  const reason = new Set<number>(hintLine === null ? [] : lineIndices(size, hintLine));
  const hintSigns = new Set<number>(
    hint === null ? [] : hint.kind === 'violation' ? hint.constraints : hint.step.constraints,
  );

  const selectedValue = selected === null ? EMPTY : valueAt(board, selected);

  return (
    <div
      className="futoshiki-board"
      role="group"
      aria-label={t('futoshikiBoardLabel', { size })}
      style={
        {
          '--futoshiki-size': size,
          '--futoshiki-note-cols': noteColumns(size),
        } as CSSProperties
      }
    >
      {board.givens.map((given, index) => {
        const row = rowOf(index, size);
        const col = colOf(index, size);
        const value = valueAt(board, index);
        const isGiven = given !== EMPTY;
        const notes = value === EMPTY ? (board.notes[index] ?? 0) : 0;

        const isSelected = selected === index;
        const isPeer =
          selected !== null &&
          !isSelected &&
          (rowOf(selected, size) === row || colOf(selected, size) === col);
        const isSame = !isSelected && value !== EMPTY && value === selectedValue;
        const isBroken = violations.cells.has(index);

        const base = isGiven
          ? t('futoshikiCellGiven', { value, row: row + 1, col: col + 1 })
          : value === EMPTY
            ? t('futoshikiCellEmpty', { row: row + 1, col: col + 1 })
            : t('futoshikiCellEntry', { value, row: row + 1, col: col + 1 });
        // Position, then every sign this square is party to, then the break —
        // the order a person would read the square in (§13).
        const spoken = [base];
        for (const position of touching.get(index) ?? []) {
          spoken.push(signWords(constraints[position]!));
        }
        if (isBroken) spoken.push(t('futoshikiRuleBroken'));

        const classes = [
          'futoshiki-cell',
          isGiven ? 'futoshiki-cell-given' : '',
          isSelected ? 'futoshiki-cell-selected' : isSame ? 'futoshiki-cell-same' : '',
          !isSelected && !isSame && isPeer ? 'futoshiki-cell-peer' : '',
          isBroken ? 'futoshiki-cell-broken' : '',
          !isBroken && mistakes.has(index) ? 'futoshiki-cell-mistake' : '',
          support.has(index) ? 'futoshiki-cell-support' : '',
          reason.has(index) ? 'futoshiki-cell-reason' : '',
          targets.has(index) ? (broken ? 'futoshiki-cell-hint-broken' : 'futoshiki-cell-hint') : '',
        ]
          .filter(Boolean)
          .join(' ');

        const across = acrossAt.get(index);
        const down = downAt.get(index);

        return (
          <Fragment key={index}>
            <button
              type="button"
              className={classes}
              disabled={isGiven}
              aria-label={spoken.join('. ')}
              aria-pressed={isSelected}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
              onClick={() => onCellTap(index)}
            >
              {value !== EMPTY ? (
                value
              ) : notes !== 0 ? (
                <span className="futoshiki-notes" aria-hidden="true">
                  {Array.from({ length: size }, (_, slot) => (
                    <span key={slot} className="futoshiki-note">
                      {hasBit(notes, slot + 1) ? slot + 1 : ''}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
            {across !== undefined ? (
              <span
                className={[
                  'futoshiki-sign',
                  'futoshiki-sign-across',
                  violations.constraints.has(across) ? 'futoshiki-sign-broken' : '',
                  hintSigns.has(across) ? 'futoshiki-sign-hint' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="img"
                aria-label={signWords(constraints[across]!)}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
              >
                <span className="futoshiki-sign-glyph">
                  {constraintSymbol(constraints[across]!)}
                </span>
              </span>
            ) : null}
            {down !== undefined ? (
              <span
                className={[
                  'futoshiki-sign',
                  'futoshiki-sign-down',
                  violations.constraints.has(down) ? 'futoshiki-sign-broken' : '',
                  hintSigns.has(down) ? 'futoshiki-sign-hint' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="img"
                aria-label={signWords(constraints[down]!)}
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
              >
                <span className="futoshiki-sign-glyph">{constraintSymbol(constraints[down]!)}</span>
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
});
