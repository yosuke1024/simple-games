/**
 * Core Dots and Boxes types. See docs/DOTS_AND_BOXES_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A board is two strings (§1): one character per edge — open, drawn by the
 * player, drawn by the CPU — and one per box — open, the player's, the CPU's.
 * The edge owner exists for the picture only (§10: who drew which line); the
 * rules themselves only ever ask whether an edge is drawn.
 *
 * Indexing, for N boxes per side (§1):
 *   horizontal h(r, c) = r·N + c              r ∈ 0..N,   c ∈ 0..N−1
 *   vertical   v(r, c) = (N+1)·N + r·(N+1) + c  r ∈ 0..N−1, c ∈ 0..N
 *   box        (r, c)  = r·N + c              r, c ∈ 0..N−1
 */

export type BoardSize = 'small' | 'medium' | 'large';
export const BOARD_SIZES: readonly BoardSize[] = ['small', 'medium', 'large'];

export const isBoardSize = (value: unknown): value is BoardSize =>
  value === 'small' || value === 'medium' || value === 'large';

/** Boxes per side for each board (§1). */
export const BOXES_FOR: Readonly<Record<BoardSize, number>> = { small: 3, medium: 4, large: 5 };

export const PLAYER = 1;
export const CPU = 2;
export type Side = typeof PLAYER | typeof CPU;

export const opponentOf = (side: Side): Side => (side === PLAYER ? CPU : PLAYER);

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/** Edge characters (§1). */
export const EDGE_OPEN = '0';
export const EDGE_PLAYER = '1';
export const EDGE_CPU = '2';

/** Box characters (§1). */
export const BOX_OPEN = '.';
export const BOX_PLAYER = 'p';
export const BOX_CPU = 'c';

export interface Board {
  /** Boxes per side. */
  readonly n: number;
  /** One character per edge, horizontal edges first (§1). */
  readonly edges: string;
  /** One character per box, row-major (§1). */
  readonly boxes: string;
}

/** Horizontal edges: N+1 rows of N. */
export const horizontalCount = (n: number): number => (n + 1) * n;
/** Every edge on the board: 2N(N+1). */
export const edgeCount = (n: number): number => 2 * n * (n + 1);
export const boxCount = (n: number): number => n * n;

export const hEdge = (n: number, row: number, col: number): number => row * n + col;
export const vEdge = (n: number, row: number, col: number): number =>
  horizontalCount(n) + row * (n + 1) + col;
export const boxAt = (n: number, row: number, col: number): number => row * n + col;

export interface EdgePosition {
  readonly orientation: 'h' | 'v';
  readonly row: number;
  readonly col: number;
}

/** The inverse of hEdge / vEdge. */
export function edgePosition(n: number, edge: number): EdgePosition {
  const h = horizontalCount(n);
  if (edge < h) return { orientation: 'h', row: Math.floor(edge / n), col: edge % n };
  const rest = edge - h;
  return { orientation: 'v', row: Math.floor(rest / (n + 1)), col: rest % (n + 1) };
}

/** The four sides of box (row, col): top, bottom, left, right (§1). */
export function edgesOfBox(n: number, row: number, col: number): [number, number, number, number] {
  return [hEdge(n, row, col), hEdge(n, row + 1, col), vEdge(n, row, col), vEdge(n, row, col + 1)];
}

/** The one or two boxes an edge borders (§2). */
export function boxesOfEdge(n: number, edge: number): number[] {
  const { orientation, row, col } = edgePosition(n, edge);
  const out: number[] = [];
  if (orientation === 'h') {
    if (row > 0) out.push(boxAt(n, row - 1, col));
    if (row < n) out.push(boxAt(n, row, col));
  } else {
    if (col > 0) out.push(boxAt(n, row, col - 1));
    if (col < n) out.push(boxAt(n, row, col));
  }
  return out;
}

export const isDrawn = (character: string | undefined): boolean =>
  character === EDGE_PLAYER || character === EDGE_CPU;

export function emptyBoard(n: number): Board {
  return {
    n,
    edges: EDGE_OPEN.repeat(edgeCount(n)),
    boxes: BOX_OPEN.repeat(boxCount(n)),
  };
}
