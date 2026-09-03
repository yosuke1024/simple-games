/**
 * Scoring — implements docs/NUMBER_MATCH_RULES.md §12.
 *
 * Design principles (brand: quiet, never rushed):
 * - No time factor. Points reward observation (distant pairs) and planning
 *   (row clears, finishing with few Add Numbers), never speed.
 * - A board is worth a fixed amount of work: only its starting cells earn
 *   match and row points (the scoring budget, §12). Add Numbers re-lays the
 *   remaining numbers, so without the budget every Add would hand out fresh
 *   match and row points and grinding would outscore a clean clear.
 * - Hint and Undo are never penalized; a no-hint clear earns a small bonus.
 * - Undo restores the exact previous score (snapshots live in the session
 *   history), so match→undo→match cannot farm points.
 * - Integer arithmetic only; fully deterministic and unit-testable.
 */
import type { GameMode } from './types';

export interface ScoreState {
  /** Invariant: total === matchPoints + rowPoints + clearBonus + noHintBonus. */
  readonly total: number;
  /** Streak multiplier in tenths: 10 (=×1.0) … 20 (=×2.0). */
  readonly streakTenths: number;
  readonly matchPoints: number;
  readonly rowPoints: number;
  readonly clearBonus: number;
  readonly noHintBonus: number;
  /**
   * Cell removals that still earn match and row points, counted down from the
   * board's starting cell count. Once it hits 0 the board's work is paid for:
   * play continues normally but earns nothing until the clear (§12).
   */
  readonly scorableCells: number;
}

/** A fresh score for a board of `cellCount` starting numbers. */
export function createScore(cellCount: number): ScoreState {
  return {
    total: 0,
    streakTenths: 10,
    matchPoints: 0,
    rowPoints: 0,
    clearBonus: 0,
    noHintBonus: 0,
    scorableCells: Math.max(0, cellCount),
  };
}

/** Zero score with no budget left — only useful as a shape/reset reference. */
export const INITIAL_SCORE: ScoreState = createScore(0);

const MATCH_BASE = 10;
const GAP_POINTS = 3;
/** Every match removes exactly two cells, so that is what a match costs. */
const MATCH_CELLS = 2;
/** Per playable cell of a removed row: a full 9-wide row is worth 54. */
const ROW_POINTS_PER_CELL = 6;
const MULTI_ROW_BONUS = 50;
const STREAK_STEP = 1;
const STREAK_MAX_TENTHS = 20;

/**
 * One match: base 10 + 3 per cleared cell jumped over (shortest valid path),
 * multiplied by the current streak; 6 per cell of each removed row (so a
 * narrow shaped row is worth less than a full one), +50 extra when two or
 * more rows vanish at once.
 *
 * Both awards are gated on the scoring budget: once the board's starting cells
 * have been paid for, the copies Add Numbers laid down are free to clear but
 * worth nothing, so no amount of grinding beats a clean clear.
 */
export function scoreMatch(
  state: ScoreState,
  gapCells: number,
  rowsRemoved: number,
  rowCellsRemoved = 0,
): ScoreState {
  const withinBudget = state.scorableCells > 0;
  const base = MATCH_BASE + GAP_POINTS * Math.max(0, gapCells);
  const earned = withinBudget ? Math.floor((base * state.streakTenths) / 10) : 0;
  const rowBonus = withinBudget
    ? ROW_POINTS_PER_CELL * Math.max(0, rowCellsRemoved) + (rowsRemoved >= 2 ? MULTI_ROW_BONUS : 0)
    : 0;
  return {
    ...state,
    matchPoints: state.matchPoints + earned,
    rowPoints: state.rowPoints + rowBonus,
    total: state.total + earned + rowBonus,
    streakTenths: Math.min(STREAK_MAX_TENTHS, state.streakTenths + STREAK_STEP),
    scorableCells: Math.max(0, state.scorableCells - MATCH_CELLS),
  };
}

/**
 * Add Numbers resets the streak. It costs nothing else directly, but it never
 * refreshes the scoring budget, and each use still trims the clear bonus 25%
 * (scoreClear) — the two together are what keep an efficient clear on top.
 */
export function scoreAddNumbers(state: ScoreState): ScoreState {
  return { ...state, streakTenths: INITIAL_SCORE.streakTenths };
}

/**
 * What a clear is worth before Add Numbers trims it: scaled by the level for
 * a level board — and for a free board by the level its tier stands in for
 * (§11「フリープレイ」; the session passes that level in). A daily has no
 * level and takes the flat 300.
 */
export function clearBonusBase(mode: GameMode, level: number | null): number {
  return mode !== 'daily' && level !== null ? 150 + 15 * level : 300;
}

/**
 * Applied once when the board is cleared: a level-scaled bonus reduced by 25%
 * per Add Numbers use (efficiency reward — Add itself stays free/unlimited),
 * then +10% on everything for a no-hint clear.
 */
export function scoreClear(
  state: ScoreState,
  mode: GameMode,
  level: number | null,
  addCount: number,
  hintCount: number,
): ScoreState {
  const base = clearBonusBase(mode, level);
  const clearBonus = Math.floor((base * Math.max(0, 100 - 25 * addCount)) / 100);
  const subtotal = state.total + clearBonus;
  const noHintBonus = hintCount === 0 ? Math.floor(subtotal / 10) : 0;
  return {
    ...state,
    clearBonus: state.clearBonus + clearBonus,
    noHintBonus: state.noHintBonus + noHintBonus,
    total: subtotal + noHintBonus,
  };
}
