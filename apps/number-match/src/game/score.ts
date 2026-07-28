/**
 * Scoring — implements docs/NUMBER_MATCH_RULES.md §12.
 *
 * Design principles (brand: quiet, never rushed):
 * - No time factor. Points reward observation (distant pairs) and planning
 *   (row clears, finishing with few Add Numbers), never speed.
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
}

export const INITIAL_SCORE: ScoreState = {
  total: 0,
  streakTenths: 10,
  matchPoints: 0,
  rowPoints: 0,
  clearBonus: 0,
  noHintBonus: 0,
};

const MATCH_BASE = 10;
const GAP_POINTS = 3;
const ROW_POINTS = 50;
const MULTI_ROW_BONUS = 50;
const STREAK_STEP = 1;
const STREAK_MAX_TENTHS = 20;

/**
 * One match: base 10 + 3 per cleared cell jumped over (shortest valid path),
 * multiplied by the current streak; +50 per removed row, +50 extra when two
 * or more rows vanish at once.
 */
export function scoreMatch(state: ScoreState, gapCells: number, rowsRemoved: number): ScoreState {
  const base = MATCH_BASE + GAP_POINTS * Math.max(0, gapCells);
  const earned = Math.floor((base * state.streakTenths) / 10);
  const rowBonus = rowsRemoved * ROW_POINTS + (rowsRemoved >= 2 ? MULTI_ROW_BONUS : 0);
  return {
    ...state,
    matchPoints: state.matchPoints + earned,
    rowPoints: state.rowPoints + rowBonus,
    total: state.total + earned + rowBonus,
    streakTenths: Math.min(STREAK_MAX_TENTHS, state.streakTenths + STREAK_STEP),
  };
}

/** Add Numbers resets the streak (no penalty otherwise). */
export function scoreAddNumbers(state: ScoreState): ScoreState {
  return { ...state, streakTenths: INITIAL_SCORE.streakTenths };
}

export function clearBonusBase(mode: GameMode, level: number | null): number {
  return mode === 'level' && level !== null ? 150 + 15 * level : 300;
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
