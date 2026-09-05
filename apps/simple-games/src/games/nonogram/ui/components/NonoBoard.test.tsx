/**
 * What one press on a cell means (docs/NONOGRAM_RULES.md §3).
 *
 * The three moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. That is the only
 * way to say a right click paints *nothing*: on a real board a cross that
 * arrived after a paint looks exactly like a cross that arrived alone.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  createLevelSession,
  crossCell,
  CROSSED,
  FILLED,
  paintCell,
  UNKNOWN,
  type Mark,
  type NonogramSession,
} from '../../game';
import { LONG_PRESS_MS, NonoBoard } from './NonoBoard';

/** Level 1 is a blank 5×5, and the same one on every machine (§6). */
const SIZE = 5;
const SESSION = createLevelSession(1);

/** Row and column count from one, the way the labels do. */
const indexAt = (row: number, col: number) => (row - 1) * SIZE + (col - 1);

function renderBoard(xMode = false, session: NonogramSession = SESSION) {
  const onPaint = vi.fn();
  const onCross = vi.fn();
  const onStroke = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NonoBoard
        session={session}
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
  fireEvent.pointerDown(cell, { button: 2, buttons: 2, pointerType: 'mouse' });
  contextMenu(cell, { button: 2 });
  fireEvent.pointerUp(cell, { button: 2, pointerType: 'mouse' });
}

/** macOS ctrl+click: the primary button raises the menu, and a click follows. */
function ctrlClick(cell: Element) {
  fireEvent.pointerDown(cell, { button: 0, buttons: 1, pointerType: 'mouse', ctrlKey: true });
  contextMenu(cell, { button: 0, ctrlKey: true });
  fireEvent.pointerUp(cell, { button: 0, pointerType: 'mouse', ctrlKey: true });
  fireEvent.click(cell, { button: 0, ctrlKey: true, detail: 1 });
}

/**
 * The press a right drag begins with. Where the menu goes is left to the
 * caller: the browsers disagree on when it belongs to this press, and that
 * disagreement is half of what the right drag has to answer for (§3).
 */
function rightPress(cell: Element, row: number, col: number, init: Record<string, unknown> = {}) {
  fireEvent.pointerDown(cell, {
    button: 2,
    buttons: 2,
    pointerType: 'mouse',
    pointerId: 1,
    ...pointAt(row, col),
    ...init,
  });
}

/**
 * One move of a drag, fired at the cell the press began on: pointer capture
 * retargets every move there, and they reach the grid by bubbling.
 */
function dragTo(origin: Element, row: number, col: number, init: Record<string, unknown> = {}) {
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(row, col), ...init });
}

/** The release, wherever the drag ran out. */
function release(origin: Element, row: number, col: number, init: Record<string, unknown> = {}) {
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(row, col), ...init });
}

/** Every cell a run of strokes wrote, in the order they were written. */
const strokeCells = (onStroke: Mock): number[] =>
  onStroke.mock.calls.flatMap((call) => call[0] as number[]);

/** The mark each of those strokes carried. One stroke should give one answer. */
const strokeMarks = (onStroke: Mock): Mark[] => onStroke.mock.calls.map((call) => call[1] as Mark);

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
      fireEvent.pointerDown(cells[4]!, { button: 2, buttons: 2, pointerType: 'mouse' });
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
    const { cells, onPaint, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // A second button pressed while the first is down is a chorded press: the
    // browser sends a pointermove carrying the new buttons, never a second
    // pointerdown. The left stroke is already drawing when it arrives — the
    // move to the second cell below is what starts it — so the menu that
    // follows is the only thing that can end it.
    const origin = cells[indexAt(4, 1)]!;
    fireEvent.pointerDown(origin, {
      button: 0,
      buttons: 1,
      pointerType: 'mouse',
      pointerId: 1,
      ...pointAt(4, 1),
    });
    dragTo(origin, 4, 2);
    expect(strokeCells(onStroke)).toEqual([indexAt(4, 1), indexAt(4, 2)]);

    dragTo(origin, 4, 3, { button: 2, buttons: 3 });
    contextMenu(origin, { button: 2 });
    // The stroke is gone: what the hand does next writes nothing, and no
    // second stroke starts under the button that joined.
    dragTo(origin, 4, 4);
    release(origin, 4, 4);
    fireEvent.click(origin, { detail: 1 });

    // The chorded move carried on painting — a button added mid-stroke changes
    // neither the run nor what it writes (§3) — and the menu crossed the cell
    // the press began on, once.
    expect(strokeCells(onStroke)).toEqual([indexAt(4, 1), indexAt(4, 2), indexAt(4, 3)]);
    expect(strokeMarks(onStroke)).toEqual([FILLED, FILLED]);
    expect(onCross.mock.calls).toEqual([[indexAt(4, 1)]]);
    expect(onPaint).not.toHaveBeenCalled();
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
    const { cells, onCross, onPaint } = renderBoard();

    vi.useFakeTimers();
    try {
      // The tip alone: the contact is the only button down (`buttons` 1), so
      // this is the primary press, not the barrel, and the menu it raises at
      // the end belongs to the long press that has crossed already.
      fireEvent.pointerDown(cells[3]!, { button: 0, buttons: 1, pointerType: 'pen', pointerId: 1 });
      vi.advanceTimersByTime(LONG_PRESS_MS);
      contextMenu(cells[3]!, { button: 0 });
    } finally {
      vi.useRealTimers();
    }

    expect(onCross.mock.calls).toEqual([[3]]);
    expect(onPaint).not.toHaveBeenCalled();
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

/**
 * The right button held and moved (§3, issue #130). It crosses the whole run,
 * and the awkward part is not the run but the context menu: macOS raises it on
 * the way down, before anyone can know a stroke is coming, and Windows only
 * once the button is back up, when the stroke is already over. Both orders have
 * to leave the same crosses behind.
 */
describe('the right drag (§3, issue #130)', () => {
  it('crosses every cell of the run, and paints none of them (Windows order)', () => {
    const { cells, onPaint, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    dragTo(origin, 2, 3);
    release(origin, 2, 3);

    // The cell the press began on joins the run as soon as the second one is
    // reached, so the three read as one continuous stretch.
    expect(strokeCells(onStroke)).toEqual([indexAt(2, 1), indexAt(2, 2), indexAt(2, 3)]);
    expect(strokeMarks(onStroke)).toEqual([CROSSED, CROSSED]);
    expect(onPaint).not.toHaveBeenCalled();
    // The menu, and with it the single cross of #112, is still to come here.
    expect(onCross).not.toHaveBeenCalled();
  });

  it('leaves the same run behind when the menu comes first (macOS order)', () => {
    const { cells, onPaint, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    // Raised before the hand has said whether it meant one cross or a run, so
    // it crosses the cell it landed on, the way a lone right click does.
    contextMenu(origin, { button: 2 });
    dragTo(origin, 2, 2);
    dragTo(origin, 2, 3);
    release(origin, 2, 3);

    expect(onCross.mock.calls).toEqual([[indexAt(2, 1)]]);
    // The stroke writes that same cell again, and to the same thing: the menu
    // crossed it and the stroke crosses it, so the two orders agree on the run.
    expect(strokeCells(onStroke)).toEqual([indexAt(2, 1), indexAt(2, 2), indexAt(2, 3)]);
    expect(strokeMarks(onStroke)).toEqual([CROSSED, CROSSED]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('takes crosses back off when it starts on one', () => {
    const start = indexAt(3, 1);
    const { cells, onPaint, onStroke } = renderBoard(false, crossCell(SESSION, start)!);
    giveCellsALayout();

    // The same rule the left button's stroke follows: the cell it began on
    // decides, once, and every cell of the run is set to that answer (§3).
    const origin = cells[start]!;
    rightPress(origin, 3, 1);
    dragTo(origin, 3, 2);
    release(origin, 3, 2);

    expect(strokeCells(onStroke)).toEqual([start, indexAt(3, 2)]);
    expect(strokeMarks(onStroke)).toEqual([UNKNOWN]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('crosses when it starts on a painted cell', () => {
    const start = indexAt(3, 1);
    const { cells, onPaint, onStroke } = renderBoard(false, paintCell(SESSION, start)!);
    giveCellsALayout();

    // Paint is not a cross, so a right drag from it asks for one — the newest
    // intent wins, and the run overwrites what was there.
    const origin = cells[start]!;
    rightPress(origin, 3, 1);
    dragTo(origin, 3, 2);
    release(origin, 3, 2);

    expect(strokeMarks(onStroke)).toEqual([CROSSED]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('does not toggle inside one stroke, however it doubles back', () => {
    const { cells, onStroke } = renderBoard();
    giveCellsALayout();

    // Out along the row and back over its own path. A hand that overshoots and
    // corrects itself must not unpick what it has just drawn.
    const origin = cells[indexAt(1, 1)]!;
    rightPress(origin, 1, 1);
    dragTo(origin, 1, 2);
    dragTo(origin, 1, 3);
    dragTo(origin, 1, 2);
    dragTo(origin, 1, 1);
    release(origin, 1, 1);

    expect(strokeCells(onStroke)).toEqual([indexAt(1, 1), indexAt(1, 2), indexAt(1, 3)]);
    expect(strokeMarks(onStroke).every((mark) => mark === CROSSED)).toBe(true);
  });

  it('still crosses in X mode: the button means one thing (§3)', () => {
    const { cells, onPaint, onStroke } = renderBoard(true);
    giveCellsALayout();

    // X mode swaps what the tap and the long press do. The right button does
    // not follow it there — held and moved, it is the same run either way.
    const origin = cells[indexAt(4, 1)]!;
    rightPress(origin, 4, 1);
    dragTo(origin, 4, 2);
    release(origin, 4, 2);

    expect(strokeCells(onStroke)).toEqual([indexAt(4, 1), indexAt(4, 2)]);
    expect(strokeMarks(onStroke)).toEqual([CROSSED]);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('swallows the menu a drawn run leaves behind, rather than crossing again', () => {
    const { cells, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // Windows raises it after the release. Acting on it would cross the cell
    // the run began on a second time — taking straight back off the first × of
    // the run the player just watched appear.
    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    release(origin, 2, 2);
    contextMenu(origin, { button: 2 });

    expect(onCross).not.toHaveBeenCalled();
    expect(strokeCells(onStroke)).toEqual([indexAt(2, 1), indexAt(2, 2)]);
  });

  it('swallows that menu off the board as well', () => {
    const { cells } = renderBoard();
    giveCellsALayout();

    // A run drawn to the end of a row is let go past the last cell as often as
    // not, and the menu is then raised where the board's own handler cannot
    // reach it — over the puzzle the player is reading. The window catches it.
    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 5);
    release(origin, 2, 5);

    expect(fireEvent.contextMenu(document.body, { button: 2 })).toBe(false);
  });

  it('gives the window listener back when the board goes away', () => {
    const { cells } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    release(origin, 2, 2);
    cleanup();

    // An unmounted board owes nothing to anybody: the rest of the page keeps
    // its own menu.
    expect(fireEvent.contextMenu(document.body, { button: 2 })).toBe(true);
  });

  it('swallows only the menu it is owed, and no later one', () => {
    const { cells, onCross } = renderBoard();
    giveCellsALayout();

    // macOS order: the menu came first, so the run owes none, and the flag it
    // would have raised must not be left standing. A menu with no press behind
    // it — the keyboard's menu key on another cell — still crosses that cell.
    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    contextMenu(origin, { button: 2 });
    dragTo(origin, 2, 2);
    release(origin, 2, 2);

    contextMenu(cells[indexAt(5, 5)]!, { button: 0, buttons: 0, detail: 0 });
    expect(onCross.mock.calls).toEqual([[indexAt(2, 1)], [indexAt(5, 5)]]);
  });

  it('swallows one menu for one run, and hands the page back its own', () => {
    const { cells } = renderBoard();
    giveCellsALayout();

    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    release(origin, 2, 2);
    contextMenu(origin, { button: 2 });

    // The answer kept for that menu is spent on it. Anywhere else on the page
    // no press of ours goes down to clear it, so a run that swallowed one and
    // stayed hungry would leave the rest of the page without a menu at all.
    expect(fireEvent.contextMenu(document.body, { button: 2 })).toBe(true);
  });

  it('forgets the menu it was owed when the run is cancelled instead', () => {
    const { cells, onCross } = renderBoard();
    giveCellsALayout();

    // A pointer taken away mid-run — the browser handing the gesture to
    // something else — is never followed by the menu the run was owed. The
    // press after it has crossed nothing yet, and its menu is the only thing
    // that will: a stale answer left over from the run would eat that one.
    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(2, 2) });

    rightClick(cells[indexAt(5, 5)]!);
    expect(onCross.mock.calls).toEqual([[indexAt(5, 5)]]);
  });

  it('swallows the menu of a run drawn after an earlier right click', () => {
    const { cells, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // The menu of that first press has been and gone, and it belonged to it
    // alone. The run that follows is still owed one of its own — Windows
    // raises it on the release — and reading the earlier one as the run's
    // would take the first × of the run straight back off.
    rightClick(cells[indexAt(5, 5)]!);
    expect(onCross.mock.calls).toEqual([[indexAt(5, 5)]]);

    const origin = cells[indexAt(2, 1)]!;
    rightPress(origin, 2, 1);
    dragTo(origin, 2, 2);
    release(origin, 2, 2);
    contextMenu(origin, { button: 2 });

    expect(onCross.mock.calls).toEqual([[indexAt(5, 5)]]);
    expect(strokeCells(onStroke)).toEqual([indexAt(2, 1), indexAt(2, 2)]);
    expect(strokeMarks(onStroke)).toEqual([CROSSED]);
  });

  it("takes a pen's barrel button for the right button, however it arrives", () => {
    // Pressed while the pen hovers, the barrel is the button that changed.
    const hovering = renderBoard();
    giveCellsALayout();
    const first = hovering.cells[indexAt(1, 1)]!;
    rightPress(first, 1, 1, { button: 2, buttons: 2, pointerType: 'pen' });
    dragTo(first, 1, 2);
    release(first, 1, 2);
    expect(strokeCells(hovering.onStroke)).toEqual([indexAt(1, 1), indexAt(1, 2)]);
    expect(strokeMarks(hovering.onStroke)).toEqual([CROSSED]);
    expect(hovering.onPaint).not.toHaveBeenCalled();
    cleanup();

    // Held as the tip comes down, the contact is what changed, and the barrel
    // is only in `buttons`. Asking what is down rather than what moved is the
    // whole of catching this one.
    const held = renderBoard();
    giveCellsALayout();
    const second = held.cells[indexAt(1, 1)]!;
    rightPress(second, 1, 1, { button: 0, buttons: 3, pointerType: 'pen' });
    dragTo(second, 1, 2);
    release(second, 1, 2);
    expect(strokeCells(held.onStroke)).toEqual([indexAt(1, 1), indexAt(1, 2)]);
    expect(strokeMarks(held.onStroke)).toEqual([CROSSED]);
    expect(held.onPaint).not.toHaveBeenCalled();
  });

  it('crosses once on a barrel press that never moves', () => {
    const { cells, onPaint, onCross, onStroke } = renderBoard();

    // The menu a barrel raises is not the one a pen's tip raises at the end of
    // a long press: nothing has crossed yet, so this one has to.
    const cell = cells[indexAt(1, 4)]!;
    fireEvent.pointerDown(cell, { button: 2, buttons: 2, pointerType: 'pen', pointerId: 1 });
    contextMenu(cell, { button: 2 });
    fireEvent.pointerUp(cell, { button: 2, pointerType: 'pen', pointerId: 1 });

    expect(onCross.mock.calls).toEqual([[indexAt(1, 4)]]);
    expect(onPaint).not.toHaveBeenCalled();
    expect(onStroke).not.toHaveBeenCalled();
  });

  it("leaves a pen tip's own drag painting (issue #108)", () => {
    const { cells, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // Nothing about the barrel reaches the tip: with only the contact down,
    // the pen draws what a finger draws.
    const origin = cells[indexAt(5, 1)]!;
    rightPress(origin, 5, 1, { button: 0, buttons: 1, pointerType: 'pen' });
    dragTo(origin, 5, 2);
    release(origin, 5, 2);

    expect(strokeCells(onStroke)).toEqual([indexAt(5, 1), indexAt(5, 2)]);
    expect(strokeMarks(onStroke)).toEqual([FILLED]);
    expect(onCross).not.toHaveBeenCalled();
  });

  it('keeps writing crosses when the left button joins the run', () => {
    const { cells, onPaint, onStroke } = renderBoard();
    giveCellsALayout();

    // The other way round from the chorded press above, and the same rule: a
    // button added mid-stroke starts no second stroke and changes nothing
    // about what the first one writes (§3).
    const origin = cells[indexAt(3, 1)]!;
    rightPress(origin, 3, 1);
    dragTo(origin, 3, 2);
    dragTo(origin, 3, 3, { button: 0, buttons: 3 });
    dragTo(origin, 3, 4);
    release(origin, 3, 4);

    expect(strokeCells(onStroke)).toEqual([
      indexAt(3, 1),
      indexAt(3, 2),
      indexAt(3, 3),
      indexAt(3, 4),
    ]);
    expect(strokeMarks(onStroke).every((mark) => mark === CROSSED)).toBe(true);
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('is still one cross when the button never moves (§3, issue #112)', () => {
    const { cells, onPaint, onCross, onStroke } = renderBoard();
    giveCellsALayout();

    // The single right click of #112, with a grid that could have raised a
    // stroke: standing still must not turn into a run of one.
    rightClick(cells[indexAt(4, 4)]!);

    expect(onCross.mock.calls).toEqual([[indexAt(4, 4)]]);
    expect(onStroke).not.toHaveBeenCalled();
    expect(onPaint).not.toHaveBeenCalled();
  });
});
