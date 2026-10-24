/**
 * The direction buttons (docs/SNAKE_RULES.md §13「操作」): a press enters its
 * direction on the press itself, the click that press leaves behind is spent
 * rather than entered a second time, and a click with no press before it — a
 * keyboard's Enter or Space, a screen reader's activation — still enters it
 * (docs/ARCHITECTURE.md「押下の記録は誰のものか」: the mark is only honoured
 * for `event.detail > 0`).
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { Direction, RunStatus } from '../../game';
import { SnakePad } from './SnakePad';

afterEach(cleanup);

function mount(status: RunStatus = 'running', direction: Direction = 'right') {
  const onSteer = vi.fn();
  const onToggle = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SnakePad status={status} direction={direction} onSteer={onSteer} onToggle={onToggle} />
    </SettingsProvider>,
  );
  return { onSteer, onToggle };
}

describe('a direction button (§13)', () => {
  it('enters its direction on the press, and spends the click the press leaves behind', () => {
    const { onSteer } = mount();
    const up = screen.getByRole('button', { name: 'Up' });
    fireEvent.pointerDown(up, { pointerId: 1, button: 0 });
    expect(onSteer).toHaveBeenCalledTimes(1);
    expect(onSteer).toHaveBeenLastCalledWith('up');
    fireEvent.click(up, { detail: 1 });
    expect(onSteer).toHaveBeenCalledTimes(1);
  });

  it('enters a click that no press armed — keyboard and assistive activation', () => {
    const { onSteer } = mount();
    const left = screen.getByRole('button', { name: 'Left' });
    fireEvent.click(left, { detail: 0 });
    expect(onSteer).toHaveBeenCalledTimes(1);
    expect(onSteer).toHaveBeenLastCalledWith('left');
    // Even a click that reports a pointer, when no press of this button armed it.
    fireEvent.click(left, { detail: 1 });
    expect(onSteer).toHaveBeenCalledTimes(2);
  });

  it('after a cancelled press, nothing stays armed to swallow the next activation', () => {
    const { onSteer } = mount();
    const down = screen.getByRole('button', { name: 'Down' });
    fireEvent.pointerDown(down, { pointerId: 4, button: 0 });
    fireEvent.pointerCancel(down, { pointerId: 4 });
    expect(onSteer).toHaveBeenCalledTimes(1);
    fireEvent.click(down, { detail: 1 });
    expect(onSteer).toHaveBeenCalledTimes(2);
  });

  it('ignores a right or middle mouse press', () => {
    const { onSteer } = mount();
    const right = screen.getByRole('button', { name: 'Right' });
    fireEvent.pointerDown(right, { pointerId: 1, pointerType: 'mouse', button: 2 });
    expect(onSteer).not.toHaveBeenCalled();
  });

  it('does not take focus from a mouse press, so Space stays the pause key', () => {
    mount();
    const up = screen.getByRole('button', { name: 'Up' });
    const pressed = fireEvent.mouseDown(up);
    // A cancelled mousedown is what keeps the focus where it was.
    expect(pressed).toBe(false);
  });
});

describe('straight back while waiting (§5, §13)', () => {
  it('is marked as doing nothing — by outline and aria-disabled — only while ready or paused', () => {
    mount('paused', 'up');
    const down = screen.getByRole('button', { name: 'Down' });
    expect(down).toHaveAttribute('aria-disabled', 'true');
    expect(down).toHaveClass('sn-pad-off');
    for (const name of ['Up', 'Left', 'Right']) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled');
    }
    cleanup();
    mount('running', 'up');
    expect(screen.getByRole('button', { name: 'Down' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('the middle button (§6)', () => {
  it('is Start, Pause or Resume as the run needs, and off once it is over', () => {
    const { onToggle } = mount('ready');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    cleanup();
    mount('running');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    cleanup();
    mount('paused');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    cleanup();
    mount('over');
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
