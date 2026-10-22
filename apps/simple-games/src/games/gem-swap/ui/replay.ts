/**
 * What the board shows while a move it has already resolved is replayed
 * (docs/GEM_SWAP_RULES.md §10). Pure, so the frames are tested apart from
 * the timers that step through them.
 *
 * A move of S cascade stages is S + 1 frames, one per beat
 * (`playbackIntervalMs`, game/playback.ts — the beat count it squeezes into
 * about a second is exactly this frame count):
 *
 *   frame 0      the board right after the exchange — the two gems slide in
 *                from each other's cell — with stage 1's cells clearing;
 *   frame i      the board after stage i (its gems fallen, its refills
 *                dropped in from above the column), with stage i + 1's cells
 *                clearing, if there is one.
 *
 * The last frame is the move's final board. A frame says what to draw and
 * whether its clear is heard; it holds no rule — every board here is one
 * `resolveSwap` already returned.
 */
import { BOARD_SIZE, colOf, rowOf, type Board, type MoveResult } from '../game';

/** Where a gem drawn in a cell arrives from, in cells (negative dy = from above). */
export interface Motion {
  readonly dx: number;
  readonly dy: number;
}

export interface ReplayFrame {
  readonly board: Board;
  /** Cells whose gems clear on this beat. */
  readonly clearing: readonly number[];
  /** Cells whose gem arrives on this beat, and from where. */
  readonly motion: ReadonlyMap<number, Motion>;
}

export function replayFrames(move: MoveResult, a: number, b: number): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const swapMotion = new Map<number, Motion>([
    [a, { dx: colOf(b) - colOf(a), dy: rowOf(b) - rowOf(a) }],
    [b, { dx: colOf(a) - colOf(b), dy: rowOf(a) - rowOf(b) }],
  ]);
  frames.push({
    board: move.swapped,
    clearing: move.stages[0]?.cleared ?? [],
    motion: swapMotion,
  });
  move.stages.forEach((stage, i) => {
    const motion = new Map<number, Motion>();
    for (const drop of stage.drops) {
      motion.set(drop.to, { dx: 0, dy: rowOf(drop.from) - rowOf(drop.to) });
    }
    // A column's refills fall from above the board as one block: the lowest
    // lands n rows down, where n is how many the column took this stage.
    const perColumn = new Array<number>(BOARD_SIZE).fill(0);
    for (const spawn of stage.spawns) {
      const col = colOf(spawn.index);
      perColumn[col] = (perColumn[col] ?? 0) + 1;
    }
    for (const spawn of stage.spawns) {
      motion.set(spawn.index, { dx: 0, dy: -(perColumn[colOf(spawn.index)] ?? 0) });
    }
    frames.push({
      board: stage.board,
      clearing: move.stages[i + 1]?.cleared ?? [],
      motion,
    });
  });
  return frames;
}
