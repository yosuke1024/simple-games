import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { Controls } from './Controls';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mount() {
  const play = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
      <Controls enabled play={play} />
    </SettingsProvider>,
  );
  return { play, view };
}
it('holds a movement, stops on pointercancel, and leaves the next standalone click available', () => {
  vi.useFakeTimers();
  const { play } = mount();
  const down = screen.getByRole('button', { name: 'Move down' });
  fireEvent.pointerDown(down, { pointerId: 1, button: 0 });
  expect(play).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(360));
  expect(play).toHaveBeenCalledTimes(3);
  fireEvent.pointerCancel(down, { pointerId: 1 });
  act(() => vi.advanceTimersByTime(1000));
  expect(play).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
  fireEvent.click(down, { detail: 1 });
  expect(play).toHaveBeenCalledTimes(4);
});
it('spends the pointer click once and keeps keyboard activation', () => {
  const { play } = mount();
  const rotate = screen.getByRole('button', { name: 'Rotate' });
  fireEvent.pointerDown(rotate, { pointerId: 2, button: 0 });
  fireEvent.pointerUp(rotate, { pointerId: 2 });
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.click(rotate, { detail: 1 });
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.click(rotate, { detail: 0 });
  expect(play).toHaveBeenCalledTimes(2);
});
it('does not let a second finger release the first finger hold and clears it on unmount', () => {
  vi.useFakeTimers();
  const { play, view } = mount();
  const left = screen.getByRole('button', { name: 'Move left' });
  fireEvent.pointerDown(left, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(left, { pointerId: 2 });
  act(() => vi.advanceTimersByTime(260));
  expect(play).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
