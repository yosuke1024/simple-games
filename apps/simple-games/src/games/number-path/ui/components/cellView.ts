/**
 * What one cell of the board looks like, read off the board and the path
 * (docs/NUMBER_PATH_RULES.md §11): which way the path enters and leaves it,
 * which of its edges are walls, whether it is the path's end, whether it
 * carries the number the path is next due to reach. Shared by the live board
 * and the Quick Rules figures, so the two can never draw the same situation
 * two different ways.
 */
import {
  DIRECTIONS,
  DOWN,
  LEFT,
  RIGHT,
  UP,
  directionBetween,
  neighbourOf,
  nextNumber,
  type Board,
  type Direction,
  type Path,
} from '../../game';

const SIDE: Record<Direction, string> = {
  [UP]: 'up',
  [RIGHT]: 'right',
  [DOWN]: 'down',
  [LEFT]: 'left',
};

export interface CellView {
  /** Position on the path, or -1 off it. */
  readonly step: number;
  /** The number written here, or 0. */
  readonly number: number;
  /** The path's end sits here. */
  readonly isEnd: boolean;
  /**
   * This is the number the path is due to reach next (`nextNumber`), and so
   * has not been reached yet. False once past K — there is no next past the
   * end (§11). A figure with an empty path is due for 1, never higher.
   */
  readonly isNext: boolean;
  /** Path segments to draw, as CSS side names. */
  readonly segments: readonly string[];
  /** Walls to draw, as CSS side names. */
  readonly walls: readonly string[];
  readonly firstRow: boolean;
  readonly lastCol: boolean;
  readonly lastRow: boolean;
}

/** Where each cell stands on the path — one lookup, built once per render. */
export function pathPositions(board: Board, path: Path): Int16Array {
  const positions = new Int16Array(board.width * board.height).fill(-1);
  path.forEach((cell, at) => {
    positions[cell] = at;
  });
  return positions;
}

export function cellView(board: Board, path: Path, positions: Int16Array, index: number): CellView {
  const { width, height } = board;
  const step = positions[index]!;
  const segments: string[] = [];
  if (step > 0) {
    const toPrevious = directionBetween(index, path[step - 1]!, width);
    if (toPrevious !== null) segments.push(SIDE[toPrevious]);
  }
  if (step >= 0 && step < path.length - 1) {
    const toNext = directionBetween(index, path[step + 1]!, width);
    if (toNext !== null) segments.push(SIDE[toNext]);
  }
  const walls: string[] = [];
  for (const direction of DIRECTIONS) {
    const inGrid = neighbourOf(index, direction, width, height) >= 0;
    if (inGrid && (board.open[index]! & direction) === 0) walls.push(SIDE[direction]);
  }
  const number = board.numbers[index]!;
  return {
    step,
    number,
    isEnd: step === path.length - 1,
    isNext: number !== 0 && number === nextNumber(board, path),
    segments,
    walls,
    firstRow: Math.floor(index / width) === 0,
    lastCol: index % width === width - 1,
    lastRow: Math.floor(index / width) === height - 1,
  };
}

/** The class list a cell wears for its view, before any hint marking. */
export function cellClasses(view: CellView): string[] {
  return [
    'np-cell',
    view.step >= 0 ? 'np-cell-on' : '',
    view.isEnd ? 'np-cell-end' : '',
    view.number !== 0 ? 'np-cell-number' : '',
    view.number !== 0 && view.step >= 0 ? 'np-cell-visited' : '',
    view.isNext ? 'np-cell-next' : '',
    view.lastCol ? 'np-cell-edge-right' : '',
    view.lastRow ? 'np-cell-edge-bottom' : '',
    // The board's own top-right corner: derived from geometry, never a fixed
    // child count, so it lands on that one cell whatever the board's width —
    // the live 5/6/7-wide boards and the 3-wide Quick Rules figure alike.
    view.firstRow && view.lastCol ? 'np-cell-corner-tr' : '',
  ].filter(Boolean);
}
