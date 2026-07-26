import { describe, expect, it } from 'vitest';
import { DEFAULT_REMOTE_CONFIG } from '../remoteConfig';
import { canShowInterstitial, type InterstitialCounters } from './interstitialPolicy';

const NOW = 1_800_000_000_000;

/** Counters that satisfy every default gate. */
const eligible = (): InterstitialCounters => ({
  sessionCount: 2,
  totalPlaySeconds: 10 * 60,
  completedGames: 2,
  lastInterstitialAt: null,
  shownToday: 0,
});

describe('canShowInterstitial', () => {
  it('allows when every gate passes', () => {
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, eligible(), NOW)).toBe(true);
  });

  it('blocks when disabled via config (kill switch)', () => {
    const config = { ...DEFAULT_REMOTE_CONFIG, interstitial_enabled: false };
    expect(canShowInterstitial(config, eligible(), NOW)).toBe(false);
  });

  it('blocks during the first session', () => {
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, { ...eligible(), sessionCount: 1 }, NOW)).toBe(
      false,
    );
  });

  it('allows the first session when that gate is disabled', () => {
    const config = { ...DEFAULT_REMOTE_CONFIG, interstitial_first_session_disabled: false };
    expect(canShowInterstitial(config, { ...eligible(), sessionCount: 1 }, NOW)).toBe(true);
  });

  it('blocks below the minimum play time', () => {
    const counters = { ...eligible(), totalPlaySeconds: 10 * 60 - 1 };
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, counters, NOW)).toBe(false);
  });

  it('blocks below the minimum completed games', () => {
    const counters = { ...eligible(), completedGames: 1 };
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, counters, NOW)).toBe(false);
  });

  it('enforces the daily limit', () => {
    const counters = { ...eligible(), shownToday: 3 };
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, counters, NOW)).toBe(false);
    expect(
      canShowInterstitial(DEFAULT_REMOTE_CONFIG, { ...eligible(), shownToday: 2 }, NOW),
    ).toBe(true);
  });

  it('enforces the minimum interval', () => {
    const justShown = { ...eligible(), lastInterstitialAt: NOW - 14 * 60_000 };
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, justShown, NOW)).toBe(false);
    const longAgo = { ...eligible(), lastInterstitialAt: NOW - 15 * 60_000 };
    expect(canShowInterstitial(DEFAULT_REMOTE_CONFIG, longAgo, NOW)).toBe(true);
  });
});
