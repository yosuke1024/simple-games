/**
 * The stage table (docs/INVADERS_RULES.md §1, §3). Twenty rows, read by stage number; nothing
 * here is rolled, so every player meets the same twenty skies in the same order.
 *
 * A stage is more than a speed: it chooses the formation's shape, how low it begins, which
 * invader fires and in what rhythm, how far the formation drops at the wall, and whether —
 * and how often — one of them leaves the line to dive at the ship. Stage 1 is the classic
 * block exactly as it was, so the tutorial, the first-stage pilot and the records written by
 * the published build all still describe it.
 *
 * This module imports nothing from the engine so that the engine can import it: the grid is
 * restated here (4 rows × 7 columns) and the engine's ENEMY_COUNT is that product.
 */
export const ROWS = 4;
export const COLS = 7;

export type LayoutId =
  | 'full'
  | 'wings'
  | 'arrow'
  | 'wedge'
  | 'ring'
  | 'stair'
  | 'stair-mirror'
  | 'pillars'
  | 'hourglass'
  | 'checker';

/** Who fires next (§3): the fixed rotation, the column above the ship, or the rotation in pairs. */
export type FireMode = 'rotate' | 'aimed' | 'burst';

export interface StageSpec {
  layout: LayoutId;
  /** How many 12 px steps lower than stage 1 the formation enters (0–4). */
  drop: number;
  fire: FireMode;
  /** Pixels the formation descends at each wall. */
  descent: number;
  /** Ticks between dive launches; 0 means nobody leaves the formation on this stage. */
  diveEvery: number;
  /** Divers allowed in the air at once (0–DIVE_MAX). */
  diveMax: number;
}

export const LAYOUT_IDS: readonly LayoutId[] = [
  'full',
  'wings',
  'arrow',
  'wedge',
  'ring',
  'stair',
  'stair-mirror',
  'pillars',
  'hourglass',
  'checker',
];

/** Whether the slot (row 0–3 from the top, column 0–6) is filled in a layout. */
function filled(layout: LayoutId, row: number, col: number): boolean {
  switch (layout) {
    case 'full':
      return true;
    case 'wings':
      return col !== 3;
    case 'arrow':
      return col >= row && col <= COLS - 1 - row;
    case 'wedge':
      return col >= 3 - row && col <= 3 + row;
    case 'ring':
      return row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1;
    case 'stair':
      return col >= row;
    case 'stair-mirror':
      return col <= COLS - 1 - row;
    case 'pillars':
      return col % 2 === 0;
    case 'hourglass':
      return row === 0 || row === ROWS - 1 || (col >= 2 && col <= 4);
    case 'checker':
      return (row + col) % 2 === 0;
  }
}

const LAYOUT_SLOTS: Readonly<Record<LayoutId, readonly number[]>> = Object.fromEntries(
  LAYOUT_IDS.map((layout) => [
    layout,
    Array.from({ length: ROWS * COLS }, (_, id) => id).filter((id) =>
      filled(layout, Math.floor(id / COLS), id % COLS),
    ),
  ]),
) as unknown as Record<LayoutId, readonly number[]>;

/**
 * The ids a layout fields, ascending. An id keeps its row and column from the 4 × 7 grid
 * (`row = id / 7`, `col = id % 7`), so the silhouette, the points and "the front of a column"
 * read the same whatever the shape.
 */
export function layoutSlots(layout: LayoutId): readonly number[] {
  return LAYOUT_SLOTS[layout];
}

/** Points for one invader by its row: 40 / 30 / 20 / 10 from the top. */
export function pointsFor(id: number): number {
  return (ROWS - Math.floor(id / COLS)) * 10;
}

/** What a whole formation of this shape is worth. */
export function layoutPoints(layout: LayoutId): number {
  return LAYOUT_SLOTS[layout].reduce((sum, id) => sum + pointsFor(id), 0);
}

export const isLayoutId = (value: unknown): value is LayoutId =>
  typeof value === 'string' && (LAYOUT_IDS as readonly string[]).includes(value);

/** The most divers any stage may have in the air; the save validator holds the same line. */
export const DIVE_MAX = 2;
/** Ticks after a stage starts (or a run resumes from an older save) before the first dive. */
export const DIVE_GRACE_TICKS = 90;
/** The longest launch interval in the table — the bound the save validator checks against. */
export const DIVE_EVERY_MAX = 150;

const row = (
  layout: LayoutId,
  drop: number,
  fire: FireMode,
  descent: number,
  diveEvery = 0,
  diveMax = 0,
): StageSpec => ({ layout, drop, fire, descent, diveEvery, diveMax });

/**
 * Stages 1–20. Blocks of five: the first learns the three voices of fire, the second adds the
 * diver, the third stacks them, the fourth sends two divers at once. Every fifth stage is the
 * full block again, lower each time. A faster descent (18 px) is given only to formations of
 * twenty or fewer, so a stage never asks for the full block's twenty-eight kills in less room.
 */
export const STAGES: readonly StageSpec[] = [
  row('full', 0, 'rotate', 12),
  row('full', 1, 'rotate', 12),
  row('wings', 1, 'rotate', 12),
  row('arrow', 1, 'aimed', 12),
  row('full', 2, 'burst', 12),
  row('ring', 0, 'rotate', 12, 150, 1),
  row('stair', 1, 'aimed', 12, 150, 1),
  row('pillars', 1, 'burst', 18, 150, 1),
  row('hourglass', 2, 'rotate', 12, 150, 1),
  row('full', 3, 'aimed', 12, 120, 1),
  row('checker', 1, 'burst', 18, 150, 1),
  row('wedge', 2, 'aimed', 12, 105, 1),
  row('wings', 2, 'rotate', 12, 105, 1),
  row('arrow', 3, 'burst', 18, 105, 1),
  row('full', 1, 'aimed', 12, 120, 1),
  row('ring', 2, 'burst', 12, 90, 2),
  row('stair-mirror', 2, 'aimed', 12, 90, 2),
  row('hourglass', 2, 'rotate', 12, 75, 2),
  row('pillars', 2, 'aimed', 12, 90, 2),
  row('full', 2, 'burst', 12, 75, 2),
];

/** The row for a stage; out-of-range stages read the nearest end rather than extrapolating. */
export function stageSpec(stage: number): StageSpec {
  const index = Math.min(STAGES.length, Math.max(1, Math.floor(stage))) - 1;
  return STAGES[index]!;
}

/** The sum of every stage's formation: the most a run can score. */
export const MAX_SCORE = STAGES.reduce((sum, spec) => sum + layoutPoints(spec.layout), 0);
