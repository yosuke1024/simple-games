import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BU_STORAGE_KEYS } from '../storage/schemas';
import { BubblePopRoot } from './BubblePopRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BubblePopRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BU_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Drag to aim')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3 in a row pops')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The ceiling creeps down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Bubble Pop board' })).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
  });
});

describe('home', () => {
  it('starts the frontier level and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: 'Level 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('locks every level beyond the frontier', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BU_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 3 }),
    });

    // The Levels chip says how many of the hundred are behind the frontier.
    const chip = await screen.findByRole('button', { name: /^Levels/ });
    expect(chip).toHaveTextContent('2/100');
    await user.click(chip);
    expect(screen.getByRole('button', { name: 'Level 3' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level 4, locked' })).toBeDisabled();
    // Cleared levels stay replayable.
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeEnabled();
  });

  it('shows counts and no clock, no score, no streak', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BU_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 12,
        cleared: 7,
        totalPlaySeconds: 300,
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Games played')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });
});

describe('playing', () => {
  it('mounts the board with shots-until-descent in the status row (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(screen.getByRole('img', { name: 'Bubble Pop board' })).toBeInTheDocument();
    // Level 1's descent cadence is 8 shots (game/levels.ts's levelSpec(1)),
    // shown as a dot row, not a countdown number — the text label backs the
    // dots' aria-label, not a digits-only readout.
    expect(screen.getByText('8 shots until the ceiling drops')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('offers a swap between the current and next bubble', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(
      screen.getByRole('button', { name: 'Swap current and next bubble' }),
    ).toBeInTheDocument();
  });

  it('fires on Space alone, with no arrow key steering it first', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(screen.getByText('8 shots until the ceiling drops')).toBeInTheDocument();

    // No ArrowLeft/ArrowRight here — Space must fire the aim it already has
    // (straight up) on its own, not only after a drag or an arrow key has
    // set draggingRef.
    fireEvent.keyDown(window, { key: ' ' });

    expect(await screen.findByText('7 shots until the ceiling drops')).toBeInTheDocument();
  });
});
