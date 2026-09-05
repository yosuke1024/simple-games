/**
 * The boot sequence's one guarantee: a step that fails costs only itself.
 *
 * These reads shared a single `try` until issue #96, so the first
 * rejection skipped every step after it — an unreadable entitlement took the
 * settings and the recent-games row down with it, silently. The steps are
 * mocked here because what is under test is the sequence, not what any one
 * step reads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsSchema, type Settings } from '../storage/schemas';
import { initShellState, startAdsUnlessRemoved } from './boot';

const mocks = vi.hoisted(() => ({
  initNetwork: vi.fn<() => Promise<void>>(),
  initAdRemoval: vi.fn<() => Promise<void>>(),
  initReview: vi.fn<() => Promise<void>>(),
  initRecentGames: vi.fn<() => Promise<void>>(),
  initFavoriteGames: vi.fn<() => Promise<void>>(),
  initWebAppPrompt: vi.fn<() => Promise<void>>(),
  initShortcutLaunch: vi.fn<() => Promise<void>>(),
  initHomeShortcuts: vi.fn<() => Promise<void>>(),
  loadRecord: vi.fn<() => Promise<Settings>>(),
  isAdRemovalActive: vi.fn<() => boolean>(),
  initAds: vi.fn<() => Promise<void>>(),
}));

vi.mock('../monetization/adRemoval', () => ({
  initAdRemoval: mocks.initAdRemoval,
  isAdRemovalActive: mocks.isAdRemovalActive,
}));
vi.mock('../services/ads/banner', () => ({ initAds: mocks.initAds }));
vi.mock('../services/network', () => ({ initNetwork: mocks.initNetwork }));
vi.mock('../services/review', () => ({ initReview: mocks.initReview }));
vi.mock('../services/webAppPrompt', () => ({ initWebAppPrompt: mocks.initWebAppPrompt }));
vi.mock('../storage/repo', () => ({ loadRecord: mocks.loadRecord }));
vi.mock('./recentGames', () => ({ initRecentGames: mocks.initRecentGames }));
vi.mock('./favoriteGames', () => ({ initFavoriteGames: mocks.initFavoriteGames }));
vi.mock('./shortcutLaunch', () => ({ initShortcutLaunch: mocks.initShortcutLaunch }));
vi.mock('../services/homeShortcut/homeShortcut', () => ({
  initHomeShortcuts: mocks.initHomeShortcuts,
}));

const storedSettings: Settings = { ...settingsSchema.defaultValue(), theme: 'dark' };

const failing = () => Promise.reject(new Error('storage unavailable'));

beforeEach(() => {
  mocks.initNetwork.mockReset().mockResolvedValue(undefined);
  mocks.initAdRemoval.mockReset().mockResolvedValue(undefined);
  mocks.initReview.mockReset().mockResolvedValue(undefined);
  mocks.initRecentGames.mockReset().mockResolvedValue(undefined);
  mocks.initFavoriteGames.mockReset().mockResolvedValue(undefined);
  mocks.initWebAppPrompt.mockReset().mockResolvedValue(undefined);
  mocks.initShortcutLaunch.mockReset().mockResolvedValue(undefined);
  mocks.initHomeShortcuts.mockReset().mockResolvedValue(undefined);
  mocks.loadRecord.mockReset().mockResolvedValue(storedSettings);
  mocks.isAdRemovalActive.mockReset().mockReturnValue(false);
  mocks.initAds.mockReset().mockResolvedValue(undefined);
});

describe('initShellState (issue #96)', () => {
  it('reads every shared record and hands back the stored settings', async () => {
    await expect(initShellState()).resolves.toEqual(storedSettings);
    expect(mocks.initNetwork).toHaveBeenCalledTimes(1);
    expect(mocks.initAdRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.initReview).toHaveBeenCalledTimes(1);
    expect(mocks.initRecentGames).toHaveBeenCalledTimes(1);
    expect(mocks.initFavoriteGames).toHaveBeenCalledTimes(1);
    expect(mocks.initWebAppPrompt).toHaveBeenCalledTimes(1);
    // The Android shortcut steps (issue #110): which game a home-screen
    // shortcut launched us into, and whether the launcher pins at all.
    expect(mocks.initShortcutLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.initHomeShortcuts).toHaveBeenCalledTimes(1);
  });

  it('runs the later steps even when an earlier one fails', async () => {
    mocks.initAdRemoval.mockImplementation(failing);
    mocks.initReview.mockImplementation(failing);

    // The settings read is last, so it is the step the old shared `try`
    // dropped first — the player's language and theme, gone for the launch.
    await expect(initShellState()).resolves.toEqual(storedSettings);
    expect(mocks.initRecentGames).toHaveBeenCalledTimes(1);
    expect(mocks.initFavoriteGames).toHaveBeenCalledTimes(1);
    expect(mocks.initWebAppPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.initShortcutLaunch).toHaveBeenCalledTimes(1);
    expect(mocks.initHomeShortcuts).toHaveBeenCalledTimes(1);
  });

  // A shortcut step that fails must cost only itself: the settings read
  // behind it is the player's language and theme.
  it('still reads the settings when a shortcut step fails', async () => {
    mocks.initShortcutLaunch.mockImplementation(failing);
    mocks.initHomeShortcuts.mockImplementation(failing);
    await expect(initShellState()).resolves.toEqual(storedSettings);
  });

  it('falls back to the default settings when their own read fails', async () => {
    mocks.loadRecord.mockImplementation(failing);
    await expect(initShellState()).resolves.toEqual(settingsSchema.defaultValue());
  });

  it('never rejects, whatever every step does', async () => {
    mocks.initNetwork.mockImplementation(failing);
    mocks.initAdRemoval.mockImplementation(failing);
    mocks.initReview.mockImplementation(failing);
    mocks.initRecentGames.mockImplementation(failing);
    mocks.initFavoriteGames.mockImplementation(failing);
    mocks.initWebAppPrompt.mockImplementation(failing);
    mocks.initShortcutLaunch.mockImplementation(failing);
    mocks.initHomeShortcuts.mockImplementation(failing);
    mocks.loadRecord.mockImplementation(failing);
    await expect(initShellState()).resolves.toEqual(settingsSchema.defaultValue());
  });
});

describe('startAdsUnlessRemoved', () => {
  it('leaves the ad SDK alone when the ad removal takes effect', () => {
    // Purchased, or an entitlement that could not be read at all: either way
    // no ad code runs this launch (docs/ADS_POLICY.md).
    mocks.isAdRemovalActive.mockReturnValue(true);
    startAdsUnlessRemoved();
    expect(mocks.initAds).not.toHaveBeenCalled();
  });

  it('starts it on an ordinary launch', () => {
    mocks.isAdRemovalActive.mockReturnValue(false);
    startAdsUnlessRemoved();
    expect(mocks.initAds).toHaveBeenCalledTimes(1);
  });
});
