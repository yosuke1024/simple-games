import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { isEditableTarget, isUndoKey, useGameKeys } from './useGameKeys';

// This suite leans on window-level listeners, so hooks from one test must
// not survive into the next (RTL auto-cleanup is off without test globals).
afterEach(cleanup);

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe('useGameKeys', () => {
  it('offers keys to the handler and suppresses the default only when handled', () => {
    const handler = vi.fn((event: KeyboardEvent) => event.key === 'a');
    renderHook(() => useGameKeys(handler));

    const handled = press('a');
    const passed = press('b');

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handled.defaultPrevented).toBe(true);
    expect(passed.defaultPrevented).toBe(false);
  });

  it('never offers keys typed into a real input', () => {
    const handler = vi.fn(() => true);
    renderHook(() => useGameKeys(handler));

    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });
    input.dispatchEvent(event);
    input.remove();

    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('detaches while disabled and re-attaches when enabled again', () => {
    const handler = vi.fn(() => true);
    const { rerender } = renderHook(({ enabled }) => useGameKeys(handler, enabled), {
      initialProps: { enabled: false },
    });

    press('a');
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });
    press('a');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unmount', () => {
    const handler = vi.fn(() => true);
    const { unmount } = renderHook(() => useGameKeys(handler));
    unmount();

    press('a');
    expect(handler).not.toHaveBeenCalled();
  });

  it('reads the latest handler without re-registering', () => {
    const first = vi.fn(() => false);
    const second = vi.fn(() => false);
    const { rerender } = renderHook(({ handler }) => useGameKeys(handler), {
      initialProps: { handler: first },
    });

    rerender({ handler: second });
    press('a');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('leaves keys another layer already answered alone', () => {
    const handler = vi.fn(() => true);
    renderHook(() => useGameKeys(handler));

    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('isUndoKey', () => {
  const base = { cancelable: true } as const;

  it('accepts Ctrl+Z and Cmd+Z, upper or lower', () => {
    expect(isUndoKey(new KeyboardEvent('keydown', { ...base, key: 'z', ctrlKey: true }))).toBe(
      true,
    );
    expect(isUndoKey(new KeyboardEvent('keydown', { ...base, key: 'Z', metaKey: true }))).toBe(
      true,
    );
  });

  it('rejects plain z, redo chords, and alt chords', () => {
    expect(isUndoKey(new KeyboardEvent('keydown', { ...base, key: 'z' }))).toBe(false);
    expect(
      isUndoKey(new KeyboardEvent('keydown', { ...base, key: 'z', ctrlKey: true, shiftKey: true })),
    ).toBe(false);
    expect(
      isUndoKey(new KeyboardEvent('keydown', { ...base, key: 'z', metaKey: true, altKey: true })),
    ).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it('recognizes form fields and contenteditable, not buttons', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);

    const div = document.createElement('div');
    // jsdom does not compute isContentEditable from the attribute alone.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isEditableTarget(div)).toBe(true);
  });
});
