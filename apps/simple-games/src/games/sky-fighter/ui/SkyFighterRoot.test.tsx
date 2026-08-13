import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { SF_STORAGE_KEYS } from '../storage/schemas';
import { SkyFighterRoot } from './SkyFighterRoot';

// jsdom has no canvas: getContext returns null, so the board renders but the
// loop never starts — which is exactly the simulation/view split under test.

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SkyFighterRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SF_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Move to aim')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Big ones break up')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Catch what falls')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByRole('img', { name: 'Sky Fighter board' })).toBeInTheDocument();
    expect(screen.getByText('Stage 1')).toBeInTheDocument();
    expect(screen.getByText('Wave 1 / 4')).toBeInTheDocument();
  });
});

describe('home', () => {
  it('starts the frontier level and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('locks every level beyond the frontier (§7)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [SF_STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: 1, highestUnlocked: 5 }),
    });

    await user.click(await screen.findByRole('button', { name: 'Levels' }));
    expect(screen.getByRole('button', { name: 'Level 5' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level 6, locked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Level 1' })).toBeEnabled();
  });

  it('shows one best score and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [SF_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 9,
        cleared: 4,
        bestScore: 1520,
        totalPlaySeconds: 240,
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('1520')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('playing', () => {
  it('mounts the board with score, wave, lives and the weapon line (§2, §5)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: /Level 1/ }));
    expect(screen.getByRole('img', { name: 'Sky Fighter board' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lives: 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toHaveTextContent('0');
    // The four weapon axes, folded into one small line (§5).
    expect(screen.getByLabelText('Power 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Missile 0')).toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});
