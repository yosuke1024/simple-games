/**
 * The Loop Puzzle board (docs/LOOP_PUZZLE_RULES.md §4, §5, §13).
 *
 * A CSS grid of tracks: one narrow track per row / column of dots, and three
 * per cell — 30% / 40% / 30% of the cell — plus a 30% margin outside the
 * outer dots. Every edge is one `<button>` whose grid area IS its hit area:
 * the full length between its two dots, and across, the dot track plus the
 * 30% sub-track on each side (the margin, for an outer edge). So a tap a
 * little off the drawn line still lands on it, the middle 40% of every cell
 * belongs to no edge (a tap on a number never flips a side by accident), and
 * the small squares beside a dot, where a horizontal and a vertical area
 * meet, go to the button later in the DOM. Nothing is computed from
 * coordinates, there is no board-level pointer handler and no clip-path: the
 * hit test is the browser's own, on plain rectangles — which is what an old
 * WebView does reliably (§4).
 *
 * Tap only: one click is one step, UNKNOWN → LINE → CROSS → UNKNOWN (§4).
 * There is no drag and no long press, so there is no pointer state here and
 * nothing a cancelled press could leave behind — a cancelled touch simply
 * never becomes a click.
 *
 * Keyboard (§4): the edges are one roving tab stop. Tab reaches the board,
 * the arrow keys walk the edges — ←/→ along a row, ↑/↓ to the row of edges
 * above or below (rows of horizontal and vertical edges alternate) — and
 * Enter / Space taps the focused one; held keys never repeat it. L, X and
 * Delete write a line, an × or nothing straight onto the focused edge —
 * shortcuts for states a tap reaches anyway, not functions of their own.
 *
 * Nothing rests on colour alone (§5): a line is a thick bar, an × a drawn
 * cross, an empty edge nothing at all; a broken rule adds a shape (a ring on
 * the number or dot, a dashed frame on a closed loop's lines) and is read
 * aloud; a met number turns lighter in weight as well as colour.
 */
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  CROSS,
  LINE,
  UNKNOWN,
  dotDegree,
  edgePosition,
  findConflicts,
  gridFor,
  hintEdge,
  horizontalEdge,
  linesAround,
  metClues,
  verticalEdge,
  type Grid,
  type Hint,
  type LoopPuzzleSession,
  type Mark,
} from '../../game';
import { edgeLabel } from '../feedback';

export interface LoopPuzzleBoardProps {
  session: LoopPuzzleSession;
  /** The last hint: a wrong mark, a deduction with where it was read, or an answer edge (§6). */
  hint: Hint | null;
  /** One tap on an edge (§4). */
  onCycle: (edge: number) => void;
  /** One mark written straight onto an edge — the keyboard's L / X / Delete (§4). */
  onSet: (edge: number, mark: Mark) => void;
  /** True the instant the board is solved, for the one-shot wash (§13). */
  solved: boolean;
}

/** The grid lines (1-based, `start / end`) of each kind of piece — see the header. */
const dotArea = (r: number, c: number): CSSProperties => ({
  gridRow: `${4 * r + 2} / ${4 * r + 3}`,
  gridColumn: `${4 * c + 2} / ${4 * c + 3}`,
});
const cellArea = (r: number, c: number): CSSProperties => ({
  gridRow: `${4 * r + 3} / ${4 * r + 6}`,
  gridColumn: `${4 * c + 3} / ${4 * c + 6}`,
});
/** The middle 40% of a cell: nobody's (§4). */
const padArea = (r: number, c: number): CSSProperties => ({
  gridRow: `${4 * r + 4} / ${4 * r + 5}`,
  gridColumn: `${4 * c + 4} / ${4 * c + 5}`,
});
const horizontalArea = (r: number, c: number): CSSProperties => ({
  gridRow: `${4 * r + 1} / ${4 * r + 4}`,
  gridColumn: `${4 * c + 3} / ${4 * c + 6}`,
});
const verticalArea = (r: number, c: number): CSSProperties => ({
  gridRow: `${4 * r + 3} / ${4 * r + 6}`,
  gridColumn: `${4 * c + 1} / ${4 * c + 4}`,
});

/** The track list along one side: margin, then dot / cell (30·40·30) / dot …, then margin. */
const tracks = (cells: number): string =>
  `3fr var(--lp-dot) repeat(${cells}, 3fr 4fr 3fr var(--lp-dot)) 3fr`;

/**
 * Where an arrow key moves the keyboard focus (§4). Edges sit on a doubled
 * lattice: horizontal edge (r, c) at (2r, 2c + 1), vertical edge (r, c) at
 * (2r + 1, 2c). ←/→ step two places along the same row; ↑/↓ step to the
 * neighbouring row — from a horizontal edge to the vertical edge at its left
 * end, from a vertical edge to the horizontal edge on its right — so ↓ then ↑
 * comes back to where it started. At the board's edge the focus stays put.
 */
export function edgeInDirection(grid: Grid, edge: number, key: string): number | null {
  const { horizontal, row, col } = edgePosition(grid, edge);
  let y = horizontal ? 2 * row : 2 * row + 1;
  let x = horizontal ? 2 * col + 1 : 2 * col;
  if (key === 'ArrowLeft') x -= 2;
  else if (key === 'ArrowRight') x += 2;
  else if (key === 'ArrowUp' || key === 'ArrowDown') {
    y += key === 'ArrowUp' ? -1 : 1;
    x = horizontal ? x - 1 : Math.min(x + 1, 2 * grid.width - 1);
  } else return null;
  if (y < 0 || y > 2 * grid.height || x < 0 || x > 2 * grid.width) return edge;
  if (y % 2 === 0) {
    if (x % 2 !== 1) return edge;
    return horizontalEdge(grid, y / 2, (x - 1) / 2);
  }
  if (x % 2 !== 0) return edge;
  return verticalEdge(grid, (y - 1) / 2, x / 2);
}

/** The keys that write a mark straight onto the focused edge (§4). */
const DIRECT_KEYS: Readonly<Record<string, Mark>> = {
  l: LINE,
  L: LINE,
  x: CROSS,
  X: CROSS,
  Delete: UNKNOWN,
  Backspace: UNKNOWN,
};

/** The × of a CROSS edge (§13): drawn, not typed — no glyph to translate. */
function CrossMark() {
  return (
    <svg className="lp-cross" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M2 2 8 8 M8 2 2 8" />
    </svg>
  );
}

export const LoopPuzzleBoard = memo(function LoopPuzzleBoard({
  session,
  hint,
  onCycle,
  onSet,
  solved,
}: LoopPuzzleBoardProps) {
  const { t } = useSettings();
  const noteId = useId();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { width, height, clues, marks } = session;
  const grid = gridFor(width, height);

  /** The edge that holds the board's one tab stop: the last one focused. */
  const [focusEdge, setFocusEdge] = useState(0);
  // A smaller board can follow a bigger one on the same screen: the stop must
  // land on an edge that exists, or the board drops out of the tab order.
  const tabStop = focusEdge < grid.edgeCount ? focusEdge : 0;

  const conflicts = useMemo(() => findConflicts(session, marks), [session, marks]);
  const met = useMemo(() => metClues(session, marks), [session, marks]);

  // What the hint points at (§6): the edge, and where its reason was read.
  const markedEdge = hint === null ? null : hintEdge(hint);
  const anchor = hint?.kind === 'step' ? hint.step.anchor : null;
  const hintCell = anchor?.kind === 'cell' ? anchor.index : null;
  const hintDot = anchor?.kind === 'dot' ? anchor.index : null;

  /** An edge is "in conflict" when its own line breaks a rule, or ends on a broken dot. */
  const edgeInConflict = (edge: number): boolean => {
    if (conflicts.edges[edge] === true) return true;
    if (marks[edge] !== LINE) return false;
    return (
      conflicts.dots[grid.edgeDots[2 * edge]!] === true ||
      conflicts.dots[grid.edgeDots[2 * edge + 1]!] === true
    );
  };

  // A hint hands the board's one tab stop to the edge it marks (§13), so Tab
  // into the board lands on it — the stop, not the focus: nothing moves under
  // a player who is not on the board. One already walking the edges keeps
  // its place (the stop stays with the focus).
  useEffect(() => {
    if (markedEdge === null) return;
    const board = boardRef.current;
    if (board !== null && board.contains(document.activeElement)) return;
    setFocusEdge(markedEdge);
  }, [markedEdge]);

  const focusOn = useCallback((edge: number) => {
    setFocusEdge(edge);
    boardRef.current?.querySelector<HTMLButtonElement>(`button[data-edge="${edge}"]`)?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const attribute = target.dataset.edge;
    if (attribute === undefined) return;
    const edge = Number(attribute);
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter clicks a button on every repeat of a held key; one press is one tap (§4).
    if (event.key === 'Enter' && event.repeat) {
      event.preventDefault();
      return;
    }
    const direct = DIRECT_KEYS[event.key];
    if (direct !== undefined) {
      event.preventDefault();
      if (!event.repeat) onSet(edge, direct);
      return;
    }
    const next = edgeInDirection(grid, edge, event.key);
    if (next === null) return;
    // Arrow keys move the focus and never scroll the page under it.
    event.preventDefault();
    if (next !== edge) focusOn(next);
  };

  const describedBy = (hinted: boolean, broken: boolean): string | undefined => {
    const ids = [hinted ? `${noteId}-hint` : '', broken ? `${noteId}-conflict` : ''].filter(
      Boolean,
    );
    return ids.length > 0 ? ids.join(' ') : undefined;
  };

  const edgeButton = (edge: number, orientation: 'h' | 'v', style: CSSProperties): ReactNode => {
    const mark = marks[edge]! as Mark;
    const label = edgeLabel(grid, edge, mark);
    const hinted = markedEdge === edge;
    const broken = edgeInConflict(edge);
    const classes = [
      'lp-edge',
      `lp-edge-${orientation}`,
      mark === LINE ? 'lp-edge-line' : mark === CROSS ? 'lp-edge-cross' : 'lp-edge-empty',
      broken ? 'lp-edge-conflict' : '',
      hinted ? 'lp-edge-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={`e${edge}`}
        type="button"
        className={classes}
        style={style}
        data-edge={edge}
        tabIndex={edge === tabStop ? 0 : -1}
        aria-label={t(label.key, label.values)}
        aria-describedby={describedBy(hinted, broken)}
        onFocus={() => setFocusEdge(edge)}
        onClick={() => onCycle(edge)}
      >
        <span className="lp-edge-mark" aria-hidden="true">
          {mark === CROSS ? <CrossMark /> : null}
        </span>
      </button>
    );
  };

  const items: ReactNode[] = [];
  for (let y = 0; y <= 2 * height; y++) {
    for (let x = 0; x <= 2 * width; x++) {
      const yEven = y % 2 === 0;
      const xEven = x % 2 === 0;
      if (yEven && xEven) {
        const r = y / 2;
        const c = x / 2;
        const dot = r * (width + 1) + c;
        const classes = [
          'lp-dot',
          dotDegree(grid, marks, dot) > 0 ? 'lp-dot-used' : '',
          conflicts.dots[dot] === true ? 'lp-dot-conflict' : '',
          hintDot === dot ? 'lp-dot-hint' : '',
        ]
          .filter(Boolean)
          .join(' ');
        items.push(<span key={`d${dot}`} className={classes} style={dotArea(r, c)} aria-hidden />);
      } else if (yEven) {
        const r = y / 2;
        const c = (x - 1) / 2;
        items.push(edgeButton(horizontalEdge(grid, r, c), 'h', horizontalArea(r, c)));
      } else if (xEven) {
        const r = (y - 1) / 2;
        const c = x / 2;
        items.push(edgeButton(verticalEdge(grid, r, c), 'v', verticalArea(r, c)));
      } else {
        const r = (y - 1) / 2;
        const c = (x - 1) / 2;
        const cell = r * width + c;
        // The dead zone is an element of its own, not a hole: a touch screen
        // snaps a tap that lands on nothing to the nearest button (Chromium's
        // touch adjustment), which would hand the middle of a cell to one of
        // its sides after all. A tap on the pad lands on the pad, which does
        // nothing (loop-puzzle.css explains how it is made a tap target).
        items.push(<span key={`p${cell}`} className="lp-pad" style={padArea(r, c)} aria-hidden />);
        const clue = clues[cell] ?? null;
        if (clue === null) continue;
        const broken = conflicts.cells[cell] === true;
        const isMet = !broken && met[cell] === true;
        const place = { n: clue, row: r + 1, col: c + 1 };
        const label = broken
          ? linesAround(grid, marks, cell) > clue
            ? t('loopPuzzleClueTooMany', place)
            : t('loopPuzzleClueTooFew', place)
          : isMet
            ? t('loopPuzzleClueMet', place)
            : t('loopPuzzleClueOpen', place);
        const classes = [
          'lp-clue',
          isMet ? 'lp-clue-met' : '',
          broken ? 'lp-clue-conflict' : '',
          hintCell === cell ? 'lp-clue-hint' : '',
        ]
          .filter(Boolean)
          .join(' ');
        items.push(
          <span
            key={`c${cell}`}
            className={classes}
            style={cellArea(r, c)}
            role="img"
            aria-label={label}
            aria-describedby={hintCell === cell ? `${noteId}-hint` : undefined}
          >
            <span className="lp-clue-digit" aria-hidden="true">
              {String(clue)}
            </span>
          </span>,
        );
      }
    }
  }

  return (
    <div
      ref={boardRef}
      className={`lp-board${solved ? ' lp-board-solved' : ''}`}
      role="group"
      aria-label={t('loopPuzzleBoardLabel', { width, height })}
      style={
        {
          '--lp-n': width,
          gridTemplateColumns: tracks(width),
          gridTemplateRows: tracks(height),
        } as CSSProperties
      }
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items}
      <span id={`${noteId}-hint`} hidden>
        {t('loopPuzzleNoteHint')}
      </span>
      <span id={`${noteId}-conflict`} hidden>
        {t('loopPuzzleNoteConflict')}
      </span>
    </div>
  );
});
