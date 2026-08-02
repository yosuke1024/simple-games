import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { WS_STORAGE_KEYS } from '../storage/schemas';
import { WaterSortRoot } from './WaterSortRoot';

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WaterSortRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [WS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: 'Water sort tubes' });
const tubes = () => within(board()).getAllByRole('button');

/** The golden level-1 board (compatibility.test.ts): 2112.2021.0001.. */
async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Pour same onto same')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Two spare tubes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('One color per tube')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 is three colors: five tubes, two of them the empty spares (§1).
    expect(tubes()).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /bottom to top: empty/ })).toHaveLength(2);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('pours with two taps and counts the move (§3, §4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    // Golden board: tube 1 holds 3 2 2 3 (top is color 3). Pour it into an
    // empty spare — always legal (§3).
    await user.click(screen.getByRole('button', { name: 'Tube 1, bottom to top: 3 2 2 3' }));
    await user.click(screen.getByRole('button', { name: 'Tube 4, bottom to top: empty' }));

    expect(
      screen.getByRole('button', { name: 'Tube 4, bottom to top: 3' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('undo puts the board and the move count back (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Tube 1, bottom to top: 3 2 2 3' }));
    await user.click(screen.getByRole('button', { name: 'Tube 4, bottom to top: empty' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(
      screen.getByRole('button', { name: 'Tube 1, bottom to top: 3 2 2 3' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('offers a free hint that leaves the game playable (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // A generated board always has a proven way forward from the start, so no
    // "no way forward" toast — and the game keeps playing.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§4, §7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports level and daily facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('Dailies solved')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
