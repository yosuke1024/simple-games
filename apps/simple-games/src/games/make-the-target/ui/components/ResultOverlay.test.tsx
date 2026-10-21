/**
 * The result card's five cases and its variant after a solution was shown
 * (docs/MAKE_THE_TARGET_RULES.md §5, §9): what "Your fastest yet.", the
 * record and the difference say — or do not say — in each, which buttons
 * each card has, and when it appears.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia } from '@/test/lifecycle';
import { RESULT_REVEAL_MS } from '@/ui/useResultReveal';
import { revealSolution, withElapsed, type MakeTheTargetSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { dailyGame, freeGame, MISS, play, SOLVE } from '../test-helpers';
import { MakeTheTargetResultOverlay } from './ResultOverlay';

afterEach(cleanup);

const solvedIn = (seconds: number, session = freeGame()) =>
  play(withElapsed(session, seconds), ...SOLVE);

function show(session: MakeTheTargetSession, lastResult: LastResult | null) {
  const handlers = { onRetry: vi.fn(), onNewBoard: vi.fn(), onHome: vi.fn() };
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MakeTheTargetResultOverlay session={session} lastResult={lastResult} {...handlers} />
    </SettingsProvider>,
  );
  return handlers;
}

const card = () => screen.getByRole('alertdialog');
const delta = () => card().querySelector('.result-delta')?.textContent ?? null;

describe('the record line (§9)', () => {
  it('a first clear: "Your fastest yet.", and no difference', () => {
    show(solvedIn(83), {
      seconds: 83,
      comparison: { previousSeconds: null, isNewBest: true, bestSeconds: 83 },
    });
    expect(within(card()).getByText('Your fastest yet.')).toBeInTheDocument();
    expect(delta()).toBeNull();
    expect(card()).toHaveTextContent('Time1:23');
  });

  it('faster than the record: "Your fastest yet." and how much faster', () => {
    show(solvedIn(60), {
      seconds: 60,
      comparison: { previousSeconds: 65, isNewBest: true, bestSeconds: 60 },
    });
    expect(within(card()).getByText('Your fastest yet.')).toBeInTheDocument();
    expect(delta()).toBe('−0:05');
  });

  it('the record’s own time: the record, and no difference', () => {
    show(solvedIn(60), {
      seconds: 60,
      comparison: { previousSeconds: 60, isNewBest: false, bestSeconds: 60 },
    });
    expect(within(card()).queryByText('Your fastest yet.')).toBeNull();
    expect(card()).toHaveTextContent('Fastest clear 1:00');
    expect(delta()).toBeNull();
  });

  it('slower than the record: the record and how far behind', () => {
    show(solvedIn(78), {
      seconds: 78,
      comparison: { previousSeconds: 60, isNewBest: false, bestSeconds: 60 },
    });
    expect(within(card()).queryByText('Your fastest yet.')).toBeNull();
    expect(card()).toHaveTextContent('Fastest clear 1:00');
    expect(delta()).toBe('+0:18');
  });

  it('a retry of a solved problem: the facts as always, and no record line nor difference', () => {
    show(solvedIn(5), { seconds: 5, comparison: null });
    expect(within(card()).queryByText('Your fastest yet.')).toBeNull();
    expect(within(card()).queryByText(/Fastest clear/)).toBeNull();
    expect(delta()).toBeNull();
    // The four facts every clear states (§9) are all still there.
    expect(card()).toHaveTextContent('DifficultyEasy');
    expect(card()).toHaveTextContent('Numbers4');
    expect(card()).toHaveTextContent('Target21');
    expect(card()).toHaveTextContent('Time0:05');
  });
});

describe('the buttons (§8)', () => {
  it('Free Play leads with a new problem, then the same one, then Home', () => {
    const { onRetry, onNewBoard, onHome } = show(solvedIn(30), { seconds: 30, comparison: null });
    const buttons = within(card())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(buttons.slice(0, 3)).toEqual(['New problem', 'Retry same board', 'Home']);
    expect(within(card()).getByRole('button', { name: 'New problem' })).toHaveFocus();
    within(card()).getByRole('button', { name: 'New problem' }).click();
    within(card()).getByRole('button', { name: 'Retry same board' }).click();
    within(card()).getByRole('button', { name: 'Home' }).click();
    expect([onNewBoard, onRetry, onHome].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    // A held key presses nothing here (§3): a repeat's default is cancelled.
    const first = within(card()).getByRole('button', { name: 'New problem' });
    expect(fireEvent.keyDown(first, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(first, { key: 'Enter' })).toBe(true);
  });

  it('the daily offers its retry and Home only', () => {
    show(solvedIn(30, dailyGame('2026-10-21')), { seconds: 30, comparison: null });
    expect(within(card()).queryByRole('button', { name: 'New problem' })).toBeNull();
    expect(within(card()).getByRole('button', { name: 'Retry same board' })).toHaveFocus();
    expect(card()).toHaveTextContent('DifficultyDaily');
  });
});

describe('after a solution was shown (§5)', () => {
  it('is the same card’s variant: the kept solution, a new problem or Home, no retry', () => {
    const revealed = revealSolution(play(freeGame(), ...MISS))!;
    const { onNewBoard } = show(revealed, null);
    expect(card()).toHaveAccessibleName('One way to make 21');
    const list = within(card()).getByRole('list', { name: 'A solution' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('[aria-hidden="true"]')!.textContent),
    ).toEqual(['1 + 2 = 3', '3 + 4 = 7', '3 × 7 = 21']);
    expect(
      within(card())
        .getAllByRole('button')
        .map((b) => b.textContent)
        .slice(0, 2),
    ).toEqual(['New problem', 'Home']);
    expect(within(card()).queryByRole('button', { name: 'Retry same board' })).toBeNull();
    expect(within(card()).getByRole('button', { name: 'New problem' })).toHaveFocus();
    within(card()).getByRole('button', { name: 'New problem' }).click();
    expect(onNewBoard).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the beat a clear waits for', () => {
    const restoreMedia = stubMatchMedia();
    vi.useFakeTimers();
    try {
      show(solvedIn(30), {
        seconds: 30,
        comparison: { previousSeconds: null, isNewBest: true, bestSeconds: 30 },
      });
      // A clear: the made target gets its beat first (§4).
      expect(screen.queryByRole('alertdialog')).toBeNull();
      act(() => vi.advanceTimersByTime(RESULT_REVEAL_MS));
      expect(screen.getByRole('alertdialog', { name: 'Target made.' })).toBeInTheDocument();
      cleanup();

      show(revealSolution(play(freeGame(), ...MISS))!, null);
      expect(screen.getByRole('alertdialog', { name: 'One way to make 21' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      restoreMedia();
    }
  });

  it('shows nothing while the problem is still in play', () => {
    show(freeGame(), null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    cleanup();
    show(play(freeGame(), ...MISS), null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
