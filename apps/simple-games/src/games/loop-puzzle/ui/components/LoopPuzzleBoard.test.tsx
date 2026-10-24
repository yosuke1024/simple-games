/**
 * The board (docs/LOOP_PUZZLE_RULES.md §4, §5, §13): what a tap, a click and
 * a key do to an edge, how wide an edge's hit area is, and what the board
 * reads aloud and shows.
 *
 * The board is controlled, so most tests mount it in a small harness that
 * runs the real session transitions (`doCycle` / `doSet`) — a press is then
 * judged by the state it leaves, exactly as in the game. jsdom lays nothing
 * out, so the hit area is checked where it is decided: the grid placement of
 * every edge button against the board's track list.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  CROSS,
  LINE,
  UNKNOWN,
  createDailySession,
  doCycle,
  doSet,
  gridFor,
  horizontalEdge,
  verticalEdge,
  type Clue,
  type Hint,
  type LoopPuzzleSession,
  type Mark,
} from '../../game';
import { edgeInDirection, LoopPuzzleBoard } from './LoopPuzzleBoard';

afterEach(cleanup);

/** A 3×3 board with hand-placed clues; the answer is never consulted here. */
function handMade(clues: readonly Clue[], marks?: readonly Mark[]): LoopPuzzleSession {
  const edgeCount = gridFor(3, 3).edgeCount;
  return {
    mode: 'difficulty',
    seed: 'hand-made',
    difficulty: 'easy',
    dailyDate: null,
    width: 3,
    height: 3,
    clues,
    solution: new Array<Mark>(edgeCount).fill(CROSS),
    marks: marks ?? new Array<Mark>(edgeCount).fill(UNKNOWN),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    hinted: [],
    lastHint: null,
  };
}

const grid3 = gridFor(3, 3);
const h3 = (r: number, c: number) => horizontalEdge(grid3, r, c);
const v3 = (r: number, c: number) => verticalEdge(grid3, r, c);

/** Mounts the board over a live session, the way the game screen does. */
function Harness({ initial, hint = null }: { initial: LoopPuzzleSession; hint?: Hint | null }) {
  const [session, setSession] = useState(initial);
  return (
    <LoopPuzzleBoard
      session={session}
      hint={hint}
      onCycle={(edge) => setSession((s) => doCycle(s, edge) ?? s)}
      onSet={(edge, mark) => setSession((s) => doSet(s, edge, mark) ?? s)}
      solved={session.status === 'solved'}
    />
  );
}

function renderHarness(initial: LoopPuzzleSession, hint: Hint | null = null) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Harness initial={initial} hint={hint} />
    </SettingsProvider>,
  );
}

const board = () => screen.getByRole('group', { name: /Loop Puzzle board/ });
const edgeButton = (edge: number) =>
  board().querySelector<HTMLButtonElement>(`button[data-edge="${edge}"]`)!;

describe('one tap, one step (§4)', () => {
  it('has one real button per edge, named by place and state', () => {
    const daily = createDailySession('2026-10-17');
    renderHarness(daily);
    const buttons = within(board()).getAllByRole('button');
    expect(buttons).toHaveLength(gridFor(5, 5).edgeCount);
    expect(edgeButton(0)).toHaveAccessibleName('Horizontal edge, row 1, column 1, empty');
    const firstVertical = gridFor(5, 5).firstVertical;
    expect(edgeButton(firstVertical)).toHaveAccessibleName('Vertical edge, row 1, column 1, empty');
  });

  it('cycles an edge: empty → line → × → empty, on the button itself', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(new Array<Clue>(9).fill(null)));
    const edge = h3(1, 1);
    const names = [];
    for (let tap = 0; tap < 3; tap++) {
      await user.click(edgeButton(edge));
      names.push(edgeButton(edge).getAttribute('aria-label'));
    }
    expect(names).toEqual([
      'Horizontal edge, row 2, column 2, line',
      'Horizontal edge, row 2, column 2, crossed out',
      'Horizontal edge, row 2, column 2, empty',
    ]);
  });

  it('draws a line as a bar and an × as a drawn cross — shapes, not colours (§5)', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(new Array<Clue>(9).fill(null)));
    const edge = v3(0, 0);
    await user.click(edgeButton(edge));
    expect(edgeButton(edge)).toHaveClass('lp-edge-line');
    expect(edgeButton(edge).querySelector('svg.lp-cross')).toBeNull();
    await user.click(edgeButton(edge));
    expect(edgeButton(edge)).toHaveClass('lp-edge-cross');
    expect(edgeButton(edge).querySelector('svg.lp-cross')).not.toBeNull();
  });

  it('answers the primary click only; other buttons and a touch that never clicks do nothing', () => {
    const onCycle = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard
          session={handMade(new Array<Clue>(9).fill(null))}
          hint={null}
          onCycle={onCycle}
          onSet={vi.fn()}
          solved={false}
        />
      </SettingsProvider>,
    );
    const target = edgeButton(h3(0, 0));
    // A press the OS took back (pointercancel) never becomes a click.
    fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerCancel(target, { pointerId: 1, pointerType: 'touch' });
    fireEvent(target, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    fireEvent.mouseDown(target, { button: 2 });
    fireEvent.mouseUp(target, { button: 2 });
    fireEvent.contextMenu(target);
    expect(onCycle).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(onCycle).toHaveBeenCalledTimes(1);
    expect(onCycle).toHaveBeenCalledWith(h3(0, 0));
  });
});

/** A grid area as [rowStart, rowEnd, colStart, colEnd] (1-based lines, end exclusive). */
function areaOf(element: HTMLElement): [number, number, number, number] {
  const [rs, re] = element.style.gridRow.split('/').map((part) => Number(part.trim()));
  const [cs, ce] = element.style.gridColumn.split('/').map((part) => Number(part.trim()));
  return [rs!, re!, cs!, ce!];
}

describe('wide hit areas (§4)', () => {
  it('lays the board out as margin · dot · 30% 40% 30% … tracks', () => {
    renderHarness(createDailySession('2026-10-17'));
    expect(board().style.gridTemplateColumns).toBe(
      '3fr var(--lp-dot) repeat(5, 3fr 4fr 3fr var(--lp-dot)) 3fr',
    );
    expect(board().style.gridTemplateRows).toBe(board().style.gridTemplateColumns);
  });

  it('gives every edge its full length and three tracks across — the dot’s and 30% of a cell each side', () => {
    const W = 5;
    const grid = gridFor(W, W);
    renderHarness(createDailySession('2026-10-17'));
    for (let edge = 0; edge < grid.edgeCount; edge++) {
      const [rs, re, cs, ce] = areaOf(edgeButton(edge));
      const horizontal = edge < grid.firstVertical;
      // Across: three tracks, starting on a 30% track (4k + 1 is the track before dot k).
      const [acrossStart, acrossEnd] = horizontal ? [rs, re] : [cs, ce];
      expect(acrossEnd - acrossStart).toBe(3);
      expect((acrossStart - 1) % 4).toBe(0);
      // Along: exactly the cell's three tracks between its two dots.
      const [alongStart, alongEnd] = horizontal ? [cs, ce] : [rs, re];
      expect(alongEnd - alongStart).toBe(3);
      expect((alongStart - 3) % 4).toBe(0);
    }
  });

  it('leaves the middle 40% of every cell to no edge, so a tap on a number flips nothing', () => {
    const W = 5;
    renderHarness(createDailySession('2026-10-17'));
    const areas = within(board())
      .getAllByRole('button')
      .map((button) => areaOf(button));
    for (let r = 0; r < W; r++) {
      for (let c = 0; c < W; c++) {
        // The 4fr track of cell (r, c) is track 4r + 3 (0-based), grid line 4r + 4.
        const row = 4 * r + 4;
        const col = 4 * c + 4;
        const covering = areas.filter(
          ([rs, re, cs, ce]) => rs <= row && row < re && cs <= col && col < ce,
        );
        expect(covering).toEqual([]);
      }
    }
  });

  it('fills that middle with a pad of its own, so a touch there is not moved to a side', () => {
    // Chromium moves a tap that lands on nothing to the nearest button (touch
    // adjustment); the pad is the tap's own target instead (loop-puzzle.css).
    const W = 5;
    renderHarness(createDailySession('2026-10-17'));
    const pads = Array.from(board().querySelectorAll<HTMLElement>('.lp-pad'));
    expect(pads).toHaveLength(W * W);
    const centres = pads.map((pad) => areaOf(pad).join(',')).sort();
    const expected: string[] = [];
    for (let r = 0; r < W; r++) {
      for (let c = 0; c < W; c++)
        expected.push([4 * r + 4, 4 * r + 5, 4 * c + 4, 4 * c + 5].join(','));
    }
    expect(centres).toEqual(expected.sort());
    for (const pad of pads) {
      expect(pad.tagName).toBe('SPAN');
      expect(pad).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('makes no control of a number or a dot', () => {
    // Numbers are images for a screen reader and dots are hidden — neither is
    // a button. That they also stay out of the hit test (`pointer-events:
    // none`, so a number never covers its edges' inner bands) is a rule of
    // loop-puzzle.css, which jsdom does not apply: ui/contrast.test.ts pins it.
    renderHarness(createDailySession('2026-10-17'));
    const dots = board().querySelectorAll('.lp-dot');
    expect(dots).toHaveLength(36);
    for (const dot of dots) {
      expect(dot.tagName).toBe('SPAN');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    }
    for (const clue of board().querySelectorAll('.lp-clue')) {
      expect(clue.tagName).toBe('SPAN');
      expect(clue).toHaveAttribute('role', 'img');
    }
  });
});

describe('keyboard (§4)', () => {
  it('is one tab stop that the arrow keys walk, and Enter taps', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(new Array<Clue>(9).fill(null)));
    const stops = within(board())
      .getAllByRole('button')
      .filter((button) => button.tabIndex === 0);
    expect(stops).toHaveLength(1);

    await user.tab();
    expect(document.activeElement).toBe(edgeButton(h3(0, 0)));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(edgeButton(h3(0, 1)));
    await user.keyboard('{Enter}');
    expect(edgeButton(h3(0, 1))).toHaveAccessibleName(/row 1, column 2, line/);
    await user.keyboard(' ');
    expect(edgeButton(h3(0, 1))).toHaveAccessibleName(/row 1, column 2, crossed out/);
    // Down to the vertical edge at its left end, and back up.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(edgeButton(v3(0, 1)));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(edgeButton(h3(0, 1)));
    // The roving stop follows the focus.
    expect(edgeButton(h3(0, 1)).tabIndex).toBe(0);
    expect(edgeButton(h3(0, 0)).tabIndex).toBe(-1);
  });

  it('keeps its one tab stop when a smaller board follows a bigger one', () => {
    const props = { hint: null, onCycle: vi.fn(), onSet: vi.fn(), solved: false };
    const view = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={createDailySession('2026-10-17')} {...props} />
      </SettingsProvider>,
    );
    const last = gridFor(5, 5).edgeCount - 1;
    act(() => edgeButton(last).focus());
    expect(edgeButton(last).tabIndex).toBe(0);
    view.rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={handMade(new Array<Clue>(9).fill(null))} {...props} />
      </SettingsProvider>,
    );
    const stops = within(board())
      .getAllByRole('button')
      .filter((button) => button.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('writes a line, an × or nothing straight onto the focused edge with L / X / Delete', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(new Array<Clue>(9).fill(null)));
    act(() => edgeButton(v3(1, 1)).focus());
    await user.keyboard('x');
    expect(edgeButton(v3(1, 1))).toHaveClass('lp-edge-cross');
    await user.keyboard('l');
    expect(edgeButton(v3(1, 1))).toHaveClass('lp-edge-line');
    await user.keyboard('{Delete}');
    expect(edgeButton(v3(1, 1))).toHaveClass('lp-edge-empty');
  });

  it('never repeats a tap from a held key', () => {
    const onCycle = vi.fn();
    const onSet = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard
          session={handMade(new Array<Clue>(9).fill(null))}
          hint={null}
          onCycle={onCycle}
          onSet={onSet}
          solved={false}
        />
      </SettingsProvider>,
    );
    const target = edgeButton(h3(1, 1));
    // A repeated Enter is swallowed before the browser can click again.
    expect(fireEvent.keyDown(target, { key: 'Enter', repeat: true })).toBe(false);
    fireEvent.keyDown(target, { key: 'x', repeat: true });
    expect(onSet).not.toHaveBeenCalled();
    fireEvent.keyDown(target, { key: 'x' });
    expect(onSet).toHaveBeenCalledWith(h3(1, 1), CROSS);
    // With a modifier, the keys are not the board's (Ctrl+X, Ctrl+L).
    fireEvent.keyDown(target, { key: 'l', ctrlKey: true });
    expect(onSet).toHaveBeenCalledTimes(1);
  });

  it('moves along rows and between them, and stays put at the board’s edge', () => {
    const grid = gridFor(4, 4);
    const h = (r: number, c: number) => horizontalEdge(grid, r, c);
    const v = (r: number, c: number) => verticalEdge(grid, r, c);
    expect(edgeInDirection(grid, h(0, 0), 'ArrowLeft')).toBe(h(0, 0));
    expect(edgeInDirection(grid, h(0, 0), 'ArrowUp')).toBe(h(0, 0));
    expect(edgeInDirection(grid, h(0, 3), 'ArrowRight')).toBe(h(0, 3));
    expect(edgeInDirection(grid, h(4, 2), 'ArrowDown')).toBe(h(4, 2));
    expect(edgeInDirection(grid, v(1, 4), 'ArrowRight')).toBe(v(1, 4));
    expect(edgeInDirection(grid, v(1, 0), 'ArrowRight')).toBe(v(1, 1));
    expect(edgeInDirection(grid, h(2, 2), 'ArrowDown')).toBe(v(2, 2));
    expect(edgeInDirection(grid, v(2, 2), 'ArrowUp')).toBe(h(2, 2));
    // The rightmost vertical edge goes up to the last edge of the row above.
    expect(edgeInDirection(grid, v(1, 4), 'ArrowUp')).toBe(h(1, 3));
    expect(edgeInDirection(grid, h(0, 0), 'Enter')).toBeNull();
    // Every move lands on a real edge.
    for (let edge = 0; edge < grid.edgeCount; edge++) {
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
        const next = edgeInDirection(grid, edge, key)!;
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(grid.edgeCount);
      }
    }
  });
});

describe('what the board shows and says (§5, §13)', () => {
  const clues: Clue[] = [2, null, null, null, 1, null, null, null, 0];
  const center = 4;

  it('reads a number with its state, and marks met numbers by weight as well as colour', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(clues));
    const number = (n: number, place: string) =>
      screen.getByRole('img', { name: new RegExp(`^Number ${n}, ${place}`) });
    // A 0 is met from the start (§5): nothing touches it.
    expect(number(0, 'row 3, column 3')).toHaveAccessibleName('Number 0, row 3, column 3, met');
    expect(number(0, 'row 3, column 3')).toHaveClass('lp-clue-met');
    expect(number(1, 'row 2, column 2')).toHaveAccessibleName('Number 1, row 2, column 2');

    await user.click(edgeButton(h3(1, 1)));
    expect(number(1, 'row 2, column 2')).toHaveAccessibleName('Number 1, row 2, column 2, met');
    expect(number(1, 'row 2, column 2')).toHaveClass('lp-clue-met');

    await user.click(edgeButton(v3(1, 2)));
    const tooMany = number(1, 'row 2, column 2');
    expect(tooMany).toHaveAccessibleName('Number 1, row 2, column 2, too many lines');
    expect(tooMany).toHaveClass('lp-clue-conflict');
    expect(tooMany).not.toHaveClass('lp-clue-met');
  });

  it('says when a number can no longer be met because too many sides are crossed out', async () => {
    const user = userEvent.setup();
    renderHarness(handMade(clues));
    // Cell 0 shows a 2: cross out three of its sides.
    for (const edge of [h3(0, 0), v3(0, 0), v3(0, 1)]) {
      await user.click(edgeButton(edge));
      await user.click(edgeButton(edge));
    }
    expect(screen.getByRole('img', { name: /^Number 2/ })).toHaveAccessibleName(
      'Number 2, row 1, column 1, cannot be met',
    );
  });

  it('rings a dot with three lines and frames a closed loop beside other lines', () => {
    const marks = new Array<Mark>(grid3.edgeCount).fill(UNKNOWN);
    // A loop round cell 0, and a stray line in the far corner.
    for (const edge of [h3(0, 0), v3(0, 1), h3(1, 0), v3(0, 0), h3(3, 2)]) marks[edge] = LINE;
    renderHarness(handMade(new Array<Clue>(9).fill(null), marks));
    expect(edgeButton(h3(0, 0))).toHaveClass('lp-edge-conflict');
    expect(edgeButton(h3(0, 0))).toHaveAccessibleDescription('Breaks a rule');
    expect(edgeButton(h3(3, 2))).not.toHaveClass('lp-edge-conflict');

    cleanup();
    const branch = new Array<Mark>(grid3.edgeCount).fill(UNKNOWN);
    for (const edge of [v3(0, 1), h3(1, 0), h3(1, 1)]) branch[edge] = LINE;
    renderHarness(handMade(new Array<Clue>(9).fill(null), branch));
    expect(board().querySelectorAll('.lp-dot-conflict')).toHaveLength(1);
    expect(edgeButton(h3(1, 1))).toHaveAccessibleDescription('Breaks a rule');
  });

  it('marks the hint’s edge and where it was read, and changes nothing on the board (§6)', () => {
    const hint: Hint = {
      kind: 'step',
      step: { edge: h3(1, 1), mark: LINE, level: 1, anchor: { kind: 'cell', index: center } },
    };
    renderHarness(handMade(clues), hint);
    expect(edgeButton(h3(1, 1))).toHaveClass('lp-edge-hint');
    expect(edgeButton(h3(1, 1))).toHaveAccessibleDescription('Marked by the hint');
    expect(edgeButton(h3(1, 1))).toHaveClass('lp-edge-empty');
    expect(screen.getByRole('img', { name: /^Number 1/ })).toHaveClass('lp-clue-hint');
    expect(board().querySelectorAll('.lp-edge-hint')).toHaveLength(1);
  });

  it('hands the one tab stop to the hinted edge — the stop, never the focus (§13)', () => {
    const hint: Hint = { kind: 'wrong', edge: v3(1, 2), mark: LINE };
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const props = { onCycle: vi.fn(), onSet: vi.fn(), solved: false };
    const session = handMade(clues);
    const { rerender } = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={session} hint={null} {...props} />
      </SettingsProvider>,
    );
    expect(edgeButton(0)).toHaveAttribute('tabindex', '0');
    rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={session} hint={hint} {...props} />
      </SettingsProvider>,
    );
    expect(edgeButton(v3(1, 2))).toHaveAttribute('tabindex', '0');
    expect(board().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(outside).toHaveFocus();

    // A player already on the board keeps the stop where the focus is.
    rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={session} hint={null} {...props} />
      </SettingsProvider>,
    );
    act(() => edgeButton(h3(0, 0)).focus());
    rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard session={session} hint={hint} {...props} />
      </SettingsProvider>,
    );
    expect(edgeButton(h3(0, 0))).toHaveFocus();
    expect(edgeButton(h3(0, 0))).toHaveAttribute('tabindex', '0');
    outside.remove();
  });

  it('rings the dot a hint was read from', () => {
    const hint: Hint = {
      kind: 'step',
      step: { edge: h3(1, 1), mark: CROSS, level: 1, anchor: { kind: 'dot', index: 5 } },
    };
    renderHarness(handMade(clues), hint);
    expect(board().querySelectorAll('.lp-dot-hint')).toHaveLength(1);
  });

  it('washes the board once when it is solved', () => {
    const { rerender } = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard
          session={handMade(clues)}
          hint={null}
          onCycle={vi.fn()}
          onSet={vi.fn()}
          solved={false}
        />
      </SettingsProvider>,
    );
    expect(board()).not.toHaveClass('lp-board-solved');
    rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LoopPuzzleBoard
          session={handMade(clues)}
          hint={null}
          onCycle={vi.fn()}
          onSet={vi.fn()}
          solved
        />
      </SettingsProvider>,
    );
    expect(board()).toHaveClass('lp-board-solved');
  });
});
