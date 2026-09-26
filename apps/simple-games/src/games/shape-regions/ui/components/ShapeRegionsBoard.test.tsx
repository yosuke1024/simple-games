/**
 * What one press on a cell means (docs/SHAPE_REGIONS_RULES.md §4), and what
 * the board reads aloud (§13).
 *
 * The two moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. The board is
 * a hand-drawn 3×3 — three lines of three, clued at the left — so every cell
 * is where the test says it is.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { initialAssignment, type Hint, type ShapeRegionsSession } from '../../game';
import { ShapeRegionsBoard } from './ShapeRegionsBoard';

const SIZE = 3;
const LAYOUT = {
  width: SIZE,
  height: SIZE,
  clues: [
    { index: 0, size: 3, shape: 'line' as const },
    { index: 3, size: 3, shape: 'corner' as const },
    { index: 6, size: null, shape: null },
  ],
};

const session = (
  assignment: readonly number[] = initialAssignment(LAYOUT),
): ShapeRegionsSession => ({
  mode: 'difficulty',
  seed: 'shape-regions-test',
  difficulty: 'easy',
  dailyDate: null,
  ...LAYOUT,
  solution: [0, 0, 0, 1, 1, 1, 2, 2, 2],
  assignment,
  history: [],
  status: 'playing',
  elapsedSeconds: 0,
  hintCount: 0,
});

function renderBoard(current: ShapeRegionsSession = session(), hint: Hint | null = null) {
  const onStroke = vi.fn(() => true);
  const onTap = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ShapeRegionsBoard session={current} hint={hint} onStroke={onStroke} onTap={onTap} />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Shape Regions board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onStroke, onTap };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

const pointAt = (index: number) => ({
  clientX: CELL_PX * ((index % SIZE) + 0.5),
  clientY: CELL_PX * (Math.floor(index / SIZE) + 0.5),
});

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(): void {
  const cells = document.querySelector('.sr-cells') as Element;
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

const press = (cell: Element, index: number) =>
  fireEvent.pointerDown(cell, { button: 0, pointerId: 1, pointerType: 'touch', ...pointAt(index) });
const dragTo = (origin: Element, index: number) =>
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(index) });
const release = (origin: Element, index: number) =>
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(index) });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what a cell reads aloud (§13)', () => {
  it('names position, region and clue', () => {
    const { cells } = renderBoard();
    expect(cells[0]).toHaveAccessibleName('Row 1, column 1, shape A, 1 of 3 cells, Line');
    expect(cells[1]).toHaveAccessibleName('Row 1, column 2, unassigned');
    expect(cells[3]).toHaveAccessibleName('Row 2, column 1, shape B, 1 of 3 cells, Corner');
    // A clue with neither side says only where it is and whose it is.
    expect(cells[6]).toHaveAccessibleName('Row 3, column 1, shape C');
  });

  it('shows the count against the number, and the number alone once reached', () => {
    const growing = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]));
    expect(growing.cells[0]).toHaveTextContent('2/3');
    cleanup();
    const complete = renderBoard(session([0, 0, 0, 1, -1, -1, 2, -1, -1]));
    expect(complete.cells[0]).toHaveTextContent('3');
    expect(complete.cells[0]).not.toHaveTextContent('/');
  });

  it('says when a region breaks a rule, and marks its cells (§5)', () => {
    // Four cells in a region whose number is three.
    const { cells } = renderBoard(session([0, 0, 0, 1, -1, 0, 2, -1, -1]));
    expect(cells[0]).toHaveAccessibleName(/breaks a rule$/);
    expect(cells[5]).toHaveAccessibleName(/breaks a rule$/);
    expect(cells[5]).toHaveClass('sr-cell-warn');
    expect(cells[3]).not.toHaveClass('sr-cell-warn');
  });

  it('draws a thick edge wherever the region changes, so tint is never alone', () => {
    const { cells } = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]));
    // Between A's second cell and the empty one to its right: an edge on the empty cell's left.
    expect(cells[2]).toHaveClass('sr-edge-l');
    // Between the two A cells: no edge.
    expect(cells[1]).not.toHaveClass('sr-edge-l');
    // Between A (row 1) and B (row 2): an edge on B's top.
    expect(cells[3]).toHaveClass('sr-edge-t');
    // Two empty cells side by side: nothing to separate.
    expect(cells[5]).not.toHaveClass('sr-edge-l');
    expect(cells[1]).toHaveClass('sr-tint-0');
  });

  it('marks the hint’s cells, its reason, and a wrong region (§6)', () => {
    const step = renderBoard(session(), {
      kind: 'step',
      step: { technique: 'forced-cell', region: 0, cells: [1], reason: [0, 1, 2] },
    });
    expect(step.cells[1]).toHaveClass('sr-cell-hint');
    expect(step.cells[2]).toHaveClass('sr-cell-reason');
    expect(step.cells[4]).not.toHaveClass('sr-cell-reason');
    cleanup();
    const wrong = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]), {
      kind: 'wrong',
      region: 0,
      cells: [0, 1],
    });
    expect(wrong.cells[0]).toHaveClass('sr-cell-wrong');
    expect(wrong.cells[1]).toHaveClass('sr-cell-wrong');
    expect(wrong.cells[3]).not.toHaveClass('sr-cell-wrong');
  });
});

describe('the stroke (§4)', () => {
  it('offers each cell the finger crosses to the region the press began on', () => {
    const { cells, onStroke } = renderBoard();
    giveCellsALayout();
    const origin = cells[0]!;
    press(origin, 0);
    dragTo(origin, 1);
    expect(onStroke.mock.calls).toEqual([[0, [1], false]]);
    // The step is open now, so the next move extends it rather than opening another (§6).
    dragTo(origin, 2);
    expect(onStroke.mock.calls).toEqual([
      [0, [1], false],
      [0, [2], true],
    ]);
    release(origin, 2);
  });

  it('offers the cells a flick jumped over, in order', () => {
    const { cells, onStroke } = renderBoard(session([0, 0, 0, 1, -1, -1, 2, -1, -1]));
    giveCellsALayout();
    const origin = cells[2]!;
    press(origin, 2);
    dragTo(origin, 8);
    expect(onStroke.mock.calls).toEqual([[0, [5, 8], false]]);
  });

  it('keeps the step open only once a move has written something', () => {
    const { cells, onStroke } = renderBoard();
    onStroke.mockReturnValueOnce(false);
    giveCellsALayout();
    const origin = cells[0]!;
    press(origin, 0);
    dragTo(origin, 1);
    dragTo(origin, 2);
    // The first move joined nothing, so the second is still the first write.
    expect(onStroke.mock.calls).toEqual([
      [0, [1], false],
      [0, [2], false],
    ]);
  });

  it('starts no stroke from a cell that belongs to no region', () => {
    const { cells, onStroke } = renderBoard();
    giveCellsALayout();
    const origin = cells[4]!;
    press(origin, 4);
    dragTo(origin, 5);
    release(origin, 5);
    expect(onStroke).not.toHaveBeenCalled();
  });

  it('swallows the click a drag leaves behind, and takes the next tap as a tap', () => {
    const { cells, onStroke, onTap } = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]));
    giveCellsALayout();
    const origin = cells[1]!;
    press(origin, 1);
    dragTo(origin, 2);
    release(origin, 2);
    // Capture retargets the click to the cell the press began on. Acting on
    // it would take that cell straight back out of the region it just grew.
    fireEvent.click(origin, { detail: 1 });
    expect(onStroke).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();

    // A fresh press and its click on the same cell is a tap.
    press(origin, 1);
    release(origin, 1);
    fireEvent.click(origin, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[1]]);
  });

  it('ends the stroke where a cancel takes the finger away, and arms nothing (issue #169)', () => {
    const { cells, onStroke, onTap } = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]));
    giveCellsALayout();
    const origin = cells[1]!;
    press(origin, 1);
    dragTo(origin, 2);
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(2) });
    // The platform took the pointer: later moves belong to nobody.
    dragTo(origin, 5);
    expect(onStroke).toHaveBeenCalledTimes(1);
    // No click follows a cancel — and the next real press is not owed one.
    press(origin, 1);
    release(origin, 1);
    fireEvent.click(origin, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[1]]);
  });

  it('lets the keyboard tap a cell: an activation is never the click a drag left', () => {
    const { cells, onTap } = renderBoard(session([0, 0, -1, 1, -1, -1, 2, -1, -1]));
    giveCellsALayout();
    const origin = cells[1]!;
    press(origin, 1);
    dragTo(origin, 2);
    release(origin, 2);
    // Enter on the focused cell carries no click count.
    fireEvent.click(origin, { detail: 0 });
    expect(onTap.mock.calls).toEqual([[1]]);
  });

  it('taps on a plain click, whatever the cell holds — the game decides what it means', () => {
    const { cells, onTap } = renderBoard();
    fireEvent.click(cells[0]!, { detail: 1 });
    fireEvent.click(cells[4]!, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[0], [4]]);
  });
});
