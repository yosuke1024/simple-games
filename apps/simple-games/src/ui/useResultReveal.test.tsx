import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { RESULT_REVEAL_MS, useResultReveal } from './useResultReveal';

function Probe({ open }: { open: boolean }) {
  const revealed = useResultReveal(open);
  return <output>{revealed ? 'shown' : 'waiting'}</output>;
}

function renderProbe(open: boolean, reducedMotion: boolean) {
  const settings = { ...settingsSchema.defaultValue(), reducedMotion };
  return render(
    <SettingsProvider initialSettings={settings}>
      <Probe open={open} />
    </SettingsProvider>,
  );
}

/** A window whose OS does not ask for reduced motion. */
function withMotion() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useResultReveal', () => {
  it('shows the card at once under Reduced Motion', () => {
    renderProbe(true, true);
    expect(screen.getByRole('status')).toHaveTextContent('shown');
  });

  it('shows the card at once when the OS cannot be asked (no matchMedia)', () => {
    renderProbe(true, false);
    expect(screen.getByRole('status')).toHaveTextContent('shown');
  });

  it('waits one beat, then shows, when motion is allowed', () => {
    vi.useFakeTimers();
    withMotion();
    renderProbe(true, false);
    expect(screen.getByRole('status')).toHaveTextContent('waiting');
    act(() => {
      vi.advanceTimersByTime(RESULT_REVEAL_MS - 1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('waiting');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('shown');
  });

  it('is false again as soon as the result is gone, and re-waits next time', () => {
    vi.useFakeTimers();
    withMotion();
    const { rerender } = renderProbe(true, false);
    act(() => {
      vi.advanceTimersByTime(RESULT_REVEAL_MS);
    });
    expect(screen.getByRole('status')).toHaveTextContent('shown');
    rerender(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion: false }}>
        <Probe open={false} />
      </SettingsProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('waiting');
    rerender(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion: false }}>
        <Probe open />
      </SettingsProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('waiting');
  });

  it('leaves no timer behind when unmounted mid-beat', () => {
    vi.useFakeTimers();
    withMotion();
    const { unmount } = renderProbe(true, false);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
