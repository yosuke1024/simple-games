/**
 * What one press on the board means (docs/BRIDGES_RULES.md §4), and what the
 * board reads aloud and shows (§5, §9, §13).
 *
 * The three inputs arrive as spies, so a press is judged by what it asked the
 * screen to do rather than by what the screen ended up showing. The board is
 * the hand-drawn 5×5 of ../test-helpers.ts, so every island is where the test
 * says it is.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { BridgesSession, Hint } from '../../game';
import { handSession } from '../test-helpers';
import { BridgesBoard } from './BridgesBoard';

function renderBoard(
  session: BridgesSession = handSession(),
  { selected = null, hint = null }: { selected?: number | null; hint?: Hint | null } = {},
) {
  const onTapIsland = vi.fn();
  const onDragConnect = vi.fn();
  const onTapWater = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesBoard
        session={session}
        selected={selected}
        hint={hint}
        solved={session.status === 'solved'}
        onTapIsland={onTapIsland}
        onDragConnect={onDragConnect}
        onTapWater={onTapWater}
      />
    </SettingsProvider>,
  );
  const board = screen.getByRole('group', { name: /^Bridges board/ });
  const islands = within(board).getAllByRole('button');
  const field = board.querySelector('.bg-field') as HTMLElement;
  return { view, board, islands, field, onTapIsland, onDragConnect, onTapWater };
}

/** A pretend cell, in CSS pixels — jsdom lays nothing out on its own. */
const CELL_PX = 40;

/** Gives the field the rectangle a drag measures itself against. */
function giveFieldALayout(field: HTMLElement): void {
  const side = CELL_PX * 5;
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
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

/** The centre of a cell, by row-major index on the 5×5. */
const pointAt = (index: number, dx = 0, dy = 0) => ({
  clientX: CELL_PX * ((index % 5) + 0.5) + dx,
  clientY: CELL_PX * (Math.floor(index / 5) + 0.5) + dy,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what an island reads aloud and shows (§5, §13)', () => {
  it('names number, position, and bridges against the number', () => {
    const { islands } = renderBoard();
    expect(islands).toHaveLength(6);
    expect(islands[0]).toHaveAccessibleName('Island 1, row 1, column 3: 0 of 1 bridges');
    expect(islands[4]).toHaveAccessibleName('Island 3, row 5, column 3: 0 of 3 bridges');
    expect(islands[4]).toHaveTextContent(/^3$/);
    expect(screen.getByRole('group')).toHaveAccessibleName('Bridges board, 5 by 5, 6 islands');
  });

  it('shows short, exact and past its number as three different shapes, not hues', () => {
    // Island 0 (a 1) on two bridges: past. Island 3 (a 2): 1 + 1, exact.
    const { islands } = renderBoard(handSession([2, 0, 1, 0, 1, 0]));
    expect(islands[0]).toHaveClass('bg-island-over');
    expect(islands[0]).toHaveAccessibleName('Island 1, row 1, column 3: 2 bridges, too many');
    expect(islands[3]).toHaveClass('bg-island-complete');
    expect(islands[3]).toHaveAccessibleName('Island 2, row 5, column 1: complete');
    expect(islands[5]).toHaveClass('bg-island-open');
  });

  it('draws one line for one bridge and two for two', () => {
    const { board } = renderBoard(handSession([1, 0, 0, 2, 0, 0]));
    expect(board.querySelectorAll('line.bg-bridge')).toHaveLength(3);
    expect(board.querySelectorAll('.bg-bridge-double')).toHaveLength(1);
  });

  it('carries no letters on the board: a number per island, nothing else', () => {
    const { board } = renderBoard(handSession([1, 0, 1, 2, 1, 1]));
    expect(board.textContent).toBe('112233');
    expect(board.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('the selection and its partners (§4, §5)', () => {
  it('rings the selection, and rings and lines each partner', () => {
    const { islands, board } = renderBoard(handSession(), { selected: 1 });
    expect(islands[1]).toHaveClass('bg-island-selected');
    expect(islands[1]).toHaveAccessibleName(/Selected$/);
    // Island 1 sees 2 (across) and 3 (down): both partners, nothing else is.
    expect(islands[2]).toHaveClass('bg-island-partner');
    expect(islands[3]).toHaveClass('bg-island-partner');
    expect(islands[2]).toHaveAccessibleName(
      'Island 2, row 3, column 5: 0 of 2 bridges. Can link to the selected island: 0 of 2 bridges',
    );
    for (const other of [0, 4, 5]) expect(islands[other]).not.toHaveClass('bg-island-partner');
    expect(board.querySelectorAll('line.bg-candidate')).toHaveLength(2);
  });

  it('draws no candidate over a bridge already there, and none across a blocked way', () => {
    // A bridge down the middle: the way across is shut, the way down has one.
    const { islands, board, view } = renderBoard(handSession([0, 0, 1, 0, 0, 0]), {
      selected: 1,
    });
    expect(islands[3]).toHaveAccessibleName(/1 of 2 bridges$/);
    expect(board.querySelectorAll('line.bg-candidate')).toHaveLength(1);
    view.unmount();
    const blocked = renderBoard(handSession([1, 0, 0, 0, 0, 0]), { selected: 1 });
    expect(blocked.islands[2]).not.toHaveClass('bg-island-partner');
    expect(blocked.islands[3]).toHaveClass('bg-island-partner');
  });

  it('shows no selection on a finished board', () => {
    const { islands } = renderBoard(handSession([1, 0, 1, 2, 1, 1], 'solved'), { selected: 1 });
    expect(islands[1]).not.toHaveClass('bg-island-selected');
    expect(islands[2]).not.toHaveClass('bg-island-partner');
  });
});

describe('the hint’s marks (§9)', () => {
  it('lays a band on the pair and rings the island that gives it away', () => {
    const hint: Hint = { kind: 'step', edge: 3, atLeast: 2, technique: 'count', island: 2 };
    const { islands, board } = renderBoard(handSession(), { hint });
    expect(board.querySelector('.bg-hint-band')).not.toBeNull();
    expect(islands[2]).toHaveClass('bg-island-hint', 'bg-island-reason');
    expect(islands[5]).toHaveClass('bg-island-hint');
    expect(islands[5]).not.toHaveClass('bg-island-reason');
  });

  it('says in the spoken names what the marks show, and only on the marked islands', () => {
    const hint: Hint = { kind: 'step', edge: 3, atLeast: 2, technique: 'count', island: 2 };
    const { islands } = renderBoard(handSession(), { hint });
    expect(islands[2]).toHaveAccessibleName(
      'Island 2, row 3, column 5: 0 of 2 bridges. Highlighted by the hint, in the dotted ring',
    );
    expect(islands[5]).toHaveAccessibleName(
      'Island 3, row 5, column 5: 0 of 3 bridges. Highlighted by the hint',
    );
    for (const other of [0, 1, 3, 4]) {
      expect(islands[other]!.getAttribute('aria-label')).not.toMatch(/hint/i);
    }
  });

  it('keeps the hint in a name when a selection is made beside it', () => {
    const hint: Hint = { kind: 'step', edge: 3, atLeast: 2, technique: 'count', island: 2 };
    // Island 5 is selected; island 2 is its partner as well as the ring.
    const { islands } = renderBoard(handSession(), { hint, selected: 5 });
    expect(islands[5]).toHaveAccessibleName(
      'Island 3, row 5, column 5: 0 of 3 bridges. Highlighted by the hint. Selected',
    );
    expect(islands[2]).toHaveAccessibleName(
      'Island 2, row 3, column 5: 0 of 2 bridges. Highlighted by the hint, in the dotted ring. ' +
        'Can link to the selected island: 0 of 2 bridges',
    );
  });

  it('names no island when the reason is a chain', () => {
    const hint: Hint = { kind: 'step', edge: 0, atLeast: 1, technique: 'connect', island: -1 };
    const { board, islands } = renderBoard(handSession(), { hint });
    expect(board.querySelectorAll('.bg-island-reason')).toHaveLength(0);
    expect(board.querySelectorAll('.bg-island-hint')).toHaveLength(2);
    expect(islands[0]).toHaveAccessibleName(/0 of 1 bridges\. Highlighted by the hint$/);
    expect(islands[4]).toHaveAccessibleName(/0 of 3 bridges\. Highlighted by the hint$/);
  });

  it('marks a pair over the answer apart from a step', () => {
    const hint: Hint = { kind: 'wrong', edge: 1, count: 1, answer: 0 };
    const { islands, board } = renderBoard(handSession([0, 1, 0, 0, 0, 0]), { hint });
    expect(islands[1]).toHaveClass('bg-island-wrong');
    expect(islands[2]).toHaveClass('bg-island-wrong');
    expect(board.querySelector('.bg-hint-band-wrong')).not.toBeNull();
    expect(islands[1]).toHaveAccessibleName(/Highlighted by the hint$/);
    expect(islands[2]).toHaveAccessibleName(/Highlighted by the hint$/);
    expect(islands[0]!.getAttribute('aria-label')).not.toMatch(/hint/i);
  });
});

describe('a press (§4)', () => {
  it('is a tap on the island it lands on', () => {
    const { islands, onTapIsland, onTapWater } = renderBoard();
    fireEvent.click(islands[4]!, { detail: 1 });
    expect(onTapIsland).toHaveBeenCalledWith(4);
    expect(onTapWater).not.toHaveBeenCalled();
  });

  it('on a bridge’s line is a tap on the water — the line is never the target', () => {
    // Bridges on 1–3 (one) and 2–5 (two). No handler hangs on a line: a click
    // that reaches one goes on to the field, which reads it as water. (In a
    // browser the lines take no pointer at all — `pointer-events: none`,
    // which jsdom does not apply — so the field is hit directly.)
    const { board, onTapIsland, onDragConnect, onTapWater } = renderBoard(
      handSession([0, 0, 1, 2, 0, 0]),
    );
    const lines = board.querySelectorAll('line.bg-bridge');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      fireEvent.pointerDown(line, { button: 0, pointerId: 1 });
      fireEvent.pointerUp(line, { pointerId: 1 });
      fireEvent.click(line, { detail: 1 });
    }
    expect(onTapWater).toHaveBeenCalledTimes(3);
    expect(onTapIsland).not.toHaveBeenCalled();
    expect(onDragConnect).not.toHaveBeenCalled();
  });

  it('on the water clears the selection', () => {
    const { field, onTapWater, onTapIsland } = renderBoard(handSession(), { selected: 1 });
    fireEvent.click(field, { detail: 1 });
    expect(onTapWater).toHaveBeenCalledTimes(1);
    expect(onTapIsland).not.toHaveBeenCalled();
  });

  it('that never leaves its island is still a tap, through the click it leaves', () => {
    const { islands, field, onTapIsland, onDragConnect } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 0, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(10, 6, 4) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(10, 6, 4) });
    fireEvent.click(origin, { detail: 1 });
    expect(onTapIsland).toHaveBeenCalledWith(1);
    expect(onDragConnect).not.toHaveBeenCalled();
  });

  it('dragged onto another island joins the two, and spends the click it leaves', () => {
    const { islands, field, onTapIsland, onDragConnect } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 0, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(12) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(14) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(14) });
    fireEvent.click(origin, { detail: 1 });
    expect(onDragConnect).toHaveBeenCalledWith(1, 2);
    expect(onTapIsland).not.toHaveBeenCalled();
  });

  it('shows where a drag would build while it lasts', () => {
    const { islands, field, board } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 0, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(14) });
    expect(islands[1]).toHaveClass('bg-island-selected');
    expect(islands[2]).toHaveClass('bg-island-target');
    expect(board.querySelector('.bg-candidate-target')).not.toBeNull();
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(14) });
    expect(islands[1]).not.toHaveClass('bg-island-selected');
  });

  it('let go on the water builds nothing, and leaves no tap behind', () => {
    const { islands, field, onTapIsland, onDragConnect } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 0, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(12) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(12) });
    fireEvent.click(origin, { detail: 1 });
    expect(onDragConnect).not.toHaveBeenCalled();
    expect(onTapIsland).not.toHaveBeenCalled();
  });

  it('taken away by the platform decides nothing, and leaves nothing armed', () => {
    const { islands, field, onTapIsland, onDragConnect } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 0, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(14) });
    fireEvent.pointerCancel(origin, { pointerId: 1 });
    // The release that never came cannot arrive late and build.
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(14) });
    expect(onDragConnect).not.toHaveBeenCalled();
    expect(islands[2]).not.toHaveClass('bg-island-target');
    // And the next press is an ordinary tap.
    fireEvent.pointerDown(origin, { button: 0, pointerId: 2, ...pointAt(10) });
    fireEvent.pointerUp(origin, { pointerId: 2, ...pointAt(10) });
    fireEvent.click(origin, { detail: 1 });
    expect(onTapIsland).toHaveBeenCalledWith(1);
  });

  it('ignores every button but the primary one', () => {
    const { islands, field, onDragConnect } = renderBoard();
    giveFieldALayout(field);
    const origin = islands[1]!;
    fireEvent.pointerDown(origin, { button: 2, pointerId: 1, ...pointAt(10) });
    fireEvent.pointerMove(origin, { pointerId: 1, ...pointAt(14) });
    fireEvent.pointerUp(origin, { pointerId: 1, ...pointAt(14) });
    expect(onDragConnect).not.toHaveBeenCalled();
  });
});

describe('the keyboard (§4)', () => {
  it('keeps one island in the tab order and walks the islands with arrows', () => {
    const { islands } = renderBoard();
    expect(islands.filter((island) => island.tabIndex === 0)).toEqual([islands[0]]);
    islands[0]!.focus();
    fireEvent.keyDown(islands[0]!, { key: 'ArrowDown' });
    expect(islands[4]).toHaveFocus();
    fireEvent.keyDown(islands[4]!, { key: 'ArrowLeft' });
    expect(islands[3]).toHaveFocus();
    fireEvent.keyDown(islands[3]!, { key: 'ArrowUp' });
    expect(islands[1]).toHaveFocus();
    expect(islands.filter((island) => island.tabIndex === 0)).toEqual([islands[1]]);
    // Nothing that way: the focus stays.
    fireEvent.keyDown(islands[1]!, { key: 'ArrowLeft' });
    expect(islands[1]).toHaveFocus();
  });

  it('reaches the tap through a keyboard activation, never swallowed as a drag’s click', () => {
    const { islands, onTapIsland } = renderBoard();
    fireEvent.click(islands[2]!, { detail: 0 });
    expect(onTapIsland).toHaveBeenCalledWith(2);
  });

  it('does not let a held Enter build bridge after bridge', () => {
    const { islands } = renderBoard();
    islands[0]!.focus();
    // `fireEvent` answers false when the default — the button's click — was stopped.
    expect(fireEvent.keyDown(islands[0]!, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(islands[0]!, { key: 'Enter' })).toBe(true);
  });
});
