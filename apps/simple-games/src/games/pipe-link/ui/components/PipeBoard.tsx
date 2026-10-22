/**
 * The board (docs/PIPE_LINK_RULES.md §1, §3, §10): one `<button>` per tile, in
 * a `role="group"` that names the board's size.
 *
 * Input follows §3, the contract the right button already has in Minesweeper
 * §3 and Nonogram §3:
 *
 * - A tap or a left click turns the tile a quarter turn clockwise.
 * - A single right click turns it counter-clockwise — and so does a pen's
 *   barrel button (Nonogram's form: pressed while hovering it is `button` 2,
 *   held as the tip comes down it is in `buttons`), and macOS's Ctrl+click,
 *   which the browser delivers as a context menu; the click that follows it is
 *   marked spent with `detail > 0`, so the Enter a keyboard player presses
 *   next is never swallowed. There is no right-drag.
 * - The browser's menu never opens anywhere over the board, gaps included.
 *   The menu touch and a pen's tip raise at the end of a long press is not
 *   the right button, and is ignored.
 * - A long press (touch or a pen's tip, LONG_PRESS_MS, Minesweeper's value)
 *   does nothing, and the click the browser may send after it does not turn
 *   the tile either — so a long press is never "one turn" on one device and
 *   "none" on another. Not checked on a real device (§13).
 * - Everything a press arms — the long-press timer, the mark on the tile —
 *   is released by `pointercancel` (docs/ARCHITECTURE.md「指を取り上げられた
 *   ときの契約」).
 *
 * The keyboard: one tab stop (roving tabindex); arrows move between tiles and
 * stop at the edge; Enter or Space turns clockwise and Shift+Enter
 * counter-clockwise, all on keydown with the default stopped, and never on a
 * key's repeat (a held Enter does not spin a tile).
 *
 * Each tile's drawn angle is cumulative (§10): a clockwise turn from 270°
 * goes on to 360°, never back round to 0°. The board keeps those angles
 * itself, so a turn is drawn as the turn it was — the screen tells it which
 * way the last one went (`spin`).
 */
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { periodOf, type Board, type Hint, type TileType, type TurnDirection } from '../../game';
import { pipesKey } from '../labels';
import { PipeGhost, PipeGlyph, SourceMark } from './PipeGlyph';

/** Minesweeper's long-press threshold, copied (§3) — the code is not shared. */
export const LONG_PRESS_MS = 450;

/** The last turn, so the drawing goes round the way the tile went. */
export interface Spin {
  readonly cell: number;
  readonly direction: TurnDirection;
}

export interface PipeBoardHandle {
  /** Brings the keyboard focus onto the board, at the tile it last had. */
  focusTile: () => void;
}

export interface PipeBoardProps {
  board: Board;
  orientations: readonly number[];
  lit: readonly boolean[];
  hint: Hint | null;
  solved: boolean;
  spin: Spin | null;
  onTurn: (cell: number, direction: TurnDirection) => void;
}

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * The cumulative quarter turns each tile is drawn at. Kept in a ref and
 * brought up to date during render — idempotent, so a second render pass
 * changes nothing: a tile is only moved when its drawing disagrees with its
 * orientation.
 */
function useCumulativeTurns(
  board: Board,
  orientations: readonly number[],
  spin: Spin | null,
): readonly number[] {
  const turnsRef = useRef<number[] | null>(null);
  if (turnsRef.current === null || turnsRef.current.length !== orientations.length) {
    turnsRef.current = [...orientations];
  }
  const turns = turnsRef.current;
  for (let cell = 0; cell < orientations.length; cell++) {
    const period = periodOf(board.types[cell]!);
    const target = orientations[cell]!;
    const shown = ((turns[cell]! % period) + period) % period;
    if (shown === target) continue;
    const forward = (target - shown + period) % period;
    // The way the last turn went, for its own tile; otherwise the short way.
    const step =
      spin !== null && spin.cell === cell
        ? spin.direction === 'cw'
          ? forward
          : forward - period
        : forward <= period / 2
          ? forward
          : forward - period;
    turns[cell] = turns[cell]! + step;
  }
  return turns;
}

export const PipeBoard = memo(
  forwardRef<PipeBoardHandle, PipeBoardProps>(function PipeBoard(
    { board, orientations, lit, hint, solved, spin, onTurn },
    ref,
  ) {
    const { t } = useSettings();
    const reducedMotion = useReducedMotion();
    const { width, height } = board;
    const turns = useCumulativeTurns(board, orientations, spin);

    const [focusCell, setFocusCell] = useState<number>(() => board.source);
    const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

    useImperativeHandle(ref, () => ({ focusTile: () => buttonsRef.current[focusCell]?.focus() }), [
      focusCell,
    ]);

    /**
     * The latest `onTurn`, read at the moment of a press: the screen hands a
     * new one after every turn, and binding the handlers to it would re-render
     * every tile on every turn.
     */
    const onTurnRef = useRef(onTurn);
    onTurnRef.current = onTurn;

    const timerRef = useRef<number | null>(null);
    /**
     * The tile a long press or a right-button turn has already answered, so
     * the click that may follow does not turn it again. The tile rather than a
     * bare flag: a mark that named no tile would sit there waiting to swallow
     * an unrelated click.
     */
    const handledRef = useRef<number | null>(null);
    /** How the press in progress arrived (touch and a pen's tip raise their own menu). */
    const pointerTypeRef = useRef('mouse');
    /** Whether the press in progress is the right button's — a pen's barrel counts. */
    const rightPressRef = useRef(false);

    const clearTimer = useCallback(() => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    useEffect(() => clearTimer, [clearTimer]);

    const onPointerDown = useCallback(
      (event: PointerEvent<HTMLButtonElement>, cell: number) => {
        pointerTypeRef.current = event.pointerType;
        // Ask what is down, not only what moved: a pen's barrel held as the
        // tip comes down arrives in `buttons`, with `button` 0 (Nonogram §3).
        const right = event.button === 2 || (event.buttons & 2) !== 0;
        rightPressRef.current = right;
        handledRef.current = null;
        clearTimer();
        // Only a finger or a pen's tip has a long press to neutralise (§3).
        if (right || event.button !== 0) return;
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          // Held long enough: the press means nothing, and the click it may
          // leave behind must not turn the tile.
          handledRef.current = cell;
        }, LONG_PRESS_MS);
      },
      [clearTimer],
    );

    /** A release ends the press; a long press already marked stays marked for its click. */
    const onPointerUp = useCallback(() => {
      if (timerRef.current !== null) clearTimer();
    }, [clearTimer]);

    /**
     * The platform took the pointer away: no release and no click will
     * follow, so nothing this press armed may outlive it — the timer, and a
     * long press's mark, which would otherwise swallow the next tap here.
     */
    const onPointerCancel = useCallback(() => {
      if (timerRef.current !== null) clearTimer();
      handledRef.current = null;
      rightPressRef.current = false;
    }, [clearTimer]);

    const onTileContextMenu = useCallback(
      (event: MouseEvent<HTMLButtonElement>, cell: number) => {
        event.preventDefault();
        // The menu at the end of a long press by touch or a pen's tip: not the
        // right button (§3). A pen's barrel is the right button.
        if (
          !rightPressRef.current &&
          (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen')
        ) {
          return;
        }
        // macOS raises it from the primary button (Ctrl+click), so a click may
        // still follow: mark the tile so that click turns nothing.
        clearTimer();
        handledRef.current = cell;
        rightPressRef.current = false;
        onTurnRef.current(cell, 'ccw');
      },
      [clearTimer],
    );

    /** No browser menu anywhere over the board — the gaps are a target too. */
    const onBoardContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    }, []);

    const onClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>, cell: number) => {
        clearTimer();
        setFocusCell(cell);
        // `detail` counts the clicks of the press that left this click: a
        // keyboard activation has none, so it is never the click a mark was
        // left for.
        if (event.detail > 0 && handledRef.current === cell) {
          handledRef.current = null;
          return;
        }
        onTurnRef.current(cell, 'cw');
      },
      [clearTimer],
    );

    const moveFocus = useCallback(
      (cell: number) => {
        setFocusCell(cell);
        buttonsRef.current[cell]?.focus();
      },
      [setFocusCell],
    );

    const onKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const arrow = ARROWS[event.key];
        if (arrow !== undefined) {
          event.preventDefault();
          const row = Math.floor(cell / width) + arrow[0];
          const col = (cell % width) + arrow[1];
          // The edge stops the focus; it does not wrap (§3).
          if (row >= 0 && row < height && col >= 0 && col < width) moveFocus(row * width + col);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          // Taken here rather than left to the button's own click, so a held
          // key's repeats turn nothing and Shift+Enter is not also a click.
          event.preventDefault();
          if (event.repeat) return;
          onTurnRef.current(cell, event.key === 'Enter' && event.shiftKey ? 'ccw' : 'cw');
        }
      },
      [height, moveFocus, width],
    );

    /** Space activates a button on its release; that click is already answered above. */
    const onKeyUp = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ') event.preventDefault();
    }, []);

    const handlers = useMemo<TileHandlers>(
      () => ({
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onContextMenu: onTileContextMenu,
        onClick,
        onKeyDown,
        onKeyUp,
        onFocus: setFocusCell,
        register: (cell, element) => {
          buttonsRef.current[cell] = element;
        },
      }),
      [onClick, onKeyDown, onKeyUp, onPointerCancel, onPointerDown, onPointerUp, onTileContextMenu],
    );

    return (
      <div
        className={[
          'pn-board',
          solved ? 'pn-board-solved' : '',
          reducedMotion ? 'pn-board-still' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="group"
        aria-label={t('pipeLinkBoardLabel', { width, height })}
        style={{ '--pn-cols': width, '--pn-rows': height } as CSSProperties}
        onContextMenu={onBoardContextMenu}
      >
        {orientations.map((orientation, cell) => (
          <PipeTile
            key={cell}
            cell={cell}
            width={width}
            type={board.types[cell]!}
            orientation={orientation}
            turns={turns[cell]!}
            lit={lit[cell]!}
            source={cell === board.source}
            hintOrientation={hint !== null && hint.cell === cell ? hint.orientation : null}
            focusable={cell === focusCell}
            handlers={handlers}
          />
        ))}
      </div>
    );
  }),
);

interface TileHandlers {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, cell: number) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>, cell: number) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>, cell: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, cell: number) => void;
  onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: (cell: number) => void;
  register: (cell: number, element: HTMLButtonElement | null) => void;
}

interface PipeTileProps {
  cell: number;
  width: number;
  type: TileType;
  orientation: number;
  turns: number;
  lit: boolean;
  source: boolean;
  hintOrientation: number | null;
  focusable: boolean;
  handlers: TileHandlers;
}

/**
 * One tile: its own memoised component, so a turn re-renders the tile it
 * turned and the tiles whose light changed — not the whole board.
 */
const PipeTile = memo(function PipeTile({
  cell,
  width,
  type,
  orientation,
  turns,
  lit,
  source,
  hintOrientation,
  focusable,
  handlers,
}: PipeTileProps) {
  const { t } = useSettings();
  const row = Math.floor(cell / width) + 1;
  const col = (cell % width) + 1;
  const pipes = t(pipesKey(type, orientation));
  const tile = t(source ? 'pipeLinkTileSource' : 'pipeLinkTile', {
    row,
    col,
    pipes,
    light: lit ? t('pipeLinkLit') : t('pipeLinkUnlit'),
  });
  const hinted = hintOrientation !== null;
  const label = hinted
    ? t('pipeLinkTileHinted', { tile, pipes: t(pipesKey(type, hintOrientation)) })
    : tile;
  return (
    <button
      ref={(element) => handlers.register(cell, element)}
      type="button"
      className={[
        'pn-tile',
        lit ? 'pn-tile-lit' : '',
        source ? 'pn-tile-source' : '',
        hinted ? 'pn-tile-hint' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      tabIndex={focusable ? 0 : -1}
      onPointerDown={(event) => handlers.onPointerDown(event, cell)}
      onPointerUp={handlers.onPointerUp}
      onPointerLeave={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onContextMenu={(event) => handlers.onContextMenu(event, cell)}
      onClick={(event) => handlers.onClick(event, cell)}
      onKeyDown={(event) => handlers.onKeyDown(event, cell)}
      onKeyUp={handlers.onKeyUp}
      onFocus={() => handlers.onFocus(cell)}
    >
      <PipeGlyph type={type} turns={turns} lit={lit} />
      {hinted ? <PipeGhost type={type} orientation={hintOrientation} /> : null}
      {source ? <SourceMark /> : null}
    </button>
  );
});
