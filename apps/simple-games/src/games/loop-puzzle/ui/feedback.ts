/**
 * The words the game screen puts beside the board: the one line of rule
 * feedback (§5) and the sentence that goes with a hint (§6). Pure functions
 * of the session and the hint, kept apart from React so they can be tested
 * on their own.
 *
 * The rule feedback reads `findConflicts` — the rules, never the answer — and
 * names the first thing broken, in a fixed order: a branch, a closed loop
 * beside other lines, a number with too many lines, a dead end, a number that
 * can no longer be met. The board marks every broken place at once; this line
 * only says in words what kind of thing to look for.
 */
import type { MessageKey } from '@/i18n';
import {
  CROSS,
  LINE,
  UNKNOWN,
  dotDegree,
  edgePosition,
  findConflicts,
  gridFor,
  linePieces,
  linesAround,
  type Grid,
  type Hint,
  type LoopPuzzleSession,
  type Mark,
} from '../game';

const EDGE_LABELS: Record<'h' | 'v', Record<Mark, MessageKey>> = {
  h: {
    [UNKNOWN]: 'loopPuzzleEdgeHEmpty',
    [LINE]: 'loopPuzzleEdgeHLine',
    [CROSS]: 'loopPuzzleEdgeHCross',
  },
  v: {
    [UNKNOWN]: 'loopPuzzleEdgeVEmpty',
    [LINE]: 'loopPuzzleEdgeVLine',
    [CROSS]: 'loopPuzzleEdgeVCross',
  },
};

/**
 * An edge's spoken name (§13): one whole sentence per direction and mark,
 * with its place passed in (1-based) — never pieced together from parts.
 */
export function edgeLabel(
  grid: Grid,
  edge: number,
  mark: Mark,
): { readonly key: MessageKey; readonly values: { row: number; col: number } } {
  const { horizontal, row, col } = edgePosition(grid, edge);
  return { key: EDGE_LABELS[horizontal ? 'h' : 'v'][mark], values: { row: row + 1, col: col + 1 } };
}

export function conflictMessageKey(session: LoopPuzzleSession): MessageKey | null {
  const { marks, clues } = session;
  const conflicts = findConflicts(session, marks);
  if (!conflicts.any) return null;
  const grid = gridFor(session.width, session.height);

  for (let dot = 0; dot < grid.dotCount; dot++) {
    if (conflicts.dots[dot] === true && dotDegree(grid, marks, dot) >= 3) {
      return 'loopPuzzleConflictBranch';
    }
  }
  if (conflicts.edges.some(Boolean)) return 'loopPuzzleConflictLoop';
  for (let cell = 0; cell < grid.cellCount; cell++) {
    const clue = clues[cell];
    if (conflicts.cells[cell] === true && clue !== null && clue !== undefined) {
      if (linesAround(grid, marks, cell) > clue) return 'loopPuzzleConflictTooMany';
    }
  }
  if (conflicts.dots.some(Boolean)) return 'loopPuzzleConflictDeadEnd';
  // What is left is a number short of lines: for good, because the edges
  // around it ran out, or because the one loop has closed without it.
  const pieces = linePieces(session, marks);
  const closedAlone = pieces.length === 1 && pieces[0]!.closed;
  return closedAlone ? 'loopPuzzleConflictClosed' : 'loopPuzzleConflictTooFew';
}

/** The sentence that goes with a hint (§6). Every one names what is marked on the board. */
export function hintMessageKey(hint: Hint): MessageKey {
  if (hint.kind === 'wrong') {
    return hint.mark === LINE ? 'loopPuzzleHintWrongLine' : 'loopPuzzleHintWrongCross';
  }
  if (hint.kind === 'reveal') {
    return hint.mark === LINE ? 'loopPuzzleHintRevealLine' : 'loopPuzzleHintRevealCross';
  }
  const { mark, anchor } = hint.step;
  const line = mark !== CROSS;
  switch (anchor.kind) {
    case 'cell':
      return line ? 'loopPuzzleHintCellLine' : 'loopPuzzleHintCellCross';
    case 'dot':
      return line ? 'loopPuzzleHintDotLine' : 'loopPuzzleHintDotCross';
    case 'trial':
      return line ? 'loopPuzzleHintTrialLine' : 'loopPuzzleHintTrialCross';
    case 'loop':
    default:
      // The loop rule only ever rules a line out: the edge that would close a
      // chain too soon (index ≥ 0), or every edge left once the loop is whole.
      // A line read from it would still be proven, so it is said plainly.
      if (line) return 'loopPuzzleHintRevealLine';
      return anchor.index >= 0 ? 'loopPuzzleHintLoopCross' : 'loopPuzzleHintClosedCross';
  }
}
