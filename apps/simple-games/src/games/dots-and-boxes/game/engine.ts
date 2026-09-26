/**
 * One line, resolved (docs/DOTS_AND_BOXES_RULES.md §2, §3): which boxes it
 * closes, and whether the side that drew it goes again. Pure functions over
 * two strings — no identity, no time, no randomness.
 */
import {
  BOX_CPU,
  BOX_OPEN,
  BOX_PLAYER,
  boxCount,
  boxesOfEdge,
  EDGE_CPU,
  EDGE_OPEN,
  EDGE_PLAYER,
  edgeCount,
  edgesOfBox,
  isDrawn,
  PLAYER,
  type Board,
  type Side,
} from './types';

export interface ClaimOutcome {
  readonly board: Board;
  /** Box indices this line closed — none, one, or two (§2). */
  readonly completed: readonly number[];
  /** A closed box means the same side draws again (§2). */
  readonly keepsTurn: boolean;
}

const replaceAt = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

/** How many of a box's four sides are drawn. */
export function sidesDrawn(board: Board, box: number): number {
  const row = Math.floor(box / board.n);
  const col = box % board.n;
  let count = 0;
  for (const edge of edgesOfBox(board.n, row, col)) {
    if (isDrawn(board.edges[edge])) count += 1;
  }
  return count;
}

/**
 * `side` draws `edge`. Null when the edge is already drawn or not on the
 * board — the input is nothing (§2).
 */
export function claim(board: Board, side: Side, edge: number): ClaimOutcome | null {
  if (!Number.isInteger(edge) || edge < 0 || edge >= board.edges.length) return null;
  if (board.edges[edge] !== EDGE_OPEN) return null;

  const edges = replaceAt(board.edges, edge, side === PLAYER ? EDGE_PLAYER : EDGE_CPU);
  const drawnBoard: Board = { n: board.n, edges, boxes: board.boxes };
  const completed = boxesOfEdge(board.n, edge).filter((box) => sidesDrawn(drawnBoard, box) === 4);

  const owner = side === PLAYER ? BOX_PLAYER : BOX_CPU;
  let boxes = board.boxes;
  for (const box of completed) boxes = replaceAt(boxes, box, owner);

  return { board: { n: board.n, edges, boxes }, completed, keepsTurn: completed.length > 0 };
}

/** Every open edge, lowest index first. */
export function openEdges(board: Board): number[] {
  const out: number[] = [];
  for (let edge = 0; edge < board.edges.length; edge++) {
    if (board.edges[edge] === EDGE_OPEN) out.push(edge);
  }
  return out;
}

/** Drawn edges — which is also the number of moves played (§8). */
export function drawnEdgeCount(board: Board): number {
  let count = 0;
  for (const character of board.edges) if (isDrawn(character)) count += 1;
  return count;
}

/** Every line drawn: the game is over (§3). */
export function isFinished(board: Board): boolean {
  return !board.edges.includes(EDGE_OPEN);
}

export interface BoxCounts {
  readonly player: number;
  readonly cpu: number;
  readonly open: number;
}

export function countBoxes(board: Board): BoxCounts {
  let player = 0;
  let cpu = 0;
  let open = 0;
  for (const character of board.boxes) {
    if (character === BOX_PLAYER) player += 1;
    else if (character === BOX_CPU) cpu += 1;
    else open += 1;
  }
  return { player, cpu, open };
}

/**
 * A board that could have come from play (§8): the right lengths for its
 * size, only the known characters, and every box owned exactly when all four
 * of its sides are drawn. A closed box with no owner, or an owner on a box
 * still missing a side, is a board no sequence of lines produces.
 */
export function isConsistent(board: Board): boolean {
  const { n, edges, boxes } = board;
  if (!Number.isInteger(n) || n < 1) return false;
  if (edges.length !== edgeCount(n) || boxes.length !== boxCount(n)) return false;
  for (const character of edges) {
    if (character !== EDGE_OPEN && character !== EDGE_PLAYER && character !== EDGE_CPU) {
      return false;
    }
  }
  for (let box = 0; box < boxes.length; box++) {
    const owner = boxes[box];
    if (owner !== BOX_OPEN && owner !== BOX_PLAYER && owner !== BOX_CPU) return false;
    const closed = sidesDrawn(board, box) === 4;
    if (closed !== (owner !== BOX_OPEN)) return false;
  }
  return true;
}
