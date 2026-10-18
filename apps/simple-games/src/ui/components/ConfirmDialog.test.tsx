/**
 * The keyboard half of the shell's confirmation (ConfirmDialog.tsx, through
 * ui/useDialogDismiss.ts): Escape is the Cancel button, the Escape that closed
 * the dialog never also reaches the game behind it, and the focus goes back to
 * the control that opened the dialog — only when it would otherwise be lost.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackResources } from '../../test/lifecycle';
import { useGameKeys } from '../useGameKeys';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

interface ScreenProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  /** Called once by each of the game's three Escape handlers below. */
  onGameEscape?: () => void;
  /**
   * What confirming leaves on the page: the board as it was, the board plus a
   * next step that takes the focus itself, or a different page altogether.
   */
  afterConfirm?: 'board' | 'next-step' | 'elsewhere';
}

/**
 * A game screen in miniature: a top-bar control that opens the dialog, the
 * board inerted while it is up (docs/ARCHITECTURE.md「モーダルの間、盤面は
 * inert」), and a game that answers Escape itself three ways — a `useGameKeys`
 * listener left attached the way 2048's `blocked` guard leaves it, a raw
 * window listener like the arcade boards', and a keydown handler on the
 * screen that the dialog's own buttons bubble into.
 */
function Screen({
  onCancel = vi.fn(),
  onConfirm = vi.fn(),
  onGameEscape = vi.fn(),
  afterConfirm = 'board',
}: ScreenProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useGameKeys((event) => {
    if (event.key !== 'Escape') return false;
    onGameEscape();
    return true;
  }, true);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onGameEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onGameEscape]);

  const board = (
    <div className="game-content" inert={open}>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
    </div>
  );
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') onGameEscape();
      }}
    >
      {confirmed && afterConfirm === 'elsewhere' ? null : board}
      {confirmed && afterConfirm === 'next-step' ? (
        <button type="button" autoFocus>
          Next
        </button>
      ) : null}
      <ConfirmDialog
        open={open}
        title="Leave?"
        cancelLabel="Cancel"
        confirmLabel="Leave"
        onCancel={() => {
          setOpen(false);
          onCancel();
        }}
        onConfirm={() => {
          setOpen(false);
          setConfirmed(true);
          onConfirm();
        }}
      />
    </div>
  );
}

describe('Escape on the confirmation', () => {
  it('is the Cancel button: it cancels once and never confirms', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Leave?"
        cancelLabel="Cancel"
        confirmLabel="Leave"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes the dialog the way Cancel does', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Screen onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is taken by the dialog first: none of the game’s own Escape handlers also fires', async () => {
    const user = userEvent.setup();
    const onGameEscape = vi.fn();
    render(<Screen onGameEscape={onGameEscape} />);
    // The three handlers are live — without the dialog, each answers once.
    screen.getByRole('button', { name: 'Open' }).focus();
    await user.keyboard('{Escape}');
    expect(onGameEscape).toHaveBeenCalledTimes(3);
    onGameEscape.mockClear();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onGameEscape).not.toHaveBeenCalled();

    // ...and the game has its Escape back once the dialog is gone.
    await user.keyboard('{Escape}');
    expect(onGameEscape).toHaveBeenCalledTimes(3);
  });

  it('leaves every other key to the dialog’s buttons', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<Screen onCancel={onCancel} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('releases its key listener when the dialog closes, and when it unmounts open', async () => {
    const props = {
      title: 'Leave?',
      cancelLabel: 'Cancel',
      confirmLabel: 'Leave',
      onConfirm: vi.fn(),
    };
    // Warm-up: React's own once-per-document listeners belong to the page, not the dialog.
    render(<ConfirmDialog open onCancel={vi.fn()} {...props} />).unmount();

    // jsdom answers autoFocus with a 0ms timer of its own (its Selection); let it land.
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const onCancel = vi.fn();
    const tracker = trackResources();
    try {
      const view = render(<ConfirmDialog open onCancel={onCancel} {...props} />);
      view.rerender(<ConfirmDialog open={false} onCancel={onCancel} {...props} />);
      await settle();
      tracker.assertReleased();

      view.rerender(<ConfirmDialog open onCancel={onCancel} {...props} />);
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('the focus when the confirmation closes', () => {
  it('starts on Cancel', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('goes back to the control that opened it on Escape, Cancel, the backdrop and confirm', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    const opener = screen.getByRole('button', { name: 'Open' });

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(screen.getByRole('alertdialog').parentElement!);
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('opened from the keyboard, Escape puts the keyboard back where it was', async () => {
    const user = userEvent.setup();
    render(<Screen />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('stays where the close put it on purpose', async () => {
    const user = userEvent.setup();
    render(<Screen afterConfirm="next-step" />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    // The opener is still there; the focus is not pulled back to it.
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
  });

  it('is not chased after an opener that has left the page', async () => {
    const user = userEvent.setup();
    render(<Screen afterConfirm="elsewhere" />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it('is left alone when nothing had it before the dialog opened', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Screen onCancel={onCancel} />);
    // A tap that opens the dialog without focusing anything (iOS WebView buttons).
    act(() => screen.getByRole('button', { name: 'Open' }).click());
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.body);
  });
});
