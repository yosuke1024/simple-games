/**
 * Quick Rules' figures (docs/CHESS_RULES.md §8): a 5×5 corner of the board,
 * drawn with the board's own squares, pieces and marks, so what the figure
 * shows is what the board will show. Each is a position the game could
 * actually be in. Decorative — the step's sentence says it in words.
 *
 * - `moves`: a knight in the middle and the dots of every square it reaches,
 *   with the six pieces under the board.
 * - `capture`: a pawn that can take the knight diagonally ahead (a ring) and
 *   not the rook straight ahead (no mark).
 * - `mate`: the back-rank mate — the rook checks along the edge, the king's
 *   own pawns block every escape (the dashed check ring).
 */
import { BLACK, KING, KNIGHT, PAWN, ROOK, WHITE, type Color } from '../../game';
import { ChessPiece, PIECE_KINDS } from './ChessPiece';

type Cell =
  | {
      readonly piece: number;
      readonly color: Color;
      /** The dashed ring of a king in check. */
      readonly check?: boolean;
      /** The ring of a piece the selected one can take. */
      readonly capture?: boolean;
      /** The piece in hand, ringed as on the board. */
      readonly selected?: boolean;
    }
  | { readonly mark: 'move' | 'capture' };

type Figure = Readonly<Record<number, Cell>>;

/** Row-major index on the 5×5 corner. */
const at = (row: number, col: number): number => row * 5 + col;

const MOVES: Figure = {
  [at(2, 2)]: { piece: KNIGHT, color: WHITE, selected: true },
  [at(0, 1)]: { mark: 'move' },
  [at(0, 3)]: { mark: 'move' },
  [at(1, 0)]: { mark: 'move' },
  [at(1, 4)]: { mark: 'move' },
  [at(3, 0)]: { mark: 'move' },
  [at(3, 4)]: { mark: 'move' },
  [at(4, 1)]: { mark: 'move' },
  [at(4, 3)]: { mark: 'move' },
};

const CAPTURE: Figure = {
  [at(3, 2)]: { piece: PAWN, color: WHITE, selected: true },
  [at(2, 2)]: { piece: ROOK, color: BLACK },
  [at(2, 3)]: { piece: KNIGHT, color: BLACK, capture: true },
};

const MATE: Figure = {
  [at(0, 0)]: { piece: ROOK, color: WHITE },
  [at(0, 4)]: { piece: KING, color: BLACK, check: true },
  [at(1, 3)]: { piece: PAWN, color: BLACK },
  [at(1, 4)]: { piece: PAWN, color: BLACK },
  [at(3, 1)]: { piece: KING, color: WHITE },
};

const FIGURES = { moves: MOVES, capture: CAPTURE, mate: MATE } as const;

export interface RulesFigureProps {
  kind: keyof typeof FIGURES;
}

export function RulesFigure({ kind }: RulesFigureProps) {
  const figure = FIGURES[kind];
  return (
    <div className="tutorial-example ch-figure-wrap" aria-hidden="true" data-figure={kind}>
      <div className="ch-figure">
        {Array.from({ length: 25 }, (_, index) => {
          const cell = figure[index];
          const light = (Math.floor(index / 5) + (index % 5)) % 2 === 1;
          const piece = cell !== undefined && 'piece' in cell ? cell : null;
          return (
            <span
              key={index}
              className={`ch-figure-square ${light ? 'ch-square-light' : 'ch-square-dark'}`}
              data-selected={piece?.selected ? '' : undefined}
            >
              {piece ? <ChessPiece kind={piece.piece} white={piece.color === WHITE} /> : null}
              {piece?.check ? <span className="ch-check-ring" /> : null}
              {piece?.capture ? <span className="ch-mark-capture" /> : null}
              {cell !== undefined && 'mark' in cell ? (
                <span className={cell.mark === 'capture' ? 'ch-mark-capture' : 'ch-mark-move'} />
              ) : null}
            </span>
          );
        })}
      </div>
      {kind === 'moves' ? (
        <div className="ch-figure-row">
          {PIECE_KINDS.map((pieceKind) => (
            <ChessPiece key={pieceKind} kind={pieceKind} white />
          ))}
        </div>
      ) : null}
    </div>
  );
}
