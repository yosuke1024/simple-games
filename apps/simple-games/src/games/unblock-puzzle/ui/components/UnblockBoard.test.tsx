/**
 * The board on its own (docs/UNBLOCK_PUZZLE_RULES.md §5, §14): what it says
 * about each block, and the three ways in — a drag, a tap on a block and then
 * on a cell, and the click a keyboard activation makes. The drag is driven the
 * way the platform drives it: a press, moves, then a release followed by the
 * click it leaves behind, or a cancel followed by nothing (issue #169,
 * src/test/pointerContractWiring.test.ts).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import '../../i18n';
import { decodeBoard, isSolved, slide, type Board } from '../../game';
import { UnblockBoard, destinationsOf, type BoardHint } from './UnblockBoard';

/**
 * Row 3 holds the target (columns 1–2) with two free cells to its right; a
 * vertical block stands in column 5, rows 3–4; a horizontal one lies in row 5,
 * columns 2–4.
 */
const BOARD = decodeBoard(
  ['......', '......', 'aa..b.', '....b.', '.ccc..', '......'].join(''),
) as Board;

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 50;

function Harness({
  initial,
  onSlide,
  hint = null,
}: {
  initial: Board;
  onSlide: (block: number, to: number) => void;
  hint?: BoardHint | null;
}) {
  const [board, setBoard] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <UnblockBoard
      board={board}
      solved={isSolved(board)}
      selected={selected}
      hint={hint}
      onSelect={setSelected}
      onSlide={(block, to) => {
        onSlide(block, to);
        const next = slide(board, { block, to });
        if (next === null) return false;
        setBoard(next);
        return true;
      }}
    />
  );
}

function renderBoard(options: { hint?: BoardHint | null; layout?: boolean } = {}) {
  const onSlide = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Harness initial={BOARD} onSlide={onSlide} hint={options.hint ?? null} />
    </SettingsProvider>,
  );
  const grid = view.container.querySelector('.ub-grid') as HTMLElement;
  if (options.layout !== false) {
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: CELL_PX * 6,
      height: CELL_PX * 6,
      right: CELL_PX * 6,
      bottom: CELL_PX * 6,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  }
  return { ...view, onSlide, grid };
}

const boardGroup = () => screen.getByRole('group', { name: /Board, 6 by 6/ });
const target = () => within(boardGroup()).getByRole('button', { name: /^Target block/ });
const upright = () => within(boardGroup()).getByRole('button', { name: /^Vertical block/ });
const lying = () => within(boardGroup()).getByRole('button', { name: /^Horizontal block/ });
const cell = (container: HTMLElement, index: number) =>
  container.querySelector(`[data-cell="${index}"]`) as HTMLElement;

/** The centre of a cell, in the pretend layout. */
const at = (row: number, col: number) => ({
  clientX: CELL_PX * (col + 0.5),
  clientY: CELL_PX * (row + 0.5),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what the board says (§14)', () => {
  it('names the board, where the exit is, and each block with its free cells', () => {
    renderBoard();
    expect(boardGroup()).toHaveAccessibleName(
      'Board, 6 by 6. The exit is at the right end of row 3.',
    );
    expect(target()).toHaveAccessibleName(
      'Target block, row 3, columns 1 to 2. Free cells: 0 left, 2 right.',
    );
    expect(upright()).toHaveAccessibleName(
      'Vertical block, column 5, rows 3 to 4. Free cells: 2 up, 2 down.',
    );
    expect(lying()).toHaveAccessibleName(
      'Horizontal block, row 5, columns 2 to 4. Free cells: 1 left, 2 right.',
    );
    for (const block of [target(), upright(), lying()]) {
      expect(block).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('draws no text on the board (§1)', () => {
    const { container } = renderBoard();
    expect(container.querySelector('.ub-grid')?.textContent).toBe('');
  });

  it('marks a hint on the block and draws where it goes, without moving anything (§6)', () => {
    const { container } = renderBoard({ hint: { block: 1, to: 0 } });
    expect(upright()).toHaveClass('ub-block-hint');
    const ghost = container.querySelector('.ub-ghost') as HTMLElement;
    expect(ghost.style.getPropertyValue('--ub-y')).toBe('0');
    expect(upright()).toHaveAccessibleName(/rows 3 to 4/);
  });
});

describe('tap, then tap (§5)', () => {
  it('selects a block, slides it to a tapped free cell on its lane, and lets go of it', () => {
    const { container, onSlide } = renderBoard();
    fireEvent.click(lying(), { detail: 1 });
    expect(lying()).toHaveAttribute('aria-pressed', 'true');
    // The free cells on its lane get a dot: column 1 to the left, 5 and 6 to the right.
    const dots = [...container.querySelectorAll('.ub-cell-dest')].map((el) =>
      Number((el as HTMLElement).dataset.cell),
    );
    expect(dots.sort((a, b) => a - b)).toEqual([24, 28, 29]);
    // Column 6 brings the block's right end there: it ends on columns 4–6.
    fireEvent.click(cell(container, 29), { detail: 1 });
    expect(onSlide).toHaveBeenCalledWith(2, 3);
    expect(lying()).toHaveAccessibleName(/columns 4 to 6/);
    // Still selected: the next tap can move it again.
    expect(lying()).toHaveAttribute('aria-pressed', 'true');
    // A tap on the block again lets go of it.
    fireEvent.click(lying(), { detail: 1 });
    expect(lying()).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('.ub-cell-dest')).toHaveLength(0);
  });

  it('lets go on a tap off the lane, and never slides through another block', () => {
    const { container, onSlide } = renderBoard();
    fireEvent.click(target(), { detail: 1 });
    // Column 6 of row 3 is past the upright block: not a destination.
    fireEvent.click(cell(container, 17), { detail: 1 });
    expect(onSlide).not.toHaveBeenCalled();
    expect(target()).toHaveAttribute('aria-pressed', 'false');
  });

  it('maps a cell before the block to its leading end and one after to its trailing end', () => {
    const destinations = destinationsOf(BOARD, 1);
    // Column 5, rows 1–2 above it: the top end goes there. Rows 5–6 below: the bottom end.
    expect(destinations.get(4)).toBe(0);
    expect(destinations.get(10)).toBe(1);
    expect(destinations.get(28)).toBe(3);
    expect(destinations.get(34)).toBe(4);
    // Its own cells are not destinations.
    expect(destinations.has(16)).toBe(false);
    expect(destinations.has(22)).toBe(false);
  });
});

describe('drag (§5, issue #169)', () => {
  it('follows the finger along the lane and settles on the nearest cell', () => {
    const { onSlide } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 1), clientX: 25 + 60 });
    expect(block).toHaveClass('ub-block-dragging');
    expect(block.style.getPropertyValue('--ub-dx')).toBe('60px');
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 2), clientX: 25 + 90 });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(2, 2), clientX: 25 + 90 });
    expect(onSlide).toHaveBeenCalledWith(0, 2);
    expect(target()).toHaveAccessibleName(/columns 3 to 4/);
    expect(target()).not.toHaveClass('ub-block-dragging');
  });

  it('spends the click a drag leaves behind, so a drag never also selects', () => {
    const { onSlide } = renderBoard();
    const block = lying();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'mouse', ...at(4, 2) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(4, 3) });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(4, 3) });
    fireEvent.click(block, { detail: 1 });
    expect(onSlide).toHaveBeenCalledWith(2, 2);
    expect(lying()).toHaveAttribute('aria-pressed', 'false');
    // The next real tap selects as usual.
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'mouse', ...at(4, 3) });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(4, 3) });
    fireEvent.click(block, { detail: 1 });
    expect(lying()).toHaveAttribute('aria-pressed', 'true');
  });

  it('stops at the free cells, however far the finger goes', () => {
    const { onSlide } = renderBoard();
    const block = upright();
    fireEvent.pointerDown(block, { button: 0, pointerId: 3, pointerType: 'touch', ...at(2, 4) });
    fireEvent.pointerMove(block, { pointerId: 3, clientX: 225, clientY: -400 });
    expect(block.style.getPropertyValue('--ub-dy')).toBe(`${-2 * CELL_PX}px`);
    fireEvent.pointerUp(block, { pointerId: 3, clientX: 225, clientY: -400 });
    expect(onSlide).toHaveBeenCalledWith(1, 0);
  });

  it('ignores movement across the lane, and makes no move for it', () => {
    const { onSlide } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, clientX: 25, clientY: 125 + 150 });
    fireEvent.pointerUp(block, { pointerId: 1, clientX: 25, clientY: 125 + 150 });
    fireEvent.click(block, { detail: 1 });
    expect(onSlide).not.toHaveBeenCalled();
    expect(target()).toHaveAttribute('aria-pressed', 'false');
  });

  it('treats a press that travels under 8px as a tap', () => {
    const { onSlide } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, clientX: 25 + 5, clientY: 125 + 3 });
    fireEvent.pointerUp(block, { pointerId: 1, clientX: 25 + 5, clientY: 125 + 3 });
    fireEvent.click(block, { detail: 1 });
    expect(onSlide).not.toHaveBeenCalled();
    expect(target()).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts the block back on pointercancel, records nothing, and leaves nothing armed', () => {
    const { onSlide } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 2) });
    expect(block.style.getPropertyValue('--ub-dx')).toBe(`${2 * CELL_PX}px`);
    fireEvent.pointerCancel(block, { pointerId: 1 });
    expect(onSlide).not.toHaveBeenCalled();
    expect(block.style.getPropertyValue('--ub-dx')).toBe('0px');
    expect(block).not.toHaveClass('ub-block-dragging');
    // A release arriving late for that pointer does nothing.
    fireEvent.pointerUp(block, { pointerId: 1, ...at(2, 2) });
    expect(onSlide).not.toHaveBeenCalled();
    // And the next tap is a tap — the cancel did not leave a guard to eat it.
    fireEvent.pointerDown(block, { button: 0, pointerId: 2, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerUp(block, { pointerId: 2, ...at(2, 0) });
    fireEvent.click(block, { detail: 1 });
    expect(target()).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets a second finger do nothing while the first one drags', () => {
    const { onSlide } = renderBoard();
    const first = target();
    const second = lying();
    fireEvent.pointerDown(first, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerDown(second, {
      button: 0,
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
      ...at(4, 2),
    });
    fireEvent.pointerMove(second, { pointerId: 2, ...at(4, 4) });
    fireEvent.pointerUp(second, { pointerId: 2, ...at(4, 4) });
    expect(onSlide).not.toHaveBeenCalled();
    fireEvent.pointerMove(first, { pointerId: 1, ...at(2, 1) });
    fireEvent.pointerUp(first, { pointerId: 1, ...at(2, 1) });
    expect(onSlide).toHaveBeenCalledTimes(1);
    expect(onSlide).toHaveBeenCalledWith(0, 1);
  });

  it('never swallows a keyboard activation, even right after a drag', () => {
    renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 1) });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(2, 1) });
    // Enter / Space on a focused button: a click with no press behind it.
    fireEvent.click(target(), { detail: 0 });
    expect(target()).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not drag without a layout to measure against, and the press stays a tap', () => {
    const { onSlide } = renderBoard({ layout: false });
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 2) });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(2, 2) });
    expect(onSlide).not.toHaveBeenCalled();
  });

  it('ignores every button but the primary one', () => {
    const { onSlide } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 2, pointerId: 1, pointerType: 'mouse', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 2) });
    fireEvent.pointerUp(block, { pointerId: 1, ...at(2, 2) });
    expect(onSlide).not.toHaveBeenCalled();
  });

  it('leaves nothing behind when it is unmounted mid-drag', () => {
    const { onSlide, unmount } = renderBoard();
    const block = target();
    fireEvent.pointerDown(block, { button: 0, pointerId: 1, pointerType: 'touch', ...at(2, 0) });
    fireEvent.pointerMove(block, { pointerId: 1, ...at(2, 2) });
    unmount();
    // A release after the board is gone reaches nothing and moves nothing.
    fireEvent.pointerUp(document.body, { pointerId: 1, ...at(2, 2) });
    expect(onSlide).not.toHaveBeenCalled();
    // A fresh board starts from the dealt positions, with no drag drawn.
    renderBoard();
    expect(target()).toHaveAccessibleName(/columns 1 to 2/);
    expect(target().style.getPropertyValue('--ub-dx')).toBe('0px');
  });
});
