import { memo, useEffect, useMemo, useState } from 'react';
import { COLS, isLive, type Board, type BoardCell, type BlockedPath } from '../../game';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';

/**
 * The last successful match, captured before the model board moved on. This is
 * what lets the UI show the pair leaving and the emptied rows closing instead
 * of snapping to the collapsed board.
 */
export interface MatchAnim {
  readonly pair: readonly [number, number];
  /** The board the pair was tapped on (pre-match indices). */
  readonly prevBoard: Board;
  readonly rowsRemoved: number;
}

export interface BoardViewProps {
  board: Board;
  selected: number | null;
  hintPair: readonly [number, number] | null;
  invalidPair: readonly [number, number] | null;
  /**
   * The last rejected pair's route: the corridor it would have travelled and
   * the cells standing on it ("these are in the way"). Null when there is
   * nothing to explain.
   */
  blocked: BlockedPath | null;
  lastMatch?: MatchAnim | null;
  onCellTap: (index: number) => void;
}

/** Wilds carry a mark instead of a number: they stand for any of them. */
const WILD_GLYPH = '✦';

/** The matched pair's send-off. Long enough to read, short enough to not slow play. */
const POP_MS = 260;
/** Emptied rows closing up. Matches the .row-collapsing transition in styles.css. */
const COLLAPSE_MS = 300;

const NO_ROWS: ReadonlySet<number> = new Set();
const NO_CELLS: ReadonlySet<number> = new Set();

interface AnimState {
  readonly phase: 'pop' | 'collapse';
  readonly match: MatchAnim;
  /** prevBoard with the pair cleared: what the collapse phase displays. */
  readonly afterPair: Board;
  /** Row indices (in prevBoard) that the collapse removes. */
  readonly deadRows: ReadonlySet<number>;
}

export const BoardView = memo(function BoardView({
  board,
  selected,
  hintPair,
  invalidPair,
  blocked,
  lastMatch = null,
  onCellTap,
}: BoardViewProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const [anim, setAnim] = useState<AnimState | null>(null);

  useEffect(() => {
    if (!lastMatch || reducedMotion) {
      setAnim(null);
      return;
    }
    const [i, j] = lastMatch.pair;
    if (lastMatch.rowsRemoved === 0) {
      // No collapse means indices are stable: display the real board and let
      // the two (now cleared) cells play their send-off in place.
      setAnim({ phase: 'pop', match: lastMatch, afterPair: lastMatch.prevBoard, deadRows: NO_ROWS });
      const done = window.setTimeout(() => setAnim(null), POP_MS);
      return () => window.clearTimeout(done);
    }
    // Rows are about to disappear: hold the pre-match board, pop the pair,
    // close the emptied rows, and only then let the collapsed board in.
    const afterPair = lastMatch.prevBoard.map((cell, idx) =>
      (idx === i || idx === j) && isLive(cell) ? { ...cell, cleared: true } : cell,
    );
    const deadRows = new Set<number>();
    for (let r = 0; r * COLS < afterPair.length; r++) {
      if (!afterPair.slice(r * COLS, (r + 1) * COLS).some((cell) => isLive(cell))) {
        deadRows.add(r);
      }
    }
    setAnim({ phase: 'pop', match: lastMatch, afterPair, deadRows });
    const toCollapse = window.setTimeout(() => {
      setAnim((current) =>
        current && current.match === lastMatch ? { ...current, phase: 'collapse' } : current,
      );
    }, POP_MS);
    const done = window.setTimeout(() => setAnim(null), POP_MS + COLLAPSE_MS);
    return () => {
      window.clearTimeout(toCollapse);
      window.clearTimeout(done);
    };
  }, [lastMatch, reducedMotion]);

  // While emptied rows are closing, the display shows the pre-match board, so
  // model indices would not line up with what the player sees.
  const holding = anim !== null && anim.match.rowsRemoved > 0;
  const displayBoard: Board = holding
    ? anim.phase === 'pop'
      ? anim.match.prevBoard
      : anim.afterPair
    : board;
  const clearingCells: ReadonlySet<number> =
    anim !== null && anim.phase === 'pop' ? new Set(anim.match.pair) : NO_CELLS;
  const collapsingRows: ReadonlySet<number> =
    anim !== null && anim.phase === 'collapse' ? anim.deadRows : NO_ROWS;

  // The corridor can span most of the board, so membership is a lookup rather
  // than a scan per cell.
  const pathCells = useMemo(() => new Set(blocked?.path ?? []), [blocked]);
  const blockedCells = useMemo(() => new Set(blocked?.blockers ?? []), [blocked]);

  const rows = useMemo(() => {
    const chunks: { start: number; cells: readonly BoardCell[] }[] = [];
    for (let r = 0; r * COLS < displayBoard.length; r++) {
      chunks.push({ start: r * COLS, cells: displayBoard.slice(r * COLS, (r + 1) * COLS) });
    }
    return chunks;
  }, [displayBoard]);

  const renderCell = (cell: BoardCell, index: number) => {
    // The matched pair on its way out: still shows its value, no longer a
    // button — the model has already moved on.
    if (clearingCells.has(index) && cell !== null && cell.kind !== 'stone') {
      const isWild = cell.kind === 'wild';
      return (
        <div
          key={index}
          className={`cell cell-live cell-clearing${isWild ? ' cell-wild' : ''}`}
          aria-hidden="true"
        >
          {isWild ? WILD_GLYPH : cell.value}
        </div>
      );
    }
    // Empty slots carry the route: they are what makes the reading order's
    // wrap around the row end readable as one continuous trail. A hole has
    // no dot of its own, so the route gives it one — a gap there would
    // break the line on shaped boards.
    const isOnPath = pathCells.has(index);
    const onPath = isOnPath ? ' cell-path' : '';
    // A hole in the board's shape: empty space, not a playable slot.
    if (cell === null) {
      return (
        <div key={index} className={`cell cell-hole${onPath}`} aria-hidden="true">
          {isOnPath ? <span className="cell-dot" /> : null}
        </div>
      );
    }
    const row = Math.floor(index / COLS) + 1;
    const col = (index % COLS) + 1;
    const isBlocking = blockedCells.has(index);
    // A stone: never matchable, so not a button. It is announced rather
    // than hidden, because it is the thing standing in a rejected pair's
    // way and a route marked around silence explains nothing.
    if (cell.kind === 'stone') {
      const className = ['cell', 'cell-stone', onPath.trim(), isBlocking ? 'cell-blocking' : '']
        .filter(Boolean)
        .join(' ');
      return (
        <div
          key={index}
          className={className}
          role="img"
          aria-label={t('cellLabelStone', { row, col })}
        />
      );
    }
    if (cell.cleared) {
      return (
        <div key={index} className={`cell cell-cleared${onPath}`} aria-hidden="true">
          <span className="cell-dot" />
        </div>
      );
    }
    const isSelected = selected === index;
    const isHint = hintPair !== null && (hintPair[0] === index || hintPair[1] === index);
    const isInvalid =
      invalidPair !== null && (invalidPair[0] === index || invalidPair[1] === index);
    const isWild = cell.kind === 'wild';
    const className = [
      'cell',
      'cell-live',
      isWild ? 'cell-wild' : '',
      isSelected ? 'cell-selected' : '',
      isHint ? 'cell-hint' : '',
      isInvalid ? 'cell-invalid' : '',
      isBlocking ? 'cell-blocking' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={index}
        type="button"
        className={className}
        aria-label={
          isWild
            ? t('cellLabelWild', { row, col })
            : t('cellLabel', { value: cell.value, row, col })
        }
        aria-pressed={isSelected}
        onClick={() => {
          if (!holding) onCellTap(index);
        }}
      >
        {isWild ? WILD_GLYPH : cell.value}
      </button>
    );
  };

  return (
    <div className="board" role="group" aria-label={t('boardLabel')}>
      {rows.map(({ start, cells }) => (
        <div
          key={start}
          className={`board-row${collapsingRows.has(start / COLS) ? ' row-collapsing' : ''}`}
        >
          <div className="board-row-inner">
            {cells.map((cell, offset) => renderCell(cell, start + offset))}
          </div>
        </div>
      ))}
    </div>
  );
});
