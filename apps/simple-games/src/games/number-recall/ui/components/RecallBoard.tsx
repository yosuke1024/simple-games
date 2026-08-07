/**
 * The board (docs/NUMBER_RECALL_RULES.md §1, §3, §14).
 *
 * Three kinds of slot, told apart by their face and not by their colour: a
 * tile showing its number, a tile face down (blank, raised), and an empty cell
 * (flat, part of the board). A face-down tile never announces its number — a
 * screen reader that read it out would be handing over the answer.
 *
 * During the memorise phase every tile is up and nothing is counting down. The
 * phase ends when the player taps `1`, which is the whole point: the look is
 * ended by the person doing the looking (§3).
 */
import { useSettings } from '@/state/SettingsContext';
import { colOf, EMPTY, isFaceUp, rowOf, type RecallSession } from '../../game';

export interface RecallBoardProps {
  session: RecallSession;
  onCellTap: (index: number) => void;
}

export function RecallBoard({ session, onCellTap }: RecallBoardProps) {
  const { t } = useSettings();
  const { size, layout } = session;

  return (
    <div
      className="recall-board"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="group"
      aria-label={t('recallBoardLabel')}
    >
      {layout.map((value, index) => {
        const row = rowOf(index, size) + 1;
        const col = colOf(index, size) + 1;

        if (value === EMPTY) {
          return (
            <span
              key={index}
              className="recall-cell recall-cell-empty"
              role="presentation"
              aria-hidden="true"
            />
          );
        }

        const faceUp = isFaceUp(session, index);
        const expected = session.expectedIndex === index;
        return (
          <button
            key={index}
            type="button"
            className={[
              'recall-cell',
              'recall-tile',
              faceUp ? 'recall-tile-up' : 'recall-tile-down',
              expected ? 'recall-tile-expected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={
              faceUp
                ? t('recallTileUp', { value, row, col })
                : // No number here, on purpose: it is the thing being asked for.
                  t('recallTileDown', { row, col })
            }
            onClick={() => onCellTap(index)}
          >
            <span aria-hidden="true">{faceUp ? value : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
