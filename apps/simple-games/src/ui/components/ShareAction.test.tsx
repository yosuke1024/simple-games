/**
 * The button on the result card: what it sends, what it says afterwards, and
 * the things it must never do — no reward, no second ask, no error (issue #86).
 */
import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

import { en } from '../../i18n/locales/en';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { ShareAction } from './ShareAction';

function renderAction(outcome: 'completed' | 'played' = 'played', strict = false) {
  const tree = (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ShareAction gameId="sudoku" outcome={outcome} />
    </SettingsProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return screen.getByRole('button', { name: en.shareAction });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the share button', () => {
  it('hands the sheet the game and its link, and says nothing after', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });

    await userEvent.click(renderAction('completed'));

    expect(share).toHaveBeenCalledWith({
      text: 'I cleared Sudoku on Simple Games.\nYou can play it right in your browser.',
      url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
    });
    // A share sheet is its own confirmation; a toast on top of it is noise.
    expect(screen.queryByText(en.shareCopied)).not.toBeInTheDocument();
  });

  it('confirms only the outcome with nothing on screen to show for it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await userEvent.click(renderAction());

    await waitFor(() => expect(screen.getByText(en.shareCopied)).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(
      'I played Sudoku on Simple Games.\n' +
        'You can play it right in your browser.\n' +
        'https://pixapps.ai/simple-games/play/?game=sudoku',
    );
  });

  it('stays silent and stays pressable when nothing worked', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    const button = renderAction();
    await userEvent.click(button);

    // No error text, no disabled button, no dialog: the result screen is
    // exactly as it was, and the player can try again or ignore it.
    expect(screen.queryByText(en.shareCopied)).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('still confirms a copy under a double-invoked mount', async () => {
    // StrictMode runs effects invoke-cleanup-invoke; a component that reads
    // that as "unmounted" would go quiet in development only.
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    await userEvent.click(renderAction('played', true));

    await waitFor(() => expect(screen.getByText(en.shareCopied)).toBeInTheDocument());
  });

  it('offers nothing in return for pressing it', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockResolvedValue(undefined) });

    const button = renderAction();
    await userEvent.click(button);
    await userEvent.click(button);

    // Two shares later the screen still holds one plain button and no promise
    // of anything — no unlock, no bonus, no "share again for…".
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
