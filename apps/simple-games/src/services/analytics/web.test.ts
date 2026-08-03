import { afterEach, describe, expect, it, vi } from 'vitest';
import { setOnlineForTesting } from '../network';
import {
  initWebAnalytics,
  measurementIdFromEnv,
  resetWebAnalyticsForTesting,
  trackGameClosed,
  trackGameOpened,
} from './web';

afterEach(() => {
  resetWebAnalyticsForTesting();
  setOnlineForTesting(true);
  vi.restoreAllMocks();
});

describe('web analytics', () => {
  it('accepts only GA4 measurement IDs', () => {
    expect(measurementIdFromEnv(' G-ABC12345 ')).toBe('G-ABC12345');
    expect(measurementIdFromEnv(undefined)).toBeNull();
    expect(measurementIdFromEnv('')).toBeNull();
    expect(measurementIdFromEnv('UA-12345-1')).toBeNull();
    expect(measurementIdFromEnv('G-XXXXXX!')).toBeNull();
  });

  it('stays off for the whole page load when the first attempt is offline', () => {
    setOnlineForTesting(false);

    expect(initWebAnalytics('G-ABC12345')).toBe(false);
    expect(document.querySelector('script[data-simple-games-ga4]')).toBeNull();

    setOnlineForTesting(true);
    expect(initWebAnalytics('G-ABC12345')).toBe(false);
    expect(document.querySelector('script[data-simple-games-ga4]')).toBeNull();
  });

  it('queues the page view and shell-level game events only', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(100).mockReturnValueOnce(1_600);

    expect(initWebAnalytics('G-ABC12345')).toBe(true);
    trackGameOpened('sudoku', 'G-ABC12345');
    trackGameClosed('sudoku', 'G-ABC12345');

    const script = document.querySelector<HTMLScriptElement>('script[data-simple-games-ga4]');
    expect(script?.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-ABC12345');

    const commands = window.dataLayer ?? [];
    expect(commands[1]).toEqual([
      'config',
      'G-ABC12345',
      { content_group: 'simple_games_play', content_type: 'game_collection' },
    ]);
    expect(commands[2]).toEqual([
      'event',
      'game_open',
      {
        content_group: 'simple_games_play',
        content_type: 'game',
        content_id: 'sudoku',
        game_id: 'sudoku',
      },
    ]);
    expect(commands[3]).toEqual([
      'event',
      'game_close',
      {
        content_group: 'simple_games_play',
        content_type: 'game',
        content_id: 'sudoku',
        game_id: 'sudoku',
        play_duration_ms: 1500,
        engagement_time_msec: 1500,
      },
    ]);
  });
});
