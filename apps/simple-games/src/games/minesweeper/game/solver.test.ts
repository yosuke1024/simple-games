/**
 * The two inference rules of docs/MINESWEEPER_RULES.md §5, one hand-built
 * position each, plus the position they cannot touch.
 *
 * Each fixture is drawn as a mine map and an open map, so the numbers the
 * solver reads are derived rather than typed — a fixture whose numbers
 * contradicted its mines would test nothing.
 */
import { describe, expect, it } from 'vitest';
import { fieldFromMines, openRegion, safeCellCount, type MineField } from './board';
import { generateField } from './generator';
import { findSafeCell, solveFrom, type SolverView } from './solver';
import { PRESETS, type Difficulty } from './types';

/**
 * `mineRows` uses '*' for a mine and '.' for anything else; `openRows` uses
 * 'o' for an open cell and '.' for one the player has not opened.
 */
function fixture(mineRows: readonly string[], openRows: readonly string[]) {
  const height = mineRows.length;
  const width = mineRows[0]!.length;
  const mines: boolean[] = [];
  const open: boolean[] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      mines.push(mineRows[row]![col] === '*');
      open.push(openRows[row]![col] === 'o');
    }
  }
  const field = fieldFromMines(width, height, mines);
  const view: SolverView = {
    width,
    height,
    numbers: open.map((isOpen, index) => (isOpen ? field.counts[index]! : null)),
  };
  return { field, view, at: (row: number, col: number) => row * width + col };
}

describe('counting rule (§5)', () => {
  /**
   * One mine in the corner, with the two ends of the top row still shut.
   *
   *   . o .          mines:  * . .
   *   o o o                  . . .
   *   o o o                  . . .
   *
   * The 1 at (1,0) touches exactly one unopened cell, so that cell must be the
   * mine; the 1 at (1,1) is then fully accounted for and its other unopened
   * neighbour must be safe. Both steps are the counting rule — no two number
   * cells are ever compared — and the subset rule has nothing to do here.
   */
  const position = fixture(['*..', '...', '...'], ['.o.', 'ooo', 'ooo']);

  it('names the safe cell and the number that proves it', () => {
    const safe = findSafeCell(position.view);
    expect(safe).not.toBeNull();
    expect(safe!.rule).toBe('counting');
    expect(safe!.index).toBe(position.at(0, 2));
    expect(safe!.reason).toEqual([position.at(1, 1)]);
  });

  it('never points at the mine it had to find on the way', () => {
    const safe = findSafeCell(position.view);
    expect(position.field.mines[safe!.index]).toBe(false);
  });
});

describe('subset rule (§5)', () => {
  /**
   * A 1 and a 1 sharing a wall — the pattern the subset rule exists for.
   *
   *   o o o o        mines:  . . . .
   *   . . . .                . * . *
   *
   * Counting is stuck everywhere: the 1 at (0,0) sees two unopened cells, the
   * 1 at (0,1) sees three, the 2 at (0,2) sees three, the 1 at (0,3) sees two.
   * No number equals its unopened count and none is satisfied yet.
   *
   * The subset rule reads them against each other: (0,0)'s unopened cells all
   * sit inside (0,1)'s, both still need exactly one mine, so the cell (0,1) has
   * and (0,0) does not — (1,2) — holds no mine.
   */
  const position = fixture(['....', '.*.*'], ['oooo', '....']);

  it('proves a safe cell from a pair of numbers, and cites both', () => {
    const safe = findSafeCell(position.view);
    expect(safe).not.toBeNull();
    // 'subset' at all means the counting scan found nothing first: it runs
    // before this one and would have returned its own answer.
    expect(safe!.rule).toBe('subset');
    expect(safe!.index).toBe(position.at(1, 2));
    expect(safe!.reason).toEqual([position.at(0, 0), position.at(0, 1)]);
    expect(position.field.mines[safe!.index]).toBe(false);
  });
});

describe('a position that needs a guess (§4)', () => {
  /**
   * The classic coin flip.
   *
   *   o o          mines:  . .
   *   . .                  * .
   *
   * Both 1s see both unopened cells and both still need one mine. Counting
   * cannot split them, and the subset rule needs a strict superset — the two
   * sets are identical. Nothing is provable, so the solver says so instead of
   * guessing, and the generator throws a layout like this away (§5).
   */
  const position = fixture(['..', '*.'], ['oo', '..']);

  it('returns nothing rather than a coin flip', () => {
    expect(findSafeCell(position.view)).toBeNull();
  });

  it('reports the board as unfinished, with the cells it could not settle', () => {
    const outcome = solveFrom(position.field, position.at(0, 0));
    expect(outcome.solved).toBe(false);
    expect(outcome.remaining).toBeGreaterThan(0);
  });
});

describe('solveFrom on real boards', () => {
  const difficulties: readonly Difficulty[] = ['easy', 'medium', 'hard'];

  it.each(difficulties)('finishes every %s board it accepted', (difficulty: Difficulty) => {
    const preset = PRESETS[difficulty];
    const cells = preset.width * preset.height;
    for (let i = 0; i < 6; i++) {
      const first = (i * 37) % cells;
      const { field } = generateField(`solver-${difficulty}-${i}`, difficulty, first);
      const outcome = solveFrom(field, first);
      expect(outcome.solved, `${difficulty} ${i}`).toBe(true);
      expect(outcome.remaining).toBe(0);
    }
  });

  /**
   * Soundness, checked against the truth rather than against itself: replaying
   * a whole board one hint at a time must never name a cell that holds a mine,
   * and must never run out of things to prove. A solver that cheated would win
   * this test by opening a mine — so the mine map is what it is measured on.
   */
  it.each(difficulties)(
    'never calls a mine safe while replaying a %s board',
    (difficulty: Difficulty) => {
      const preset = PRESETS[difficulty];
      const cells = preset.width * preset.height;
      for (let i = 0; i < 3; i++) {
        const first = (i * 53) % cells;
        const { field } = generateField(`sound-${difficulty}-${i}`, difficulty, first);
        const opened = new Array<boolean>(cells).fill(false);
        let open = openRegion(field, first, opened);
        const target = safeCellCount(field);
        let guard = 0;
        while (open < target && guard++ <= cells) {
          const view = viewOf(field, opened);
          const safe = findSafeCell(view);
          expect(safe, `${difficulty} ${i} stalled at ${open}/${target}`).not.toBeNull();
          expect(field.mines[safe!.index], `${difficulty} ${i} called a mine safe`).toBe(false);
          expect(opened[safe!.index]).toBe(false);
          // Every reason a hint gives must be something the player can see.
          for (const reason of safe!.reason) expect(opened[reason]).toBe(true);
          open += openRegion(field, safe!.index, opened);
        }
        expect(open, `${difficulty} ${i}`).toBe(target);
      }
    },
  );
});

function viewOf(field: MineField, opened: readonly boolean[]): SolverView {
  return {
    width: field.width,
    height: field.height,
    numbers: opened.map((isOpen, index) => (isOpen ? field.counts[index]! : null)),
  };
}
