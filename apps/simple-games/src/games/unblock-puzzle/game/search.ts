/**
 * The two searches of docs/UNBLOCK_PUZZLE_RULES.md §6–§8, over the same move
 * rule as engine.ts: one block, along its lane, any distance through free
 * cells, is one move (§4).
 *
 * `exploreComponent` enumerates every board reachable from a board — its
 * component — breadth first, up to a state limit, and then runs a
 * breadth-first search backwards from every solved board in it at once. That
 * gives the exact fewest moves to the exit from every board of the
 * component, which is what generation picks a starting board by (§8). Every
 * move is reversible (slide the same block back), so the component is the
 * same whichever board it is entered from, and every board in a component
 * that holds a solved board is itself solvable — there are no dead ends.
 *
 * `solve` is the forward search the Hint and the save check use (§6, §12):
 * breadth first from one board until the first solved board, with parent
 * links so the shortest solution can be read back. It stops at a state limit
 * and says so — `capped` is never reported as `unsolvable`, and neither is
 * ever dressed up as a move (§6).
 *
 * Both count their work in `searchWork` — one per board expanded plus one per
 * move generated — because that is the number the budgets are stated in
 * (§8): the same board gives the same count on any machine.
 *
 * A state packs every block's offset into 3 bits (offsets are 0–4): blocks
 * 0–9 in one 32-bit word, 10–15 in a second. A neighbour's key is the
 * parent's key plus one shifted delta, so moving never re-encodes a board.
 *
 * Speed matters here, because every search runs on the UI thread on a tap
 * (§8). Beside its offsets, each board met keeps the cells it covers as bits,
 * by rows and by columns; a new board's bits are its parent's with one
 * block's cells swapped, and how far a block can slide is one lookup in a
 * small table (REACH) by the six cells of its lane. The moves are read in
 * place, block by block, never listed first, and the tables are sized for
 * the state limit up front, so a search to the usual limit never copies them
 * to grow. The answers and the work count are those of the simpler version
 * this replaced: moves are met, and counted, in the same order.
 */
import { CELL_COUNT, EXIT_POSITION, MAX_BLOCKS, type Block, type Board, type Slide } from './types';

let work = 0;

/** Boards expanded plus moves generated plus boards and edges walked since the last reset (§8). */
export const searchWork = {
  read: (): number => work,
  reset: (): void => {
    work = 0;
  },
  /** Adds work done outside this file that scales with a component — a scan of its boards (§8). */
  add: (amount: number): void => {
    work += amount;
  },
};

/**
 * Whether a state limit lets a search meet at least one board. A limit
 * below 1 — or NaN, which compares false with everything and would switch
 * the cap off — is answered `capped` at once rather than read as a search
 * that found nothing.
 */
const usableLimit = (limit: number): boolean => limit >= 1;

/**
 * The searches pack 3 bits per block into two 32-bit words (below), which
 * holds MAX_BLOCKS blocks and no more. Every caller passes a board that
 * `isValidBoard` accepted, which caps the count; a longer list is a caller's
 * bug, refused loudly rather than searched as a board it is not.
 */
function assertPackable(board: Board): void {
  if (board.blocks.length > MAX_BLOCKS || board.positions.length !== board.blocks.length) {
    throw new RangeError(
      `unblock-puzzle search: ${board.blocks.length} blocks, at most ${MAX_BLOCKS}`,
    );
  }
}

/** Blocks held in the low word; the rest go in the high word. */
const LOW_BLOCKS = 10;

const shiftOf = (block: number): number =>
  block < LOW_BLOCKS ? 3 * block : 3 * (block - LOW_BLOCKS);

/** Packs a position list into its two words. */
export function packPositions(positions: readonly number[]): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let block = 0; block < positions.length; block++) {
    const value = positions[block]! << shiftOf(block);
    if (block < LOW_BLOCKS) lo |= value;
    else hi |= value;
  }
  return [lo, hi];
}

/** The offset of one block in a packed state. */
const offsetIn = (lo: number, hi: number, block: number): number =>
  ((block < LOW_BLOCKS ? lo : hi) >>> shiftOf(block)) & 7;

export function unpackPositions(lo: number, hi: number, count: number): number[] {
  const out: number[] = [];
  for (let block = 0; block < count; block++) out.push(offsetIn(lo, hi, block));
  return out;
}

/**
 * The most states a table is sized for before its first board. A search to a
 * larger limit (none in play: the limit is COMPONENT_LIMIT, 6,000) grows as
 * it goes.
 */
const PRESIZE_LIMIT = 1 << 14;

/** Room for the first boards of a search under `limit`, without regrowing below it. */
const initialCapacity = (limit: number): number =>
  limit <= PRESIZE_LIMIT ? Math.max(16, Math.ceil(limit) + 1) : 256;

/**
 * The boards a search has met, in discovery order, behind an open-addressing
 * hash table that grows with them. Typed arrays throughout: a search runs on
 * the UI thread (§8), and a `Map` keyed by board strings costs several times
 * as much per state.
 *
 * Beside each board's packed offsets it keeps the cells the board covers,
 * twice: by rows and by columns (`Lanes`). A board's moves are read off
 * those bits, and a new board's bits are its parent's with one block's cells
 * swapped — so no board ever lays its blocks out cell by cell.
 */
class StateSet {
  lo: Int32Array;
  hi: Int32Array;
  rowLo: Int32Array;
  rowHi: Int32Array;
  colLo: Int32Array;
  colHi: Int32Array;
  count = 0;
  private slots: Int32Array;
  private mask: number;

  constructor(private readonly limit: number) {
    const capacity = initialCapacity(limit);
    this.lo = new Int32Array(capacity);
    this.hi = new Int32Array(capacity);
    this.rowLo = new Int32Array(capacity);
    this.rowHi = new Int32Array(capacity);
    this.colLo = new Int32Array(capacity);
    this.colHi = new Int32Array(capacity);
    let slots = 512;
    while (slots < capacity * 2) slots *= 2;
    this.slots = new Int32Array(slots);
    this.mask = slots - 1;
  }

  private static hash(lo: number, hi: number): number {
    const h = Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi + 0x7f4a7c15, 0x85ebca77);
    return h ^ (h >>> 15);
  }

  /**
   * The index of a state; -1 when it is new and the set is full. A new
   * state's cell bits are left for the caller to write (`count` grew).
   */
  insert(lo: number, hi: number): number {
    const slots = this.slots;
    const mask = this.mask;
    let slot = StateSet.hash(lo, hi) & mask;
    for (;;) {
      const held = slots[slot]!;
      if (held === 0) break;
      const index = held - 1;
      if (this.lo[index] === lo && this.hi[index] === hi) return index;
      slot = (slot + 1) & mask;
    }
    if (this.count >= this.limit) return -1;
    const index = this.count++;
    if (index >= this.lo.length) this.growStates();
    this.lo[index] = lo;
    this.hi[index] = hi;
    slots[slot] = index + 1;
    if (this.count * 2 > slots.length) this.growSlots();
    return index;
  }

  /** The index of a state, or -1 when it was never met. */
  find(lo: number, hi: number): number {
    let slot = StateSet.hash(lo, hi) & this.mask;
    for (;;) {
      const held = this.slots[slot]!;
      if (held === 0) return -1;
      const index = held - 1;
      if (this.lo[index] === lo && this.hi[index] === hi) return index;
      slot = (slot + 1) & this.mask;
    }
  }

  /** Room for this many states without growing. */
  get capacity(): number {
    return this.lo.length;
  }

  private growStates(): void {
    const grow = (from: Int32Array): Int32Array => {
      const to = new Int32Array(from.length * 2);
      to.set(from);
      return to;
    };
    this.lo = grow(this.lo);
    this.hi = grow(this.hi);
    this.rowLo = grow(this.rowLo);
    this.rowHi = grow(this.rowHi);
    this.colLo = grow(this.colLo);
    this.colHi = grow(this.colHi);
  }

  private growSlots(): void {
    const slots = new Int32Array(this.slots.length * 2);
    const mask = slots.length - 1;
    for (let index = 0; index < this.count; index++) {
      let slot = StateSet.hash(this.lo[index]!, this.hi[index]!) & mask;
      while (slots[slot] !== 0) slot = (slot + 1) & mask;
      slots[slot] = index + 1;
    }
    this.slots = slots;
    this.mask = mask;
  }
}

/** Offsets 0–4: the most any block can take (§1). */
const OFFSETS = 5;

/**
 * How far a block can slide, for every block length, offset and lane: entry
 * `((length − 2) · 5 + offset) · 64 + lane` is the lowest offset it can reach,
 * plus 8 × the highest. `lane` is the lane's six cells as bits (bit k = the
 * k-th cell along it), the block's own cells included. Built once; 640 bytes.
 */
const REACH = ((): Uint8Array => {
  const table = new Uint8Array(2 * OFFSETS * 64);
  for (let length = 2; length <= 3; length++) {
    for (let offset = 0; offset <= 6 - length; offset++) {
      for (let lane = 0; lane < 64; lane++) {
        let min = offset;
        while (min > 0 && (lane & (1 << (min - 1))) === 0) min--;
        let max = offset;
        while (max + length < 6 && (lane & (1 << (max + length))) === 0) max++;
        table[((length - 2) * OFFSETS + offset) * 64 + lane] = min | (max << 3);
      }
    }
  }
  return table;
})();

/**
 * Per-block constants the move generator reads in its inner loop, so that a
 * board's moves are table lookups and nothing else.
 *
 * A board's covered cells are kept as bits twice, six bits per line: by rows
 * (row r at bits 6r–6r+5, bit = column; rows 0–4 in one word, row 5 in a
 * second) and by columns (column c at bits 6c–6c+5, bit = row; columns 0–4
 * and column 5 likewise). A horizontal block reads its lane from the rows, a
 * vertical one from the columns — six bits either way, which REACH turns
 * into how far it can slide. `cover*` holds, at entry `block · 5 + offset`,
 * the bits a block covers at an offset in each of the four words.
 */
interface Lanes {
  readonly count: number;
  /** Which word holds the block's lane: 0 rows 0–4, 1 row 5, 2 columns 0–4, 3 column 5. */
  readonly word: Uint8Array;
  /** Where the lane's six bits start in that word. */
  readonly shift: Uint8Array;
  /** The block's first REACH entry: `(length − 2) · 5 · 64`. */
  readonly reach: Uint16Array;
  readonly coverRowLo: Int32Array;
  readonly coverRowHi: Int32Array;
  readonly coverColLo: Int32Array;
  readonly coverColHi: Int32Array;
}

function lanesOf(blocks: readonly Block[]): Lanes {
  const count = blocks.length;
  const word = new Uint8Array(count);
  const shift = new Uint8Array(count);
  const reach = new Uint16Array(count);
  const coverRowLo = new Int32Array(count * OFFSETS);
  const coverRowHi = new Int32Array(count * OFFSETS);
  const coverColLo = new Int32Array(count * OFFSETS);
  const coverColHi = new Int32Array(count * OFFSETS);
  blocks.forEach((block, index) => {
    const horizontal = block.orientation === 'h';
    word[index] = (horizontal ? 0 : 2) + (block.lane === 5 ? 1 : 0);
    shift[index] = block.lane === 5 ? 0 : 6 * block.lane;
    reach[index] = (block.length - 2) * OFFSETS * 64;
    for (let offset = 0; offset <= 6 - block.length; offset++) {
      const at = index * OFFSETS + offset;
      for (let k = 0; k < block.length; k++) {
        const row = horizontal ? block.lane : offset + k;
        const col = horizontal ? offset + k : block.lane;
        if (row < 5) coverRowLo[at] = coverRowLo[at]! | (1 << (6 * row + col));
        else coverRowHi[at] = coverRowHi[at]! | (1 << col);
        if (col < 5) coverColLo[at] = coverColLo[at]! | (1 << (6 * col + row));
        else coverColHi[at] = coverColHi[at]! | (1 << row);
      }
    }
  });
  return { count, word, shift, reach, coverRowLo, coverRowHi, coverColLo, coverColHi };
}

/** Writes the cell bits of the board at `index` from its offsets, block by block. */
function layOut(lanes: Lanes, set: StateSet, index: number): void {
  const lo = set.lo[index]!;
  const hi = set.hi[index]!;
  let rowLo = 0;
  let rowHi = 0;
  let colLo = 0;
  let colHi = 0;
  for (let block = 0; block < lanes.count; block++) {
    const at = block * OFFSETS + offsetIn(lo, hi, block);
    rowLo |= lanes.coverRowLo[at]!;
    rowHi |= lanes.coverRowHi[at]!;
    colLo |= lanes.coverColLo[at]!;
    colHi |= lanes.coverColHi[at]!;
  }
  set.rowLo[index] = rowLo;
  set.rowHi[index] = rowHi;
  set.colLo[index] = colLo;
  set.colHi[index] = colHi;
}

/**
 * Writes the cell bits of board `child`, reached from board `parent` by one
 * block sliding from offset `from` to `to`: the parent's, with that block's
 * cells at `from` taken out and its cells at `to` put in.
 */
function slideBits(
  lanes: Lanes,
  set: StateSet,
  parent: number,
  child: number,
  block: number,
  from: number,
  to: number,
): void {
  const a = block * OFFSETS + from;
  const b = block * OFFSETS + to;
  set.rowLo[child] = set.rowLo[parent]! ^ lanes.coverRowLo[a]! ^ lanes.coverRowLo[b]!;
  set.rowHi[child] = set.rowHi[parent]! ^ lanes.coverRowHi[a]! ^ lanes.coverRowHi[b]!;
  set.colLo[child] = set.colLo[parent]! ^ lanes.coverColLo[a]! ^ lanes.coverColLo[b]!;
  set.colHi[child] = set.colHi[parent]! ^ lanes.coverColHi[a]! ^ lanes.coverColHi[b]!;
}

/**
 * The most moves out of one board: each move is told apart by the free cell
 * its block newly covers first and its direction, so at most 4 per free cell
 * (§8) — and fewer than this with the target and one other block on the
 * board.
 */
const MAX_MOVES = 4 * CELL_COUNT;

/**
 * How far block `block` of the board at `index` can slide: the lowest offset
 * it can reach, plus 8 × the highest (REACH).
 */
function reachOf(
  lanes: Lanes,
  set: StateSet,
  index: number,
  block: number,
  offset: number,
): number {
  const word = lanes.word[block]!;
  const bits =
    word === 0
      ? set.rowLo[index]!
      : word === 1
        ? set.rowHi[index]!
        : word === 2
          ? set.colLo[index]!
          : set.colHi[index]!;
  return REACH[lanes.reach[block]! + offset * 64 + ((bits >>> lanes.shift[block]!) & 63)]!;
}

/** One move out of a board: a block, the offsets it leaves and ends on, the state it reaches. */
interface Move {
  readonly block: number;
  readonly from: number;
  readonly to: number;
  readonly lo: number;
  readonly hi: number;
}

/**
 * Every move out of the board at `index`, in the order of engine.ts
 * `legalSlides` — block by block, nearest offset first, left / up before
 * right / down — the same moves, in the same order, that the searches read
 * in place. Listed only where they must be reordered first (`solve`'s
 * `prefer`). Counts no work.
 */
function movesOf(lanes: Lanes, set: StateSet, index: number): Move[] {
  const lo = set.lo[index]!;
  const hi = set.hi[index]!;
  const out: Move[] = [];
  for (let block = 0; block < lanes.count; block++) {
    const from = offsetIn(lo, hi, block);
    const reach = reachOf(lanes, set, index, block, from);
    const shift = shiftOf(block);
    const low = block < LOW_BLOCKS;
    const add = (to: number): void => {
      const delta = (to - from) << shift;
      out.push({ block, from, to, lo: low ? lo + delta : lo, hi: low ? hi : hi + delta });
    };
    for (let to = from - 1; to >= (reach & 7); to--) add(to);
    for (let to = from + 1; to <= reach >>> 3; to++) add(to);
  }
  return out;
}

const isGoal = (lo: number): boolean => (lo & 7) === EXIT_POSITION;

/** A fully enumerated component, with every board's fewest moves to the exit. */
export interface Component {
  readonly blocks: readonly Block[];
  /** Boards in the component. */
  readonly size: number;
  /** Fewest moves to the exit per board, by discovery index; -1 when no board is solved. */
  readonly goalDistance: Int32Array;
  /** The largest finite `goalDistance`; -1 when the component holds no solved board. */
  readonly maxDistance: number;
  /** Boards expanded plus moves generated to build this (§8). */
  readonly work: number;
  /** The positions of the board at a discovery index. */
  positionsAt(index: number): number[];
  /** The discovery index of a board, or -1 when it is not in this component. */
  indexOf(positions: readonly number[]): number;
  /** Fewest moves from one board to every other, by discovery index. */
  distancesFrom(index: number): Int32Array;
  /**
   * How many boards lie at most `depth` moves from one board, by a walk that
   * stops at that depth (§7). Past `cap` boards the walk stops and returns
   * `cap + 1`; when it would spend more than `workLimit`, it stops and
   * returns null. Exact whenever it returns a number of at most `cap`.
   */
  countWithin(index: number, depth: number, cap?: number, workLimit?: number): number | null;
}

export type ComponentResult =
  | { readonly status: 'complete'; readonly component: Component }
  | { readonly status: 'capped'; readonly states: number; readonly work: number };

/**
 * Every board reachable from `board`, up to `stateLimit` boards, and the
 * fewest moves to the exit from each (§8). `capped` when the component is
 * larger than the limit — a component cut short has no exact distances, so
 * nothing is read from it.
 *
 * `workLimit` caps the whole call. The listing costs one per board plus one
 * per move, and the walk back from the solved boards reads every listed board
 * and edge once more — the same amount again — so the listing stops, `capped`,
 * once it has spent half the limit. The call then never spends more than
 * `workLimit` plus one board's moves.
 */
export function exploreComponent(
  board: Board,
  stateLimit: number,
  workLimit: number = Number.POSITIVE_INFINITY,
): ComponentResult {
  assertPackable(board);
  const before = work;
  if (!usableLimit(stateLimit)) return { status: 'capped', states: 0, work: 0 };
  const listingLimit = workLimit / 2;
  const lanes = lanesOf(board.blocks);
  const set = new StateSet(stateLimit);
  const [startLo, startHi] = packPositions(board.positions);
  set.insert(startLo, startHi);
  layOut(lanes, set, 0);

  let edges = new Int32Array(set.capacity * 8);
  let edgeCount = 0;
  let edgeStart = new Int32Array(set.capacity);

  /** Lists one move out of board `parent`; false once the component is past the state limit. */
  const list = (
    parent: number,
    block: number,
    from: number,
    to: number,
    lo: number,
    hi: number,
  ): boolean => {
    const known = set.count;
    const next = set.insert(lo, hi);
    if (next < 0) return false;
    if (set.count > known) slideBits(lanes, set, parent, next, block, from, to);
    edges[edgeCount++] = next;
    return true;
  };

  // The moves of each board are read in place, in legalSlides order.
  for (let index = 0; index < set.count; index++) {
    if (index >= edgeStart.length) {
      const grown = new Int32Array(edgeStart.length * 2);
      grown.set(edgeStart);
      edgeStart = grown;
    }
    edgeStart[index] = edgeCount;
    // Room for every move of this board (at most MAX_MOVES) before reading them.
    if (edgeCount + MAX_MOVES > edges.length) {
      const grown = new Int32Array(edges.length * 2);
      grown.set(edges);
      edges = grown;
    }
    const lo = set.lo[index]!;
    const hi = set.hi[index]!;
    work++;
    for (let block = 0; block < lanes.count; block++) {
      const offset = offsetIn(lo, hi, block);
      const reach = reachOf(lanes, set, index, block, offset);
      const shift = shiftOf(block);
      const low = block < LOW_BLOCKS;
      for (let to = offset - 1, min = reach & 7; to >= min; to--) {
        work++;
        const delta = (to - offset) << shift;
        if (!list(index, block, offset, to, low ? lo + delta : lo, low ? hi : hi + delta)) {
          return { status: 'capped', states: set.count, work: work - before };
        }
      }
      for (let to = offset + 1, max = reach >>> 3; to <= max; to++) {
        work++;
        const delta = (to - offset) << shift;
        if (!list(index, block, offset, to, low ? lo + delta : lo, low ? hi : hi + delta)) {
          return { status: 'capped', states: set.count, work: work - before };
        }
      }
    }
    if (work - before > listingLimit) {
      return { status: 'capped', states: set.count, work: work - before };
    }
  }

  const size = set.count;
  const starts = new Int32Array(size + 1);
  starts.set(edgeStart.subarray(0, size));
  starts[size] = edgeCount;

  const distancesFromSources = (sources: readonly number[]): Int32Array => {
    const distance = new Int32Array(size).fill(-1);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    for (const source of sources) {
      distance[source] = 0;
      queue[tail++] = source;
    }
    while (head < tail) {
      const state = queue[head++]!;
      const next = distance[state]! + 1;
      const end = starts[state + 1]!;
      // A walk over listed edges is work like any other (§8): one per board
      // taken off the queue, one per edge read.
      work += 1 + end - starts[state]!;
      for (let edge = starts[state]!; edge < end; edge++) {
        const neighbour = edges[edge]!;
        if (distance[neighbour] === -1) {
          distance[neighbour] = next;
          queue[tail++] = neighbour;
        }
      }
    }
    return distance;
  };

  // Every move is reversible, so the edge lists read the same both ways and
  // the backwards search from the solved boards walks the same lists.
  const goals: number[] = [];
  for (let index = 0; index < size; index++) if (isGoal(set.lo[index]!)) goals.push(index);
  const goalDistance =
    goals.length > 0 ? distancesFromSources(goals) : new Int32Array(size).fill(-1);
  let maxDistance = -1;
  for (let index = 0; index < size; index++) {
    if (goalDistance[index]! > maxDistance) maxDistance = goalDistance[index]!;
  }

  const countWithin = (
    source: number,
    depth: number,
    cap: number = Number.POSITIVE_INFINITY,
    limit: number = Number.POSITIVE_INFINITY,
  ): number | null => {
    const spentBefore = work;
    const distance = new Int32Array(size).fill(-1);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    distance[source] = 0;
    queue[tail++] = source;
    // Boards at `depth` are counted when they are met and never expanded:
    // what lies beyond them is not asked for.
    while (head < tail && distance[queue[head]!]! < depth) {
      if (tail > cap) return cap + 1;
      if (work - spentBefore > limit) return null;
      const state = queue[head++]!;
      const next = distance[state]! + 1;
      const end = starts[state + 1]!;
      work += 1 + end - starts[state]!;
      for (let edge = starts[state]!; edge < end; edge++) {
        const neighbour = edges[edge]!;
        if (distance[neighbour] === -1) {
          distance[neighbour] = next;
          queue[tail++] = neighbour;
        }
      }
    }
    return tail > cap ? cap + 1 : tail;
  };

  const count = board.blocks.length;
  const component: Component = {
    blocks: board.blocks,
    size,
    goalDistance,
    maxDistance,
    work: work - before,
    positionsAt: (index) => unpackPositions(set.lo[index]!, set.hi[index]!, count),
    indexOf: (positions) => {
      if (positions.length !== count) return -1;
      const [lo, hi] = packPositions(positions);
      return set.find(lo, hi);
    },
    distancesFrom: (index) => distancesFromSources([index]),
    countWithin,
  };
  return { status: 'complete', component };
}

/**
 * How many boards a breadth-first search from `start` must expand to prove
 * its minimum: every board fewer than `minMoves` moves away (§7). It does not
 * depend on the order moves are tried in, which is what makes it a property
 * of the puzzle rather than of this implementation.
 *
 * The walk stops at depth `minMoves − 1`: nothing farther counts. With a
 * `cap` it also stops once the count passes the cap and returns `cap + 1` —
 * enough to know a tier's upper bound fails (§7) — and with a `workLimit` it
 * returns null when the walk would spend more than that. Every number it
 * returns at or below `cap` is exact.
 */
export function exploredStates(
  component: Component,
  start: number,
  minMoves: number,
  cap?: number,
  workLimit?: number,
): number | null {
  return component.countWithin(start, minMoves - 1, cap, workLimit);
}

export type SolveResult =
  | {
      readonly status: 'solved';
      /** The fewest moves to the exit from the board searched. */
      readonly minMoves: number;
      /** One shortest solution, as slides in order. */
      readonly solution: readonly Slide[];
      /** Boards fewer than `minMoves` moves away — what proving the minimum costs (§7). */
      readonly exploredStates: number;
      /** Boards met before stopping. */
      readonly states: number;
    }
  | { readonly status: 'unsolvable'; readonly states: number }
  | { readonly status: 'capped'; readonly states: number };

/**
 * Breadth first from `board` to the first solved board, meeting at most
 * `stateLimit` boards (§6). The first solved board met is at the fewest moves
 * — boards are expanded in order of distance — and its parent links read back
 * one shortest solution; with two equally short first moves, the one
 * `legalSlides` lists first wins, so the answer is the same on every device.
 * `prefer` moves one block's slides to the front of that order (the Hint's
 * tie-break, session.ts): a shortest solution that starts with `prefer`
 * itself wins, then one that starts with another slide of its block.
 *
 * `unsolvable` only once the whole component has been searched; `capped` when
 * the limit stopped the search first. A caller words both honestly.
 *
 * `workLimit` stops the search, `capped`, once it has spent more than that —
 * checked after each board it expands, so it never spends more than the
 * limit plus one board's moves. The Hint and the save check leave it off
 * (the state limit bounds them); a deal sets it (§8).
 */
export function solve(
  board: Board,
  stateLimit: number,
  prefer?: Slide,
  workLimit: number = Number.POSITIVE_INFINITY,
): SolveResult {
  assertPackable(board);
  const spentBefore = work;
  const lanes = lanesOf(board.blocks);
  const [startLo, startHi] = packPositions(board.positions);
  if (isGoal(startLo)) {
    return { status: 'solved', minMoves: 0, solution: [], exploredStates: 0, states: 1 };
  }
  if (!usableLimit(stateLimit)) return { status: 'capped', states: 0 };
  const set = new StateSet(stateLimit);
  set.insert(startLo, startHi);
  layOut(lanes, set, 0);
  let parents = new Int32Array(set.capacity);
  let moveBlock = new Uint8Array(set.capacity);
  let moveTo = new Uint8Array(set.capacity);
  let depth = new Int32Array(set.capacity);
  parents[0] = -1;
  let goal = -1;
  let capped = false;

  const grow = (needed: number): void => {
    if (needed < parents.length) return;
    const size = parents.length * 2;
    const p = new Int32Array(size);
    const b = new Uint8Array(size);
    const t = new Uint8Array(size);
    const d = new Int32Array(size);
    p.set(parents);
    b.set(moveBlock);
    t.set(moveTo);
    d.set(depth);
    parents = p;
    moveBlock = b;
    moveTo = t;
    depth = d;
  };

  /**
   * Records one move out of board `parent` — `block` from offset `from` to
   * `to`, reaching the packed state `lo` / `hi`; false once the search is to
   * stop (§6).
   */
  const step = (
    parent: number,
    block: number,
    from: number,
    to: number,
    lo: number,
    hi: number,
  ): boolean => {
    const known = set.count;
    const next = set.insert(lo, hi);
    if (next < 0) {
      capped = true;
      return false;
    }
    if (set.count === known) return true;
    slideBits(lanes, set, parent, next, block, from, to);
    grow(next);
    parents[next] = parent;
    moveBlock[next] = block;
    moveTo[next] = to;
    depth[next] = depth[parent]! + 1;
    if (isGoal(lo)) {
      goal = next;
      return false;
    }
    return true;
  };

  let expanding = 0;
  if (prefer !== undefined) {
    // The root's moves, `prefer` first, then the rest of its block's moves,
    // then every other move — each group in legalSlides order. A breadth-first
    // search meets the boards of each depth in the order of their first-move
    // ancestors, so the first solved board met descends from the earliest
    // root move that begins any shortest solution: `prefer`'s block wins every
    // tie it is part of.
    const moves = movesOf(lanes, set, 0);
    work += 1 + moves.length;
    const rank = (move: Move): number =>
      move.block !== prefer.block ? 2 : move.to === prefer.to ? 0 : 1;
    const ordered = moves
      .map((move, order) => ({ move, order }))
      .sort((a, b) => rank(a.move) - rank(b.move) || a.order - b.order);
    for (const { move } of ordered) {
      if (!step(0, move.block, move.from, move.to, move.lo, move.hi)) break;
    }
    expanding = 1;
  }
  // The moves of each board are read in place, in legalSlides order — the
  // same moves movesOf lists, without writing them down first.
  for (; expanding < set.count && goal < 0 && !capped; expanding++) {
    const lo = set.lo[expanding]!;
    const hi = set.hi[expanding]!;
    work++;
    search: for (let block = 0; block < lanes.count; block++) {
      const offset = offsetIn(lo, hi, block);
      const reach = reachOf(lanes, set, expanding, block, offset);
      const shift = shiftOf(block);
      const low = block < LOW_BLOCKS;
      for (let to = offset - 1, min = reach & 7; to >= min; to--) {
        work++;
        const delta = (to - offset) << shift;
        if (!step(expanding, block, offset, to, low ? lo + delta : lo, low ? hi : hi + delta)) {
          break search;
        }
      }
      for (let to = offset + 1, max = reach >>> 3; to <= max; to++) {
        work++;
        const delta = (to - offset) << shift;
        if (!step(expanding, block, offset, to, low ? lo + delta : lo, low ? hi : hi + delta)) {
          break search;
        }
      }
    }
    if (goal < 0 && work - spentBefore > workLimit) capped = true;
  }

  if (goal < 0) {
    return capped
      ? { status: 'capped', states: set.count }
      : { status: 'unsolvable', states: set.count };
  }
  const solution: Slide[] = [];
  for (let at = goal; parents[at]! >= 0; at = parents[at]!) {
    solution.push({ block: moveBlock[at]!, to: moveTo[at]! });
  }
  solution.reverse();
  const minMoves = solution.length;
  // Every board met lies at most `minMoves` away; the ones nearer than that
  // are what proving the minimum expanded (§7).
  let explored = 0;
  for (let index = 0; index < set.count; index++) if (depth[index]! < minMoves) explored++;
  return { status: 'solved', minMoves, solution, exploredStates: explored, states: set.count };
}
