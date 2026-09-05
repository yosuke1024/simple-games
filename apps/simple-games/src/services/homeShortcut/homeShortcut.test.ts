/**
 * Asking Android to pin a game (issue #110). What is pinned here is the
 * contract with the sheet that offers it: the door exists only where the
 * launcher takes pin requests, a request carries exactly the game's title,
 * the browser's address for it and the drawn icon, and no ending — an
 * unsupported launcher, a plugin that rejects, a request the launcher
 * declines — ever reaches the caller as a throw.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, pluginMock, iconMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'android' },
  pluginMock: {
    isSupported: vi.fn<() => Promise<{ supported: boolean }>>(),
    requestPin: vi.fn<(request: unknown) => Promise<{ requested: boolean }>>(),
  },
  iconMock: { render: vi.fn<() => string | null>() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));
vi.mock('@capacitor/app', () => ({ App: { getLaunchUrl: vi.fn() } }));
vi.mock('./plugin', () => ({ HomeShortcut: pluginMock }));
vi.mock('./icon', () => ({ renderHomeShortcutIcon: iconMock.render }));

import { GAMES } from '../../app/registry';
import {
  homeShortcutsAvailable,
  initHomeShortcuts,
  requestHomeShortcut,
  resetHomeShortcutsForTesting,
} from './homeShortcut';

const sudoku = GAMES.find((game) => game.id === 'sudoku')!;

beforeEach(() => {
  capacitorMock.platform = 'android';
  pluginMock.isSupported.mockReset().mockResolvedValue({ supported: true });
  pluginMock.requestPin.mockReset().mockResolvedValue({ requested: true });
  iconMock.render.mockReset().mockReturnValue('UE5H');
  resetHomeShortcutsForTesting();
});

describe('whether the door is offered', () => {
  it('is settled at boot by the launcher, on Android', async () => {
    await initHomeShortcuts();
    expect(homeShortcutsAvailable()).toBe(true);
    expect(pluginMock.isSupported).toHaveBeenCalledTimes(1);
  });

  it('is withheld where the launcher takes no pin requests', async () => {
    pluginMock.isSupported.mockResolvedValue({ supported: false });
    await initHomeShortcuts();
    expect(homeShortcutsAvailable()).toBe(false);
  });

  it('is withheld, without a throw, when the plugin itself fails', async () => {
    pluginMock.isSupported.mockRejectedValue(new Error('not implemented'));
    await expect(initHomeShortcuts()).resolves.toBeUndefined();
    expect(homeShortcutsAvailable()).toBe(false);
  });

  it.each(['ios', 'web'])('is never asked about on %s', async (platform) => {
    capacitorMock.platform = platform;
    await initHomeShortcuts();
    expect(pluginMock.isSupported).not.toHaveBeenCalled();
    expect(homeShortcutsAvailable()).toBe(false);
  });

  it('is withheld until boot has asked', () => {
    expect(homeShortcutsAvailable()).toBe(false);
  });
});

describe('asking for a shortcut', () => {
  it('hands the launcher the title, the game’s address and the drawn icon', async () => {
    await initHomeShortcuts();
    await expect(requestHomeShortcut(sudoku)).resolves.toBe(true);
    expect(pluginMock.requestPin).toHaveBeenCalledWith({
      id: 'game-sudoku',
      label: 'Sudoku',
      uri: 'https://pixapps.ai/simple-games/play/?game=sudoku',
      icon: 'UE5H',
    });
    expect(iconMock.render).toHaveBeenCalledWith(sudoku);
  });

  // The launcher then shows the app icon. A missing picture is never a
  // reason to withhold the door.
  it('leaves the icon out when it could not be drawn', async () => {
    iconMock.render.mockReturnValue(null);
    await initHomeShortcuts();
    await requestHomeShortcut(sudoku);
    const [request] = pluginMock.requestPin.mock.calls[0]!;
    expect(request).not.toHaveProperty('icon');
    expect(request).toMatchObject({ id: 'game-sudoku', label: 'Sudoku' });
  });

  it('asks nothing where the door was never offered', async () => {
    await expect(requestHomeShortcut(sudoku)).resolves.toBe(false);
    expect(pluginMock.requestPin).not.toHaveBeenCalled();
  });

  it('reports a request the launcher declined as false, not as an error', async () => {
    pluginMock.requestPin.mockResolvedValue({ requested: false });
    await initHomeShortcuts();
    await expect(requestHomeShortcut(sudoku)).resolves.toBe(false);
  });

  it('never rejects, whatever the plugin does', async () => {
    pluginMock.requestPin.mockRejectedValue(new Error('Could not request the shortcut'));
    await initHomeShortcuts();
    await expect(requestHomeShortcut(sudoku)).resolves.toBe(false);
  });

  // One record per game on the OS side. The launcher may still put a second
  // icon on the workspace if the player confirms again — its call, made at
  // its own dialog (plugin.ts).
  it('uses a stable id per game, so asking twice updates the one record', async () => {
    await initHomeShortcuts();
    await requestHomeShortcut(sudoku);
    await requestHomeShortcut(sudoku);
    const ids = pluginMock.requestPin.mock.calls.map(([request]) => (request as { id: string }).id);
    expect(ids).toEqual(['game-sudoku', 'game-sudoku']);
  });
});
