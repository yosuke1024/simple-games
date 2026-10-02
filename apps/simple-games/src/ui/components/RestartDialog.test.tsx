/**
 * The question behind a game's ↻ (RestartDialog.tsx): the same board again,
 * the game's own fresh board when the mode has one, and a way out that keeps
 * the focus. The game decides whether the second option exists; this only
 * checks that the dialog says exactly what it was given, and nothing when it
 * was given nothing.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { RestartDialog, type RestartDialogProps } from './RestartDialog';

function renderDialog(props: Partial<RestartDialogProps> = {}) {
  const onRetry = vi.fn();
  const onClose = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <RestartDialog open onRetry={onRetry} onClose={onClose} {...props} />
    </SettingsProvider>,
  );
  return { onRetry, onClose };
}

afterEach(cleanup);

describe('the restart question behind ↻', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <RestartDialog open={false} onRetry={vi.fn()} onClose={vi.fn()} />
      </SettingsProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('asks about the same board only, when this mode has no other board to give', () => {
    renderDialog();
    expect(screen.getByRole('alertdialog', { name: 'Start over?' })).toBeInTheDocument();
    expect(screen.getByText('Your current game will be lost.')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Retry same board', 'Cancel']);
  });

  it("offers the game's fresh board under the game's own name, between retry and cancel", () => {
    renderDialog({ newBoard: { label: 'New deal', start: vi.fn() } });
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Retry same board', 'New deal', 'Cancel']);
  });

  it('keeps the focus on Cancel: both other answers throw the game away', () => {
    renderDialog({ newBoard: { label: 'New board', start: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('closes, then retries the same board', async () => {
    const user = userEvent.setup();
    const { onRetry, onClose } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]!).toBeLessThan(onRetry.mock.invocationCallOrder[0]!);
  });

  it('closes, then starts the fresh board', async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const { onRetry, onClose } = renderDialog({ newBoard: { label: 'New board', start } });
    await user.click(screen.getByRole('button', { name: 'New board' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('cancel and the backdrop only close', async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const { onRetry, onClose } = renderDialog({ newBoard: { label: 'New board', start } });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('alertdialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onRetry).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('speaks the catalogue, not English, in another language', () => {
    render(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'ja' }}>
        <RestartDialog
          open
          onRetry={vi.fn()}
          onClose={vi.fn()}
          newBoard={{ label: '新しい盤面', start: vi.fn() }}
        />
      </SettingsProvider>,
    );
    expect(screen.getByRole('alertdialog', { name: 'やり直しますか？' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '同じ盤面で再挑戦',
      '新しい盤面',
      'キャンセル',
    ]);
  });
});
