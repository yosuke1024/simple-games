import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyBrowser } from './NearbyBrowser';
import type { NearbyGameId } from './gameTypes';
import { en } from './i18n/en';
import { NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import { GAME_TITLES } from './games';

const fixtures = vi.hoisted(() => ({
  controllers: [] as Array<{
    state: string;
    peers: Array<{ id: string; name: string; roomName: string; gameId: NearbyGameId }>;
    changed: () => void;
    stop: ReturnType<typeof vi.fn>;
    connectToGame: ReturnType<typeof vi.fn>;
    setup: { transport: string };
    storageFailed: boolean;
  }>,
  loadGame: vi.fn(),
  loadHistory: vi.fn(),
  joined: vi.fn(),
  exited: vi.fn(),
  openedGame: vi.fn(),
  native: false,
  nativeBack: null as (() => void) | null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => fixtures.native } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: fixtures.addListener } }));
vi.mock('../state/SettingsContext', async () => {
  const { translate } = await import('../i18n');
  return {
    useSettings: () => ({
      locale: 'en',
      t: (key: Parameters<typeof translate>[1]) => translate('en', key),
    }),
  };
});
vi.mock('./history', () => ({ loadHistory: fixtures.loadHistory }));
vi.mock('./games', async (original) => ({
  ...(await original<typeof import('./games')>()),
  loadNearbyGame: fixtures.loadGame,
}));
vi.mock('./controller', () => ({
  NearbyController: class {
    state = 'idle';
    storageFailed = false;
    reason = 'ended';
    peers: Array<{ id: string; name: string; roomName: string; gameId: NearbyGameId }> = [];
    constructor(
      readonly setup: { transport: string },
      readonly changed: () => void,
    ) {
      fixtures.controllers.push(this);
    }
    start = vi.fn(async () => {
      this.state = 'discovering';
      this.changed();
    });
    stop = vi.fn(async () => {
      this.state = 'ended';
      this.changed();
    });
    connectToGame = vi.fn(async () => {
      this.state = 'connecting';
      this.changed();
      return true;
    });
  },
}));

function Harness({ visible = true }: { visible?: boolean }) {
  const [, render] = useState(0);
  return (
    <NearbyBrowser
      visible={visible}
      onExit={fixtures.exited}
      onOpenGame={fixtures.openedGame}
      onJoin={fixtures.joined}
      onChanged={() => render((v) => v + 1)}
    />
  );
}
const peer = {
  id: 'chess-host',
  name: 'P-8A1234',
  roomName: 'Friday games',
  gameId: 'chess' as const,
};
async function search() {
  fireEvent.click(screen.getByRole('button', { name: 'Find gatherings' }));
  await act(async () => {
    await Promise.resolve();
  });
  const controller = fixtures.controllers.at(-1)!;
  act(() => {
    controller.peers = [
      peer,
      { id: 'nim-host', name: 'F-8D1234', roomName: 'Nim club', gameId: 'nim' },
    ];
    controller.changed();
  });
  return controller;
}
function fillJoin() {
  fireEvent.click(screen.getByRole('button', { name: /Friday games Chess/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Your display name' }), {
    target: { value: 'Guest' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree and want to continue' }));
}
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.controllers.length = 0;
  fixtures.native = false;
  fixtures.nativeBack = null;
  fixtures.addListener.mockImplementation(async (_event, callback: () => void) => {
    fixtures.nativeBack = callback;
    return { remove: fixtures.removeListener };
  });
  fixtures.loadHistory.mockResolvedValue({ displayName: undefined });
  fixtures.loadGame.mockResolvedValue({ adapter: { id: 'chess' }, Board: () => null });
});
afterEach(cleanup);

describe('collection-wide nearby browser', () => {
  it('reports only a selected listing, and hiding it neither connects nor blocks a player', async () => {
    const view = render(<Harness />);
    const controller = await search();
    const listing = screen.getByRole('button', { name: /Friday games Chess/ }).closest('article')!;
    fireEvent.click(within(listing).getByRole('button', { name: en.report }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('textbox', { name: en.reportContent })).toHaveValue(
      'Simple Games — Chess\n\n\n\nFriday games',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(fixtures.exited).not.toHaveBeenCalled();
    fireEvent.click(within(listing).getByRole('button', { name: en.hideListing }));
    expect(screen.queryByRole('button', { name: /Friday games Chess/ })).not.toBeInTheDocument();
    expect(screen.getByText(en.hideListingHint)).toBeVisible();
    act(() => controller.changed());
    expect(screen.queryByRole('button', { name: /Friday games Chess/ })).not.toBeInTheDocument();
    expect(controller.connectToGame).not.toHaveBeenCalled();
    expect(fixtures.loadHistory).not.toHaveBeenCalled();
    expect(fixtures.loadGame).not.toHaveBeenCalled();
    view.unmount();
    render(<Harness />);
    await search();
    expect(screen.getByRole('button', { name: /Friday games Chess/ })).toBeVisible();
  });

  it('links every supported game to its home without starting discovery or loading boards', async () => {
    render(<Harness />);
    const region = screen.getByRole('region', { name: en.supportedGames });
    const links = within(region).getAllByRole('link');
    expect(links).toHaveLength(13);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      Object.keys(NEARBY_GAME_CODES).map((id) => `?game=${id}`),
    );
    for (const id of Object.keys(NEARBY_GAME_CODES) as NearbyGameId[]) {
      expect(within(region).getByRole('link', { name: GAME_TITLES[id] })).toBeVisible();
    }
    await act(async () => {
      fireEvent.click(within(region).getByRole('link', { name: 'Chess' }));
    });
    expect(fixtures.openedGame).toHaveBeenCalledExactlyOnceWith('chess');
    expect(fixtures.controllers).toHaveLength(0);
    expect(fixtures.loadGame).not.toHaveBeenCalled();
    expect(fixtures.loadHistory).not.toHaveBeenCalled();
    expect(fixtures.joined).not.toHaveBeenCalled();
  });

  it('waits for active discovery to stop before opening a game home', async () => {
    render(<Harness />);
    const controller = await search();
    let finish!: () => void;
    controller.stop.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('link', { name: 'Nim' }));
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(fixtures.openedGame).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Chess' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Chess' }));
    await act(async () => {
      finish();
    });
    expect(fixtures.openedGame).toHaveBeenCalledExactlyOnceWith('nim');
    expect(controller.connectToGame).not.toHaveBeenCalled();
    expect(fixtures.loadGame).not.toHaveBeenCalled();
  });

  it.each(['back', 'hidden', 'unmounted'] as const)(
    'does not navigate after a delayed stop when the browser was %s',
    async (exit) => {
      const view = render(<Harness />);
      const controller = await search();
      let finish!: () => void;
      const stopped = new Promise<void>((resolve) => {
        finish = resolve;
      });
      controller.stop.mockImplementation(() => stopped);
      fireEvent.click(screen.getByRole('link', { name: 'Yacht' }));
      if (exit === 'back') fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      if (exit === 'hidden') view.rerender(<Harness visible={false} />);
      if (exit === 'unmounted') view.unmount();
      await act(async () => {
        finish();
      });
      expect(fixtures.openedGame).not.toHaveBeenCalled();
      expect(fixtures.loadGame).not.toHaveBeenCalled();
    },
  );

  it('reports persistence failures when saving a participant name prevents joining', async () => {
    render(<Harness />);
    const controller = await search();
    fillJoin();
    expect(screen.queryByRole('region', { name: en.supportedGames })).not.toBeInTheDocument();
    controller.connectToGame.mockImplementation(async () => {
      controller.storageFailed = true;
      return false;
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join a gathering' }));
    });
    expect(screen.getByText(en.storageError)).toBeVisible();
    expect(fixtures.joined).not.toHaveBeenCalled();
  });

  it('prefills the saved personal name after selecting a gathering without starting a connection', async () => {
    fixtures.loadHistory.mockResolvedValue({ displayName: 'Remembered player' });
    render(<Harness />);
    const controller = await search();
    expect(fixtures.loadHistory).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Friday games Chess/ }));
    });
    expect(screen.getByRole('heading', { name: 'Friday games' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Your display name' })).toHaveValue(
      'Remembered player',
    );
    expect(controller.connectToGame).not.toHaveBeenCalled();
  });

  it('keeps typed personal names when a delayed saved name arrives', async () => {
    let finish!: (value: unknown) => void;
    fixtures.loadHistory.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness />);
    await search();
    fillJoin();
    await act(async () => {
      finish({ displayName: 'Old player' });
    });
    expect(screen.getByRole('textbox', { name: 'Your display name' })).toHaveValue('Guest');
  });

  it('only scans after an explicit choice and shows hosts across games without loading boards', async () => {
    render(<Harness />);
    expect(fixtures.controllers).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Same Wi-Fi' }));
    const controller = await search();
    expect(controller.setup.transport).toBe('lan');
    expect(screen.getByRole('button', { name: /Friday games Chess/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Nim club Nim/ })).toBeVisible();
    expect(fixtures.loadGame).not.toHaveBeenCalled();
    expect(controller.connectToGame).not.toHaveBeenCalled();
  });
  it('loads only the selected game and hands off the same controller without stopping it', async () => {
    const view = render(<Harness />);
    const controller = await search();
    fillJoin();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join a gathering' }));
    });
    expect(fixtures.loadGame).toHaveBeenCalledExactlyOnceWith('chess');
    expect(controller.connectToGame).toHaveBeenCalledWith('chess-host', 'Guest', { id: 'chess' });
    expect(fixtures.joined).toHaveBeenCalledWith(
      controller,
      'chess',
      expect.objectContaining({ adapter: { id: 'chess' } }),
    );
    view.unmount();
    expect(controller.stop).not.toHaveBeenCalled();
  });
  it('prevents joining a listing that disappears while entering a name', async () => {
    render(<Harness />);
    const controller = await search();
    fillJoin();
    act(() => {
      controller.peers = [];
      controller.changed();
    });
    expect(screen.getByRole('button', { name: 'Join a gathering' })).toBeDisabled();
    expect(screen.getByText(/no longer available/)).toBeVisible();
    expect(controller.connectToGame).not.toHaveBeenCalled();
  });
  it('stops a scan on exit and cancels a delayed board load before it can connect', async () => {
    let finish!: (value: unknown) => void;
    fixtures.loadGame.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<Harness />);
    const controller = await search();
    fillJoin();
    fireEvent.click(screen.getByRole('button', { name: 'Join a gathering' }));
    view.unmount();
    await act(async () => {
      finish({ adapter: { id: 'chess' }, Board: () => null });
    });
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(controller.connectToGame).not.toHaveBeenCalled();
    expect(fixtures.joined).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'another-device' },
    { name: 'P-8A5678' },
    { roomName: 'Someone else' },
    { gameId: 'nim' as const },
  ])('rechecks the exact displayed listing after its board loads: %j', async (change) => {
    let finish!: (value: unknown) => void;
    fixtures.loadGame.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness />);
    const controller = await search();
    fillJoin();
    fireEvent.click(screen.getByRole('button', { name: 'Join a gathering' }));
    act(() => {
      controller.peers = [{ ...peer, ...change }];
      controller.changed();
    });
    await act(async () => {
      finish({ adapter: { id: 'chess' }, Board: () => null });
    });
    expect(controller.connectToGame).not.toHaveBeenCalled();
    expect(fixtures.joined).not.toHaveBeenCalled();
    expect(screen.getByText(/no longer available/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Join a gathering' })).toBeDisabled();
  });

  it('stops when hidden, releases native Back, and ignores both keyboard and late native callbacks', async () => {
    fixtures.native = true;
    const view = render(<Harness />);
    const controller = await search();
    const oldBack = fixtures.nativeBack!;
    await act(async () => {
      view.rerender(<Harness visible={false} />);
    });
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(fixtures.removeListener).toHaveBeenCalledOnce();
    act(() => {
      oldBack();
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(fixtures.exited).not.toHaveBeenCalled();
    view.rerender(<Harness />);
    expect(fixtures.controllers).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Find gatherings' })).toBeEnabled();
  });

  it.each(['board', 'connection'] as const)(
    'does not revive a pending %s handoff after hide and show',
    async (stage) => {
      let finish!: (value: unknown) => void;
      const deferred = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      if (stage === 'board') fixtures.loadGame.mockImplementation(deferred);
      const view = render(<Harness />);
      const controller = await search();
      if (stage === 'connection') controller.connectToGame.mockImplementation(deferred);
      fillJoin();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Join a gathering' }));
      });
      if (stage === 'connection') expect(controller.connectToGame).toHaveBeenCalledOnce();
      await act(async () => {
        view.rerender(<Harness visible={false} />);
      });
      view.rerender(<Harness />);
      await act(async () => {
        finish(stage === 'board' ? { adapter: { id: 'chess' }, Board: () => null } : true);
      });
      expect(controller.stop).toHaveBeenCalledOnce();
      if (stage === 'board') expect(controller.connectToGame).not.toHaveBeenCalled();
      expect(fixtures.joined).not.toHaveBeenCalled();
      expect(fixtures.controllers).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Find gatherings' })).toBeEnabled();
    },
  );
});
