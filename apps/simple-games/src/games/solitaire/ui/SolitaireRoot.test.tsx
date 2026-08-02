import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createFreeSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { SO_STORAGE_KEYS } from '../storage/schemas';
import { SolitaireRoot } from './SolitaireRoot';

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SolitaireRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SO_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/**
 * The golden deal (compatibility.test.ts): pile 1 shows the jack of clubs
 * alone, pile 2 shows the queen of diamonds — a legal, board-emptying move.
 */
const savedGoldenGame = {
  ...tutorialDone,
  [SO_STORAGE_KEYS.game]: JSON.stringify(
    toPersisted(createFreeSession(false, 'sol-free-golden'), 1),
  ),
};

const table = () => screen.getByRole('group', { name: 'Solitaire table' });

async function resumeGoldenGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
}

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and deals a free game right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Down by one, colors alternate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Free the hidden cards')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Aces build to kings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // A fresh Klondike layout (§1): a 24-card stock and 21 hidden cards.
    expect(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole('img', { name: 'Face down' })).toHaveLength(21);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('moves a card with two taps and flips nothing it should not (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    // J♣ (alone on pile 1) onto Q♦ (pile 2): legal, and empties pile 1.
    await user.click(within(table()).getByRole('button', { name: 'J of clubs' }));
    await user.click(within(table()).getByRole('button', { name: 'Q of diamonds' }));

    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Column 1, empty — a king can move here' }),
    ).toBeInTheDocument();
  });

  it('draws from the stock and undoes it, move count included (§3, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }));
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 23 cards — tap to draw' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(
      within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('never names a face-down card in the page (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    // The table finds a card again after a move by its `data-card`. Only
    // face-up cards may carry one: the fresh deal shows seven, one per pile,
    // and the twenty-one hidden cards give away nothing.
    expect(table().querySelectorAll('[data-card]')).toHaveLength(7);
    for (const back of within(table()).getAllByRole('img', { name: 'Face down' })) {
      expect(back).not.toHaveAttribute('data-card');
    }

    // Drawing turns one card over, and only then is it named.
    await user.click(within(table()).getByRole('button', { name: 'Stock, 24 cards — tap to draw' }));
    expect(table().querySelectorAll('[data-card]')).toHaveLength(8);
  });

  it('offers a free hint and shows no clock or streak (§4, §8)', async () => {
    const user = userEvent.setup();
    renderGame(savedGoldenGame);
    await resumeGoldenGame(user);

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    // The golden board has a hidden-card-freeing move, so no toast appears.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers a new deal, the daily, and the draw toggle, and exits', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /New deal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();

    // Draw 1 is the default; the toggle flips the preference (§4).
    const drawOne = screen.getByRole('button', { name: 'Draw 1' });
    const drawThree = screen.getByRole('button', { name: 'Draw 3' });
    expect(drawOne).toHaveAttribute('aria-pressed', 'true');
    await user.click(drawThree);
    expect(drawThree).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports deals, wins, and the honest win rate on the statistics screen (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Deals played')).toBeInTheDocument();
    expect(screen.getByText('Games won')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('Daily deals won')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
