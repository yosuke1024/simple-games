/**
 * Which games the shell offers Play Together for (App.tsx hands a game's home
 * `onPlayTogether` only when this says yes). The iOS app leaves two titles out
 * (app/iosWithheldGames.ts), and this is one of their doors: the game's own
 * Play Together, the one way an iPhone would host their table. Android keeps
 * it, and the browser offers Nearby for no game at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'web' as 'web' | 'android' | 'ios' },
}));
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.platform !== 'web',
      getPlatform: () => capacitorMock.platform,
    },
  };
});

import { NEARBY_CAPACITY, NEARBY_GAME_CODES } from './nearbyGameIds';
import { nearbyAvailable, nearbyDiscoveryAvailable } from './nearbyGate';

const WITHHELD_FROM_IOS = ['texas-holdem', 'blackjack'];
const nearbyIds = Object.keys(NEARBY_GAME_CODES);
const fourSeat = nearbyIds.filter(
  (id) => NEARBY_CAPACITY[id as keyof typeof NEARBY_CAPACITY] === 4,
);

beforeEach(() => {
  capacitorMock.platform = 'web';
});

describe('Play Together in the iOS app', () => {
  beforeEach(() => {
    capacitorMock.platform = 'ios';
  });

  it.each(WITHHELD_FROM_IOS)('is not offered for %s', (id) => {
    expect(nearbyAvailable(id)).toBe(false);
  });

  it('is offered for the other twenty-six Nearby games, eight of them four-seat', () => {
    const offered = nearbyIds.filter((id) => nearbyAvailable(id));
    expect(offered).toEqual(nearbyIds.filter((id) => !WITHHELD_FROM_IOS.includes(id)));
    expect(offered).toHaveLength(26);
    expect(fourSeat.filter((id) => nearbyAvailable(id))).toHaveLength(8);
  });

  it('keeps the collection-wide search, which never names either title (NearbyBrowser)', () => {
    expect(nearbyDiscoveryAvailable()).toBe(true);
  });
});

describe('Play Together on Android', () => {
  beforeEach(() => {
    capacitorMock.platform = 'android';
  });

  it.each(WITHHELD_FROM_IOS)('is offered for %s', (id) => {
    expect(nearbyAvailable(id)).toBe(true);
  });

  it('is offered for all twenty-eight Nearby games, ten of them four-seat', () => {
    expect(nearbyIds.filter((id) => nearbyAvailable(id))).toHaveLength(28);
    expect(fourSeat).toHaveLength(10);
    expect(fourSeat.filter((id) => nearbyAvailable(id))).toHaveLength(10);
  });
});

describe('Play Together in the browser', () => {
  it('is offered for no game, either title included', () => {
    expect(nearbyIds.filter((id) => nearbyAvailable(id))).toEqual([]);
    expect(nearbyDiscoveryAvailable()).toBe(false);
  });
});

describe('Play Together for a game Nearby does not support', () => {
  it('is never offered, on either app', () => {
    for (const platform of ['android', 'ios'] as const) {
      capacitorMock.platform = platform;
      expect(nearbyAvailable('sudoku')).toBe(false);
      expect(nearbyAvailable('not-a-game')).toBe(false);
    }
  });
});
