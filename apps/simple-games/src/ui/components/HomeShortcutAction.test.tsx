/**
 * "Add to Home Screen" in a game's own header (issue #110), and the group it
 * shares with the favourite star. What is pinned here: the button exists only
 * where the shell found a launcher to pin to, it asks for exactly the game
 * whose header it sits in, and pressing it never touches the favourites.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { homeShortcutsAvailable, requestHomeShortcut } = vi.hoisted(() => ({
  homeShortcutsAvailable: vi.fn(),
  requestHomeShortcut: vi.fn(),
}));

// The real module reaches `registerPlugin` at import time; the answer the
// shell settled at boot is all these tests need.
vi.mock('../../services/homeShortcut/homeShortcut', () => ({
  homeShortcutsAvailable,
  requestHomeShortcut,
}));

import {
  getFavoriteGames,
  initFavoriteGames,
  resetFavoriteGamesForTesting,
} from '../../app/favoriteGames';
import { SettingsProvider } from '../../state/SettingsContext';
import { createMemoryKV } from '../../storage/kv';
import { settingsSchema } from '../../storage/schemas';
import { GameHomeActions } from './GameHomeActions';
import { HomeShortcutAction } from './HomeShortcutAction';

function renderWithSettings(node: React.ReactElement) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>{node}</SettingsProvider>,
  );
}

beforeEach(() => {
  homeShortcutsAvailable.mockReset().mockReturnValue(false);
  requestHomeShortcut.mockReset().mockResolvedValue(true);
  resetFavoriteGamesForTesting();
});

afterEach(() => {
  cleanup();
});

describe('the add-to-home-screen button on a game home', () => {
  it('is absent where the shell has no launcher to pin to (web, iOS, an unsupporting launcher)', () => {
    const { container } = renderWithSettings(<HomeShortcutAction gameId="sudoku" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is present where the launcher takes pin requests, labelled by what it does', () => {
    homeShortcutsAvailable.mockReturnValue(true);
    renderWithSettings(<HomeShortcutAction gameId="sudoku" />);
    expect(screen.getByRole('button', { name: 'Add to Home Screen' })).toBeInTheDocument();
  });

  it('asks for the game whose header it sits in, and nothing else', async () => {
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderWithSettings(<HomeShortcutAction gameId="hearts" />);

    await user.click(screen.getByRole('button', { name: 'Add to Home Screen' }));

    expect(requestHomeShortcut).toHaveBeenCalledTimes(1);
    expect(requestHomeShortcut).toHaveBeenCalledWith(expect.objectContaining({ id: 'hearts' }));
  });

  it('leaves the favourites alone: a shortcut is not a pin to the collection', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderWithSettings(<HomeShortcutAction gameId="sudoku" />);

    await user.click(screen.getByRole('button', { name: 'Add to Home Screen' }));

    expect(getFavoriteGames()).toEqual([]);
  });
});

describe('the header group', () => {
  it('holds only the star where there is nothing to pin to, so the header is unchanged', async () => {
    await initFavoriteGames(createMemoryKV());
    renderWithSettings(<GameHomeActions gameId="sudoku" />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add to Favorites' })).toBeInTheDocument();
  });

  it('puts the shortcut before the star on Android, both naming the same game', async () => {
    await initFavoriteGames(createMemoryKV());
    homeShortcutsAvailable.mockReturnValue(true);
    const user = userEvent.setup();
    renderWithSettings(<GameHomeActions gameId="kakuro" />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Add to Home Screen',
      'Add to Favorites',
    ]);

    await user.click(buttons[0]!);
    expect(requestHomeShortcut).toHaveBeenCalledWith(expect.objectContaining({ id: 'kakuro' }));
    await user.click(buttons[1]!);
    expect(getFavoriteGames()).toEqual(['kakuro']);
  });
});
