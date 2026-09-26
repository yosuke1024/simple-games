/**
 * What one press on a cell means (docs/CROWN_GRID_RULES.md §4), and what the
 * board does when the platform takes the finger away (issue #169).
 *
 * The two moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. That is the
 * only way to say a drag tapped *nothing*: on a real board a × that arrived
 * after a tap on the same cell would read as a crown.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, doTap, type CrownGridSession, type Hint } from '../../game';
import { CrownGridBoard } from './CrownGridBoard';

/** A fixed 6×6, the same on every machine (§8). */
const SESSION = createDifficultySession('easy', 'crown-grid-easy-board');
const SIZE = SESSION.size;

/** Row and column count from one, the way the labels do. */
const indexAt = (row: number, col: number) => (row - 1) * SIZE + (col - 1);

function renderBoard(session: CrownGridSession = SESSION, hint: Hint | null = null) {
  const onTap = vi.fn();
  const onStroke = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CrownGridBoard session={session} hint={hint} onTap={onTap} onStroke={onStroke} />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Crown Grid board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onTap, onStroke };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

const pointAt = (row: number, col: number) => ({
  clientX: CELL_PX * (col - 1 + 0.5),
  clientY: CELL_PX * (row - 1 + 0.5),
});

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(): void {
  const cells = document.querySelector('.cg-cells') as Element;
  const side = CELL_PX * SIZE;
  vi.spyOn(cells, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: side,
    height: side,
    right: side,
    bottom: side,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

const press = (cell: Element, row: number, col: number) =>
  fireEvent.pointerDown(cell, {
    button: 0,
    pointerType: 'touch',
    pointerId: 1,
    ...pointAt(row, col),
  });
/** One move of a drag, fired at the cell the press began on: capture retargets every move there. */
const dragTo = (origin: Element, row: number, col: number) =>
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(row, col) });
const release = (origin: Element, row: number, col: number) =>
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(row, col) });

/** Every cell a run of strokes wrote, in the order they were written. */
const strokeCells = (onStroke: Mock): number[] =>
  onStroke.mock.calls.flatMap((call) => call[0] as number[]);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the tap (§4)', () => {
  it('taps the cell, and nothing else', () => {
    const { cells, onTap, onStroke } = renderBoard();
    press(cells[0]!, 1, 1);
    release(cells[0]!, 1, 1);
    fireEvent.click(cells[0]!, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[0]]);
    expect(onStroke).not.toHaveBeenCalled();
  });

  it('reads position, region and mark to a screen reader, and names a broken rule', () => {
    const crowned = doTap(doTap(SESSION, indexAt(1, 1))!, indexAt(1, 1))!;
    const broken = doTap(doTap(crowned, indexAt(1, 2))!, indexAt(1, 2))!;
    const { cells } = renderBoard(broken);
    expect(cells[indexAt(1, 1)]!.getAttribute('aria-label')).toMatch(
      /^Crown, row 1, column 1, region \d, breaks a rule$/,
    );
    expect(cells[indexAt(1, 3)]!.getAttribute('aria-label')).toMatch(
      /^Empty, row 1, column 3, region \d$/,
    );
  });

  it('draws a thick edge wherever the neighbouring cell is another region (§13)', () => {
    const { cells } = renderBoard();
    const walls = cells.filter(
      (cell) => cell.classList.contains('cg-wall-t') || cell.classList.contains('cg-wall-l'),
    );
    expect(walls.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('data-region')).toMatch(/^[0-5]$/);
  });
});

describe('the drag (§4)', () => {
  it('writes × across the run, origin included, and spends the click it leaves behind', () => {
    const { cells, onTap, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(2, 1)]!;
    press(origin, 2, 1);
    dragTo(origin, 2, 2);
    dragTo(origin, 2, 4);
    release(origin, 2, 4);
    // The click the release leaves behind lands on the origin, by capture.
    fireEvent.click(origin, { detail: 1 });

    expect(strokeCells(onStroke)).toEqual([
      indexAt(2, 1),
      indexAt(2, 2),
      indexAt(2, 3),
      indexAt(2, 4),
    ]);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not write a cell twice when the finger doubles back', () => {
    const { cells, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(3, 3)]!;
    press(origin, 3, 3);
    dragTo(origin, 3, 4);
    dragTo(origin, 3, 3);
    dragTo(origin, 3, 2);
    release(origin, 3, 2);

    expect(strokeCells(onStroke)).toEqual([indexAt(3, 3), indexAt(3, 4), indexAt(3, 2)]);
  });

  it('ends where the platform cancels it, keeps what it wrote, and arms nothing (issue #169)', () => {
    const { cells, onTap, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(4, 1)]!;
    press(origin, 4, 1);
    dragTo(origin, 4, 2);
    expect(strokeCells(onStroke)).toEqual([indexAt(4, 1), indexAt(4, 2)]);

    // The shade comes down: no release follows, and no click either.
    fireEvent.pointerCancel(origin, { pointerId: 1 });
    dragTo(origin, 4, 4);
    expect(strokeCells(onStroke)).toEqual([indexAt(4, 1), indexAt(4, 2)]);

    // The next press is a fresh tap on another cell, and it taps.
    const next = cells[indexAt(6, 6)]!;
    press(next, 6, 6);
    release(next, 6, 6);
    fireEvent.click(next, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[indexAt(6, 6)]]);
  });

  it('leaves the keyboard its own turn on the cell a drag began on', () => {
    const { cells, onTap } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(5, 1)]!;
    press(origin, 5, 1);
    dragTo(origin, 5, 2);
    release(origin, 5, 2);
    // A browser gives a key press no click count at all: Enter on the
    // focused cell is not the click the drag spoke for.
    fireEvent.click(origin, { detail: 0 });
    expect(onTap.mock.calls).toEqual([[indexAt(5, 1)]]);
  });

  it('ignores a second finger and buttons other than the first', () => {
    const { cells, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(1, 1)]!;
    fireEvent.pointerDown(origin, {
      button: 2,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 1),
    });
    dragTo(origin, 1, 3);
    expect(onStroke).not.toHaveBeenCalled();

    press(origin, 1, 1);
    fireEvent.pointerMove(origin, { pointerId: 2, ...pointAt(1, 3) });
    expect(onStroke).not.toHaveBeenCalled();
  });
});

describe('the hint on the board (§6)', () => {
  it('marks the cells a step settles and the houses it was read off', () => {
    const hint: Hint = {
      kind: 'step',
      step: {
        kind: 'eliminate',
        cells: [indexAt(1, 3)],
        technique: 'attack',
        houses: [{ kind: 'row', index: 5 }],
        support: [indexAt(6, 2)],
      },
    };
    const { cells } = renderBoard(SESSION, hint);
    expect(cells[indexAt(1, 3)]!.classList.contains('cg-cell-hint')).toBe(true);
    expect(cells[indexAt(6, 1)]!.classList.contains('cg-cell-reason')).toBe(true);
    expect(cells[indexAt(6, 2)]!.classList.contains('cg-cell-support')).toBe(true);
    expect(cells[indexAt(2, 2)]!.classList.contains('cg-cell-reason')).toBe(false);
  });

  it('rings a crown that cannot be right', () => {
    const { cells } = renderBoard(SESSION, { kind: 'wrong', index: indexAt(2, 2) });
    expect(cells[indexAt(2, 2)]!.classList.contains('cg-cell-hint-broken')).toBe(true);
  });
});
