import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, inAppReviewMock, networkMock, openExternalMock } = vi.hoisted(() => ({
  capacitorMock: { native: true, platform: 'android' },
  inAppReviewMock: { requestReview: vi.fn() },
  networkMock: { online: true },
  openExternalMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorMock.native,
    getPlatform: () => capacitorMock.platform,
  },
}));
vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: inAppReviewMock }));
vi.mock('./network', () => ({ isOnline: () => networkMock.online }));
vi.mock('../ui/openExternal', () => ({ openExternal: openExternalMock }));

import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';
import { createMemoryKV } from '../storage/kv';
import { loadRecord } from '../storage/repo';
import { reviewSchema, STORAGE_KEYS } from '../storage/schemas';
import {
  initReview,
  markReviewPromptShown,
  recordGameCompleted,
  requestStoreReview,
  resetReviewForTesting,
  resolveReviewPrompt,
  shouldPromptReview,
} from './review';

beforeEach(() => {
  vi.clearAllMocks();
  networkMock.online = true;
  capacitorMock.native = true;
  capacitorMock.platform = 'android';
});

afterEach(() => {
  resetReviewForTesting();
});

const winTimes = (n: number) => {
  for (let i = 0; i < n; i += 1) recordGameCompleted();
};

describe('review prompt cadence', () => {
  it('asks nothing before the fifth completed game', async () => {
    await initReview(createMemoryKV());
    winTimes(4);
    expect(shouldPromptReview()).toBe(false);
    recordGameCompleted();
    expect(shouldPromptReview()).toBe(true);
  });

  it('never asks while offline (a "yes" could reach nothing)', async () => {
    await initReview(createMemoryKV());
    winTimes(5);
    networkMock.online = false;
    expect(shouldPromptReview()).toBe(false);
  });

  it('never asks on the web build (there is no install to rate)', async () => {
    await initReview(createMemoryKV());
    winTimes(50);
    capacitorMock.native = false;
    expect(shouldPromptReview()).toBe(false);
  });

  it('an answered prompt retires the question for good', async () => {
    await initReview(createMemoryKV());
    winTimes(5);
    markReviewPromptShown();
    resolveReviewPrompt();
    winTimes(1000);
    expect(shouldPromptReview()).toBe(false);
  });

  it('"not now" re-arms once, twenty completions later', async () => {
    await initReview(createMemoryKV());
    winTimes(5);
    markReviewPromptShown(); // shown, then dismissed
    expect(shouldPromptReview()).toBe(false);
    winTimes(19);
    expect(shouldPromptReview()).toBe(false);
    winTimes(1);
    expect(shouldPromptReview()).toBe(true);
    markReviewPromptShown(); // second dismissal: the hard cap ends it
    winTimes(1000);
    expect(shouldPromptReview()).toBe(false);
  });

  it('persists across restarts', async () => {
    const kv = createMemoryKV();
    await initReview(kv);
    winTimes(5);
    markReviewPromptShown();
    resolveReviewPrompt();

    resetReviewForTesting();
    await initReview(kv);
    winTimes(50);
    expect(shouldPromptReview()).toBe(false);

    // Read the way the app does. Storage runs a key's operations in the order
    // they were asked for (storage/repo.ts), so reaching past it into the
    // store can see a moment when the fire-and-forget saves above have not all
    // landed yet — which says nothing about whether the counter persisted.
    expect(await loadRecord(reviewSchema, kv)).toMatchObject({
      resolved: true,
      gamesCompleted: 55,
    });
  });

  it('a corrupt record falls back to a fresh counter', async () => {
    const kv = createMemoryKV({ [STORAGE_KEYS.review]: '{"schemaVersion":9}' });
    await initReview(kv);
    expect(shouldPromptReview()).toBe(false);
  });
});

describe('requestStoreReview', () => {
  it('falls back to the store listing off-device', async () => {
    capacitorMock.native = false;
    capacitorMock.platform = 'web';
    await requestStoreReview();
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
  });

  it('falls back to Play when the native card fails on Android', async () => {
    inAppReviewMock.requestReview.mockRejectedValueOnce(new Error('no quota'));
    await requestStoreReview();
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
  });

  // An iPhone opened on Google Play cannot install anything: the fallback has
  // to know which store this device came from.
  it('falls back to the App Store when the native card fails on iOS', async () => {
    capacitorMock.platform = 'ios';
    inAppReviewMock.requestReview.mockRejectedValueOnce(new Error('no quota'));
    await requestStoreReview();
    expect(openExternalMock).toHaveBeenCalledWith(APP_STORE_URL);
  });
});
