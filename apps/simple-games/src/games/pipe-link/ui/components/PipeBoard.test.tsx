/**
 * The board's input contract (docs/PIPE_LINK_RULES.md §3): a tap turns
 * clockwise; a single right click, a pen's barrel and macOS's Ctrl+click turn
 * counter-clockwise, and the click that may follow is spent; the browser's
 * menu never opens over the board; a long press by touch or a pen's tip does
 * nothing, not even through the click after it; `pointercancel` releases
 * what a press armed. And the keyboard: arrows walk, Enter / Space turn
 * clockwise, Shift+Enter counter-clockwise, never on a key's repeat.
 *
 * The board is driven directly with a hand-made 3×3 (the Quick Rules'
 * finished board), so each test knows every tile's place.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createBoard, litSet, type Hint, type TileType } from '../../game';
import { LONG_PRESS_MS, PipeBoard } from './PipeBoard';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const TYPES: TileType[] = ['end', 'tee', 'end', 'end', 'tee', 'elbow', 'elbow', 'elbow', 'end'];
const BOARD = createBoard(3, 3, TYPES, 4);
const ANSWER = [1, 1, 3, 2, 0, 2, 0, 3, 0];
/** The answer with the last tile facing away: it alone is unlit. */
const ONE_OFF = [1, 1, 3, 2, 0, 2, 0, 3, 3];

function renderBoard(
  orientations: readonly number[] = ONE_OFF,
  hint: Hint | null = null,
): { onTurn: ReturnType<typeof vi.fn> } {
  const onTurn = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PipeBoard
        board={BOARD}
        orientations={orientations}
        lit={litSet(BOARD, orientations)}
        hint={hint}
        solved={false}
        spin={null}
        onTurn={onTurn}
      />
    </SettingsProvider>,
  );
  return { onTurn };
}

const group = () => screen.getByRole('group', { name: 'Pipe Link board, 3 by 3' });
const tiles = () => within(group()).getAllByRole('button');
const tile = (cell: number) => tiles()[cell]!;

/** Raises the context menu and insists it was cancelled — the browser's menu never opens. */
function contextMenu(target: Element, init: Record<string, unknown> = {}) {
  expect(fireEvent.contextMenu(target, init)).toBe(false);
}

describe('what a tile says (§10)', () => {
  it('names its place, its pipes and whether it is lit; the source says so', () => {
    renderBoard();
    expect(tile(0)).toHaveAccessibleName('Row 1, column 1: end, open right, lit');
    expect(tile(4)).toHaveAccessibleName('Row 2, column 2, the source: T, up, right and down, lit');
    expect(tile(8)).toHaveAccessibleName('Row 3, column 3: end, open left, not lit');
  });

  it('adds the hint and the way it should face, and draws the faint figure', () => {
    renderBoard(ONE_OFF, { cell: 8, orientation: 0, kind: 'technique' });
    expect(tile(8)).toHaveAccessibleName(
      'Row 3, column 3: end, open left, not lit. Hint: turn it to end, open up',
    );
    expect(tile(8).querySelector('.pn-ghost')).not.toBeNull();
    expect(tile(7).querySelector('.pn-ghost')).toBeNull();
  });

  it('draws lit and unlit as different shapes, not colour alone', () => {
    renderBoard();
    expect(tile(0).querySelector('.pn-pipes-lit')).not.toBeNull();
    expect(tile(8).querySelector('.pn-pipes-lit')).toBeNull();
    expect(tile(4).querySelector('.pn-source')).not.toBeNull();
  });
});

describe('the pointer (§3)', () => {
  it('turns clockwise on a tap', () => {
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(2), { button: 0, buttons: 1, pointerType: 'touch' });
    fireEvent.pointerUp(tile(2), { button: 0, pointerType: 'touch' });
    fireEvent.click(tile(2), { detail: 1 });
    expect(onTurn.mock.calls).toEqual([[2, 'cw']]);
  });

  it('turns counter-clockwise on a single right click, once', () => {
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(5), { button: 2, buttons: 2, pointerType: 'mouse' });
    contextMenu(tile(5), { button: 2 });
    fireEvent.pointerUp(tile(5), { button: 2, pointerType: 'mouse' });
    expect(onTurn.mock.calls).toEqual([[5, 'ccw']]);
  });

  it('takes macOS’s Ctrl+click as one counter-clockwise turn and spends its click', () => {
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(6), { button: 0, buttons: 1, pointerType: 'mouse', ctrlKey: true });
    contextMenu(tile(6), { button: 0, ctrlKey: true });
    fireEvent.pointerUp(tile(6), { button: 0, pointerType: 'mouse', ctrlKey: true });
    fireEvent.click(tile(6), { detail: 1, ctrlKey: true });
    expect(onTurn.mock.calls).toEqual([[6, 'ccw']]);
    // The keyboard's own activation (detail 0) is never the click a mark was
    // left for: Enter right after still turns the tile.
    fireEvent.click(tile(6), { detail: 0 });
    expect(onTurn.mock.calls).toEqual([
      [6, 'ccw'],
      [6, 'cw'],
    ]);
  });

  it("takes a pen's barrel for the right button, however it arrives", () => {
    const { onTurn } = renderBoard();
    // Pressed while hovering: the barrel is the button that changed.
    fireEvent.pointerDown(tile(1), { button: 2, buttons: 2, pointerType: 'pen' });
    contextMenu(tile(1), { button: 2 });
    fireEvent.pointerUp(tile(1), { button: 2, pointerType: 'pen' });
    // Held as the tip comes down: only `buttons` says so; the tip's click is spent.
    fireEvent.pointerDown(tile(3), { button: 0, buttons: 3, pointerType: 'pen' });
    contextMenu(tile(3), { button: 0 });
    fireEvent.pointerUp(tile(3), { button: 0, pointerType: 'pen' });
    fireEvent.click(tile(3), { detail: 1 });
    expect(onTurn.mock.calls).toEqual([
      [1, 'ccw'],
      [3, 'ccw'],
    ]);
  });

  it('keeps the browser menu off the whole board, the gaps between tiles included', () => {
    const { onTurn } = renderBoard();
    contextMenu(group(), { button: 2 });
    expect(onTurn).not.toHaveBeenCalled();
    // Outside the board, the page's own menu is left alone.
    expect(fireEvent.contextMenu(document.body, { button: 2 })).toBe(true);
  });

  it('does nothing on a long press by touch — not even through the click after it', () => {
    vi.useFakeTimers();
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(7), { button: 0, buttons: 1, pointerType: 'touch', pointerId: 1 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    // The menu a long press raises is not the right button.
    contextMenu(tile(7), { button: 0 });
    fireEvent.pointerUp(tile(7), { button: 0, pointerType: 'touch', pointerId: 1 });
    fireEvent.click(tile(7), { detail: 1 });
    expect(onTurn).not.toHaveBeenCalled();
    // The next tap is a tap again.
    fireEvent.pointerDown(tile(7), { button: 0, buttons: 1, pointerType: 'touch', pointerId: 2 });
    fireEvent.pointerUp(tile(7), { button: 0, pointerType: 'touch', pointerId: 2 });
    fireEvent.click(tile(7), { detail: 1 });
    expect(onTurn.mock.calls).toEqual([[7, 'cw']]);
  });

  it("does the same for a pen's tip held long", () => {
    vi.useFakeTimers();
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(0), { button: 0, buttons: 1, pointerType: 'pen', pointerId: 1 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    contextMenu(tile(0), { button: 0 });
    fireEvent.pointerUp(tile(0), { button: 0, pointerType: 'pen', pointerId: 1 });
    fireEvent.click(tile(0), { detail: 1 });
    expect(onTurn).not.toHaveBeenCalled();
  });

  it('turns on a touch released short of the long press', () => {
    vi.useFakeTimers();
    const { onTurn } = renderBoard();
    fireEvent.pointerDown(tile(4), { button: 0, buttons: 1, pointerType: 'touch', pointerId: 1 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 100));
    fireEvent.pointerUp(tile(4), { button: 0, pointerType: 'touch', pointerId: 1 });
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(tile(4), { detail: 1 });
    expect(onTurn.mock.calls).toEqual([[4, 'cw']]);
  });

  it('lets a cancelled press arm nothing: no timer fires, and no mark swallows a click', () => {
    vi.useFakeTimers();
    const { onTurn } = renderBoard();
    // Cancelled before the threshold: the long press never lands.
    fireEvent.pointerDown(tile(5), { button: 0, buttons: 1, pointerType: 'touch', pointerId: 1 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerCancel(tile(5), { pointerId: 1 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.click(tile(5), { detail: 1 });
    // Cancelled after it: the mark it left goes with the press.
    fireEvent.pointerDown(tile(5), { button: 0, buttons: 1, pointerType: 'touch', pointerId: 2 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerCancel(tile(5), { pointerId: 2 });
    fireEvent.click(tile(5), { detail: 1 });
    expect(onTurn.mock.calls).toEqual([
      [5, 'cw'],
      [5, 'cw'],
    ]);
  });
});

describe('the keyboard (§3)', () => {
  it('is one tab stop, and the arrows walk the tiles without wrapping', () => {
    renderBoard();
    const focusable = tiles().filter((button) => button.tabIndex === 0);
    // The board starts on the source.
    expect(focusable).toEqual([tile(4)]);
    act(() => tile(4).focus());
    fireEvent.keyDown(tile(4), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(tile(1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(1));
    fireEvent.keyDown(tile(1), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tile(0));
    fireEvent.keyDown(tile(0), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tile(0));
    expect(tile(0).tabIndex).toBe(0);
    expect(tile(4).tabIndex).toBe(-1);
  });

  it('turns clockwise on Enter and Space, counter-clockwise on Shift+Enter, never on a repeat', () => {
    const { onTurn } = renderBoard();
    fireEvent.keyDown(tile(2), { key: 'Enter' });
    fireEvent.keyDown(tile(2), { key: 'Enter', repeat: true });
    fireEvent.keyDown(tile(2), { key: ' ' });
    fireEvent.keyUp(tile(2), { key: ' ' });
    fireEvent.keyDown(tile(2), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(tile(2), { key: 'Enter', shiftKey: true, repeat: true });
    expect(onTurn.mock.calls).toEqual([
      [2, 'cw'],
      [2, 'cw'],
      [2, 'ccw'],
    ]);
  });

  it('takes the keys it acts on away from the button’s own click', () => {
    renderBoard();
    expect(fireEvent.keyDown(tile(2), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(tile(2), { key: ' ' })).toBe(false);
    expect(fireEvent.keyUp(tile(2), { key: ' ' })).toBe(false);
    // Ctrl+Z is the screen's, not the board's.
    expect(fireEvent.keyDown(tile(2), { key: 'z', ctrlKey: true })).toBe(true);
  });
});

describe('the drawing (§10)', () => {
  it('keeps each tile’s angle cumulative: on round past 270°, never back to 0°', () => {
    const onTurn = vi.fn();
    const view = (orientations: readonly number[], cell: number | null) => (
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <PipeBoard
          board={BOARD}
          orientations={orientations}
          lit={litSet(BOARD, orientations)}
          hint={null}
          solved={false}
          spin={cell === null ? null : { cell, direction: 'cw' }}
          onTurn={onTurn}
        />
      </SettingsProvider>
    );
    const { rerender } = render(view(ONE_OFF, null));
    const angle = () => (tile(8).querySelector('.pn-pipes') as SVGElement).style.transform;
    expect(angle()).toBe('rotate(270deg)');
    rerender(view(ANSWER, 8));
    expect(angle()).toBe('rotate(360deg)');
    // Counter-clockwise back: the drawing goes back the way it came.
    rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <PipeBoard
          board={BOARD}
          orientations={ONE_OFF}
          lit={litSet(BOARD, ONE_OFF)}
          hint={null}
          solved={false}
          spin={{ cell: 8, direction: 'ccw' }}
          onTurn={onTurn}
        />
      </SettingsProvider>,
    );
    expect(angle()).toBe('rotate(270deg)');
  });
});
