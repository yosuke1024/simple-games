import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { useMovePlayback } from './useMovePlayback';
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider initialSettings={settingsSchema.defaultValue()}>{children}</SettingsProvider>
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('skips playback when motion is reduced', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { result } = renderHook(() => useMovePlayback<number>(true), { wrapper });
  act(() => result.current.start(1, 1000));
  expect(result.current.playback).toBeNull();
  expect(result.current.busy.current).toBe(false);
});
it('cancels a running presentation and all of its resources on unmount', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const tracker = trackResources();
  try {
    const { result, unmount } = renderHook(() => useMovePlayback<{ move: number }>(true), {
      wrapper,
    });
    act(() => result.current.start({ move: 1 }, 1000));
    expect(result.current.playback?.move).toBe(1);
    unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
