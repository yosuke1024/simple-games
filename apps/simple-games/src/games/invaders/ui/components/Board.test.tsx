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
