/**
 * What one press on the board means (docs/NUMBER_PATH_RULES.md §4).
 *
 * The two moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. That is the
 * only way to say a drag's trailing click tapped *nothing*: on a real board a
 * tap that arrived after a stroke looks exactly like the stroke alone.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createDifficultySession, doTap, type Hint, type NumberPathSession } from '../../game';
import { NumberPathBoard } from './NumberPathBoard';

/**
 * A 5×5 whose road is pinned by its seed (compatibility.test.ts pins the
 * mechanism): 1 sits at cell 14, and the road runs 14 → 9 → 4 → 3 → 2 …
 */
const SESSION = createDifficultySession('easy', 'number-path-easy-test');
const SIZE = 5;
const START = SESSION.solution[0]!;
const [, SECOND, THIRD, FOURTH] = SESSION.solution as unknown as [number, number, number, number];

function renderBoard(
  session: NumberPathSession = SESSION,
  hint: Hint | null = null,
  solved = false,
) {
  const onTrace = vi.fn(() => true);
  const onTap = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <NumberPathBoard
        session={session}
        hint={hint}
        onTrace={onTrace}
        onTap={onTap}
        solved={solved}
      />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Number Path board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onTrace, onTap };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

const pointAt = (index: number) => ({
  clientX: CELL_PX * ((index % SIZE) + 0.5),
  clientY: CELL_PX * (Math.floor(index / SIZE) + 0.5),
});

/** Gives the grid the rectangle a stroke measures itself against. */
function giveCellsALayout(): void {
  const cells = document.querySelector('.np-cells') as Element;
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

function press(cell: Element, index: number, init: Record<string, unknown> = {}) {
  fireEvent.pointerDown(cell, {
    button: 0,
    pointerId: 1,
    pointerType: 'touch',
    ...pointAt(index),
    ...init,
  });
}

/** One move of a drag, fired at the cell the press began on (pointer capture). */
function dragTo(origin: Element, index: number) {
  fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(index) });
}

function release(origin: Element, index: number) {
  fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(index) });
}

const traces = (onTrace: Mock): unknown[][] => onTrace.mock.calls.map((call) => [...call]);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what the board says (§11)', () => {
  it('names every cell by position, number and place on the path', () => {
    const { cells } = renderBoard();
    expect(cells).toHaveLength(25);
    expect(cells[START]!.getAttribute('aria-label')).toBe(
      'Number 1, row 3, column 5, on the path, step 1',
    );
    expect(cells[0]!.getAttribute('aria-label')).toBe('Row 1, column 1, not on the path');
    expect(cells[START]!.className).toContain('np-cell-end');
    expect(cells[START]!.className).toContain('np-cell-visited');
  });

  it('draws the path as segments between neighbouring cells, and walls as edges', () => {
    const played = doTap(doTap(SESSION, SECOND)!, THIRD)!;
    const { cells } = renderBoard(played);
    expect(cells[SECOND]!.getAttribute('aria-label')).toMatch(/on the path, step 2$/);
    // 14 → 9 → 4 runs straight up: the middle cell has a segment each way.
    expect(cells[SECOND]!.querySelectorAll('.np-seg-down')).toHaveLength(1);
    expect(cells[SECOND]!.querySelectorAll('.np-seg-up')).toHaveLength(1);
    expect(cells[THIRD]!.querySelectorAll('.np-end')).toHaveLength(1);
    expect(cells[START]!.querySelectorAll('.np-end')).toHaveLength(0);
    // The wall between cells 6 and 11 is drawn on both of them (§1).
    expect(cells[6]!.querySelectorAll('.np-wall-down')).toHaveLength(1);
    expect(cells[11]!.querySelectorAll('.np-wall-up')).toHaveLength(1);
    expect(cells[0]!.querySelectorAll('.np-wall')).toHaveLength(0);
  });

  it('marks the hint cell, and the stretch beyond a back-up point', () => {
    const next = renderBoard(SESSION, { kind: 'next', cell: SECOND });
    expect(next.cells[SECOND]!.className).toContain('np-cell-hint');
    // The mark reaches assistive technology too, not just the eye (§11).
    expect(next.cells[SECOND]!.getAttribute('aria-label')).toMatch(/, hint$/);
    expect(next.cells[START]!.getAttribute('aria-label')).not.toMatch(/, hint$/);
    cleanup();

    const strayed = doTap(doTap(SESSION, SECOND)!, THIRD)!;
    const back = renderBoard(strayed, { kind: 'back', cell: SECOND });
    expect(back.cells[SECOND]!.className).toContain('np-cell-hint');
    expect(back.cells[SECOND]!.getAttribute('aria-label')).toMatch(/, hint$/);
    expect(back.cells[THIRD]!.className).toContain('np-cell-astray');
    expect(back.cells[SECOND]!.className).not.toContain('np-cell-astray');
    expect(back.cells[START]!.className).not.toContain('np-cell-astray');
  });

  it('marks every cell the path has been through as a joint, and no other cell', () => {
    const played = doTap(doTap(SESSION, SECOND)!, THIRD)!;
    const { cells } = renderBoard(played);
    for (const cell of [START, SECOND, THIRD]) {
      expect(cells[cell]!.className).toContain('np-cell-on');
    }
    expect(cells[0]!.className).not.toContain('np-cell-on');
    // The path's end, drawn as a joint plus the round cap tested above.
    expect(cells[THIRD]!.className).toContain('np-cell-end');
    expect(cells[START]!.className).not.toContain('np-cell-end');
  });

  it('marks the cell carrying the number the path is next due to reach', () => {
    // Untouched: only 1 (cell 14) is reached, so 2's cell (4) is next.
    const untouched = renderBoard();
    expect(untouched.cells[4]!.className).toContain('np-cell-next');
    expect(untouched.cells[START]!.className).not.toContain('np-cell-next');
    // No other numbered cell wears the ring too.
    expect(untouched.cells.filter((c) => c.className.includes('np-cell-next'))).toHaveLength(1);
    cleanup();

    // 2 is reached (14 → 9 → 4): 3's cell (5) becomes next, 2's no longer is.
    const played = doTap(doTap(SESSION, SECOND)!, THIRD)!;
    const { cells } = renderBoard(played);
    expect(cells[5]!.className).toContain('np-cell-next');
    expect(cells[THIRD]!.className).not.toContain('np-cell-next');
    expect(cells.filter((c) => c.className.includes('np-cell-next'))).toHaveLength(1);
  });

  it('marks no cell as next once the path has reached K', () => {
    let solved = SESSION;
    for (const cell of SESSION.solution.slice(solved.path.length)) {
      solved = doTap(solved, cell) ?? solved;
    }
    expect(solved.status).toBe('solved');
    const { cells } = renderBoard(solved);
    for (const cell of cells) {
      expect(cell.className).not.toContain('np-cell-next');
    }
  });
});

describe('growing the end (§11)', () => {
  it('grows the new segment only on the render that just extended the path, never when backing up', () => {
    const onTrace = vi.fn(() => true);
    const onTap = vi.fn();
    const wrap = (session: NumberPathSession) => (
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <NumberPathBoard
          session={session}
          hint={null}
          onTrace={onTrace}
          onTap={onTap}
          solved={false}
        />
      </SettingsProvider>
    );
    const cellsOf = () =>
      within(screen.getByRole('group', { name: /^Number Path board/ })).getAllByRole('button');

    const { rerender } = render(wrap(SESSION));
    expect(cellsOf()[START]!.className).not.toContain('np-cell-grow');

    // Extended by one tap: the new end grows in.
    const extended = doTap(SESSION, SECOND)!;
    rerender(wrap(extended));
    expect(cellsOf()[SECOND]!.className).toContain('np-cell-grow');

    // Backing up to the cell before it: nothing grows (issue found in review).
    const truncated = doTap(extended, START)!;
    rerender(wrap(truncated));
    expect(cellsOf()[SECOND]!.className).not.toContain('np-cell-grow');
    expect(cellsOf()[START]!.className).not.toContain('np-cell-grow');
  });
});

describe('the solved beat (§11)', () => {
  it('marks the board solved only when told to', () => {
    const playing = renderBoard(SESSION, null, false);
    expect(playing.board.className).not.toContain('np-board-solved');
    cleanup();

    const solved = renderBoard(SESSION, null, true);
    expect(solved.board.className).toContain('np-board-solved');
  });
});

describe('a tap (§4)', () => {
  it('hands the cell to the game as a tap, and draws nothing itself', () => {
    const { cells, onTap, onTrace } = renderBoard();
    fireEvent.click(cells[SECOND]!, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[SECOND]]);
    expect(onTrace).not.toHaveBeenCalled();
  });

  it('answers a keyboard activation too', () => {
    const { cells, onTap } = renderBoard();
    fireEvent.click(cells[SECOND]!, { detail: 0 });
    expect(onTap.mock.calls).toEqual([[SECOND]]);
  });
});

describe('a stroke (§4, §5)', () => {
  it('traces the cell it began on and every cell it reaches, in order', () => {
    const { cells, onTrace, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    dragTo(origin, SECOND);
    dragTo(origin, THIRD);
    release(origin, THIRD);
    // The first trace opens the undo step; the second joins it (§5).
    expect(traces(onTrace)).toEqual([
      [[START, SECOND], true],
      [[THIRD], false],
    ]);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('keeps asking for a new step until a trace actually changes the path', () => {
    const { cells, onTrace } = renderBoard();
    giveCellsALayout();
    onTrace.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const origin = cells[START]!;
    press(origin, START);
    dragTo(origin, SECOND);
    dragTo(origin, THIRD);
    dragTo(origin, FOURTH);
    expect(traces(onTrace).map((call) => call[1])).toEqual([true, true, false]);
  });

  it('walks a flick cell by cell, so a fast finger skips nothing', () => {
    const { cells, onTrace } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    // Straight up two cells in one move: 14 → 9 → 4 all arrive, in order.
    dragTo(origin, THIRD);
    expect(traces(onTrace)).toEqual([[[START, SECOND, THIRD], true]]);
  });

  it('hands over a cell once while the finger rests on it', () => {
    const { cells, onTrace } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    dragTo(origin, SECOND);
    fireEvent.pointerMove(origin, {
      pointerId: 1,
      clientX: pointAt(SECOND).clientX + 3,
      clientY: pointAt(SECOND).clientY - 3,
    });
    expect(onTrace).toHaveBeenCalledTimes(1);
  });

  it('spends the click a drag leaves behind, and answers the next tap', () => {
    const { cells, onTrace, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    dragTo(origin, SECOND);
    release(origin, SECOND);
    fireEvent.click(origin, { detail: 1 });
    expect(onTap).not.toHaveBeenCalled();
    expect(onTrace).toHaveBeenCalledTimes(1);
    // A fresh tap on the same cell is a tap.
    fireEvent.click(origin, { detail: 1 });
    expect(onTap.mock.calls).toEqual([[START]]);
  });

  it('ends where it stands when the pointer is taken away, keeping what it drew (issue #169)', () => {
    const { cells, onTrace, onTap } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    dragTo(origin, SECOND);
    fireEvent.pointerCancel(origin, { pointerId: 1, ...pointAt(SECOND) });
    // Nothing is taken back, and nothing more is drawn by a finger that is gone.
    dragTo(origin, THIRD);
    release(origin, THIRD);
    expect(traces(onTrace)).toEqual([[[START, SECOND], true]]);
    // The click a cancelled press might still leave is not a tap either.
    fireEvent.click(origin, { detail: 1 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('ignores a press that did not move, and a move from another pointer', () => {
    const { cells, onTrace } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START);
    fireEvent.pointerMove(origin, { pointerId: 2, ...pointAt(SECOND) });
    release(origin, START);
    expect(onTrace).not.toHaveBeenCalled();
  });

  it('draws nothing under the right button', () => {
    const { cells, onTrace } = renderBoard();
    giveCellsALayout();
    const origin = cells[START]!;
    press(origin, START, { button: 2, buttons: 2, pointerType: 'mouse' });
    dragTo(origin, SECOND);
    expect(onTrace).not.toHaveBeenCalled();
  });

  it('opens no browser menu over the board', () => {
    const { board } = renderBoard();
    expect(fireEvent.contextMenu(board, { button: 2 })).toBe(false);
  });
});
