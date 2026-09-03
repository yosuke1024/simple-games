import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { BB_STORAGE_KEYS } from '../storage/schemas';
import { BrickBreakerRoot } from './BrickBreakerRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BrickBreakerRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BB_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Aim with the paddle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Hollow bricks hold a ball')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('The wall creeps down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Brick Breaker board' })).toBeInTheDocument();
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

  it('locks every level beyond the frontier (§7)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BB_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 3 }),
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

  it('shows counts and no clock, no score, no streak (§9, §13)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [BB_STORAGE_KEYS.stats]: JSON.stringify({
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
  it('mounts the board with lives and bricks in the status row (§2)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    expect(screen.getByRole('img', { name: 'Brick Breaker board' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lives: 3' })).toBeInTheDocument();
    // The golden level-1 board has 18 bricks (compatibility.test.ts).
    expect(screen.getByText('Bricks 18')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});
