/**
 * What one press on a cell means (docs/NONOGRAM_RULES.md §3).
 *
 * The three moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. That is the only
 * way to say a right click paints *nothing*: on a real board a cross that
 * arrived after a paint looks exactly like a cross that arrived alone.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createLevelSession } from '../../game';
import { LONG_PRESS_MS, NonoBoard } from './NonoBoard';

/** Level 1 is a blank 5×5, and the same one on every machine (§6). */
const SIZE = 5;
const SESSION = createLevelSession(1);

/** Row and column count from one, the way the labels do. */
const indexAt = (row: number, col: number) => (row - 1) * SIZE + (col - 1);

function renderBoard(xMode = false) {
  const onPaint = vi.fn();
  const onCross = vi.fn();
  const onStroke = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NonoBoard
        session={SESSION}
        hint={null}
        xMode={xMode}
        onPaint={onPaint}
        onCross={onCross}
        onStroke={onStroke}
      />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Nonogram board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onPaint, onCross, onStroke };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

const pointAt = (row: number, col: number) => ({
  clientX: CELL_PX * (col - 1 + 0.5),
  clientY: CELL_PX * (row - 1 + 0.5),
});

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(): void {
  const cells = document.querySelector('.nono-cells') as Element;
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

/**
 * Raises the context menu and insists it was cancelled. A cancelled contextmenu
 * is the whole of "no browser menu over the board" (§3): fireEvent hands back
 * what dispatchEvent returned, which is false exactly when something called
 * preventDefault on it.
 */
function contextMenu(target: Element, init: Record<string, unknown>) {
  expect(fireEvent.contextMenu(target, init)).toBe(false);
}

/** A right click as a browser delivers it. No click event ever follows one. */
function rightClick(cell: Element) {
  fireEvent.pointerDown(cell, { button: 2, pointerType: 'mouse' });
  contextMenu(cell, { button: 2 });
  fireEvent.pointerUp(cell, { button: 2, pointerType: 'mouse' });
}

/** macOS ctrl+click: the primary button raises the menu, and a click follows. */
function ctrlClick(cell: Element) {
  fireEvent.pointerDown(cell, { button: 0, pointerType: 'mouse', ctrlKey: true });
  contextMenu(cell, { button: 0, ctrlKey: true });
  fireEvent.pointerUp(cell, { button: 0, pointerType: 'mouse', ctrlKey: true });
  fireEvent.click(cell, { button: 0, ctrlKey: true, detail: 1 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the tap and the long press (§3)', () => {
  it('paints on a tap and crosses on a long press, and swaps them in X mode', () => {
    const plain = renderBoard();
    fireEvent.click(plain.cells[0]!, { detail: 1 });
    expect(plain.onPaint.mock.calls).toEqual([[0]]);
    expect(plain.onCross).not.toHaveBeenCalled();
    cleanup();

    const crossing = renderBoard(true);
    fireEvent.click(crossing.cells[0]!, { detail: 1 });
    expect(crossing.onCross.mock.calls).toEqual([[0]]);
    expect(crossing.onPaint).not.toHaveBeenCalled();
  });

  it('keeps the click a long press leaves behind from painting over it', () => {
    const { cells, onPaint, onCross } = renderBoard();

    vi.useFakeTimers();
    try {
      // A press held past the timer crosses, and the finger then lifts: the
      // click that release leaves behind is about the same cell, and acting on
      // it would paint straight over the cross the player just watched appear.
      fireEvent.pointerDown(cells[5]!, { button: 0, pointerType: 'touch', pointerId: 1 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      fireEvent.pointerUp(cells[5]!, { button: 0, pointerType: 'touch', pointerId: 1 });
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(cells[5]!, { detail: 1 });

    expect(onCross.mock.calls).toEqual([[5]]);
    expect(onPaint).not.toHaveBeenCalled();
  });
});

describe('the right button (§3, issue #112)', () => {
  it('crosses the cell, and neither paints it nor draws from it', () => {
    const { cells, onPaint, onCross, onStroke } = renderBoard();

    rightClick(cells[indexAt(1, 2)]!);
    // Which way round the cross goes is the game's to decide, not the board's.
    expect(onCross.mock.calls).toEqual([[indexAt(1, 2)]]);
    expect(onPaint).not.toHaveBeenCalled();
    expect(onStroke).not.toHaveBeenCalled();
  });

  it('crosses in X mode too: the button means one thing (§3)', () => {
    const { cells, onPaint, onCross } = renderBoard(true);

    // X mode swaps what the tap and the long press do; the right button does
    // not follow it there, or a right click would mean two different things.
    rightClick(cells[indexAt(2, 3)]!);
    expect(onCross.mock.calls).toEqual([[indexAt(2, 3)]]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('acts once when the button is held down past the long press (§3)', () => {
    const { cells, onPaint, onCross } = renderBoard();

    vi.useFakeTimers();
    try {
      // Windows raises the menu only once the button comes back up. A long
      // press armed on the way down would cross on its own timer and the menu
      // would take the cross straight back off — so none is armed.
      fireEvent.pointerDown(cells[4]!, { button: 2, pointerType: 'mouse' });
      vi.advanceTimersByTime(LONG_PRESS_MS + 20);
      expect(onCross).not.toHaveBeenCalled();
      fireEvent.pointerUp(cells[4]!, { button: 2, pointerType: 'mouse' });
      contextMenu(cells[4]!, { button: 2 });
    } finally {
      vi.useRealTimers();
    }

    expect(onCross.mock.calls).toEqual([[4]]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('acts once when a click follows the menu (macOS ctrl+click)', () => {
    const { cells, onPaint, onCross } = renderBoard();

    ctrlClick(cells[6]!);
    expect(onCross.mock.calls).toEqual([[6]]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('holds the long press it interrupted, even held past its timer', () => {
    const { cells, onPaint, onCross } = renderBoard();

    vi.useFakeTimers();
    try {
      // macOS raises the menu from the primary button, which has armed a long
      // press: a hand that keeps holding must not cross a second time.
      fireEvent.pointerDown(cells[8]!, { button: 0, pointerType: 'mouse', ctrlKey: true });
      contextMenu(cells[8]!, { button: 0, ctrlKey: true });
      vi.advanceTimersByTime(LONG_PRESS_MS + 20);
      fireEvent.pointerUp(cells[8]!, { button: 0, pointerType: 'mouse', ctrlKey: true });
      fireEvent.click(cells[8]!, { button: 0, ctrlKey: true, detail: 1 });
    } finally {
      vi.useRealTimers();
    }

    expect(onCross.mock.calls).toEqual([[8]]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('starts no stroke, where the same drag on the left button draws one', () => {
    const held = renderBoard();
    giveCellsALayout();

    const origin = held.cells[indexAt(1, 1)]!;
    fireEvent.pointerDown(origin, {
      button: 2,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 1),
    });
    contextMenu(origin, { button: 2 });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(1, 2) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(1, 3) });
    fireEvent.pointerUp(origin, {
      button: 2,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 3),
    });

    expect(held.onCross.mock.calls).toEqual([[indexAt(1, 1)]]);
    expect(held.onStroke).not.toHaveBeenCalled();
    cleanup();

    // The same path under the primary button, so the rig is known to be able
    // to raise a stroke at all (issue #108).
    const drawn = renderBoard();
    giveCellsALayout();
    const left = drawn.cells[indexAt(1, 1)]!;
    fireEvent.pointerDown(left, {
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(1, 1),
    });
    fireEvent.pointerMove(left, { pointerId: 1, ...pointAt(1, 2) });
    fireEvent.pointerUp(left, { button: 0, pointerType: 'mouse', pointerId: 1, ...pointAt(1, 2) });
    expect(drawn.onStroke).toHaveBeenCalled();
  });

  it('drops the stroke the menu interrupted (macOS ctrl+drag)', () => {
    const { cells, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // The primary button did arm a stroke on the way down, so the menu has to
    // drop it: a hand that moves before letting go must not paint over the
    // cross it just asked for.
    const origin = cells[indexAt(3, 1)]!;
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerType: 'mouse',
      ctrlKey: true,
      pointerId: 1,
      ...pointAt(3, 1),
    });
    contextMenu(origin, { button: 0, ctrlKey: true });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(3, 2) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(3, 3) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(3, 3) });

    expect(onCross.mock.calls).toEqual([[indexAt(3, 1)]]);
    expect(onStroke).not.toHaveBeenCalled();
  });

  it('crosses without painting when the right button joins a stroke in progress', () => {
    const { cells, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // A second button pressed while the first is down is a chorded press: the
    // browser sends a pointermove carrying the new buttons, never a second
    // pointerdown. So the stroke is live when the menu arrives, and only the
    // menu's own handler can end it.
    const origin = cells[indexAt(4, 1)]!;
    fireEvent.pointerDown(origin, {
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(4, 1),
    });
    fireEvent.pointerMove(origin, { button: 2, buttons: 3, pointerId: 1, ...pointAt(4, 1) });
    contextMenu(origin, { button: 2 });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(4, 2) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(4, 2) });
    fireEvent.click(origin, { detail: 1 });

    expect(onCross.mock.calls).toEqual([[indexAt(4, 1)]]);
    expect(onStroke).not.toHaveBeenCalled();
  });

  it('leaves the cross a touch long press just made (§3)', () => {
    const { cells, onCross, onPaint } = renderBoard();

    vi.useFakeTimers();
    try {
      // Chrome on Android raises a context menu of its own at the end of a
      // long press, later than the 450ms that crossed the cell. Crossing there
      // as well would take the cross straight back off, on every long press a
      // touch player makes.
      fireEvent.pointerDown(cells[2]!, { button: 0, pointerType: 'touch', pointerId: 1 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onCross.mock.calls).toEqual([[2]]);

      contextMenu(cells[2]!, { button: 0 });
      fireEvent.pointerUp(cells[2]!, { button: 0, pointerType: 'touch', pointerId: 1 });
    } finally {
      vi.useRealTimers();
    }

    expect(onCross.mock.calls).toEqual([[2]]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('leaves a pen long press alone the same way', () => {
    const { cells, onCross } = renderBoard();

    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(cells[3]!, { button: 0, pointerType: 'pen', pointerId: 1 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      contextMenu(cells[3]!, { button: 0 });
    } finally {
      vi.useRealTimers();
    }

    expect(onCross.mock.calls).toEqual([[3]]);
  });

  it('takes the mouse back after a finger has used the board', () => {
    const { cells, onCross } = renderBoard();

    // A touch-screen laptop: a tap, then the mouse. Remembering "touch" past
    // the press it belonged to would leave the right button dead.
    fireEvent.pointerDown(cells[0]!, { button: 0, pointerType: 'touch', pointerId: 1 });
    fireEvent.pointerUp(cells[0]!, { button: 0, pointerType: 'touch', pointerId: 1 });
    fireEvent.click(cells[0]!, { detail: 1 });

    rightClick(cells[1]!);
    expect(onCross.mock.calls).toEqual([[1]]);
  });

  it('leaves the keyboard its own turn on the cell it just crossed', () => {
    const { cells, onCross, onPaint } = renderBoard();

    rightClick(cells[9]!);
    expect(onCross.mock.calls).toEqual([[9]]);

    // A right click leaves no click behind on most platforms, so nothing comes
    // to clear what it handled. Enter on the focused cell is not that click —
    // a browser gives a key press no click count at all — and must not be
    // mistaken for it, or a keyboard player sees the cell ignore them.
    fireEvent.click(cells[9]!, { detail: 0 });
    expect(onPaint.mock.calls).toEqual([[9]]);
  });

  it('opens no browser menu over the board, cells or not (§3)', () => {
    const { board, cells, onCross } = renderBoard();

    // The gaps between the cells are a target too, and so are the clues:
    // crossing fast with the right button, a click that misses a cell by a
    // pixel would otherwise open the native menu over the board.
    contextMenu(board, { button: 2 });
    contextMenu(document.querySelector('.nono-cells') as Element, { button: 2 });
    expect(onCross).not.toHaveBeenCalled();

    contextMenu(cells[0]!, { button: 2 });
    expect(onCross.mock.calls).toEqual([[0]]);
  });
});
