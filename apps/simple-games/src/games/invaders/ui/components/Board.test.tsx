import '../../i18n';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession } from '../../game';
import { Board } from './Board';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('maps horizontal drag through SVG letterboxing and forgets a cancelled pointer', () => {
  const aim = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Board session={createSession()} onAim={aim} />
    </SettingsProvider>,
  );
  const board = view.getByRole('img');
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 410,
    bottom: 260,
    width: 400,
    height: 240,
    toJSON: () => ({}),
  });
  // A 360×480 board is painted at 180×240, centered with 110 px of side padding.
  fireEvent.pointerDown(board, { pointerId: 1, button: 0, clientX: 210 });
  expect(aim).toHaveBeenLastCalledWith(180);
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 255 });
  expect(aim).toHaveBeenLastCalledWith(270);
  fireEvent.pointerCancel(board, { pointerId: 1 });
  const calls = aim.mock.calls.length;
  fireEvent.pointerMove(board, { pointerId: 1, clientX: 290 });
  expect(aim).toHaveBeenCalledTimes(calls);
  fireEvent.pointerDown(board, { pointerId: 2, button: 0, clientX: 165 });
  expect(aim).toHaveBeenLastCalledWith(90);
});

function renderBoard(session = createSession()) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Board session={session} onAim={vi.fn()} />
    </SettingsProvider>,
  );
}

// The look is static texture drawn inside the SVG (docs/INVADERS_RULES.md §8, §11); jsdom
// computes no style, so these pin the structure the stylesheet hangs on, not how it paints.
it('draws the field as a tray: the floor, its inset and the rail sunk into it', () => {
  const { container } = renderBoard();
  const order = [...container.querySelectorAll('rect')].map((rect) => rect.getAttribute('class'));
  // The tray's thickness is the board box's frame (invaders.css), not a rect in the drawing.
  expect(order.slice(0, 3)).toEqual(['iv-field-bg', 'iv-field-inset', 'iv-track']);
  expect(container.querySelector('.iv-field-lift')).toBeNull();
  // The floor fills the viewBox down to its 2-unit edge, so the box's outline is the board's.
  const floor = container.querySelector('.iv-field-bg')!;
  expect(Number(floor.getAttribute('y')) + Number(floor.getAttribute('height'))).toBe(479);
  // The floor and its inset stay symmetric.
  const inset = container.querySelector('.iv-field-inset')!;
  const top = Number(inset.getAttribute('y')) - Number(floor.getAttribute('y'));
  const bottom =
    Number(floor.getAttribute('y')) +
    Number(floor.getAttribute('height')) -
    (Number(inset.getAttribute('y')) + Number(inset.getAttribute('height')));
  expect(bottom).toBe(top);
  // The rail is the groove: the scale keeps only its ticks, and the defence line is unchanged.
  expect(container.querySelector('.iv-field-scale')!.getAttribute('d')).not.toContain('h328');
  expect(container.querySelector('.iv-defense-line')!.getAttribute('d')).toBe('M16 412h328');
});

it('stands every invader on a shadow of its own silhouette, under the body', () => {
  const { container } = renderBoard();
  const invaders = container.querySelectorAll('.iv-enemy');
  expect(invaders).toHaveLength(28);
  for (const invader of invaders) {
    const [shade, body] = invader.querySelectorAll('path');
    expect(shade!.getAttribute('class')).toBe('iv-shade');
    expect(body!.getAttribute('class')).toBe('iv-body');
    expect(shade!.getAttribute('d')).toBe(body!.getAttribute('d'));
    expect(shade!.getAttribute('transform')).toBe('translate(0 1.4)');
    // The group's own transform is what the engine moves; the shadow adds none of its own motion.
    expect(body!.hasAttribute('transform')).toBe(false);
  }
});

it('lights a whole bunker block top and foot and takes both off once it is hit', () => {
  const session = createSession();
  const hit = {
    ...session,
    covers: session.covers.map((brick, index) => (index === 0 ? { ...brick, hp: 1 } : brick)),
  };
  const { container } = renderBoard(hit);
  const blocks = [...container.querySelectorAll('.iv-cover')];
  expect(blocks).toHaveLength(15);
  const [damaged, ...whole] = blocks;
  expect(damaged!.getAttribute('class')).toContain('iv-cover-1');
  // A damaged block keeps its crack, the form that says it is damaged without colour (§4).
  expect(damaged!.querySelectorAll('path')).toHaveLength(1);
  expect(damaged!.querySelector('.iv-cover-hi, .iv-cover-lo')).toBeNull();
  for (const block of whole) {
    expect(block.querySelectorAll('.iv-cover-hi')).toHaveLength(1);
    expect(block.querySelectorAll('.iv-cover-lo')).toHaveLength(1);
  }
});
