/**
 * The board on its own (docs/PEG_SOLITAIRE_RULES.md §4, §5, §13): what each
 * hole says to a screen reader, how the picked-up peg and its landings are
 * drawn (by shape, never colour alone), where the keyboard focus goes, and
 * what a press, a drag, a cancel and the click a gesture leaves behind each
 * do. The rules are not asked here — the screen passes the landings in, as
 * GameScreen does — so these cases pin the board's own half of the contract.
 */
import '../../i18n';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  applyMove,
  createSession,
  ENGLISH,
  ENGLISH_PROBLEM,
  findProblem,
  holeIndex,
  jumpBetween,
  jumpsFrom,
  TRIANGLE,
  type PegSolitaireSession,
} from '../../game';
import { PegBoard, type PegBoardProps } from './PegBoard';

afterEach(cleanup);

/** One pitch of the pretend layout below, in CSS pixels. */
const PITCH = 50;

function renderBoard(overrides: Partial<PegBoardProps> & { session: PegSolitaireSession }) {
  const props: PegBoardProps = {
    selected: null,
    landings: [],
    arriving: null,
    onHoleTap: vi.fn(),
    onDragStart: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  };
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <PegBoard {...props} />
    </SettingsProvider>,
  );
  const rerender = (next: Partial<PegBoardProps>) =>
    view.rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <PegBoard {...props} {...next} />
      </SettingsProvider>,
    );
  return { props, rerender };
}

const board = () => screen.getByRole('group', { name: /board, \d+ holes$/ });
const hole = (index: number) => board().querySelector<HTMLButtonElement>(`[data-hole="${index}"]`)!;

/**
 * jsdom lays nothing out, so a drag is measured against a rectangle handed
 * to the board by force: the cross's 7×7 pitches at PITCH px each.
 */
function giveBoardALayout(width: number, height: number) {
  vi.spyOn(board(), 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: width * PITCH,
    height: height * PITCH,
    right: width * PITCH,
    bottom: height * PITCH,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/** The middle of a cross hole, in the pretend layout's pixels. */
const crossPoint = (row: number, col: number) => ({
  clientX: (col + 0.5) * PITCH,
  clientY: (row + 0.5) * PITCH,
});

const OPENING = createSession(ENGLISH_PROBLEM);
const D2 = holeIndex(ENGLISH, 1, 3);
const D3 = holeIndex(ENGLISH, 2, 3);
const D4 = holeIndex(ENGLISH, 3, 3);

describe('what the board says (§13)', () => {
  it('names every hole of the cross by row, column and what is in it — and draws no text', () => {
    renderBoard({ session: OPENING });
    expect(board()).toHaveAccessibleName('English board, 33 holes');
    expect(within(board()).getAllByRole('button')).toHaveLength(33);
    expect(within(board()).getAllByRole('button', { name: /: peg$/ })).toHaveLength(32);
    expect(hole(D4)).toHaveAccessibleName('Row 4, column 4: empty ringed hole');
    expect(hole(D2)).toHaveAccessibleName('Row 2, column 4: peg');
    expect(board().textContent).toBe('');
  });

  it('names the triangle’s holes by row and place in the row', () => {
    const problem = findProblem('triangle', 4, 12)!;
    renderBoard({ session: createSession(problem) });
    expect(board()).toHaveAccessibleName('Triangle board, 15 holes');
    expect(within(board()).getAllByRole('button')).toHaveLength(15);
    expect(hole(0)).toHaveAccessibleName('Row 1, hole 1: peg');
    expect(hole(4)).toHaveAccessibleName('Row 3, hole 2: empty');
    expect(hole(12)).toHaveAccessibleName('Row 5, hole 3: peg in the ringed hole');
  });

  it('shows the picked-up peg and where it can land by shape and state, not colour alone', () => {
    renderBoard({ session: OPENING, selected: D2, landings: [D4] });
    expect(hole(D2)).toHaveAttribute('aria-pressed', 'true');
    expect(hole(D2)).toHaveClass('pg-hole-selected');
    expect(hole(D4).querySelector('.pg-dot')).not.toBeNull();
    expect(hole(D4)).toHaveAccessibleName(
      'Row 4, column 4: empty ringed hole, a jump can land here',
    );
    expect(board().querySelectorAll('.pg-dot')).toHaveLength(1);
    // Every other peg is a toggle that is off; an empty hole is not a toggle.
    expect(within(board()).getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(hole(D3)).toHaveAttribute('aria-pressed', 'false');
    expect(hole(D4)).not.toHaveAttribute('aria-pressed');
    // The target keeps its ring with a peg in it as well as without.
    expect(hole(D4).querySelector('.pg-ring')).not.toBeNull();
    expect(board().querySelectorAll('.pg-ring')).toHaveLength(1);
  });

  it('slides the jumper in and fades the jumped peg only for the jump that made this board', () => {
    const after = applyMove(OPENING, D2, D4)!;
    const jump = jumpBetween(ENGLISH, D2, D4)!;
    const { rerender } = renderBoard({ session: after, arriving: { jump, key: 1 } });
    const arriving = hole(D4).querySelector<HTMLElement>('.pg-peg-arrive');
    expect(arriving).not.toBeNull();
    // Two pitches up, in the peg layer's own percentages.
    expect(arriving!.style.getPropertyValue('--pg-dy')).toBe('-200%');
    expect(arriving!.style.getPropertyValue('--pg-dx')).toBe('0%');
    expect(hole(D3).querySelector('.pg-peg-vanish')).not.toBeNull();
    // Only the landing hole is lifted, so the slide is drawn over the holes
    // it crosses whichever way it goes.
    expect(board().querySelectorAll('.pg-hole-arriving')).toHaveLength(1);
    expect(hole(D4)).toHaveClass('pg-hole-arriving');

    // A board the jump did not make (an Undo, a new game) shows nothing moving.
    rerender({ session: OPENING, arriving: { jump, key: 1 } });
    expect(board().querySelector('.pg-peg-arrive')).toBeNull();
    expect(board().querySelector('.pg-peg-vanish')).toBeNull();
    expect(board().querySelector('.pg-hole-arriving')).toBeNull();
  });

  it('draws an upward or leftward slide over the holes it crosses, not under them', () => {
    // The holes are absolutely placed siblings, so without a z-index they
    // stack in DOM order and a peg arriving from a later hole (d6 → d4,
    // f4 → d4) would be drawn under the pit and the fading peg between.
    // Lifting the landing hole is the stylesheet's half of that; jsdom
    // paints nothing, so the rule itself is read.
    const css = readFileSync(resolve('src/games/peg-solitaire/ui/peg-solitaire.css'), 'utf8');
    const zIndexOf = (selector: string) => {
      const at = css.indexOf(`\n${selector} {`);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      const body = css.slice(at, css.indexOf('}', at));
      return Number(/z-index:\s*(\d+)/.exec(body)?.[1] ?? 0);
    };
    expect(zIndexOf('.pg-hole')).toBe(0);
    expect(zIndexOf('.pg-hole-arriving')).toBeGreaterThan(0);
    // Still below the peg in the hand.
    expect(zIndexOf('.pg-float')).toBeGreaterThan(zIndexOf('.pg-hole-arriving'));

    // d6 → d4: the jumper comes from a later hole in DOM order.
    const D5 = holeIndex(ENGLISH, 4, 3);
    const D6 = holeIndex(ENGLISH, 5, 3);
    const upward = jumpBetween(ENGLISH, D6, D4)!;
    renderBoard({ session: applyMove(OPENING, D6, D4)!, arriving: { jump: upward, key: 2 } });
    expect(Number(hole(D6).dataset.hole)).toBeGreaterThan(Number(hole(D4).dataset.hole));
    expect(hole(D4)).toHaveClass('pg-hole-arriving');
    const arriving = hole(D4).querySelector<HTMLElement>('.pg-peg-arrive');
    expect(arriving!.style.getPropertyValue('--pg-dy')).toBe('200%');
    expect(hole(D5).querySelector('.pg-peg-vanish')).not.toBeNull();
  });
});

describe('the keyboard (§4)', () => {
  it('is one tab stop, and the arrows move it from hole to hole', () => {
    renderBoard({ session: OPENING });
    const stops = () => board().querySelectorAll('[tabindex="0"]');
    expect(stops()).toHaveLength(1);
    // The focus starts on the ringed hole.
    expect(stops()[0]).toBe(hole(D4));

    act(() => hole(D4).focus());
    fireEvent.keyDown(hole(D4), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(hole(D3));
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(hole(D3));

    fireEvent.keyDown(hole(D3), { key: 'ArrowUp' });
    fireEvent.keyDown(hole(D2), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(hole(holeIndex(ENGLISH, 1, 2)));
    // Into a cut corner: the focus stays.
    fireEvent.keyDown(hole(holeIndex(ENGLISH, 1, 2)), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(hole(holeIndex(ENGLISH, 1, 2)));
  });

  it('walks the triangle’s rows with ←/→ and between rows with ↑/↓', () => {
    renderBoard({ session: createSession(findProblem('triangle', 0, 0)!) });
    act(() => hole(0).focus());
    fireEvent.keyDown(hole(0), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(hole(holeIndex(TRIANGLE, 1, 0)));
    fireEvent.keyDown(hole(1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(hole(holeIndex(TRIANGLE, 1, 1)));
    fireEvent.keyDown(hole(2), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(hole(0));
  });

  it('leaves modified arrows to the browser, and presses once for a held Enter', () => {
    renderBoard({ session: OPENING });
    act(() => hole(D4).focus());
    expect(fireEvent.keyDown(hole(D4), { key: 'ArrowUp', ctrlKey: true })).toBe(true);
    expect(document.activeElement).toBe(hole(D4));
    // A repeat is swallowed (the default — a click — prevented).
    expect(fireEvent.keyDown(hole(D4), { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(hole(D4), { key: 'Enter' })).toBe(true);
  });

  it('follows the focus a click or Tab gives a hole', () => {
    renderBoard({ session: OPENING });
    act(() => hole(D2).focus());
    expect(hole(D2)).toHaveAttribute('tabindex', '0');
    expect(hole(D4)).toHaveAttribute('tabindex', '-1');
  });
});

describe('tap and drag (§4)', () => {
  it('hands a tap to the screen as a tap', () => {
    const { props } = renderBoard({ session: OPENING });
    fireEvent.click(hole(D2), { detail: 1 });
    expect(props.onHoleTap).toHaveBeenCalledWith(D2);
    // Enter / Space on a focused hole arrive as a click without a press.
    fireEvent.click(hole(D4), { detail: 0 });
    expect(props.onHoleTap).toHaveBeenLastCalledWith(D4);
  });

  it('carries a peg past 8px, drops it over a hole, and spends the click the release leaves', () => {
    const { props } = renderBoard({ session: OPENING });
    giveBoardALayout(7, 7);
    const peg = hole(D2);

    fireEvent.pointerDown(peg, { pointerId: 1, ...crossPoint(1, 3) });
    expect(props.onDragStart).not.toHaveBeenCalled();
    fireEvent.pointerMove(peg, { pointerId: 1, ...crossPoint(2.2, 3) });
    // Picked up the moment it moved, and drawn in the hand.
    expect(props.onDragStart).toHaveBeenCalledWith(D2);
    expect(board().querySelector('.pg-float')).not.toBeNull();
    expect(peg).toHaveClass('pg-hole-lifted');

    fireEvent.pointerMove(peg, { pointerId: 1, ...crossPoint(3, 3) });
    fireEvent.pointerUp(peg, { pointerId: 1, ...crossPoint(3, 3) });
    expect(props.onDrop).toHaveBeenCalledWith(D2, D4);
    expect(board().querySelector('.pg-float')).toBeNull();

    // The click the platform raises after the release is not a second tap.
    fireEvent.click(peg, { detail: 1 });
    expect(props.onHoleTap).not.toHaveBeenCalled();
    // The next tap is.
    fireEvent.pointerDown(peg, { pointerId: 2, ...crossPoint(1, 3) });
    fireEvent.pointerUp(peg, { pointerId: 2, ...crossPoint(1, 3) });
    fireEvent.click(peg, { detail: 1 });
    expect(props.onHoleTap).toHaveBeenCalledWith(D2);
  });

  it('treats a press that travels less than 8px as a tap', () => {
    const { props } = renderBoard({ session: OPENING });
    giveBoardALayout(7, 7);
    const peg = hole(D2);
    const start = crossPoint(1, 3);
    fireEvent.pointerDown(peg, { pointerId: 1, ...start });
    fireEvent.pointerMove(peg, {
      pointerId: 1,
      clientX: start.clientX + 5,
      clientY: start.clientY,
    });
    fireEvent.pointerUp(peg, { pointerId: 1, clientX: start.clientX + 5, clientY: start.clientY });
    expect(props.onDragStart).not.toHaveBeenCalled();
    expect(props.onDrop).not.toHaveBeenCalled();
    fireEvent.click(peg, { detail: 1 });
    expect(props.onHoleTap).toHaveBeenCalledWith(D2);
  });

  it('drops nothing between holes or off the board, and puts the peg back', () => {
    const { props } = renderBoard({ session: OPENING });
    giveBoardALayout(7, 7);
    const peg = hole(D2);
    fireEvent.pointerDown(peg, { pointerId: 1, ...crossPoint(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...crossPoint(1, 0) });
    // (1, 0) is a cut corner: no hole there.
    fireEvent.pointerUp(peg, { pointerId: 1, ...crossPoint(1, 0) });
    expect(props.onDrop).not.toHaveBeenCalled();
    expect(peg).not.toHaveClass('pg-hole-lifted');
  });

  it('treats pointercancel as a cancel: no drop, the peg back, the trailing click spent', () => {
    const { props } = renderBoard({ session: OPENING, landings: [D4] });
    giveBoardALayout(7, 7);
    const peg = hole(D2);
    fireEvent.pointerDown(peg, { pointerId: 1, ...crossPoint(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...crossPoint(3, 3) });
    expect(hole(D4)).toHaveClass('pg-hole-hover');

    // The notification shade comes down over the finger.
    fireEvent.pointerCancel(peg, { pointerId: 1, ...crossPoint(3, 3) });
    expect(props.onDrop).not.toHaveBeenCalled();
    expect(board().querySelector('.pg-float')).toBeNull();
    expect(hole(D4)).not.toHaveClass('pg-hole-hover');

    fireEvent.click(peg, { detail: 1 });
    expect(props.onHoleTap).not.toHaveBeenCalled();
    // And the tap path is alive afterwards.
    fireEvent.pointerDown(peg, { pointerId: 2, ...crossPoint(1, 3) });
    fireEvent.pointerUp(peg, { pointerId: 2, ...crossPoint(1, 3) });
    fireEvent.click(peg, { detail: 1 });
    expect(props.onHoleTap).toHaveBeenCalledWith(D2);
  });

  it('belongs to one finger: another pointer’s release drops nothing', () => {
    const { props } = renderBoard({ session: OPENING });
    giveBoardALayout(7, 7);
    const peg = hole(D2);
    fireEvent.pointerDown(peg, { pointerId: 1, ...crossPoint(1, 3) });
    fireEvent.pointerMove(peg, { pointerId: 1, ...crossPoint(3, 3) });
    fireEvent.pointerUp(peg, { pointerId: 7, ...crossPoint(3, 3) });
    expect(props.onDrop).not.toHaveBeenCalled();
    expect(board().querySelector('.pg-float')).not.toBeNull();
    fireEvent.pointerUp(peg, { pointerId: 1, ...crossPoint(3, 3) });
    expect(props.onDrop).toHaveBeenCalledWith(D2, D4);
  });

  it('picks up nothing from an empty hole, with a secondary button, or once the game is over', () => {
    const { props, rerender } = renderBoard({ session: OPENING });
    giveBoardALayout(7, 7);
    fireEvent.pointerDown(hole(D4), { pointerId: 1, ...crossPoint(3, 3) });
    fireEvent.pointerMove(hole(D4), { pointerId: 1, ...crossPoint(1, 3) });
    fireEvent.pointerDown(hole(D2), { pointerId: 2, button: 2, pointerType: 'mouse' });
    fireEvent.pointerMove(hole(D2), { pointerId: 2, ...crossPoint(3, 3) });
    expect(props.onDragStart).not.toHaveBeenCalled();

    const over = { ...OPENING, status: 'over' as const };
    rerender({ session: over });
    fireEvent.pointerDown(hole(D2), { pointerId: 3, ...crossPoint(1, 3) });
    fireEvent.pointerMove(hole(D2), { pointerId: 3, ...crossPoint(3, 3) });
    expect(props.onDragStart).not.toHaveBeenCalled();
  });

  it('carries a triangle peg along any of its lines to the hole under the finger', () => {
    const problem = findProblem('triangle', 4, 12)!;
    const session = createSession(problem);
    const { props } = renderBoard({ session });
    // 5 pitches wide; the rows √3⁄2 apart (ui/layout.ts).
    const row = Math.sqrt(3) / 2;
    giveBoardALayout(5, 4 * row + 1);
    const at = (r: number, c: number) => ({
      clientX: (c - r / 2 + 2.5) * PITCH,
      clientY: (r * row + 0.5) * PITCH,
    });
    const jump = jumpsFrom(TRIANGLE, session.pegs, holeIndex(TRIANGLE, 4, 1))[0]!;
    const from = TRIANGLE.holes[jump.from]!;
    const to = TRIANGLE.holes[jump.to]!;
    fireEvent.pointerDown(hole(jump.from), { pointerId: 1, ...at(from.row, from.col) });
    fireEvent.pointerMove(hole(jump.from), { pointerId: 1, ...at(to.row, to.col) });
    fireEvent.pointerUp(hole(jump.from), { pointerId: 1, ...at(to.row, to.col) });
    expect(props.onDrop).toHaveBeenCalledWith(jump.from, jump.to);
  });
});
