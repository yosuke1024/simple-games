/**
 * What one press on a cell means (docs/BOX_REGIONS_RULES.md §4), and what
 * the board reads aloud and shows (§5, §13).
 *
 * The two moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. The board is
 * a hand-drawn 3×3 — a 2×2 square clued at 0, a tall pair clued at 5, a wide
 * row clued at 7 — so every cell is where the test says it is.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { initialAssignment, UNASSIGNED, type BoxRegionsSession, type Hint } from '../../game';
import { BoxRegionsBoard, cellEdges } from './BoxRegionsBoard';

const _ = UNASSIGNED;
const SIZE = 3;
const LAYOUT = {
  width: SIZE,
  height: SIZE,
  clues: [
    { index: 0, size: 4, kind: 'square' as const },
    { index: 5, size: 2, kind: 'tall' as const },
    { index: 7, size: null, kind: 'free' as const },
  ],
};

const session = (assignment: readonly number[] = initialAssignment(LAYOUT)): BoxRegionsSession => ({
  mode: 'difficulty',
  seed: 'box-regions-test',
  difficulty: 'easy',
  dailyDate: null,
  ...LAYOUT,
  solution: [0, 0, 1, 0, 0, 1, 2, 2, 2],
  assignment,
  history: [],
  status: 'playing',
  elapsedSeconds: 0,
  hintCount: 0,
});

function renderBoard(
  current: BoxRegionsSession = session(),
  hint: Hint | null = null,
  solved = false,
) {
  const onDraw = vi.fn(() => true);
  const onTap = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BoxRegionsBoard
        session={current}
        hint={hint}
        onDraw={onDraw}
        onTap={onTap}
        solved={solved}
      />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Box Regions board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onDraw, onTap };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

const pointAt = (index: number) => ({
  clientX: CELL_PX * ((index % SIZE) + 0.5),
  clientY: CELL_PX * (Math.floor(index / SIZE) + 0.5),
});

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(): void {
  const cells = document.querySelector('.br-cells') as Element;
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

describe('what a cell reads aloud and shows (§5, §13)', () => {
  it('names position, box and clue — number, and kind by name', () => {
    const { cells } = renderBoard(session([0, 0, _, 0, 0, _, _, _, _]));
    expect(cells[0]).toHaveAccessibleName('Row 1, column 1, box A, 4 of 4 cells, Square');
    expect(cells[2]).toHaveAccessibleName('Row 1, column 3, unassigned');
    expect(cells[5]).toHaveAccessibleName('Row 2, column 3, unassigned, 0 of 2 cells, Tall');
    // A clue that says nothing still names its symbol.
    expect(cells[7]).toHaveAccessibleName('Row 3, column 2, unassigned, Any box');
  });

  it('always draws a badge on a clue, with the number inside it', () => {
    const { cells } = renderBoard();
    for (const index of [0, 5, 7]) expect(cells[index]!.querySelector('svg')).not.toBeNull();
    expect(cells[7]!.querySelector('svg')!.getAttribute('data-kind')).toBe('free');
    expect(cells[1]!.querySelector('svg')).toBeNull();
    // The number is part of the badge, drawn or not.
    expect(cells[0]).toHaveTextContent(/^4$/);
  });

  it('keeps the number as it is while a box is the wrong size — the warn ring says so (§5)', () => {
    const short = renderBoard(session([0, 0, _, _, _, _, _, _, _]));
    expect(short.cells[0]).toHaveTextContent(/^4$/);
    expect(short.cells[0]!.className).toContain('br-cell-warn');
    cleanup();
    const done = renderBoard(session([0, 0, _, 0, 0, _, _, _, _]));
    expect(done.cells[0]).toHaveTextContent(/^4$/);
  });

  it('says when a box breaks a rule, and marks every cell of it (§5)', () => {
    const { cells } = renderBoard(session([0, 0, _, _, _, _, _, _, _]));
    expect(cells[0]).toHaveAccessibleName(/breaks a rule$/);
    expect(cells[1]).toHaveClass('br-cell-warn');
    expect(cells[3]).not.toHaveClass('br-cell-warn');
  });

  it('draws a thick edge wherever the box changes, so tint is never alone', () => {
    const { cells } = renderBoard(session([0, 0, _, 0, 0, _, _, _, _]));
    expect(cells[1]).toHaveClass('br-edge-r');
    expect(cells[2]).toHaveClass('br-edge-l');
    expect(cells[0]).not.toHaveClass('br-edge-r');
    expect(cells[3]).toHaveClass('br-edge-b');
    expect(cells[0]).toHaveClass('br-tint-0');
    expect(cells[8]).not.toHaveClass('br-edge-b');
  });

  it('cellEdges: a side off the board is a border only when this cell is assigned', () => {
    expect(cellEdges(() => 0, 0, 0, 0, 1, 1)).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    });
    expect(cellEdges(() => UNASSIGNED, 0, 0, 0, 1, 1)).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
  });

  it('marks the hint’s cells, its reason, and a wrong box (§6)', () => {
    const step = renderBoard(session(), {
      kind: 'step',
      step: { technique: 'forced-cell', region: 0, cells: [1], reason: [0, 1, 3, 4] },
    });
    expect(step.cells[1]).toHaveClass('br-cell-hint');
    expect(step.cells[3]).toHaveClass('br-cell-reason');
    expect(step.cells[2]).not.toHaveClass('br-cell-reason');
    cleanup();
    const wrong = renderBoard(session([0, 0, _, _, _, _, _, _, _]), {
      kind: 'wrong',
      region: 0,
      cells: [0, 1],
    });
    expect(wrong.cells[0]).toHaveClass('br-cell-wrong');
    expect(wrong.cells[3]).not.toHaveClass('br-cell-wrong');
  });

  it('adds br-board-solved only when told the session is solved', () => {
    expect(renderBoard(session(), null, false).board).not.toHaveClass('br-board-solved');
    cleanup();
    expect(renderBoard(session(), null, true).board).toHaveClass('br-board-solved');
  });
});

describe('the stroke (§4)', () => {
  it('previews the rectangle while dragging, and draws it on release', () => {
    const { cells, onDraw } = renderBoard();
    giveCellsALayout();
    press(cells[4]!, 4);
    dragTo(cells[4]!, 0);
    // One clue inside: the accent ring, on the four cells of the 2×2.
    for (const index of [0, 1, 3, 4]) {
      expect(cells[index]).toHaveClass('br-cell-preview');
      expect(cells[index]).toHaveClass('br-preview-ok');
    }
    expect(cells[0]).toHaveClass('br-pv-t');
    expect(cells[0]).toHaveClass('br-pv-l');
    expect(cells[4]).toHaveClass('br-pv-b');
    expect(cells[4]).toHaveClass('br-pv-r');
    expect(cells[2]).not.toHaveClass('br-cell-preview');
    expect(onDraw).not.toHaveBeenCalled();
    release(cells[4]!, 0);
    expect(onDraw.mock.calls).toEqual([[4, 0]]);
    expect(cells[0]).not.toHaveClass('br-cell-preview');
  });

  it('warns while the rectangle holds no clue or two', () => {
    const { cells } = renderBoard();
    giveCellsALayout();
    press(cells[1]!, 1);
    dragTo(cells[1]!, 4);
    expect(cells[4]).toHaveClass('br-preview-bad');
    dragTo(cells[1]!, 8);
    expect(cells[8]).toHaveClass('br-preview-bad');
    dragTo(cells[1]!, 3);
    expect(cells[3]).toHaveClass('br-preview-ok');
  });

  it('rounds a finger off the board to the nearest cell', () => {
    const { cells, onDraw } = renderBoard();
    giveCellsALayout();
    press(cells[6]!, 6);
    fireEvent.pointerMove(cells[6]!, { pointerId: 1, clientX: 500, clientY: 500 });
    expect(cells[8]).toHaveClass('br-cell-preview');
    fireEvent.pointerUp(cells[6]!, { pointerId: 1, clientX: 500, clientY: 500 });
    expect(onDraw.mock.calls).toEqual([[6, 8]]);
  });

  it('swallows the click a drag leaves behind, and takes the next tap as a tap', () => {
    const { cells, onDraw, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[6]!;
    press(origin, 6);
    dragTo(origin, 8);
    release(origin, 8);
    // Capture retargets the click to the cell the press began on.
    fireEvent.click(origin, { detail: 1 });
    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();

    // A fresh press and its click on the same cell is a tap.
    press(origin, 6);
    release(origin, 6);
    fireEvent.click(origin, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[6]]);
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('drops the stroke when a cancel takes the finger away, and arms nothing (issue #169)', () => {
    const { cells, onDraw, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[6]!;
    press(origin, 6);
    dragTo(origin, 8);
    expect(cells[8]).toHaveClass('br-cell-preview');
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(8) });
    // The rectangle was one decision, never made: nothing drawn, no preview.
    expect(cells[8]).not.toHaveClass('br-cell-preview');
    dragTo(origin, 7);
    release(origin, 7);
    expect(onDraw).not.toHaveBeenCalled();
    // No click follows a cancel — and the next real press is not owed one.
    press(origin, 6);
    release(origin, 6);
    fireEvent.click(origin, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[6]]);
  });

  it('lets the keyboard tap a cell: an activation is never the click a drag left', () => {
    const { cells, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[6]!;
    press(origin, 6);
    dragTo(origin, 8);
    release(origin, 8);
    fireEvent.click(origin, { detail: 0 });
    expect(onTap.mock.calls).toEqual([[6]]);
  });

  it('ignores every button but the primary', () => {
    const { cells, onDraw } = renderBoard();
    giveCellsALayout();
    fireEvent.pointerDown(cells[6]!, { button: 2, pointerId: 1, ...pointAt(6) });
    dragTo(cells[6]!, 8);
    release(cells[6]!, 8);
    expect(onDraw).not.toHaveBeenCalled();
    expect(cells[8]).not.toHaveClass('br-cell-preview');
  });
});
