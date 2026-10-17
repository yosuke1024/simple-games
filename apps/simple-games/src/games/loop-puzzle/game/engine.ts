/**
 * The board rules of docs/LOOP_PUZZLE_RULES.md §3–§5: what one tap does to an
 * edge, what the lines currently break, which clues are met, and the win.
 * Pure functions over a flat array of marks — one per edge — with nothing to
 * keep in sync.
 *
 * Only LINE is ever read by the win: CROSS is the player's note that an edge
 * is not part of the loop (§4), and an UNKNOWN edge is simply not drawn. The
 * conflict display (§5) is the one place a CROSS counts, because a note can
 * contradict the rules on its own (three CROSSes round a 2 leave it at most
 * one edge).
 */
import { gridFor, type Grid } from './grid';
import { CROSS, LINE, UNKNOWN, type Layout, type Mark, type Marks } from './types';

/** A fresh board: nothing drawn. */
export function emptyMarks(layout: { width: number; height: number }): Mark[] {
  return new Array<Mark>(gridFor(layout.width, layout.height).edgeCount).fill(UNKNOWN);
}

/** One tap on an edge (§4): UNKNOWN → LINE → CROSS → UNKNOWN. */
export function nextMark(mark: Mark): Mark {
  if (mark === UNKNOWN) return LINE;
  if (mark === LINE) return CROSS;
  return UNKNOWN;
}

/** The board after one tap on `edge`, or null when there is no such edge. */
export function cycleEdge(marks: Marks, edge: number): Mark[] | null {
  if (!Number.isInteger(edge) || edge < 0 || edge >= marks.length) return null;
  const next = [...marks];
  next[edge] = nextMark(marks[edge]!);
  return next;
}

/** The board with `edge` set to `mark`, or null when nothing would change. */
export function setEdge(marks: Marks, edge: number, mark: Mark): Mark[] | null {
  if (!Number.isInteger(edge) || edge < 0 || edge >= marks.length) return null;
  if (marks[edge] === mark) return null;
  const next = [...marks];
  next[edge] = mark;
  return next;
}

/** How many of a cell's four edges carry a LINE. */
export function linesAround(grid: Grid, marks: Marks, cell: number): number {
  let count = 0;
  for (let k = 0; k < 4; k++) if (marks[grid.cellEdges[4 * cell + k]!] === LINE) count++;
  return count;
}

/** How many of a cell's four edges are still UNKNOWN. */
function unknownAround(grid: Grid, marks: Marks, cell: number): number {
  let count = 0;
  for (let k = 0; k < 4; k++) if (marks[grid.cellEdges[4 * cell + k]!] === UNKNOWN) count++;
  return count;
}

/** How many LINE edges meet at a dot — its degree (§3). */
export function dotDegree(grid: Grid, marks: Marks, dot: number): number {
  let count = 0;
  for (let k = 0; k < 4; k++) {
    const edge = grid.dotEdges[4 * dot + k]!;
    if (edge >= 0 && marks[edge] === LINE) count++;
  }
  return count;
}

/** The connected pieces of the drawn lines, and whether each one is closed. */
export interface LinePiece {
  /** The LINE edges of this piece, ascending. */
  readonly edges: readonly number[];
  /** Every dot of the piece has degree exactly 2: a closed loop. */
  readonly closed: boolean;
}

/**
 * Splits the LINE edges into connected pieces (edges sharing a dot belong
 * together). A piece is closed when every one of its dots has degree 2 — a
 * loop with no ends and no branches.
 */
export function linePieces(layout: Layout, marks: Marks): LinePiece[] {
  const grid = gridFor(layout.width, layout.height);
  const seen = new Uint8Array(grid.edgeCount);
  const pieces: LinePiece[] = [];
  const stack: number[] = [];
  for (let start = 0; start < grid.edgeCount; start++) {
    if (marks[start] !== LINE || seen[start] === 1) continue;
    const edges: number[] = [];
    let closed = true;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const edge = stack.pop()!;
      edges.push(edge);
      for (let end = 0; end < 2; end++) {
        const dot = grid.edgeDots[2 * edge + end]!;
        if (dotDegree(grid, marks, dot) !== 2) closed = false;
        for (let k = 0; k < 4; k++) {
          const next = grid.dotEdges[4 * dot + k]!;
          if (next < 0 || marks[next] !== LINE || seen[next] === 1) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    edges.sort((a, b) => a - b);
    pieces.push({ edges, closed });
  }
  return pieces;
}

/** Whether the LINE edges form exactly one simple closed loop (§3), clues aside. */
export function isSingleLoop(layout: Layout, marks: Marks): boolean {
  const pieces = linePieces(layout, marks);
  return pieces.length === 1 && pieces[0]!.closed;
}

/** Every clue cell has exactly its number of LINE edges (§3). */
export function cluesMet(layout: Layout, marks: Marks): boolean {
  const grid = gridFor(layout.width, layout.height);
  return layout.clues.every(
    (clue, cell) => clue === null || linesAround(grid, marks, cell) === clue,
  );
}

/**
 * Won (§3) when the LINE edges are one simple closed loop — every dot of
 * degree 0 or 2, all lines connected, at least one line — and every number
 * counts exactly its LINE edges. Read from the rules, never from the stored
 * answer; the board is unique (§8), so the two coincide.
 *
 * The length guard is not paranoia: an empty or short array would read as
 * "no lines", and the rules must not be asked about a board of another size.
 */
export function isSolved(layout: Layout, marks: Marks): boolean {
  const grid = gridFor(layout.width, layout.height);
  if (marks.length !== grid.edgeCount) return false;
  return isSingleLoop(layout, marks) && cluesMet(layout, marks);
}

/**
 * What the board currently breaks (§5) — a statement about the rules, never
 * a comparison with the answer. A LINE or CROSS that is legal but not the
 * answer is told nothing; only the Hint compares with the answer (§6).
 */
export interface Conflicts {
  /** Cells whose number can no longer be met (too many LINEs, or too few edges left). */
  readonly cells: readonly boolean[];
  /** Dots with a branch (three or four LINEs) or a dead end (one LINE, no way on). */
  readonly dots: readonly boolean[];
  /** LINE edges of a closed loop that is not the only piece drawn. */
  readonly edges: readonly boolean[];
  readonly any: boolean;
}

export function findConflicts(layout: Layout, marks: Marks): Conflicts {
  const grid = gridFor(layout.width, layout.height);
  const cells = new Array<boolean>(grid.cellCount).fill(false);
  const dots = new Array<boolean>(grid.dotCount).fill(false);
  const edges = new Array<boolean>(grid.edgeCount).fill(false);
  let any = false;

  layout.clues.forEach((clue, cell) => {
    if (clue === null) return;
    const lines = linesAround(grid, marks, cell);
    if (lines > clue || lines + unknownAround(grid, marks, cell) < clue) {
      cells[cell] = true;
      any = true;
    }
  });

  for (let dot = 0; dot < grid.dotCount; dot++) {
    const degree = dotDegree(grid, marks, dot);
    if (degree >= 3) {
      dots[dot] = true;
      any = true;
      continue;
    }
    if (degree !== 1) continue;
    let open = 0;
    for (let k = 0; k < 4; k++) {
      const edge = grid.dotEdges[4 * dot + k]!;
      if (edge >= 0 && marks[edge] === UNKNOWN) open++;
    }
    if (open === 0) {
      dots[dot] = true;
      any = true;
    }
  }

  const pieces = linePieces(layout, marks);
  if (pieces.length > 1) {
    // A closed loop beside any other line: there are two loops, or there
    // will be — a loop cannot be extended without breaking it (§3).
    for (const piece of pieces) {
      if (!piece.closed) continue;
      for (const edge of piece.edges) edges[edge] = true;
      any = true;
    }
  } else if (pieces.length === 1 && pieces[0]!.closed) {
    // The loop is closed and alone. Nothing can be added to it without a
    // branch or a second piece, so a number it does not meet is broken now.
    layout.clues.forEach((clue, cell) => {
      if (clue === null || cells[cell]) return;
      if (linesAround(grid, marks, cell) !== clue) {
        cells[cell] = true;
        any = true;
      }
    });
  }

  return { cells, dots, edges, any };
}

/**
 * The numbers met right now (§5): exactly their count of LINE edges. Shown
 * quietly while playing; a met number may still be part of a wrong loop.
 *
 * "Met" means the count is right now, not that the cell is finished — so a
 * 0 is met from the first frame (no LINE touches it) and stays met until a
 * LINE does, when it turns into a conflict instead. That is deliberate (§5):
 * one meaning for every number, read from the LINEs alone, with no CROSS
 * the player must write first.
 */
export function metClues(layout: Layout, marks: Marks): boolean[] {
  const grid = gridFor(layout.width, layout.height);
  return layout.clues.map((clue, cell) => clue !== null && linesAround(grid, marks, cell) === clue);
}
