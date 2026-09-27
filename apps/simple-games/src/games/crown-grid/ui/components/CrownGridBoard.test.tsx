/**
 * What one press on a cell means (docs/CROWN_GRID_RULES.md §4), and what the
 * board does when the platform takes the finger away (issue #169).
 *
 * The two moves arrive as spies, so a press is judged by what it asked the
 * game to do rather than by what the screen ended up showing. That is the
 * only way to say a drag tapped *nothing*: on a real board a × that arrived
 * after a tap on the same cell would read as a crown.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  colOf,
  createDifficultySession,
  CROWN,
  doTap,
  rowOf,
  type CrownGridSession,
  type Hint,
} from '../../game';
import { CrownGridBoard } from './CrownGridBoard';

/** A fixed 6×6, the same on every machine (§8). */
const SESSION = createDifficultySession('easy', 'crown-grid-easy-board');
const SIZE = SESSION.size;

/** Row and column count from one, the way the labels do. */
const indexAt = (row: number, col: number) => (row - 1) * SIZE + (col - 1);

function renderBoard(
  session: CrownGridSession = SESSION,
  hint: Hint | null = null,
  solved = false,
) {
  const onTap = vi.fn();
  const onStroke = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CrownGridBoard
        session={session}
        hint={hint}
        solved={solved}
        onTap={onTap}
        onStroke={onStroke}
      />
    </SettingsProvider>,
  );
  /** Re-renders the same mounted board with a new session (props update, not a remount). */
  const update = (
    nextSession: CrownGridSession,
    nextHint: Hint | null = null,
    nextSolved = false,
  ) =>
    view.rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <CrownGridBoard
          session={nextSession}
          hint={nextHint}
          solved={nextSolved}
          onTap={onTap}
          onStroke={onStroke}
        />
      </SettingsProvider>,
    );
  const board = screen.getByRole('group', { name: /^Crown Grid board/ });
  const cells = within(board).getAllByRole('button');
  return { board, cells, onTap, onStroke, update };
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
  vi.useRealTimers();
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

  it('draws a boundary edge wherever the neighbouring cell is another region or off the board, and rounds the convex corners (§13)', () => {
    const { cells } = renderBoard();
    const regionAt = (index: number) => Number(cells[index]!.getAttribute('data-region'));
    let sawBoundary = false;
    let sawInterior = false;
    for (let index = 0; index < cells.length; index++) {
      const row = rowOf(index, SIZE);
      const col = colOf(index, SIZE);
      const own = regionAt(index);
      const top = row === 0 || regionAt(index - SIZE) !== own;
      const right = col === SIZE - 1 || regionAt(index + 1) !== own;
      const bottom = row === SIZE - 1 || regionAt(index + SIZE) !== own;
      const left = col === 0 || regionAt(index - 1) !== own;
      const classes = cells[index]!.classList;
      expect(classes.contains('cg-b-t')).toBe(top);
      expect(classes.contains('cg-b-r')).toBe(right);
      expect(classes.contains('cg-b-b')).toBe(bottom);
      expect(classes.contains('cg-b-l')).toBe(left);
      expect(classes.contains('cg-c-tl')).toBe(top && left);
      expect(classes.contains('cg-c-tr')).toBe(top && right);
      expect(classes.contains('cg-c-br')).toBe(bottom && right);
      expect(classes.contains('cg-c-bl')).toBe(bottom && left);
      if (top || right || bottom || left) sawBoundary = true;
      if (!top || !right || !bottom || !left) sawInterior = true;
      expect(cells[index]!.getAttribute('data-region')).toMatch(/^[0-5]$/);
    }
    // The board's own edge is a boundary (every corner cell has two), and at
    // least one pair of same-region neighbours somewhere is not.
    expect(cells[0]!.classList.contains('cg-c-tl')).toBe(true);
    expect(cells[SIZE - 1]!.classList.contains('cg-c-tr')).toBe(true);
    expect(sawBoundary).toBe(true);
    expect(sawInterior).toBe(true);
  });

  it('draws the crown as an inline, aria-hidden SVG, and keeps × as a plain character', () => {
    const crossed = doTap(SESSION, indexAt(1, 1))!;
    const crowned = doTap(crossed, indexAt(1, 1))!;
    const { cells: crownCells } = renderBoard(crowned);
    const svg = crownCells[indexAt(1, 1)]!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(svg!.getAttribute('focusable')).toBe('false');

    cleanup();
    const { cells: crossCells } = renderBoard(crossed);
    expect(crossCells[indexAt(1, 1)]!.querySelector('svg')).toBeNull();
    expect(crossCells[indexAt(1, 1)]!.textContent).toBe('×');
  });

  it('remounts the glyph span on every change of mark (§13, "always appears new")', () => {
    const crossed = doTap(SESSION, indexAt(1, 1))!;
    const { cells, update } = renderBoard(crossed);
    const oldGlyph = cells[indexAt(1, 1)]!.querySelector('.cg-glyph');
    expect(oldGlyph).not.toBeNull();

    const crowned = doTap(crossed, indexAt(1, 1))!;
    update(crowned);
    const newGlyph = cells[indexAt(1, 1)]!.querySelector('.cg-glyph');
    expect(newGlyph).not.toBeNull();
    expect(newGlyph).not.toBe(oldGlyph);
    expect(newGlyph!.classList.contains('cg-glyph-crown')).toBe(true);
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

  it('veils every cell the hint does not touch, and veils nothing without a hint', () => {
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
    // The target, the reason house and the support candidate are all "involved"
    // (§6) — none of them gets the dim veil, whatever else they carry.
    expect(cells[indexAt(1, 3)]!.classList.contains('cg-cell-dim')).toBe(false);
    expect(cells[indexAt(6, 1)]!.classList.contains('cg-cell-dim')).toBe(false);
    expect(cells[indexAt(6, 2)]!.classList.contains('cg-cell-dim')).toBe(false);
    // A cell the step never mentions fades behind the veil.
    expect(cells[indexAt(2, 2)]!.classList.contains('cg-cell-dim')).toBe(true);

    cleanup();
    const { cells: undimmed } = renderBoard(SESSION, null);
    for (const cell of undimmed) expect(cell.classList.contains('cg-cell-dim')).toBe(false);
  });
});

describe('the "reach" of a crown just placed (§13)', () => {
  it('lights the row, column, region and 8 neighbours for 700ms, never the crown itself, and clears after', () => {
    vi.useFakeTimers();
    const { cells, update } = renderBoard();
    const target = indexAt(3, 3);
    const crowned = doTap(doTap(SESSION, target)!, target)!;
    update(crowned);

    const own = Number(cells[target]!.getAttribute('data-region'));
    const expected = new Set<number>();
    for (let col = 1; col <= SIZE; col++) expected.add(indexAt(3, col));
    for (let row = 1; row <= SIZE; row++) expected.add(indexAt(row, 3));
    for (let index = 0; index < cells.length; index++) {
      if (Number(cells[index]!.getAttribute('data-region')) === own) expected.add(index);
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const row = rowOf(target, SIZE) + dr;
        const col = colOf(target, SIZE) + dc;
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;
        expected.add(row * SIZE + col);
      }
    }
    expected.delete(target);

    for (let index = 0; index < cells.length; index++) {
      expect(cells[index]!.classList.contains('cg-cell-reach')).toBe(expected.has(index));
    }
    expect(cells[target]!.classList.contains('cg-cell-reach')).toBe(false);

    // Still lit a hair under 700ms — a shorter timeout would also pass the
    // "eventually clears" assertion below, so the lower bound is its own check.
    act(() => {
      vi.advanceTimersByTime(699);
    });
    for (const index of expected) {
      expect(cells[index]!.classList.contains('cg-cell-reach')).toBe(true);
    }

    act(() => {
      vi.advanceTimersByTime(1);
    });
    for (const index of expected) {
      expect(cells[index]!.classList.contains('cg-cell-reach')).toBe(false);
    }
  });

  it('does not light anything when a × is placed instead', () => {
    const { cells, update } = renderBoard();
    const target = indexAt(4, 4);
    update(doTap(SESSION, target)!);
    expect(cells.some((cell) => cell.classList.contains('cg-cell-reach'))).toBe(false);
  });

  it('does not light anything on the first render, even with crowns already on the board', () => {
    const crowned = doTap(doTap(SESSION, indexAt(1, 1))!, indexAt(1, 1))!;
    const { cells } = renderBoard(crowned);
    expect(cells.some((cell) => cell.classList.contains('cg-cell-reach'))).toBe(false);
  });

  it('lights nothing when two crowns appear in the same update, not just one', () => {
    const { cells, update } = renderBoard();
    const a = indexAt(1, 1);
    const b = indexAt(2, 2);
    const bulk: CrownGridSession = {
      ...SESSION,
      marks: SESSION.marks.map((mark, index) => (index === a || index === b ? CROWN : mark)),
    };
    update(bulk);
    expect(cells.some((cell) => cell.classList.contains('cg-cell-reach'))).toBe(false);
  });

  it('does not relight on a re-render with the same crowns, such as a hint arriving', () => {
    vi.useFakeTimers();
    const { cells, update } = renderBoard();
    const target = indexAt(4, 4);
    const crowned = doTap(doTap(SESSION, target)!, target)!;
    update(crowned);
    expect(cells.some((cell) => cell.classList.contains('cg-cell-reach'))).toBe(true);

    // Same marks, only a hint attached — nothing was just placed.
    update(crowned, { kind: 'wrong', index: indexAt(1, 1) });

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(cells.some((cell) => cell.classList.contains('cg-cell-reach'))).toBe(false);
  });

  it('restarts the flash on a cell two placements in a row both light (§13)', () => {
    vi.useFakeTimers();
    const { cells, update } = renderBoard();
    const first = indexAt(3, 3);
    const firstCrowned = doTap(doTap(SESSION, first)!, first)!;
    update(firstCrowned);

    // Row 3 and column 5 cross at (3, 5): the first placement lights it by
    // row, and it is not the crown's own cell.
    const shared = indexAt(3, 5);
    expect(cells[shared]!.classList.contains('cg-cell-reach')).toBe(true);
    expect(cells[shared]!.classList.contains('cg-cell-reach-odd')).toBe(true);

    // A second crown within the first flash's 700ms, sharing column 5.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const second = indexAt(5, 5);
    const secondCrowned = doTap(doTap(firstCrowned, second)!, second)!;
    update(secondCrowned);

    // Still lit — by the second placement now — but the parity class has
    // flipped, which is what forces the CSS animation to restart rather than
    // carry on the first flash's half-finished fade.
    expect(cells[shared]!.classList.contains('cg-cell-reach')).toBe(true);
    expect(cells[shared]!.classList.contains('cg-cell-reach-odd')).toBe(false);
  });

  it('re-placing the same crown three taps later still flips parity, even with an identical Set', () => {
    vi.useFakeTimers();
    const { cells, update } = renderBoard();
    const target = indexAt(2, 2);
    const crowned = doTap(doTap(SESSION, target)!, target)!;
    update(crowned);
    const lit = indexAt(2, 5);
    expect(cells[lit]!.classList.contains('cg-cell-reach-odd')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    // crown -> empty -> × -> crown: the same cell, the same reach Set.
    const cleared = doTap(crowned, target)!;
    const crossed = doTap(cleared, target)!;
    const recrowned = doTap(crossed, target)!;
    update(cleared);
    update(crossed);
    update(recrowned);

    expect(cells[lit]!.classList.contains('cg-cell-reach')).toBe(true);
    expect(cells[lit]!.classList.contains('cg-cell-reach-odd')).toBe(false);
  });

  it('clears its timer on unmount mid-flash, leaving nothing pending (GAME_LIFECYCLE.md)', () => {
    vi.useFakeTimers();
    const view = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <CrownGridBoard
          session={SESSION}
          hint={null}
          solved={false}
          onTap={vi.fn()}
          onStroke={vi.fn()}
        />
      </SettingsProvider>,
    );
    const target = indexAt(2, 2);
    const crowned = doTap(doTap(SESSION, target)!, target)!;
    view.rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <CrownGridBoard
          session={crowned}
          hint={null}
          solved={false}
          onTap={vi.fn()}
          onStroke={vi.fn()}
        />
      </SettingsProvider>,
    );
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the solved beat (common mechanism)', () => {
  it('marks the board solved when the session says so, and not otherwise', () => {
    const { board } = renderBoard(SESSION, null, false);
    expect(board.classList.contains('cg-board-solved')).toBe(false);
  });

  it('adds cg-board-solved once solved', () => {
    const { board } = renderBoard(SESSION, null, true);
    expect(board.classList.contains('cg-board-solved')).toBe(true);
  });

  it('numbers each settling crown by row-major order, from 0 (§13, "--cg-i")', () => {
    // Three crowns in three different rows, column 1 each: their board
    // indices already ascend in row-major order, so --cg-i should read
    // 0, 1, 2 in that order and not, say, the cell index or a constant 0.
    const first = indexAt(1, 1);
    const second = indexAt(2, 1);
    const third = indexAt(3, 1);
    const staged: CrownGridSession = {
      ...SESSION,
      marks: SESSION.marks.map((mark, index) =>
        index === first || index === second || index === third ? CROWN : mark,
      ),
    };
    const { cells } = renderBoard(staged, null, true);
    const ordinalAt = (index: number) =>
      (cells[index]!.querySelector('.cg-glyph-crown') as HTMLElement).style.getPropertyValue(
        '--cg-i',
      );
    expect(ordinalAt(first)).toBe('0');
    expect(ordinalAt(second)).toBe('1');
    expect(ordinalAt(third)).toBe('2');
  });
});
