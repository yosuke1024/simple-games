/**
 * The board (docs/DOTS_AND_BOXES_RULES.md §2, §10).
 *
 * A CSS grid of alternating tracks — a narrow one for the dots, a wide one
 * for the lines between them — so every edge owns one grid cell and every box
 * the cell its four edges surround. An open edge is a button filling its
 * cell; its hit area is widened past the thin drawn line by a transparent
 * pseudo-element (dots-and-boxes.css), so a line is easy to hit without
 * being drawn thick. A drawn edge stops being a control at all.
 *
 * Tap only (§11): the button is the whole interaction, so there is no
 * pointer handler here and nothing for a cancelled press to leave behind.
 *
 * Ownership never rests on colour alone: the CPU's lines are dashed where
 * the player's are solid, and a box carries its owner's mark — a filled
 * circle for the player, a cross for the CPU (§10).
 *
 * Keyboard: the open edges are ordinary buttons (Tab, Enter). Drawing one
 * removes its button, which would drop focus to the page; the focus moves on
 * to the next open edge instead. For the same reason the buttons stay
 * enabled during the CPU's turn and say so with `aria-disabled` — disabling
 * them would throw focus away on every CPU line (§10).
 */
import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOX_CPU,
  BOX_PLAYER,
  boxAt,
  EDGE_OPEN,
  EDGE_PLAYER,
  hEdge,
  vEdge,
  type Board,
  type LastMove,
} from '../../game';

/** The owner's mark on a closed box (§10): drawn, not typed — no glyph to translate. */
export function BoxMark({ owner }: { owner: 'you' | 'cpu' }) {
  return owner === 'you' ? (
    <svg className="db-mark db-mark-you" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
    </svg>
  ) : (
    <svg className="db-mark db-mark-cpu" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5 17.5 17.5 M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

export interface DotsAndBoxesBoardProps {
  board: Board;
  /** False while the CPU draws: the open edges answer nothing (§4). */
  playersTurn: boolean;
  lastMove: LastMove | null;
  onEdge: (edge: number) => void;
}

export const DotsAndBoxesBoard = memo(function DotsAndBoxesBoard({
  board,
  playersTurn,
  lastMove,
  onEdge,
}: DotsAndBoxesBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  /** The open edge focus moves to once the focused one has been drawn. */
  const refocusRef = useRef<number | null>(null);
  const { n, edges, boxes } = board;

  // After a draw removes the focused button, hand focus to its neighbour —
  // but only if nothing else has taken it in the meantime.
  useEffect(() => {
    const target = refocusRef.current;
    refocusRef.current = null;
    if (target === null) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    boardRef.current?.querySelector<HTMLButtonElement>(`button[data-edge="${target}"]`)?.focus();
  }, [edges]);

  const press = (edge: number, button: HTMLButtonElement) => {
    if (playersTurn && document.activeElement === button) {
      const open = Array.from(
        boardRef.current?.querySelectorAll<HTMLButtonElement>('button[data-edge]') ?? [],
      );
      const at = open.indexOf(button);
      const neighbour = open[at + 1] ?? open[at - 1];
      refocusRef.current = neighbour ? Number(neighbour.dataset.edge) : null;
    }
    onEdge(edge);
  };

  const edgeCell = (key: string, edge: number, orientation: 'h' | 'v', line: string): ReactNode => {
    const state = edges[edge];
    if (state === EDGE_OPEN) {
      return (
        <button
          key={key}
          type="button"
          className={`db-edge db-edge-${orientation}`}
          data-edge={edge}
          aria-label={t('dotsAndBoxesLineOpen', { line })}
          aria-disabled={playersTurn ? undefined : true}
          onClick={(event) => press(edge, event.currentTarget)}
        />
      );
    }
    const mine = state === EDGE_PLAYER;
    const fresh = lastMove?.edge === edge;
    return (
      <span
        // Keyed by the move that drew it, so the highlight plays on arrival
        // and never again (§10).
        key={fresh ? `${key}-${lastMove.moveCount}` : key}
        className={[
          'db-edge',
          `db-edge-${orientation}`,
          mine ? 'db-line-you' : 'db-line-cpu',
          fresh ? 'db-line-fresh' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="img"
        aria-label={
          mine ? t('dotsAndBoxesLineYours', { line }) : t('dotsAndBoxesLineCpu', { line })
        }
      />
    );
  };

  const cells: ReactNode[] = [];
  for (let gridRow = 0; gridRow <= 2 * n; gridRow++) {
    for (let gridCol = 0; gridCol <= 2 * n; gridCol++) {
      const key = `${gridRow}-${gridCol}`;
      const rowEven = gridRow % 2 === 0;
      const colEven = gridCol % 2 === 0;
      if (rowEven && colEven) {
        cells.push(<span key={key} className="db-dot" aria-hidden="true" />);
      } else if (rowEven) {
        const row = gridRow / 2;
        const col = (gridCol - 1) / 2;
        const line = t('dotsAndBoxesLineH', { row: row + 1, col: col + 1 });
        cells.push(edgeCell(key, hEdge(n, row, col), 'h', line));
      } else if (colEven) {
        const row = (gridRow - 1) / 2;
        const col = gridCol / 2;
        const line = t('dotsAndBoxesLineV', { row: row + 1, col: col + 1 });
        cells.push(edgeCell(key, vEdge(n, row, col), 'v', line));
      } else {
        const row = (gridRow - 1) / 2;
        const col = (gridCol - 1) / 2;
        const owner = boxes[boxAt(n, row, col)];
        const place = { row: row + 1, col: col + 1 };
        cells.push(
          owner === BOX_PLAYER ? (
            <span
              key={key}
              className="db-box db-box-you"
              role="img"
              aria-label={t('dotsAndBoxesBoxYours', place)}
            >
              <BoxMark owner="you" />
            </span>
          ) : owner === BOX_CPU ? (
            <span
              key={key}
              className="db-box db-box-cpu"
              role="img"
              aria-label={t('dotsAndBoxesBoxCpu', place)}
            >
              <BoxMark owner="cpu" />
            </span>
          ) : (
            <span
              key={key}
              className="db-box"
              role="img"
              aria-label={t('dotsAndBoxesBoxOpen', place)}
            />
          ),
        );
      }
    }
  }

  return (
    <div
      ref={boardRef}
      className={`db-board db-board-${n} ${reducedMotion ? 'db-board-still' : ''}`}
      role="group"
      aria-label={t('dotsAndBoxesBoardLabel', { n })}
    >
      {cells}
    </div>
  );
});
