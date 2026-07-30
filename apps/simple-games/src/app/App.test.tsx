import { cleanup, render, screen } from '@testing-library/react';
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

  it('carries the quiet support message and the open-source links', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByText(/small banner ad/)).toBeInTheDocument();
    // Billing is not wired in this build: no purchase button is shown.
    expect(screen.queryByRole('button', { name: /Remove Ads$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Source Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report a Bug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Licenses' })).toBeInTheDocument();
  });

  it("hosts a game's own options without knowing what they are", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // Sudoku contributes this section; the shell only lends it a place.
    const toggle = await screen.findByRole('switch', { name: 'Show mistakes' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
