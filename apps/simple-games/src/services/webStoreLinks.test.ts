/**
 * The one decision the app card's links still carry (docs/WEB_VERSION.md
 * 「アプリへの送客」): the two stores are not interchangeable destinations.
 * An iPhone sent to Google Play lands on a page it cannot install from, which
 * reads as a broken button rather than as an invitation.
 *
 * Reading the user agent is the only thing done with it — nothing here stores
 * or sends it, and there is nothing else in this module to test: the card is
 * ordinary content on the collection home now (issue #192), so no counter, no
 * threshold and no record survives to have rules of its own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';
import { STORE_URLS, storeTargets } from './webStoreLinks';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
