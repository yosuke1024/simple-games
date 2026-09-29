/**
 * The unit generation is budgeted in (docs/SUDOKU_6X6_RULES.md §7「予算は仕事量で
 * 門にする」): units the grader scanned plus placements the backtracking search
 * tried. A stopwatch measures that work times whatever else the machine
 * happened to be doing; this counts the work itself, so a seed always costs
 * the same number on any machine, and `guarantee.test.ts` can assert it.
 *
 * Nothing at runtime reads it; it costs one integer addition per unit or
 * placement.
 */
let work = 0;

export const solverWork = {
  read: (): number => work,
  reset: (): void => {
    work = 0;
  },
  add: (amount: number): void => {
    work += amount;
  },
};
