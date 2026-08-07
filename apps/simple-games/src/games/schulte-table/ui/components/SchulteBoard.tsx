/**
 * The board (docs/SCHULTE_TABLE_RULES.md §1, §3, §13).
 *
 * A tapped cell is not removed and not hidden — it sinks and its number fades,
 * but it stays exactly where it was. Clearing cells away would make the board
 * emptier as the round went on, so the last few numbers would be easy to find
 * for a reason that has nothing to do with the player.
 *
 * Nothing here is colour-coded. The next number is announced above the board,
 * never highlighted on it: highlighting it would do the searching, which is the
 * whole game (§9), and a colour-only signal would hand a different game to
 * players with a colour vision deficiency (§1).
 */
import { colOf, rowOf, type SchulteSession } from '../../game';
import { isTapped } from '../../game';
import { useSettings } from '@/state/SettingsContext';

export interface SchulteBoardProps {
  session: SchulteSession;
  onCellTap: (index: number) => void;
}

export function SchulteBoard({ session, onCellTap }: SchulteBoardProps) {
  const { t } = useSettings();
  const { size, values } = session;

  return (
    <div
      className="schulte-board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="group"
      aria-label={t('schulteBoardLabel')}
    >
      {values.map((value, index) => {
        const done = isTapped(session, index);
        return (
          <button
            key={index}
            type="button"
            className={`schulte-cell ${done ? 'schulte-cell-done' : ''}`}
            // The label carries "already tapped" in words, so the state is not
            // only in the paint (§13).
            aria-label={
              done
                ? t('schulteCellDone', {
                    value,
                    row: rowOf(index, size) + 1,
                    col: colOf(index, size) + 1,
                  })
                : t('schulteCell', {
                    value,
                    row: rowOf(index, size) + 1,
                    col: colOf(index, size) + 1,
                  })
            }
            onClick={() => onCellTap(index)}
          >
            <span aria-hidden="true">{value}</span>
          </button>
        );
      })}
    </div>
  );
}
