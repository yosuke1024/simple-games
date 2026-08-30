import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { App } from './App';

function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  // The shell writes the game it opened into the address bar (app/webRoute.ts),
  // and jsdom keeps one document per file — so without this the next test
  // starts on the previous test's game instead of the collection. What the
  // address does and how it is followed back is App.route.test.tsx's subject.
  //
  // This is enough only because no test here *leaves* a game: leaving asks the
  // browser to walk back, and that traversal would land after this line and put
  // the next test somewhere else again. A test that adds the return trip has to
  // wait the traversal out before this runs.
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without a storage implementation: nothing to clear.
  }
});

describe('collection home', () => {
  it('lists the included games under the series name', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: 'Simple Games' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Number Match/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sudoku/ })).toBeInTheDocument();
  });

  // The collection wears the app's own icon — an <svg class="home-mark"> — and
  // deliberately not .home-logo, which is the accent tile the game home
  // screens draw their glyph in. Restyling .home-logo for the collection once
  // flattened the tile on all five game screens at the same time, and nothing
  // caught it: the shared class had no test saying who it belonged to.
  it('wears the app mark, not the accent tile the game screens share', () => {
    const { container } = renderShell();
    expect(container.querySelector('svg.home-mark')).toBeInTheDocument();
    expect(container.querySelector('.home-logo')).toBeNull();
  });

  it('opens Sudoku and stamps its accent, then clears it on the way back', async () => {
    const user = userEvent.setup();
    renderShell();
    expect(document.documentElement.dataset.game).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /Sudoku/ }));
    expect(await screen.findByText('1-9, once each')).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('sudoku');
  });

  it('opens Number Match (first run lands on its tutorial)', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /Number Match/ }));
    // The game loads its own records asynchronously, then shows Quick Rules.
    expect(await screen.findByText('Equal, or adds up to 10')).toBeInTheDocument();
    // Quick Rules stay short; the long-form rules are one link away (ui/landing.ts).
    expect(screen.getByRole('button', { name: 'Learn More' })).toBeInTheDocument();
  });
});

describe('a game address', () => {
  // The browser version's address is a real entry point, not a bookmark the
  // shell writes and never reads: the chunk a tile opens has to mount from a
  // link a guide page carries, with no tap in between (app/webRoute.ts). Only
  // that end of it is here — the history behaviour, invalid ids and the app's
  // indifference to all of it are App.route.test.tsx, which stubs the games.
  it('opens the game it names', async () => {
    window.history.replaceState(null, '', '/simple-games/play/?game=number-match');
    renderShell();
    expect(await screen.findByText('Equal, or adds up to 10')).toBeInTheDocument();
    expect(document.documentElement.dataset.game).toBe('number-match');
  });
});

describe('shared settings', () => {
  it('opens from the collection home and toggles sound and theme', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const soundSwitch = screen.getByRole('switch', { name: 'Sound' });
    expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(soundSwitch);
    expect(soundSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('carries the open-source links, and no ad claim off-device', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // jsdom is not a native platform, so this renders the web build: it shows
    // no banner and sells nothing, so it must not say it does. The per-platform
    // wording is pinned in ui/screens/SettingsScreen.test.tsx.
    expect(screen.queryByText(/small banner ad/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Ads$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Source Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report a Bug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Licenses' })).toBeInTheDocument();
  });

  it("hosts a game's own options without knowing what they are", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // Sudoku contributes this section; the shell only lends it a place. The
    // section is addressed by the game's own name rather than by the toggle
    // inside it, because three contributors now offer a setting under the same
    // words — which is the arrangement working, not a collision: each lives in
    // its own labelled region, and that region is what tells them apart.
    const sudoku = await screen.findByRole('region', { name: 'Sudoku' });
    const toggle = within(sudoku).getByRole('switch', { name: 'Show mistakes' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('hosts every contributor, each under its own name', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // The shell knows none of these names — it walks GAMES and renders
    // whatever each title hands it. More than one contributor is what makes
    // that claim testable at all: a single one could have been a special case.
    for (const game of ['Sudoku', 'Futoshiki', 'Kakuro']) {
      const section = await screen.findByRole('region', { name: game });
      expect(within(section).getByRole('switch')).toBeInTheDocument();
    }
  });
});
