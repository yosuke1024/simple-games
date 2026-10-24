/**
 * The Quick Rules figures (docs/NESTED_TIC_TAC_TOE_RULES.md §9): the big
 * board in miniature, drawn with the same shapes, frames and colours as the
 * real one, and no text in it.
 *
 * 1. send — a cross in the bottom-right square of the top-left board, and an
 *    arrow from it to the bottom-right board, which wears the double frame.
 * 2. free — the circle takes the top-middle board with its last move, whose
 *    place sends the cross back into it: every open board wears the frame.
 * 3. win  — three in a row inside a board takes it; three taken boards in a
 *    row win, outlined.
 *
 * Each figure is a move list replayed by the engine (`FIGURE_MOVES`), so it
 * is a position the game can actually reach: the marks, the taken boards,
 * the framed boards (whose move it is, and where it was sent) and the
 * outlined line all come from the rules, not from a drawing
 * (RulesFigure.test.tsx). Cross is "you" in every figure. Decorative: the
 * step's sentence beside it says what it shows.
 */
import {
  BOARD_COUNT,
  boardOf,
  CROSS,
  DRAWN,
  EMPTY,
  isOver,
  OPEN,
  placeOf,
  playableBoards,
  positionFromMoves,
  winningLine,
  type Mark,
} from '../../game';

export type RulesFigureKind = 'send' | 'free' | 'win';

/** Small board `b`'s top-left corner in the 99-unit figure (3-unit thick lines). */
const origin = (board: number) => ({ x: 3 + (board % 3) * 32, y: 3 + Math.floor(board / 3) * 32 });
const SMALL = 29;
const CELL = SMALL / 3;

/** Each figure's moves from the empty board, cross first (§1). */
export const FIGURE_MOVES: Record<RulesFigureKind, readonly number[]> = {
  // Cross in the top-left board's bottom-right square: the circle is sent
  // to the bottom-right board.
  send: [8],
  // The circle fills the top-middle board's middle column, and its last
  // mark, that board's top-middle square, sends the cross back into it —
  // taken, so the cross may play in any open board.
  free: [1, 13, 37, 16, 64, 10],
  // Cross takes the top-left board (top row), the centre board (top row)
  // and the bottom-right board (middle column): the diagonal. The circle
  // never takes a board.
  win: [0, 4, 36, 8, 73, 9, 1, 13, 38, 18, 2, 26, 76, 44, 79, 63, 37],
};

interface Figure {
  /** Small marks: [cell, mark]. */
  marks: readonly (readonly [number, Mark])[];
  /** Taken boards: [board, mark]. */
  taken: readonly (readonly [number, Mark])[];
  framed: readonly number[];
  outlined: readonly number[];
}

/** What the screen would show for `moves`. Throws on a list the rules refuse. */
export function figureOf(moves: readonly number[]): Figure {
  const position = positionFromMoves(moves);
  if (!position) throw new Error(`not a legal move list: ${moves.join(',')}`);
  const marks: [number, Mark][] = [];
  position.cells.forEach((value, cell) => {
    if (value !== EMPTY) marks.push([cell, value as Mark]);
  });
  const taken: [number, Mark][] = [];
  for (let board = 0; board < BOARD_COUNT; board++) {
    const state = position.smalls[board]!;
    if (state !== OPEN && state !== DRAWN) taken.push([board, state as Mark]);
  }
  return {
    marks,
    taken,
    framed: isOver(position) ? [] : playableBoards(position),
    outlined: winningLine(position) ?? [],
  };
}

const FIGURES: Record<RulesFigureKind, Figure> = {
  send: figureOf(FIGURE_MOVES.send),
  free: figureOf(FIGURE_MOVES.free),
  win: figureOf(FIGURE_MOVES.win),
};

/**
 * A mark in a `size` square at (x, y): `reach` is the share of the square the
 * shape spans (a cell's mark about 60%, a taken board's about 80% — §10).
 */
function MarkShape({
  mark,
  x,
  y,
  size,
  reach = 0.62,
}: {
  mark: Mark;
  x: number;
  y: number;
  size: number;
  reach?: number;
}) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  const d = r * reach;
  return mark === CROSS ? (
    <path d={`M${cx - d} ${cy - d} ${cx + d} ${cy + d}M${cx + d} ${cy - d} ${cx - d} ${cy + d}`} />
  ) : (
    <circle cx={cx} cy={cy} r={d} />
  );
}

export function RulesFigure({ kind }: { kind: RulesFigureKind }) {
  const figure = FIGURES[kind];
  const arrow = kind === 'send';
  const takenBoards = new Set(figure.taken.map(([board]) => board));
  const from = origin(0);
  const to = origin(8);
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="nt-figure" viewBox="0 0 99 99" focusable="false">
        <rect className="nt-figure-ground" x="0" y="0" width="99" height="99" rx="4" />
        {Array.from({ length: 9 }, (_, board) => {
          const { x, y } = origin(board);
          return (
            <g key={board}>
              <rect className="nt-figure-small" x={x} y={y} width={SMALL} height={SMALL} />
              <path
                className="nt-figure-thin"
                d={`M${x + CELL} ${y}v${SMALL}M${x + 2 * CELL} ${y}v${SMALL}M${x} ${y + CELL}h${SMALL}M${x} ${y + 2 * CELL}h${SMALL}`}
              />
            </g>
          );
        })}
        {figure.framed.map((board) => {
          const { x, y } = origin(board);
          return (
            <rect
              key={`frame-${board}`}
              className="nt-figure-frame"
              x={x + 2}
              y={y + 2}
              width={SMALL - 4}
              height={SMALL - 4}
            />
          );
        })}
        {figure.marks.map(([cell, mark]) => {
          const board = boardOf(cell);
          const place = placeOf(cell);
          const { x, y } = origin(board);
          return (
            <g
              key={`mark-${cell}`}
              className={`nt-figure-mark ${mark === CROSS ? 'nt-mark-you' : 'nt-mark-cpu'} ${
                takenBoards.has(board) ? 'nt-figure-faint' : ''
              }`}
            >
              <MarkShape
                mark={mark}
                x={x + (place % 3) * CELL}
                y={y + Math.floor(place / 3) * CELL}
                size={CELL}
              />
            </g>
          );
        })}
        {figure.taken.map(([board, mark]) => {
          const { x, y } = origin(board);
          return (
            <g
              key={`big-${board}`}
              className={`nt-figure-mark nt-figure-big ${mark === CROSS ? 'nt-mark-you' : 'nt-mark-cpu'}`}
            >
              <MarkShape mark={mark} x={x} y={y} size={SMALL} reach={0.8} />
            </g>
          );
        })}
        {figure.outlined.map((board) => {
          const { x, y } = origin(board);
          return (
            <rect
              key={`line-${board}`}
              className="nt-figure-outline"
              x={x - 0.5}
              y={y - 0.5}
              width={SMALL + 1}
              height={SMALL + 1}
            />
          );
        })}
        {arrow ? (
          <g className="nt-figure-arrow">
            <path
              d={`M${from.x + 2.5 * CELL} ${from.y + 2.5 * CELL}L${to.x + SMALL / 2 - 3} ${
                to.y + SMALL / 2 - 3
              }`}
            />
            <path
              d={`M${to.x + SMALL / 2 - 9} ${to.y + SMALL / 2 - 2}L${to.x + SMALL / 2 - 2} ${
                to.y + SMALL / 2 - 2
              }L${to.x + SMALL / 2 - 2} ${to.y + SMALL / 2 - 9}`}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
