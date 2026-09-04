/**
 * What one press on a square means (docs/MINESWEEPER_RULES.md §3).
 *
 * The board is hand-built here, the way `game/engine.test.ts` builds its
 * fields, because the positions this file cares about — an open number with its
 * flags already matching — take several lucky taps to reach on a real board and
 * none of them would be reproducible. The three moves arrive as spies, so a
 * press is judged by what it asked the game to do rather than by what the
 * screen ended up showing.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { fieldFromMines, type Board } from '../../game';
import { MinesBoard } from './MinesBoard';

/**
 * One mine in the middle of a 3×3, so every other square is a 1:
 *
 *   . . .      counts:  1 1 1
 *   . * .               1 * 1
 *   . . .               1 1 1
 */
const FIELD = fieldFromMines(
  3,
  3,
  [false, false, false, false, true, false, false, false, false],
);

/** That field with a hand-chosen set of squares open and flagged. */
function boardWith(opened: readonly number[], flagged: readonly number[]): Board {
  return {
    field: FIELD,
    opened: FIELD.mines.map((_, index) => opened.includes(index)),
    flagged: FIELD.mines.map((_, index) => flagged.includes(index)),
    exploded: null,
  };
}

/**
 * The corner 1 is open and the only mine it touches is flagged, so its flags
 * match its number and two shut squares remain: a chord here is armed (§3).
 */
const ARMED = boardWith([0], [4]);

function renderBoard(board: Board, flagMode = false) {
  const onOpen = vi.fn();
  const onFlag = vi.fn();
  const onChord = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MinesBoard
        board={board}
        hint={null}
        flagMode={flagMode}
        onOpen={onOpen}
        onFlag={onFlag}
        onChord={onChord}
      />
    </SettingsProvider>,
  );
  const squares = within(screen.getByRole('group', { name: /^Minefield/ })).getAllByRole('button');
  return { squares, onOpen, onFlag, onChord };
}

/**
 * Raises the context menu and insists it was cancelled. A cancelled contextmenu
 * is the whole of "no browser menu over the board" (§3): fireEvent hands back
 * what dispatchEvent returned, which is false exactly when something called
 * preventDefault on it.
 */
function contextMenu(square: HTMLElement, init: Record<string, unknown>) {
  expect(fireEvent.contextMenu(square, init)).toBe(false);
}

/** A right click as a browser delivers it. No click event ever follows one. */
function rightClick(square: HTMLElement) {
  fireEvent.pointerDown(square, { button: 2, pointerType: 'mouse' });
  contextMenu(square, { button: 2 });
  fireEvent.pointerUp(square, { button: 2, pointerType: 'mouse' });
}

/** macOS ctrl+click: the primary button raises the menu, and a click follows. */
function ctrlClick(square: HTMLElement) {
  fireEvent.pointerDown(square, { button: 0, pointerType: 'mouse', ctrlKey: true });
  contextMenu(square, { button: 0, ctrlKey: true });
  fireEvent.pointerUp(square, { button: 0, pointerType: 'mouse', ctrlKey: true });
  fireEvent.click(square, { button: 0, ctrlKey: true, detail: 1 });
}

afterEach(cleanup);

describe('the tap (§3)', () => {
  it('opens a shut square, and chords an open number whose flags match', () => {
    const { squares, onOpen, onFlag, onChord } = renderBoard(ARMED);

    fireEvent.click(squares[1]!);
    expect(onOpen.mock.calls).toEqual([[1]]);

    fireEvent.click(squares[0]!);
    expect(onChord.mock.calls).toEqual([[0]]);
    expect(onFlag).not.toHaveBeenCalled();
  });
});

describe('the right button (§3, issue #111)', () => {
  it('flags a shut square and lifts a flag it finds there', () => {
    const { squares, onOpen, onFlag, onChord } = renderBoard(ARMED);

    rightClick(squares[1]!);
    expect(onFlag.mock.calls).toEqual([[1]]);

    // The flagged square takes the same press to get its flag back off — the
    // game decides which way round it goes, not the board.
    rightClick(squares[4]!);
    expect(onFlag.mock.calls).toEqual([[1], [4]]);

    expect(onOpen).not.toHaveBeenCalled();
    expect(onChord).not.toHaveBeenCalled();
  });

  it('keeps the browser menu off the gaps between squares too', () => {
    const { onOpen, onFlag, onChord } = renderBoard(ARMED);

    // Flagging fast, a right click that misses a square by a pixel lands in the
    // grid's own gutter. The native menu must not open there either — and a
    // press on nothing must not put a flag anywhere.
    const grid = screen.getByRole('group', { name: /^Minefield/ });
    expect(fireEvent.contextMenu(grid, { button: 2 })).toBe(false);
    expect(onFlag).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onChord).not.toHaveBeenCalled();
  });

  it('leaves the armed chord alone, even when a click follows the menu', () => {
    const { squares, onOpen, onFlag, onChord } = renderBoard(ARMED);

    rightClick(squares[0]!);
    ctrlClick(squares[0]!);

    // Chording is the tap's (§3). A right click on this number is not a
    // shortcut to it — and on macOS a click arrives right behind the menu.
    expect(onChord).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onFlag).not.toHaveBeenCalled();
  });

  it('flags in flag mode too, where the tap already flags', () => {
    const { squares, onOpen, onFlag } = renderBoard(ARMED, true);

    // The tap and the long press have swapped over; the right button has not.
    fireEvent.click(squares[1]!);
    expect(onFlag.mock.calls).toEqual([[1]]);

    rightClick(squares[2]!);
    expect(onFlag.mock.calls).toEqual([[1], [2]]);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
