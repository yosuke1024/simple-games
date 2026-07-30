/**
 * The 4x4 board (docs/GAME_2048_RULES.md §10).
 *
 * Two layers. The lower one is the sixteen squares, and it is where the
 * accessible names live: each square announces its value and its position,
 * straight from the session's board, so what a screen reader hears is never a
 * frame behind what the game thinks. The upper layer is the tiles — purely
 * visual, hidden from assistive technology, and the only thing that animates.
 *
 * Tile identity is derived from the movement list the engine reports, which is
 * what lets a tile slide instead of blink. When the derivation and the board
 * disagree for any reason, the board wins and the tiles are rebuilt from it:
 * an animation is never worth showing the wrong number.
 *
 * Reduced Motion skips the tracking entirely — positions and values change at
 * once, with nothing to wait for (§10).
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { CELLS, colOf, rowOf, WIN_VALUE, type Board, type Direction } from '../../game';
import type { LastMove } from '../../state/GameContext';

/** Matches the .g2048-tile transform transition in game-2048.css. */
const MOVE_MS = 110;
/** The merge pop and the new tile's arrival, both of which follow the slide. */
const SETTLE_MS = 180;

/** Below this, a drag is a tap or a tremble rather than a swipe. */
const SWIPE_THRESHOLD_PX = 24;

interface RenderedTile {
  readonly id: number;
  readonly index: number;
  readonly value: number;
  /** Placed by this move: it arrives rather than travels. */
  readonly spawned: boolean;
  /** Made by this move's merge: it lands with a small pop. */
  readonly merged: boolean;
  /** Absorbed by a merge: it finishes its slide, then goes. */
  readonly leaving: boolean;
}

export interface BoardViewProps {
  board: Board;
  lastMove: LastMove | null;
  onSwipe: (direction: Direction) => void;
}

const plainTile = (id: number, index: number, value: number): RenderedTile => ({
  id,
  index,
  value,
  spawned: false,
  merged: false,
  leaving: false,
});

export const BoardView = memo(function BoardView({ board, lastMove, onSwipe }: BoardViewProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const [tiles, setTiles] = useState<readonly RenderedTile[]>([]);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const nextIdRef = useRef(1);
  /** The board the tiles on screen were derived from. */
  const shownRef = useRef<Board | null>(null);
  const lastMoveRef = useRef<LastMove | null>(null);

  const takeId = useCallback((): number => nextIdRef.current++, []);

  const fromBoard = useCallback(
    (next: Board): RenderedTile[] => {
      const out: RenderedTile[] = [];
      for (let index = 0; index < CELLS; index++) {
        const value = next[index] ?? 0;
        if (value !== 0) out.push(plainTile(takeId(), index, value));
      }
      return out;
    },
    [takeId],
  );

  /**
   * Carries the tiles on screen through one move. Returns null when the result
   * would not match the board the engine produced — the caller then rebuilds.
   */
  const carryThrough = useCallback(
    (current: readonly RenderedTile[], move: LastMove, next: Board): RenderedTile[] | null => {
      const byIndex = new Map<number, RenderedTile>();
      for (const tile of current) if (!tile.leaving) byIndex.set(tile.index, tile);

      const out: RenderedTile[] = [];
      const survivors = new Set<number>();
      for (const movement of move.movements) {
        const source = byIndex.get(movement.from);
        const id = source?.id ?? takeId();
        if (!movement.merged) {
          out.push(plainTile(id, movement.to, movement.value));
          continue;
        }
        if (survivors.has(movement.to)) {
          // The half that is absorbed: it still travels, then it is gone.
          out.push({ ...plainTile(id, movement.to, movement.value), leaving: true });
          continue;
        }
        survivors.add(movement.to);
        out.push({ ...plainTile(id, movement.to, movement.value * 2), merged: true });
      }
      if (move.spawnIndex !== null) {
        out.push({
          ...plainTile(takeId(), move.spawnIndex, next[move.spawnIndex] ?? 0),
          spawned: true,
        });
      }

      // The board is the authority: if these tiles do not spell it out exactly,
      // they are wrong and the caller starts again from the board.
      const spelled = new Array<number>(CELLS).fill(0);
      for (const tile of out) if (!tile.leaving) spelled[tile.index] = tile.value;
      for (let index = 0; index < CELLS; index++) {
        if (spelled[index] !== (next[index] ?? 0)) return null;
      }
      return out;
    },
    [takeId],
  );

  useEffect(() => {
    const seenBoard = shownRef.current;
    const seenMove = lastMoveRef.current;
    shownRef.current = board;
    lastMoveRef.current = lastMove;
    if (seenBoard === board) return;

    // A first render, an undo, a new game, or Reduced Motion: no journey to
    // show, so the tiles are simply what the board says.
    if (reducedMotion || seenBoard === null || lastMove === null || lastMove === seenMove) {
      setTiles(fromBoard(board));
      return;
    }
    setTiles(carryThrough(tilesRef.current, lastMove, board) ?? fromBoard(board));
  }, [board, lastMove, reducedMotion, carryThrough, fromBoard]);

  // Once the move has played out, absorbed tiles go and the one-shot classes
  // come off, so the next merge in the same square animates again.
  useEffect(() => {
    if (!tiles.some((tile) => tile.leaving || tile.merged || tile.spawned)) return;
    const id = window.setTimeout(() => {
      setTiles((current) =>
        current
          .filter((tile) => !tile.leaving)
          .map((tile) =>
            tile.merged || tile.spawned ? { ...tile, merged: false, spawned: false } : tile,
          ),
      );
    }, MOVE_MS + SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [tiles]);

  // ---------- swipe ----------

  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    // Capture the pointer so a swipe that leaves the board still ends here —
    // a flick off the edge is a move, not a cancelled gesture.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Old webviews without pointer capture simply keep the plain behaviour.
    }
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragRef.current;
      dragRef.current = null;
      if (start === null) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      // The longer axis decides; a diagonal drag is not an ambiguous move.
      if (Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left');
      else onSwipe(dy > 0 ? 'down' : 'up');
    },
    [onSwipe],
  );

  const onPointerCancel = useCallback(() => {
    dragRef.current = null;
  }, []);

  const cells = useMemo(
    () =>
      Array.from({ length: CELLS }, (_, index) => {
        const value = board[index] ?? 0;
        const row = rowOf(index) + 1;
        const col = colOf(index) + 1;
        return (
          <div
            key={index}
            className="g2048-cell"
            role="img"
            aria-label={
              value === 0
                ? t('g2048CellEmpty', { row, col })
                : t('g2048CellLabel', { value, row, col })
            }
          />
        );
      }),
    [board, t],
  );

  return (
    <div
      className="g2048-board"
      role="group"
      aria-label={t('g2048BoardLabel')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="g2048-cells">{cells}</div>
      <div className="g2048-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={[
              'g2048-face',
              'g2048-tile',
              tile.spawned ? 'g2048-tile-new' : '',
              tile.merged ? 'g2048-tile-merged' : '',
              tile.leaving ? 'g2048-tile-leaving' : '',
              tile.value >= WIN_VALUE ? 'g2048-tile-goal' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-value={tile.value <= WIN_VALUE ? tile.value : 'max'}
            data-digits={Math.min(5, String(tile.value).length)}
            style={
              { '--g2048-row': rowOf(tile.index), '--g2048-col': colOf(tile.index) } as CSSProperties
            }
          >
            {tile.value}
          </div>
        ))}
      </div>
    </div>
  );
});
