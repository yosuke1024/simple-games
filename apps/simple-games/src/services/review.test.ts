import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { inAppReviewMock, networkMock, openExternalMock } = vi.hoisted(() => ({
  inAppReviewMock: { requestReview: vi.fn() },
  networkMock: { online: true },
  openExternalMock: vi.fn(),
}));

vi.mock('@capacitor-community/in-app-review', () => ({ InAppReview: inAppReviewMock }));
vi.mock('./network', () => ({ isOnline: () => networkMock.online }));
vi.mock('../ui/openExternal', () => ({ openExternal: openExternalMock }));

import { PLAY_STORE_URL } from '@simple-games/brand';
import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
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

    const raw = await kv.get(STORAGE_KEYS.review);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ resolved: true, gamesCompleted: 55 });
  });

  it('a corrupt record falls back to a fresh counter', async () => {
    const kv = createMemoryKV({ [STORAGE_KEYS.review]: '{"schemaVersion":9}' });
    await initReview(kv);
    expect(shouldPromptReview()).toBe(false);
  });
});

describe('requestStoreReview', () => {
  it('falls back to the store listing on the web', async () => {
    await requestStoreReview();
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
  });
});
