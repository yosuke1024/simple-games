/**
 * The Binary Balance board (docs/BINARY_BALANCE_RULES.md §1, §4, §9, §13).
 *
 * One button per cell, each carrying its mark, its position and the links it
 * sends right and down in its label, so a screen reader can read the board
 * rather than a wall of "button". A fixed cell is a disabled button: it stays
 * in the reading order, and "not tappable" is a fact about the DOM rather than
 * a rule some handler has to remember (§4).
 *
 * The marks are shapes (`MarkGlyph`), never characters. The two grounds behind
 * them are two weights of one neutral — support only, so a reader who cannot
 * tell them apart has lost nothing (§13). The links sit on the edge between
 * two cells as `=` / `×`, outside the buttons and hidden from assistive
 * technology: the cells read them aloud instead (§13).
 *
 * Violations show all the time (§9), and they are a statement about the rules,
 * never a comparison against the hidden answer.
 *
 * Input is one gesture, a tap (§4) — a click on a button, so a keyboard
 * activation is the same tap. There is no drag and no long press.
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  CIRCLE,
  EMPTY,
  SQUARE,
  isWritten,
  lineIndices,
  linkOther,
  violationsOf,
  type BinaryBalanceSession,
  type Hint,
} from '../../game';
import { MarkGlyph } from './MarkGlyph';

export interface BinaryBalanceBoardProps {
  session: BinaryBalanceSession;
  /** The last hint: a step with its reasons, a wrong mark, or a broken rule (§8). */
  hint: Hint | null;
  /** True for the one beat between the last mark and the result card. */
  solved: boolean;
  onTap: (index: number) => void;
}

export const BinaryBalanceBoard = memo(function BinaryBalanceBoard({
  session,
  hint,
  solved,
  onTap,
}: BinaryBalanceBoardProps) {
  const { t } = useSettings();
  const { size, givens, marks, links } = session;
  const violations = violationsOf(session);

  // The links each cell sends right and down, read aloud on that cell (§13).
  const linkWords: string[][] = givens.map(() => []);
  for (const link of links) {
    linkWords[link.index]!.push(
      link.dir === 'h'
        ? t(link.same ? 'binaryBalanceLinkSameRight' : 'binaryBalanceLinkDiffRight')
        : t(link.same ? 'binaryBalanceLinkSameBelow' : 'binaryBalanceLinkDiffBelow'),
    );
  }

  // What the hint points at (§8): the cell it settles, the written cells that
  // carry the proof, the line they were read off — or the cells at fault.
  const target = hint?.kind === 'step' ? hint.step.index : null;
  const support = new Set(hint?.kind === 'step' ? hint.step.support : []);
  const reason = new Set(hint?.kind === 'step' ? lineIndices(size, hint.step.line) : []);
  const hintLink = hint?.kind === 'step' ? hint.step.link : null;
  const broken = new Set<number>(
    hint?.kind === 'violation' ? hint.cells : hint?.kind === 'wrong' ? [hint.index] : [],
  );
  const brokenLinks = new Set(hint?.kind === 'violation' ? hint.links : []);

  return (
    <div
      className={solved ? 'bn-board bn-board-solved' : 'bn-board'}
      role="group"
      aria-label={t('binaryBalanceBoardLabel', { size })}
      style={{ '--bn-size': size } as CSSProperties}
    >
      <div className="bn-cells">
        {givens.map((given, index) => {
          const row = Math.floor(index / size);
          const col = index % size;
          const fixed = given !== EMPTY;
          const mark = fixed ? given : (marks[index] ?? EMPTY);
          const position = { row: row + 1, col: col + 1 };

          const base = fixed
            ? mark === CIRCLE
              ? t('binaryBalanceCellFixedCircle', position)
              : t('binaryBalanceCellFixedSquare', position)
            : mark === CIRCLE
              ? t('binaryBalanceCellCircle', position)
              : mark === SQUARE
                ? t('binaryBalanceCellSquare', position)
                : t('binaryBalanceCellEmpty', position);
          const isBroken = violations.cells[index] === true;
          const label = [
            base,
            ...linkWords[index]!,
            ...(isBroken ? [t('binaryBalanceRuleBroken')] : []),
          ].join(', ');

          const classes = [
            'bn-cell',
            fixed ? 'bn-cell-fixed' : '',
            mark === CIRCLE ? 'bn-cell-circle' : '',
            mark === SQUARE ? 'bn-cell-square' : '',
            isBroken ? 'bn-cell-broken' : '',
            target === index ? 'bn-cell-hint' : '',
            support.has(index) ? 'bn-cell-support' : '',
            reason.has(index) ? 'bn-cell-reason' : '',
            broken.has(index) ? 'bn-cell-hint-broken' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={index}
              type="button"
              className={classes}
              disabled={fixed}
              aria-label={label}
              onClick={() => onTap(index)}
            >
              {isWritten(mark) ? (
                <span key={mark} className="bn-glyph" aria-hidden="true">
                  <MarkGlyph mark={mark} fixed={fixed} />
                </span>
              ) : null}
            </button>
          );
        })}

        {links.map((link, k) => {
          const row = Math.floor(link.index / size);
          const col = link.index % size;
          const classes = [
            'bn-link',
            link.dir === 'h' ? 'bn-link-h' : 'bn-link-v',
            violations.links[k] === true || brokenLinks.has(k) ? 'bn-link-broken' : '',
            hintLink === k ? 'bn-link-hint' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span
              key={`${link.dir}${link.index}-${linkOther(link, size)}`}
              className={classes}
              aria-hidden="true"
              style={{ '--bn-row': row, '--bn-col': col } as CSSProperties}
            >
              {link.same ? '=' : '×'}
            </span>
          );
        })}
      </div>
    </div>
  );
});
