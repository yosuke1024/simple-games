/**
 * The star in a game's own header (issue #109). It is one button that has to
 * say two different things and mean the third: what it will do, what is
 * already true, and — by writing to the same record the collection home reads
 * — where the game will be when the player goes back.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getFavoriteGames,
  initFavoriteGames,
  resetFavoriteGamesForTesting,
  toggleFavoriteGame,
} from '../../app/favoriteGames';
import { SettingsProvider } from '../../state/SettingsContext';
import { createMemoryKV } from '../../storage/kv';
import { settingsSchema } from '../../storage/schemas';
import { FavoriteAction } from './FavoriteAction';

function renderAction(gameId: 'sudoku' | 'hearts' = 'sudoku') {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <FavoriteAction gameId={gameId} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  resetFavoriteGamesForTesting();
});

afterEach(() => {
  cleanup();
});

describe('the favourite star on a game home', () => {
  it('offers to pin a game that is not pinned', async () => {
    await initFavoriteGames(createMemoryKV());
    renderAction();
    expect(screen.getByRole('button', { name: 'Add to Favorites' })).toBeInTheDocument();
  });

  it('pins the game it names, and then offers the other direction', async () => {
    await initFavoriteGames(createMemoryKV());
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    expect(getFavoriteGames()).toEqual(['sudoku']);
    expect(screen.getByRole('button', { name: 'Remove from Favorites' })).toBeInTheDocument();
  });

  it('unpins, without disturbing the games pinned around it', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('water-sort');
    toggleFavoriteGame('hearts');
    toggleFavoriteGame('sudoku');
    const user = userEvent.setup();
    renderAction('hearts');

    await user.click(screen.getByRole('button', { name: 'Remove from Favorites' }));

    expect(getFavoriteGames()).toEqual(['water-sort', 'sudoku']);
  });

  it('opens already showing what the record says', async () => {
    await initFavoriteGames(createMemoryKV());
    toggleFavoriteGame('sudoku');
    renderAction();
    expect(screen.getByRole('button', { name: 'Remove from Favorites' })).toBeInTheDocument();
  });

  it('persists the pin, so the shelf still has it after a restart', async () => {
    const kv = createMemoryKV();
    await initFavoriteGames(kv);
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole('button', { name: 'Add to Favorites' }));

    resetFavoriteGamesForTesting();
    await initFavoriteGames(kv);
    expect(getFavoriteGames()).toEqual(['sudoku']);
  });
});
