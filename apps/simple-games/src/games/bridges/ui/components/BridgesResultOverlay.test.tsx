/**
 * The clear card (docs/BRIDGES_RULES.md §3, §8, §11, §13): the facts of the
 * run, retry first, a new board second — and none for the daily; and a card
 * that does not act on input meant for the board it covers.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import type { BridgesSession } from '../../game';
import { HAND_ANSWER, handSession } from '../test-helpers';
import { BridgesResultOverlay, RESULT_ARM_MS } from './BridgesResultOverlay';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Lets the card's first moments pass. */
const arm = () =>
  act(() => {
    vi.advanceTimersByTime(RESULT_ARM_MS);
  });

function renderCard(session: BridgesSession) {
  const onRetry = vi.fn();
  const onNewBoard = vi.fn();
  const onHome = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BridgesResultOverlay
        session={session}
        lastResult={{
          seconds: 75,
          hints: 2,
          isNewBest: true,
          bestSeconds: 75,
          previousBestSeconds: 90,
        }}
        onRetry={onRetry}
        onNewBoard={onNewBoard}
        onHome={onHome}
      />
    </SettingsProvider>,
  );
  return { onRetry, onNewBoard, onHome };
}

const won = (mode: 'difficulty' | 'daily'): BridgesSession => ({
  ...handSession([...HAND_ANSWER], 'solved'),
  mode,
  dailyDate: mode === 'daily' ? '2026-10-17' : null,
  elapsedSeconds: 75,
  hintCount: 2,
});

describe('the clear card', () => {
  it('says nothing until the board is solved', () => {
    renderCard(handSession());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows time and hints, and offers retry, a new board and home', () => {
    const { onRetry, onNewBoard, onHome } = renderCard(won('difficulty'));
    const card = screen.getByRole('alertdialog', { name: 'All connected!' });
    arm();
    expect(within(card).getByText('1:15')).toBeInTheDocument();
    expect(within(card).getByText('Hints used')).toBeInTheDocument();
    expect(within(card).getByText('Your fastest yet.')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Retry same board' }), { detail: 1 });
    fireEvent.click(within(card).getByRole('button', { name: 'New board' }), { detail: 1 });
    fireEvent.click(within(card).getByRole('button', { name: 'Home' }), { detail: 1 });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onNewBoard).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    // The share is there, quiet, below the buttons that continue play.
    expect(within(card).getByRole('button', { name: /Share/ })).toBeInTheDocument();
  });

  it('offers no other board for a daily', () => {
    renderCard(won('daily'));
    const card = screen.getByRole('alertdialog');
    expect(within(card).queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
  });

  it('takes no click in its first moments: a quick second tap meant for the board', () => {
    const { onRetry, onNewBoard, onHome } = renderCard(won('difficulty'));
    const card = screen.getByRole('alertdialog');
    const retry = within(card).getByRole('button', { name: 'Retry same board' });
    // Jsdom reads as Reduced Motion: the card is up on the frame the board was solved.
    fireEvent.click(retry, { detail: 1 });
    fireEvent.click(within(card).getByRole('button', { name: 'New board' }), { detail: 1 });
    fireEvent.click(within(card).getByRole('button', { name: 'Home' }), { detail: 1 });
    act(() => {
      vi.advanceTimersByTime(RESULT_ARM_MS - 1);
    });
    fireEvent.click(retry, { detail: 1 });
    expect(onRetry).not.toHaveBeenCalled();
    expect(onNewBoard).not.toHaveBeenCalled();
    expect(onHome).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    fireEvent.click(retry, { detail: 1 });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('presses nothing on a held key’s repeats, from the first moment or later', () => {
    renderCard(won('difficulty'));
    const retry = screen.getByRole('button', { name: 'Retry same board' });
    // Retry has the focus, so a held Enter's repeats land on it.
    expect(retry).toHaveFocus();
    // `fireEvent` answers false when the default — the button's click — was stopped.
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    arm();
    expect(fireEvent.keyDown(retry, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(retry, { key: 'Enter' })).toBe(true);
  });

  it('leaves no timer behind when it goes before it is armed', async () => {
    vi.useRealTimers();
    // Warm-up: first-use module singletons are the shell's, not the card's.
    renderCard(won('difficulty'));
    cleanup();
    const tracker = trackResources();
    try {
      renderCard(won('difficulty'));
      // The arming timer is live while the card is up…
      expect(() => tracker.assertReleased()).toThrowError(/useTransientTimeout/);
      cleanup();
      // …and goes with it. (A beat first, for jsdom's own 0 ms selection
      // task that the autofocus queues — it fires; the card's would not.)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});
