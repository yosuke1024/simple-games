/**
 * The home screen's tagline says "fully offline", which is true of the Android
 * app and not of the web build: the browser downloads the assets on a first
 * visit (docs/WEB_VERSION.md). One source ships both, so the claim is gated on
 * the platform, and this pins it in place.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));

import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { CollectionHomeScreen } from './CollectionHomeScreen';

function renderHome() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <CollectionHomeScreen onOpenGame={() => undefined} onOpenSettings={() => undefined} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  capacitorMock.native = false;
});

afterEach(() => {
  cleanup();
});

describe('collection tagline', () => {
  it('claims offline play on the app build', () => {
    capacitorMock.native = true;
    renderHome();
    expect(screen.getByText('Fully free. Fully offline. Simply playable.')).toBeInTheDocument();
  });

  it('is absent on the web build, which needs a download on a first visit', () => {
    renderHome();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });
});

describe('the game list', () => {
  it('shows every game on both builds', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /Sudoku/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Minesweeper/ })).toBeInTheDocument();
  });
});
