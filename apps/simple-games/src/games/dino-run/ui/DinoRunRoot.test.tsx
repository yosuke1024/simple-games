import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { DR_STORAGE_KEYS } from '../storage/schemas';
import { DinoRunRoot } from './DinoRunRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <DinoRunRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [DR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts running right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap to jump')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Hold to duck')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('It only gets faster')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Dino Run track' })).toBeInTheDocument();
  });
});

describe('home', () => {
  it('starts a run and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Start Running/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('offers no levels and no daily — the game is endless (§13)', async () => {
    renderGame(tutorialDone);

    await screen.findByRole('button', { name: /Start Running/ });
    expect(screen.queryByRole('button', { name: 'Levels' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Daily/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
  });

  it('shows one best score and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [DR_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 12,
        bestScore: 874,
        obstaclesPassed: 96,
        totalPlaySeconds: 300,
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('874')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('playing', () => {
  it('mounts the track with the score and both controls, and no clock (§2, §3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Start Running/ }));
    expect(screen.getByRole('img', { name: 'Dino Run track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duck' })).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toHaveTextContent('0');
    expect(screen.getByText('Tap the track to start')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('counts a started run once, whether it is the first or a retry (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Start Running/ }));
    await user.click(screen.getByRole('button', { name: 'Run again' }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Statistics' }));

    const row = screen.getByText('Games played').closest('.stats-row');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('2')).toBeInTheDocument();
  });
});
