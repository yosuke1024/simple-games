/**
 * The rules docs/WEB_VERSION.md「アプリへの送客」 states, pinned where they are
 * enforced. Three of them are the whole point of the feature and none is
 * visible by reading the card: it never appears on the app build, it never
 * appears before two games have been left, and it never appears twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, networkMock } = vi.hoisted(() => ({
  capacitorMock: { native: false },
  networkMock: { online: true },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => capacitorMock.native },
}));
vi.mock('./network', () => ({ isOnline: () => networkMock.online }));

import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';
import { createMemoryKV } from '../storage/kv';
import { loadRecord } from '../storage/repo';
import { STORAGE_KEYS, webAppPromptSchema } from '../storage/schemas';
import {
  getWebAppPromptStateForTesting,
  initWebAppPrompt,
  markWebAppPromptShown,
  noteWebArrivalOnGame,
  recordWebGameExit,
  resetWebAppPromptForTesting,
  shouldShowWebAppPrompt,
  STORE_URLS,
  storeTargets,
} from './webAppPrompt';

beforeEach(() => {
  capacitorMock.native = false;
  networkMock.online = true;
});

afterEach(() => {
  resetWebAppPromptForTesting();
  vi.unstubAllGlobals();
});

const leaveGames = (n: number) => {
  for (let i = 0; i < n; i += 1) recordWebGameExit();
};

describe('when the card becomes due', () => {
  // Pinned against WEB_APP_PROMPT_FROM_LINK_AT below loosening this: an
  // ordinary visitor — nobody called `noteWebArrivalOnGame()` — still needs
  // the full two exits. One is not enough.
  it('says nothing on a first visit or after a single game', async () => {
    await initWebAppPrompt(createMemoryKV());
    expect(shouldShowWebAppPrompt()).toBe(false);
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(false);
  });

  it('is due once a second game has been left for the collection', async () => {
    await initWebAppPrompt(createMemoryKV());
    leaveGames(2);
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('never comes back after its one showing', async () => {
    await initWebAppPrompt(createMemoryKV());
    leaveGames(2);
    markWebAppPromptShown();
    expect(shouldShowWebAppPrompt()).toBe(false);
    leaveGames(50);
    expect(shouldShowWebAppPrompt()).toBe(false);
  });

  it('waits rather than spending its one showing on a dead store link', async () => {
    await initWebAppPrompt(createMemoryKV());
    leaveGames(2);
    networkMock.online = false;
    expect(shouldShowWebAppPrompt()).toBe(false);
    // Nothing was booked while offline, so the next arrival online still has
    // the card to show — the retry is the visitor's, not a timer's.
    networkMock.online = true;
    expect(shouldShowWebAppPrompt()).toBe(true);
  });
});

/**
 * The lowered threshold for a visitor who arrived on a game rather than on
 * the collection (`WEB_APP_PROMPT_FROM_LINK_AT`, docs/WEB_VERSION.md
 * 「アプリへの送客」): a shared link or a guide link already recommended the
 * app once, so waiting for a second exit costs them the card outright, since
 * that kind of visitor usually only ever plays the one game they were sent.
 */
describe('a visitor who arrived on a game', () => {
  it('is eligible after a single exit, not two', async () => {
    await initWebAppPrompt(createMemoryKV());
    noteWebArrivalOnGame();
    expect(shouldShowWebAppPrompt()).toBe(false);
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('does nothing when called on the native build', async () => {
    capacitorMock.native = true;
    await initWebAppPrompt(createMemoryKV());
    // Guarded no-op: isNativePlatform() is true at the moment this is called.
    noteWebArrivalOnGame();
    capacitorMock.native = false;
    recordWebGameExit();
    // Had the flag actually been set, one exit would already be enough.
    expect(shouldShowWebAppPrompt()).toBe(false);
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('is cleared by initWebAppPrompt, so a later visit needs the ordinary two', async () => {
    const kv = createMemoryKV();
    await initWebAppPrompt(kv);
    noteWebArrivalOnGame();
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(true);

    // A later visit that opens on the collection this time, not on a game.
    await initWebAppPrompt(kv);
    expect(shouldShowWebAppPrompt()).toBe(false);
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('is still suppressed offline', async () => {
    await initWebAppPrompt(createMemoryKV());
    noteWebArrivalOnGame();
    recordWebGameExit();
    networkMock.online = false;
    expect(shouldShowWebAppPrompt()).toBe(false);
    networkMock.online = true;
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('is still a once-ever showing', async () => {
    await initWebAppPrompt(createMemoryKV());
    noteWebArrivalOnGame();
    recordWebGameExit();
    markWebAppPromptShown();
    expect(shouldShowWebAppPrompt()).toBe(false);
    recordWebGameExit();
    recordWebGameExit();
    expect(shouldShowWebAppPrompt()).toBe(false);
  });
});

describe('the app build', () => {
  it('shows nothing, counts nothing, and stores nothing', async () => {
    capacitorMock.native = true;
    const kv = createMemoryKV();
    await initWebAppPrompt(kv);
    leaveGames(10);
    expect(shouldShowWebAppPrompt()).toBe(false);
    expect(await kv.get(STORAGE_KEYS.webAppPrompt)).toBeNull();
  });

  it('does not read the record either — an install carries no such state', async () => {
    capacitorMock.native = true;
    const kv = createMemoryKV({
      [STORAGE_KEYS.webAppPrompt]: JSON.stringify({
        schemaVersion: 1,
        gameExits: 99,
        shown: false,
      }),
    });
    await initWebAppPrompt(kv);
    expect(getWebAppPromptStateForTesting().gameExits).toBe(0);
    expect(shouldShowWebAppPrompt()).toBe(false);
  });
});

describe('what survives a reload', () => {
  it('remembers the exits, so a card due in one visit is due in the next', async () => {
    const kv = createMemoryKV();
    await initWebAppPrompt(kv);
    leaveGames(2);
    await initWebAppPrompt(kv);
    expect(shouldShowWebAppPrompt()).toBe(true);
  });

  it('remembers the showing, so a reload cannot ask for a second card', async () => {
    const kv = createMemoryKV();
    await initWebAppPrompt(kv);
    leaveGames(2);
    markWebAppPromptShown();
    await initWebAppPrompt(kv);
    expect(shouldShowWebAppPrompt()).toBe(false);
  });

  it('stops writing once shown: the count can never matter again', async () => {
    const kv = createMemoryKV();
    await initWebAppPrompt(kv);
    leaveGames(2);
    markWebAppPromptShown();
    leaveGames(5);
    const stored = await loadRecord(webAppPromptSchema, kv);
    expect(stored).toEqual({ schemaVersion: 1, gameExits: 2, shown: true });
  });

  it('falls back to a fresh counter when the stored record is unusable', async () => {
    const kv = createMemoryKV({ [STORAGE_KEYS.webAppPrompt]: '{"schemaVersion":9}' });
    await initWebAppPrompt(kv);
    expect(getWebAppPromptStateForTesting()).toEqual({
      schemaVersion: 1,
      gameExits: 0,
      shown: false,
    });
  });
});

/**
 * The two stores are not interchangeable destinations: an iPhone sent to
 * Google Play lands on a page it cannot install from. Reading the user agent
 * is the only thing done with it — nothing here stores or sends it.
 */
describe('which store the card offers', () => {
  const withAgent = (userAgent: string, maxTouchPoints = 0) => {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
  };

  it('sends an Android browser to Google Play alone', () => {
    withAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile');
    expect(storeTargets()).toEqual(['android']);
  });

  it('sends an iPhone to the App Store alone', () => {
    withAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15');
    expect(storeTargets()).toEqual(['ios']);
  });

  it('sends an iPad to the App Store, though it calls itself a Macintosh', () => {
    // iPadOS 13+ reports the desktop agent; the touch points are what is left
    // to tell it apart from a Mac.
    withAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5);
    expect(storeTargets()).toEqual(['ios']);
  });

  it('offers both when the answer is not obvious, rather than guessing', () => {
    withAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126');
    expect(storeTargets()).toEqual(['android', 'ios']);
    withAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    expect(storeTargets()).toEqual(['android', 'ios']);
  });

  it('links the listings the whole product shares, not a copy of them', () => {
    expect(STORE_URLS).toEqual({ android: PLAY_STORE_URL, ios: APP_STORE_URL });
  });
});
