/**
 * The 4×4 board (docs/GAME_2048_RULES.md §1, §3, §12).
 *
 * Two layers. The cells are the board as it is *read*: sixteen fixed elements,
 * each announcing its number or "empty", which is the only way a board makes
 * sense aloud. The tiles are the board as it is *seen*: absolutely positioned
 * elements placed by `--tm-row` / `--tm-col` and moved by transform, keyed by
 * an identity this component keeps, so the browser animates a tile from its
 * old cell to its new one instead of blinking it there.
 *
 * That identity is derived rather than stored: the engine's `traceMove` says
 * where the tile in each cell went, so replaying the last move against the
 * previous board is enough to carry the ids over. A board that did not arrive
 * by a move — a new game, an undo, a resumed save — has no motion to show, so
 * its tiles are simply built where they are.
 *
 * A merge makes a new element rather than reusing one of the two tiles that
 * fed it: the merged tile pops, and a pop is a keyframe, which only plays on a
 * node that was not already carrying it. The two tiles it consumed slide in
 * underneath as ghosts and are dropped once the slide is over — without them
 * one of the pair would vanish from its old cell the instant the move landed.
 *
 * Reduced Motion turns all of it off and the tiles are simply in their new
 * places (§12).
 */
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { colOf, rowOf, traceMove, type Board, type Direction } from '../../game';

/** How far a drag has to travel before it counts as a swipe (§3). */
const SWIPE_THRESHOLD_PX = 24;

/** Must match the transition in game-2048.css: ghosts leave when it ends. */
const MOVE_MS = 110;

/** Past this the ramp stops; a game that gets here has earned one colour. */
const TOP_TILE = 2048;

/** Digits a tile can show before the ramp of type sizes runs out. */
const MAX_DIGITS = 5;

type TileKind = 'placed' | 'moved' | 'merged' | 'spawned';

interface PlacedTile {
  readonly id: number;
  readonly cell: number;
  readonly value: number;
  readonly kind: TileKind;
}

interface Layer {
  readonly tiles: readonly PlacedTile[];
  /** The tiles a merge consumed, still sliding to where they were joined. */
  readonly ghosts: readonly PlacedTile[];
}

const EMPTY_LAYER: Layer = { tiles: [], ghosts: [] };

/** Every occupied cell as its own tile, with no history behind it. */
function buildTiles(board: Board, nextId: () => number): PlacedTile[] {
  const tiles: PlacedTile[] = [];
  for (let cell = 0; cell < board.length; cell++) {
    const value = board[cell]!;
    if (value !== 0) tiles.push({ id: nextId(), cell, value, kind: 'placed' });
  }
  return tiles;
}

/**
 * The cell the new tile landed in, -1 when the move spawned none, or null when
 * `after` is not simply `before` plus one new tile — which means the board on
 * screen did not come from the move being replayed, and nothing may be carried
 * over from it.
 */
function spawnCellOf(before: Board, after: Board): number | null {
  let spawned = -1;
  for (let cell = 0; cell < after.length; cell++) {
    if (before[cell] === after[cell]) continue;
    if (spawned >= 0 || before[cell] !== 0) return null;
    spawned = cell;
  }
  return spawned;
}

export interface MergeBoardProps {
  board: Board;
  /** The direction that produced this board, or null when it arrived (§12). */
  direction: Direction | null;
  moveCount: number;
  onSwipe: (direction: Direction) => void;
}

export const MergeBoard = memo(function MergeBoard({
  board,
  direction,
  moveCount,
  onSwipe,
}: MergeBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const [layer, setLayer] = useState<Layer>(EMPTY_LAYER);
  const dropGhosts = useTransientTimeout();

  const idRef = useRef(0);
  const nextId = useCallback(() => {
    idRef.current += 1;
    return idRef.current;
  }, []);
  const previousRef = useRef<{
    board: Board;
    moveCount: number;
    tiles: readonly PlacedTile[];
  } | null>(null);

  // Runs before paint, so a tile is already at its old cell on the frame the
  // new positions are written — which is what there is to transition from.
  useLayoutEffect(() => {
    const previous = previousRef.current;
    const replayable =
      previous !== null && direction !== null && moveCount === previous.moveCount + 1;
    const trace = replayable ? traceMove(previous.board, direction) : null;
    const spawned = trace === null ? null : spawnCellOf(trace.board, board);

    let next: Layer;
    if (previous === null || trace === null || spawned === null) {
      next = { tiles: buildTiles(board, nextId), ghosts: [] };
    } else {
      const tiles: PlacedTile[] = [];
      const ghosts: PlacedTile[] = [];
      const joined = new Set<number>();

      for (const tile of previous.tiles) {
        const destination = trace.to[tile.cell]!;
        if (destination < 0) continue;
        if (trace.merged[destination]) {
          ghosts.push({ ...tile, cell: destination });
          if (!joined.has(destination)) {
            joined.add(destination);
            tiles.push({
              id: nextId(),
              cell: destination,
              value: board[destination]!,
              kind: 'merged',
            });
          }
        } else {
          tiles.push({ ...tile, cell: destination, value: board[destination]!, kind: 'moved' });
        }
      }
      if (spawned >= 0) {
        tiles.push({ id: nextId(), cell: spawned, value: board[spawned]!, kind: 'spawned' });
      }
      next = { tiles, ghosts };
    }

    previousRef.current = { board, moveCount, tiles: next.tiles };
    setLayer(next);
    if (next.ghosts.length > 0) {
      dropGhosts(() => setLayer((current) => ({ tiles: current.tiles, ghosts: [] })), MOVE_MS);
    }
  }, [board, direction, moveCount, dropGhosts, nextId]);

  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  /**
   * A swipe past the threshold tips the board the way its longer axis points.
   * A drag that does not reach it is not a hesitant move, it is no move — and
   * a move that changes nothing does nothing at all (§3).
   */
  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = pointerRef.current;
      pointerRef.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) >= Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left');
      else onSwipe(dy > 0 ? 'down' : 'up');
    },
    [onSwipe],
  );

  const positionOf = (cell: number) =>
    ({ '--tm-row': rowOf(cell), '--tm-col': colOf(cell) }) as CSSProperties;

  const renderTile = (tile: PlacedTile, ghost: boolean) => {
    const digits = Math.min(String(tile.value).length, MAX_DIGITS);
    const shade = tile.value > TOP_TILE ? 'max' : String(tile.value);
    return (
      <div
        key={tile.id}
        className={[
          'tm-tile',
          `tm-tile-v${shade}`,
          `tm-tile-d${digits}`,
          ghost ? 'tm-tile-ghost' : '',
          tile.kind === 'merged' ? 'tm-tile-merge' : '',
          tile.kind === 'spawned' ? 'tm-tile-spawn' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={positionOf(tile.cell)}
        aria-hidden="true"
      >
        <span className="tm-tile-face">{tile.value}</span>
      </div>
    );
  };

  return (
    <div
      className={`tm-board ${reducedMotion ? 'tm-board-still' : ''}`}
      role="group"
      aria-label={t('mergeBoardLabel')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {board.map((value, cell) => {
        const row = rowOf(cell) + 1;
        const col = colOf(cell) + 1;
        return (
          <div
            key={`cell-${cell}`}
            className="tm-cell"
            style={positionOf(cell)}
            role="img"
            aria-label={
              value === 0 ? t('mergeCellEmpty', { row, col }) : t('mergeCell', { row, col, value })
            }
          />
        );
      })}
      {layer.ghosts.map((tile) => renderTile(tile, true))}
      {layer.tiles.map((tile) => renderTile(tile, false))}
    </div>
  );
});
