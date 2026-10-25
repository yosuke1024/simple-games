import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useHardwareBackExit } from './useHardwareBackExit';

const { subscriptions } = vi.hoisted(() => ({
  subscriptions: [] as Array<{
    callback: () => void;
    complete: (handle: { remove: () => Promise<void> }) => void;
  }>,
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (_name: string, callback: () => void) =>
      new Promise<{ remove: () => Promise<void> }>((complete) => {
        subscriptions.push({ callback, complete });
      }),
  },
}));
function Surface({ active, onExit }: { active: boolean; onExit: () => void }) {
  useHardwareBackExit(onExit, active);
  return null;
}
afterEach(() => {
  cleanup();
  subscriptions.length = 0;
});
it('ignores a hidden surface immediately, even while native registration or removal is pending', async () => {
  const exit = vi.fn();
  const view = render(<Surface active onExit={exit} />);
  const first = subscriptions[0]!;
  first.callback();
  expect(exit).toHaveBeenCalledTimes(1);
  view.rerender(<Surface active={false} onExit={exit} />);
  first.callback();
  expect(exit).toHaveBeenCalledTimes(1);
  const removed = vi.fn(async () => {});
  await act(async () => {
    first.complete({ remove: removed });
  });
  expect(removed).toHaveBeenCalledTimes(1);
  view.rerender(<Surface active onExit={exit} />);
  first.callback();
  subscriptions[1]!.callback();
  expect(exit).toHaveBeenCalledTimes(2);
});
it('does not claim back-button ownership while initially hidden', () => {
  render(<Surface active={false} onExit={vi.fn()} />);
  expect(subscriptions).toHaveLength(0);
});
