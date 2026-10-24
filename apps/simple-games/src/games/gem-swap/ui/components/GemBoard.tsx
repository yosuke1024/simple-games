/**
 * The 8×8 board (docs/GEM_SWAP_RULES.md §3, §10): sixty-four buttons, each
 * one gem, each saying its row, column and cut aloud (never its colour).
 *
 * Three ways to ask for a swap, and all of them end in the screen's handlers
 * — this component holds no rule:
 *
 * - Tap (a click, a screen reader's activation, Enter / Space on the focused
 *   cell): `onTap`, which selects, reselects, deselects or tries the swap.
 * - Swipe: one finger, recorded with its `pointerId` on the press and
 *   measured on the release (2048 §3's shape). Past 18 px along the longer
 *   axis it asks for the swap with that neighbour (`onSwipe`); short of it,
 *   the click that follows is the tap. A `pointercancel` drops the record —
 *   no release is coming for that finger — and the click a swipe leaves
 *   behind is spent, never played as a tap as well
 *   (docs/ARCHITECTURE.md「指を取り上げられたときの契約」「押下の記録は誰のものか」).
 * - Keyboard: the board is one tab stop (roving tabindex). The arrows move the
 *   focus; while a gem is selected they try the swap in that direction
 *   instead, and the focus follows the gem that moved (`onSwapToward`). A
 *   held Enter or Space presses once.
 *
 * While a resolved move is being replayed, any press, tap or key only skips
 * to the final board (`onSkip`, §3, §10) — it is never also a selection or a
 * swap: the click a skipping press leaves behind is spent like a swipe's.
 */
import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import type { MessageKey } from '@/i18n';
import {
  BOARD_SIZE,
  CELL_COUNT,
  colOf,
  gemShape,
  inBounds,
  indexAt,
  rowOf,
  type Board,
  type GemShape,
} from '../../game';
import type { Motion } from '../replay';
import { GemIcon } from './GemIcon';

/** How far a swipe has to travel before it is one (§3, 初期値). */
export const SWIPE_THRESHOLD_PX = 18;

export type Direction = 'up' | 'down' | 'left' | 'right';

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** The cell next to `cell` in `direction`, or null past the board's edge. */
export function neighbour(cell: number, direction: Direction): number | null {
  const [dr, dc] = STEP[direction];
  const row = rowOf(cell) + dr;
  const col = colOf(cell) + dc;
  return inBounds(row, col) ? indexAt(row, col) : null;
}

/** The spoken name of each cut (§10) — literal keys, so every one is greppable. */
export const GEM_NAME_KEYS: Readonly<Record<GemShape, MessageKey>> = {
  hexagon: 'gemSwapGem_hexagon',
  octagon: 'gemSwapGem_octagon',
  pear: 'gemSwapGem_pear',
  marquise: 'gemSwapGem_marquise',
  shield: 'gemSwapGem_shield',
  heart: 'gemSwapGem_heart',
};

/** One beat of a replay: what clears, what arrives, and how long it takes. */
export interface BoardFrame {
  /** Changes on every beat, so the gems that move are drawn afresh. */
  readonly key: number;
  readonly beatMs: number;
  readonly clearing: readonly number[];
  readonly motion: ReadonlyMap<number, Motion>;
}

interface Press {
  readonly pointerId: number;
  readonly cell: number;
  readonly x: number;
  readonly y: number;
}

export interface GemBoardProps {
  board: Board;
  /** The beat being replayed, or null when the board is still. */
  frame: BoardFrame | null;
  selected: number | null;
  /** The round is being played: false once it is over. */
  interactive: boolean;
  onTap: (cell: number) => void;
  onSwipe: (from: number, to: number) => void;
  /** A keyboard swap; true when it was made (the focus then follows the gem). */
  onSwapToward: (from: number, to: number) => boolean;
  /** Ends a replay on its final board. */
  onSkip: () => void;
  /** The board element, for the screen to bring the keyboard focus here. */
  boardRef?: (element: HTMLDivElement | null) => void;
}

export const GemBoard = memo(function GemBoard({
  board,
  frame,
  selected,
  interactive,
  onTap,
  onSwipe,
  onSwapToward,
  onSkip,
  boardRef,
}: GemBoardProps) {
  const { t } = useSettings();
  /** The one cell in the tab order: where the keyboard focus lives. */
  const [cursor, setCursor] = useState(indexAt(3, 3));
  const elementRef = useRef<HTMLDivElement | null>(null);
  const pressRef = useRef<Press | null>(null);
  /**
   * Set when a press has just been used up — a swipe, or a press that skipped
   * a replay — so the click its release leaves behind is not taken as a tap
   * as well. Read only for a click that came from a press (`detail > 0`); a
   * keyboard activation has none. Dropped at the next press.
   */
  const spentClickRef = useRef(false);
  /** The same, for the click an Enter / Space that skipped a replay leaves behind. */
  const spentKeyClickRef = useRef(false);
  const replaying = frame !== null;

  const setElement = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      boardRef?.(element);
    },
    [boardRef],
  );

  const focusCell = useCallback((cell: number) => {
    setCursor(cell);
    elementRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${cell}"]`)?.focus();
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      spentClickRef.current = false;
      // One press at a time — the newest. A release can go missing entirely,
      // and a press that outlived the next one would be worse than one that
      // is replaced by it.
      pressRef.current = null;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (replaying) {
        onSkip();
        spentClickRef.current = true;
        return;
      }
      if (!interactive) return;
      const button = (event.target as Element).closest<HTMLElement>('[data-cell]');
      if (!button) return;
      pressRef.current = {
        pointerId: event.pointerId,
        cell: Number(button.dataset.cell),
        x: event.clientX,
        y: event.clientY,
      };
    },
    [interactive, onSkip, replaying],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      pressRef.current = null;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      // Short of the threshold this was a tap, and the click that follows plays it.
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      spentClickRef.current = true;
      const direction: Direction =
        Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      const to = neighbour(press.cell, direction);
      // Off the edge of the board: nothing to swap with, so nothing happens (§3).
      if (to !== null) onSwipe(press.cell, to);
    },
    [onSwipe],
  );

  /**
   * The platform took the finger away — the notification shade, a call, a
   * palm. No release is coming for it, so the record is dropped and no swap
   * is made: without this it would sit here waiting to be measured against
   * whatever released on the board next.
   */
  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pressRef.current?.pointerId === event.pointerId) pressRef.current = null;
  }, []);

  const onCellClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, cell: number) => {
      if (event.detail > 0 && spentClickRef.current) {
        spentClickRef.current = false;
        return;
      }
      if (event.detail === 0 && spentKeyClickRef.current) {
        spentKeyClickRef.current = false;
        return;
      }
      if (replaying) {
        onSkip();
        return;
      }
      if (!interactive) return;
      setCursor(cell);
      onTap(cell);
    },
    [interactive, onSkip, onTap, replaying],
  );

  /** The focus follows a click or a Tab, so the arrows start from there. */
  const onFocus = useCallback((event: { target: EventTarget }) => {
    const cell = (event.target as HTMLElement).dataset?.cell;
    if (cell !== undefined) setCursor(Number(cell));
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const attr = (event.target as HTMLElement).dataset?.cell;
      if (attr === undefined) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      spentKeyClickRef.current = false;
      const press = event.key === 'Enter' || event.key === ' ';
      const direction = ARROWS[event.key];
      if (!press && direction === undefined) return;
      if (event.repeat) {
        // A held key presses once, and does not walk or swap again.
        event.preventDefault();
        return;
      }
      if (replaying) {
        event.preventDefault();
        onSkip();
        // Space activates on its release; that click must not select as well.
        if (press) spentKeyClickRef.current = true;
        return;
      }
      if (press || direction === undefined) return;
      event.preventDefault();
      if (selected !== null && interactive) {
        const to = neighbour(selected, direction);
        if (to !== null && onSwapToward(selected, to)) focusCell(to);
        return;
      }
      const next = neighbour(Number(attr), direction);
      if (next !== null) focusCell(next);
    },
    [focusCell, interactive, onSkip, onSwapToward, replaying, selected],
  );

  const clearing = new Set(frame?.clearing ?? []);
  const boardStyle = frame ? ({ '--gs-beat': `${frame.beatMs}ms` } as CSSProperties) : undefined;

  const label = (cell: number, kind: number): string => {
    const shape = gemShape(kind);
    const gem = shape === null ? '' : t(GEM_NAME_KEYS[shape]);
    const params = { row: rowOf(cell) + 1, col: colOf(cell) + 1, gem };
    return selected === cell ? t('gemSwapCellSelected', params) : t('gemSwapCell', params);
  };

  return (
    <div
      ref={setElement}
      className={`gs-board${replaying ? ' gs-board-replaying' : ''}`}
      style={boardStyle}
      role="group"
      aria-label={t('gemSwapBoardLabel', { size: BOARD_SIZE })}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {Array.from({ length: CELL_COUNT }, (_, cell) => {
        const kind = board[cell]!;
        const motion = frame?.motion.get(cell);
        const isClearing = clearing.has(cell);
        const animated = motion !== undefined || isClearing;
        const slotStyle = motion
          ? ({ '--gs-dx': motion.dx, '--gs-dy': motion.dy } as CSSProperties)
          : undefined;
        return (
          <button
            key={cell}
            type="button"
            className={`gs-cell${selected === cell ? ' gs-cell-selected' : ''}`}
            data-cell={cell}
            data-kind={kind}
            tabIndex={cell === cursor ? 0 : -1}
            aria-label={label(cell, kind)}
            onClick={(event) => onCellClick(event, cell)}
          >
            <span
              // A new element per beat for a gem that moves or clears, so its
              // animation plays from the start; the rest stay as they are.
              key={animated && frame ? `f${frame.key}` : 'still'}
              className={[
                'gs-slot',
                motion ? 'gs-slot-arrive' : '',
                isClearing ? 'gs-slot-clearing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={slotStyle}
            >
              <GemIcon kind={kind} />
            </span>
          </button>
        );
      })}
    </div>
  );
});
