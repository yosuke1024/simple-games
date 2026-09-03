/**
 * The button on the result card: what it sends, what it says afterwards, and
 * the things it must never do — no reward, no second ask, no error (issue #86).
 */
import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

// Wraps the real `renderShareCard` rather than replacing it outright: most
// tests below want its real jsdom behaviour (no 2D context, so `null`, the
// same as the text-only path always got), and the two tests about the card
// itself override this mock's return value for one call.
vi.mock('../../services/share/card', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/share/card')>();
  return { ...actual, renderShareCard: vi.fn(actual.renderShareCard) };
});

import { en } from '../../i18n/locales/en';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { renderShareCard } from '../../services/share/card';
import type { ShareDetail } from '../../services/share/message';
import { ShareAction } from './ShareAction';

function renderAction(
  outcome: 'completed' | 'played' = 'played',
  details: readonly ShareDetail[] = [],
  strict = false,
) {
  const tree = (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ShareAction gameId="sudoku" outcome={outcome} details={details} />
    </SettingsProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return screen.getByRole('button', { name: en.shareAction });
}

const timeAndMistakes: ShareDetail[] = [
  { label: 'Time', value: '4:32' },
  { label: 'Mistakes', value: '0' },
];

// jsdom's canvas has no 2D context: the wrapped-real `renderShareCard` hits
// it on every click, and left un-stubbed jsdom logs a "Not implemented"
// error for each one. Every test in this file that leaves the mock at its
// default (wrapped-real) behaviour relies on that call returning `null`
// anyway, so stubbing it null is silence, not a change — kept as its own
// spy (rather than vi.restoreAllMocks) so it never touches the module-level
// renderShareCard mock the two "picture card" tests set a return value on.
let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  getContextSpy.mockRestore();
});

describe('the share button', () => {
  it('hands the sheet the game, its facts and its link, and says nothing after', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });

    await userEvent.click(renderAction('completed', timeAndMistakes));

    expect(share).toHaveBeenCalledWith({
      text: 'I cleared Sudoku on Simple Games.\nTime 4:32 · Mistakes 0\nThink you can beat it?',
      url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
    });
    // A share sheet is its own confirmation; a toast on top of it is noise.
    expect(screen.queryByText(en.shareCopied)).not.toBeInTheDocument();
  });

  it('sends the plain invitation when there are no facts to repeat', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });

    await userEvent.click(renderAction('played'));

    expect(share).toHaveBeenCalledWith({
      text: 'I played Sudoku on Simple Games.\nYou can play it right in your browser.',
      url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
    });
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

    await userEvent.click(renderAction('played', [], true));

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

describe('the picture card', () => {
  it('reaches the sheet as a file, alongside the same text and link', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'card.png', { type: 'image/png' });
    vi.mocked(renderShareCard).mockReturnValueOnce(file);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
      clipboard: { writeText: vi.fn() },
    });

    await userEvent.click(renderAction('completed'));

    // The card is drawn from the same game, outcome and facts as the text,
    // with the translated word for the pill — not from anything of its own.
    expect(renderShareCard).toHaveBeenCalledWith({
      gameId: 'sudoku',
      outcome: 'completed',
      details: [],
      clearedLabel: en.shareCardCleared,
    });
    expect(share).toHaveBeenCalledWith({
      files: [file],
      text: 'I cleared Sudoku on Simple Games.\nYou can play it right in your browser.',
      url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
    });
  });

  it('reaches the sheet as text and link alone when no card was drawn', async () => {
    vi.mocked(renderShareCard).mockReturnValueOnce(null);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
      clipboard: { writeText: vi.fn() },
    });

    await userEvent.click(renderAction());

    expect(share).toHaveBeenCalledWith({
      text: 'I played Sudoku on Simple Games.\nYou can play it right in your browser.',
      url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
    });
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty('files');
  });
});
