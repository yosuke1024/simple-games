/**
 * Board generation — implements docs/NUMBER_MATCH_RULES.md §10, §13 and §16.
 * Deterministic per seed; the same seed always produces the same board,
 * outline and obstacles included.
 */
import { COLS, INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { createRng } from './rng';
import { canConnect } from './rules';
import { RECTANGLE, rowLayout, startingWidths, type Shape } from './shapes';
import { isDigit, isLive, type Board, type BoardCell, type Digit } from './types';

const MAX_GENERATION_ATTEMPTS = 100;

/**
 * A stone may only sit on a row wide enough to still be worth playing, which
 * also guarantees no row is ever generated holding nothing but a stone.
 */
const MIN_ROW_WIDTH_FOR_STONE = 5;

export interface GenerateOptions {
  /** Outline of the starting board; defaults to the classic rectangle. */
  shape?: Shape;
  /**
   * Target number of numbers. The board is built from whole rows, so the
   * actual count lands on the nearest complete row rather than exactly here
   * — a half-filled last row reads as cut off, not as a shape (§13).
   */
  cellCount?: number;
  /**
   * Chance that a number is drawn to pair with a neighbour (left or above).
   * Higher = easier board.
   */
  pairBias?: number;
  /** Stones to place (§16). An upper bound: a narrow board may fit fewer. */
  stoneCount?: number;
  /** Wilds to place (§16). An upper bound, as with stones. */
  wildCount?: number;
}

interface Decorations {
  readonly stones: ReadonlySet<number>;
  readonly wilds: ReadonlySet<number>;
}

const NO_DECORATIONS: Decorations = { stones: new Set(), wilds: new Set() };

/** Removes and returns one element, chosen by `rng`. */
function takeRandom<T>(pool: T[], rng: () => number): T | undefined {
  if (pool.length === 0) return undefined;
  return pool.splice(Math.floor(rng() * pool.length), 1)[0];
}

/**
 * Which slots become stones and wilds.
 *
 * Chosen from the outline alone, by an rng of its own, before any number is
 * drawn. Two properties follow, and both matter:
 *
 *  - The digit rng's draw sequence is untouched, so a board generated with no
 *    decorations is byte-identical to the one this build's predecessor made.
 *    Early levels and past dailies keep the boards players already know.
 *  - Placement cannot drift with the numbers that happen to be drawn, so a
 *    retry for playability re-rolls the numbers and never the obstacles.
 */
function planDecorations(
  seed: string,
  layouts: readonly boolean[][],
  stoneCount: number,
  wildCount: number,
): Decorations {
  if (stoneCount <= 0 && wildCount <= 0) return NO_DECORATIONS;
  const rng = createRng(`deco-${seed}`);
  const rowSlots = layouts.map((layout, r) =>
    layout.flatMap((playable, c) => (playable ? [r * COLS + c] : [])),
  );

  // One stone per row at most: two on a row leaves a corridor no move can use.
  const stones = new Set<number>();
  const stoneRows = rowSlots.filter((slots) => slots.length >= MIN_ROW_WIDTH_FOR_STONE);
  for (let placed = 0; placed < stoneCount; placed++) {
    const slots = takeRandom(stoneRows, rng);
    if (slots === undefined) break;
    const at = slots[Math.floor(rng() * slots.length)];
    if (at !== undefined) stones.add(at);
  }

  const wilds = new Set<number>();
  const wildPool = rowSlots.flat().filter((at) => !stones.has(at));
  for (let placed = 0; placed < wildCount; placed++) {
    const at = takeRandom(wildPool, rng);
    if (at === undefined) break;
    wilds.add(at);
  }
  return { stones, wilds };
}

/**
 * Fills a shaped grid with digits. `pairBias` biases a slot towards making a
 * pair with the number to its left or above it, which is the single knob that
 * makes early levels gentle (§11).
 */
export function generateBoard(seed: string, options: GenerateOptions = {}): Board {
  const shape = options.shape ?? RECTANGLE;
  const cellCount = options.cellCount ?? INITIAL_CELLS;
  const bias = options.pairBias ?? 0;
  const rng = createRng(seed);

  // Whole rows only, as close to the target as the shape allows.
  const layouts = startingWidths(shape, cellCount).map(rowLayout);
  const { stones, wilds } = planDecorations(
    seed,
    layouts,
    options.stoneCount ?? 0,
    options.wildCount ?? 0,
  );

  const draw = (): BoardCell[] => {
    const cells: BoardCell[] = [];
    for (const layout of layouts) {
      for (const playable of layout) {
        if (!playable) {
          cells.push(null);
          continue;
        }
        const index = cells.length;
        const neighbours: Digit[] = [];
        for (const candidate of [cells[index - 1], cells[index - COLS]]) {
          if (isDigit(candidate)) neighbours.push(candidate.value);
        }
        let value: Digit;
        if (neighbours.length > 0 && rng() < bias) {
          const partner = neighbours[Math.floor(rng() * neighbours.length)]!;
          value = rng() < 0.5 ? partner : ((10 - partner) as Digit);
        } else {
          value = (1 + Math.floor(rng() * 9)) as Digit;
        }
        cells.push({ kind: 'digit', value, cleared: false });
      }
    }
    return cells;
  };

  // A drawn number is overwritten rather than skipped, so the draw sequence is
  // the same whether or not this level decorates its board.
  const decorate = (cells: BoardCell[]): BoardCell[] => {
    if (stones.size === 0 && wilds.size === 0) return cells;
    return cells.map((cell, index): BoardCell => {
      if (stones.has(index)) return { kind: 'stone' };
      if (wilds.has(index)) return { kind: 'wild', cleared: false };
      return cell;
    });
  };

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const cells = decorate(draw());
    if (hasAnyMove(cells)) return cells;
  }

  // Deterministic fallback (unreachable in practice): force one valid pair.
  const forced = forceOnePair(decorate(draw()));
  if (hasAnyMove(forced)) return forced;
  // Last resort: give up the decorations. Without stones in the way, the first
  // two live cells always connect — every slot between them is a hole.
  return forceOnePair(draw());
}

/**
 * Makes the first pair of connectable live cells match, so the board has at
 * least one move. A pair holding a wild already matches and is left alone.
 */
function forceOnePair(cells: readonly BoardCell[]): BoardCell[] {
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i];
    if (!isLive(a)) continue;
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j];
      if (!isLive(b) || !canConnect(cells, i, j)) continue;
      if (a.kind !== 'digit' || b.kind !== 'digit') return [...cells];
      const next = [...cells];
      next[j] = { kind: 'digit', value: a.value, cleared: false };
      return next;
    }
  }
  return [...cells];
}

/** Classic rectangular board (used by Daily Challenge's default shape). */
export function generateInitialBoard(seed: string, cellCount: number = INITIAL_CELLS): Board {
  return generateBoard(seed, { cellCount });
}
