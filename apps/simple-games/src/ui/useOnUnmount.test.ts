import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useOnUnmount } from './useOnUnmount';

afterEach(cleanup);

describe('useOnUnmount', () => {
  it('runs once, on unmount, and not before', () => {
    const fn = vi.fn();
    const { rerender, unmount } = renderHook(() => useOnUnmount(fn));
    rerender();
    rerender();
    expect(fn).not.toHaveBeenCalled();

    unmount();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // The whole reason it is not `useEffect(() => fn, [fn])`: a sync whose
  // identity changes while the game is on screen must not run on that change.
  it('runs the latest function, and never one it was handed earlier', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useOnUnmount(fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: latest });
    expect(first).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();

    unmount();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
