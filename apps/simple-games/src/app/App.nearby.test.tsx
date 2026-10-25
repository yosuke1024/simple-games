import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRootProps } from './registry';
import type { NearbyGameId } from './nearbyGate';

const state = vi.hoisted(() => ({
  native: true,
  loaded: vi.fn(),
  mounted: vi.fn(),
  unmounted: vi.fn(),
  stopped: vi.fn(),
  cleared: vi.fn(async () => {}),
  stopBarrier: null as Promise<void> | null,
  shouldPromptReview: vi.fn(() => false),
}));
vi.mock('@capacitor/core', async (original) => {
  const actual = await original<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => state.native },
  };
});
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: () => Promise.resolve({ remove: () => undefined }),
    minimizeApp: vi.fn(),
    getInfo: async () => ({ version: 'test' }),
  },
}));
vi.mock('../services/review', async (original) => ({
  ...(await original<typeof import('../services/review')>()),
  shouldPromptReview: state.shouldPromptReview,
}));
vi.mock('./nearbyGate', async (original) => ({
  ...(await original<typeof import('./nearbyGate')>()),
  getNearbyRoot: () => {
    state.loaded();
    return RetainedPeer;
  },
  clearNearbyLocalData: state.cleared,
}));
vi.mock('./lazyRoots', () => ({
  getLazyRoot: () => GameHome,
  resetLazyRoot: vi.fn(),
}));
vi.mock('../ui/screens/SettingsScreen', () => ({
  SettingsScreen: ({
    onResetNearby,
    onBack,
  }: {
    onResetNearby: () => Promise<void>;
    onBack: () => void;
  }) => (
    <>
      <button
        onClick={() => {
          void onResetNearby();
        }}
      >
        Reset saved data
      </button>
      <button onClick={onBack}>Leave settings</button>
    </>
  ),
}));

import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import { App } from './App';
import { resetRecentGamesForTesting } from './recentGames';

function GameHome({ onExit, onPlayTogether, playTogetherActive }: GameRootProps) {
  return (
    <>
      <h1>Game home</h1>
      {onPlayTogether && (
        <button onClick={onPlayTogether}>
          {playTogetherActive ? 'Return to match' : 'Play with someone'}
        </button>
      )}
      <button onClick={onExit}>All games</button>
    </>
  );
}

// Native/protocol recovery has separate integration tests. This seam exercises
// the actual shell's mount identity, visibility, and explicit deletion ordering.
function RetainedPeer({
  gameId,
  visible,
  onExit,
  onActiveChange,
  onRegisterStop,
}: {
  gameId: NearbyGameId;
  visible: boolean;
  onExit: () => void;
  onActiveChange: (active: boolean) => void;
  onRegisterStop: (stop: (() => Promise<void>) | null) => void;
}) {
  const [active, setActive] = useState(false);
  const [turn, setTurn] = useState(1);
  const stop = useCallback(async () => {
    state.stopped();
    await state.stopBarrier;
    setActive(false);
  }, []);
  useEffect(() => {
    state.mounted();
    return () => {
      state.unmounted();
    };
  }, []);
  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);
  useEffect(() => {
    onRegisterStop(stop);
    return () => {
      onRegisterStop(null);
    };
  }, [stop, onRegisterStop]);
  return (
    <section data-testid="peer" data-visible={visible}>
      <h1>{gameId} with someone</h1>
      <p>Turn {turn}</p>
      <button onClick={() => setActive(true)}>Connect</button>
      <button onClick={() => setTurn((v) => v + 1)}>Play a turn</button>
      <button onClick={onExit}>Back to game</button>
      <button
        onClick={() => {
          void stop();
        }}
      >
        End connection
      </button>
    </section>
  );
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
function renderShell() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <App />
    </SettingsProvider>,
  );
}
function chooseYacht() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Yacht' }).at(-1)!);
}
function openPeer() {
  chooseYacht();
  fireEvent.click(screen.getByRole('button', { name: 'Play with someone' }));
}
beforeEach(() => {
  vi.clearAllMocks();
  state.native = true;
  state.stopBarrier = null;
  window.history.replaceState(null, '', '/');
  resetRecentGamesForTesting();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('multiplayer is entered through the supported game', () => {
  it('does not load the feature on the collection or a game home, and has no standalone entry', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: /Nearby Play/ })).not.toBeInTheDocument();
    chooseYacht();
    expect(screen.getByRole('button', { name: 'Play with someone' })).toBeInTheDocument();
    expect(state.loaded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Play with someone' }));
    expect(screen.getByRole('heading', { name: 'yacht with someone' })).toBeInTheDocument();
  });
  it('does not offer multiplayer for an unsupported game or in the browser', () => {
    const first = renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Sudoku' }));
    expect(screen.queryByRole('button', { name: 'Play with someone' })).not.toBeInTheDocument();
    first.unmount();
    state.native = false;
    renderShell();
    chooseYacht();
    expect(screen.queryByRole('button', { name: 'Play with someone' })).not.toBeInTheDocument();
    expect(state.loaded).not.toHaveBeenCalled();
  });
  it('keeps one peer session and its turn when returning through the game home and collection', () => {
    renderShell();
    openPeer();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play a turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }));
    expect(screen.getByRole('button', { name: 'Return to match' })).toBeInTheDocument();
    expect(screen.getByTestId('peer')).not.toBeVisible();
    expect(screen.getByTestId('peer')).toHaveAttribute('data-visible', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(state.shouldPromptReview).not.toHaveBeenCalled();
    chooseYacht();
    fireEvent.click(screen.getByRole('button', { name: 'Return to match' }));
    expect(screen.getByText('Turn 2')).toBeVisible();
    expect(state.mounted).toHaveBeenCalledTimes(1);
    expect(state.unmounted).not.toHaveBeenCalled();
    expect(state.stopped).not.toHaveBeenCalled();
  });
  it('discards an explicitly ended session when leaving, so the next entry is fresh', async () => {
    renderShell();
    openPeer();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play a turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'End connection' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }));
    expect(state.unmounted).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Play with someone' }));
    expect(screen.getByText('Turn 1')).toBeVisible();
    expect(state.mounted).toHaveBeenCalledTimes(2);
  });
  it('returns to the existing gathering from another supported game without changing its rules', () => {
    renderShell();
    openPeer();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play a turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }));
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reversi' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Return to match' }));
    expect(screen.getByRole('heading', { name: 'yacht with someone' })).toBeVisible();
    expect(screen.getByText('Turn 2')).toBeVisible();
    expect(state.mounted).toHaveBeenCalledTimes(1);
    expect(state.stopped).not.toHaveBeenCalled();
  });
  it('awaits the retained connection stop before clearing its local history', async () => {
    let finishStop!: () => void;
    state.stopBarrier = new Promise<void>((resolve) => {
      finishStop = resolve;
    });
    renderShell();
    openPeer();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }));
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset saved data' }));
    expect(state.stopped).toHaveBeenCalledTimes(1);
    expect(state.cleared).not.toHaveBeenCalled();
    expect(state.unmounted).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Leave settings' }));
    chooseYacht();
    expect(screen.queryByRole('button', { name: 'Play with someone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to match' })).not.toBeInTheDocument();
    await act(async () => {
      finishStop();
    });
    expect(state.unmounted).toHaveBeenCalledTimes(1);
    expect(state.cleared).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Play with someone' })).toBeInTheDocument();
  });
});
