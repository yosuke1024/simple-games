/**
 * The board (docs/MANCALA_RULES.md §1, §2, §10): the CPU's store on the left,
 * six pits a side in two rows, the player's store on the right. The CPU's row
 * is its pits 12 … 7 read left to right, so walking the indices upward walks
 * the picture counter-clockwise — the direction the seeds go.
 *
 * Six buttons, one per pit of the player's, and nothing else pressable: a
 * move is a pit, so that is what is pressed and what is announced. A pit is
 * enabled only on the player's turn and only with seeds in it (§6); the
 * CPU's pits and both stores are pictures with a spoken count. Numbering is
 * by screen column on both rows, so "your pit 3" and "CPU pit 3" face each
 * other — the pair a capture is about (§2.2).
 *
 * Every count is an ASCII numeral, with up to twelve dots beside it so a
 * small pile reads at a glance. The last move's pits get one short flash,
 * keyed by the move counter so it plays once and never again; Reduced Motion
 * turns it off. The pit it was sown from keeps a small still mark, so the
 * CPU's move can be found after looking away (§10).
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  CPU,
  CPU_STORE,
  oppositeOf,
  PITS_PER_SIDE,
  PLAYER_STORE,
  storeOf,
  type LastMove,
  type Pits,
} from '../../game';

/** More than this many dots stops being countable at a glance (§10). */
const MAX_DOTS = 12;

/** The screen columns, left to right. */
const COLUMNS = Array.from({ length: PITS_PER_SIDE }, (_, column) => column);

/** The CPU's pit drawn above the player's pit in `column` (§1). */
const cpuPitAt = (column: number): number => oppositeOf(column);

function Seeds({ count }: { count: number }) {
  return (
    <span className="mc-seeds" aria-hidden="true">
      {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
        <span key={i} className="mc-seed" />
      ))}
    </span>
  );
}

export interface MancalaBoardProps {
  pits: Pits;
  /** False on the CPU's turn, while a dialog is up, or once it is over. */
  playable: boolean;
  lastMove: LastMove | null;
  onPlay: (pit: number) => void;
}

export const MancalaBoard = memo(function MancalaBoard({
  pits,
  playable,
  lastMove,
  onPlay,
}: MancalaBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  // Where the last move put seeds — and, after a capture, the two pits it
  // emptied and the store they went to (§2.2, §10).
  const flashed = new Set<number>(lastMove?.touched ?? []);
  if (lastMove && lastMove.captured > 0) {
    flashed.add(lastMove.lastIndex);
    flashed.add(oppositeOf(lastMove.lastIndex));
    flashed.add(storeOf(lastMove.by));
  }
  const moverClass = lastMove?.by === CPU ? 'mc-flash-cpu' : 'mc-flash-you';

  /** The pit's own decorations: the flash and the still "sown from here" mark. */
  const marks = (index: number) => (
    <>
      {lastMove && !reducedMotion && flashed.has(index) ? (
        // Keyed by the move, so the keyframe plays on arrival and never again.
        <span key={lastMove.moveCount} className={`mc-flash ${moverClass}`} aria-hidden="true" />
      ) : null}
      {lastMove?.pit === index ? (
        <span
          className={`mc-origin ${lastMove.by === CPU ? 'mc-origin-cpu' : 'mc-origin-you'}`}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const at = (row: number, column: number): CSSProperties => ({
    gridRow: row,
    gridColumn: column + 2,
  });

  return (
    <div className="mc-board" role="group" aria-label={t('mancalaBoardLabel')}>
      <div
        className="mc-store mc-store-cpu"
        role="img"
        aria-label={t('mancalaStoreCpu', { count: pits[CPU_STORE]! })}
      >
        <span className="mc-mark mc-mark-cpu" aria-hidden="true" />
        <span className="mc-store-count" aria-hidden="true">
          {pits[CPU_STORE]}
        </span>
        {marks(CPU_STORE)}
      </div>

      {COLUMNS.map((column) => {
        const index = cpuPitAt(column);
        const count = pits[index]!;
        return (
          <div
            key={index}
            className="mc-pit mc-pit-cpu"
            style={at(1, column)}
            role="img"
            aria-label={t('mancalaPitCpu', { n: column + 1, count })}
          >
            <span className="mc-count" aria-hidden="true">
              {count}
            </span>
            <Seeds count={count} />
            {marks(index)}
          </div>
        );
      })}

      {COLUMNS.map((column) => {
        const index = column;
        const count = pits[index]!;
        return (
          <button
            key={index}
            type="button"
            className="mc-pit mc-pit-you"
            style={at(2, column)}
            aria-label={t('mancalaPitYou', { n: column + 1, count })}
            disabled={!playable || count === 0}
            onClick={() => onPlay(index)}
          >
            <Seeds count={count} />
            <span className="mc-count" aria-hidden="true">
              {count}
            </span>
            {marks(index)}
          </button>
        );
      })}

      <div
        className="mc-store mc-store-you"
        role="img"
        aria-label={t('mancalaStoreYou', { count: pits[PLAYER_STORE]! })}
      >
        <span className="mc-mark mc-mark-you" aria-hidden="true" />
        <span className="mc-store-count" aria-hidden="true">
          {pits[PLAYER_STORE]}
        </span>
        {marks(PLAYER_STORE)}
      </div>
    </div>
  );
});
