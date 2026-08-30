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

/** The queue holds `arguments` objects; read them as the tag would. */
function queuedCommands(): unknown[][] {
  return (window.dataLayer ?? []).map((command) => Array.from(command) as unknown[]);
}

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

    const commands = queuedCommands();
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

  // The regression this file exists for. Until 2026-08-30 the shim pushed a
  // plain array, the Google tag dropped every entry as not-a-command, and the
  // three assertions above still passed — the queue had the right contents in
  // the one shape that never reaches Google (issue #84). Shape, not contents.
  it('pushes commands in the Google tag format, not as plain arrays', () => {
    expect(initWebAnalytics('G-ABC12345')).toBe(true);
    trackGameOpened('sudoku', 'G-ABC12345');
    trackGameClosed('sudoku', 'G-ABC12345');

    const queue = window.dataLayer ?? [];
    expect(queue).toHaveLength(4);
    for (const command of queue) {
      expect(Array.isArray(command)).toBe(false);
      expect(Object.prototype.toString.call(command)).toBe('[object Arguments]');
    }

    // Index 0 is the one command the assertions above never looked at, and
    // the only one carrying something other than plain objects: a Date that
    // arrives mangled is how a shim that copies `arguments` would show up.
    const [js, config, open, close] = queuedCommands();
    expect(js).toEqual(['js', expect.any(Date)]);
    expect(config?.slice(0, 2)).toEqual(['config', 'G-ABC12345']);
    expect(open?.slice(0, 2)).toEqual(['event', 'game_open']);
    expect(close?.slice(0, 2)).toEqual(['event', 'game_close']);
  });

  // The page view is not an event of its own: the Google tag derives it from
  // `config`. So "one page view" is "one config" — do not add an explicit
  // page_view event, that is how a page gets counted twice. Both track
  // functions call the initializer again on every call, and only the module's
  // once-per-page-load latch keeps that from configuring the tag per game.
  it('sends one page view, and one event per open and per close', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);

    expect(initWebAnalytics('G-ABC12345')).toBe(true);
    trackGameOpened('sudoku', 'G-ABC12345');
    trackGameClosed('sudoku', 'G-ABC12345');
    trackGameOpened('kakuro', 'G-ABC12345');
    trackGameClosed('kakuro', 'G-ABC12345');

    const names = queuedCommands().map(([name, argument]) =>
      name === 'event' ? `event:${String(argument)}` : String(name),
    );
    expect(names).toEqual([
      'js',
      'config',
      'event:game_open',
      'event:game_close',
      'event:game_open',
      'event:game_close',
    ]);
  });

  // play/ is served inside pixapps.ai, whose shared header expects the site's
  // own tag. When one is already on the page we send through it rather than
  // installing a second — and never into `dataLayer` behind its back, which
  // would land the commands in whichever queue that tag is not draining.
  it('sends through a Google tag the page already has', () => {
    const siteGtag = vi.fn<(...args: unknown[]) => void>();
    window.gtag = siteGtag;

    expect(initWebAnalytics('G-ABC12345')).toBe(true);
    trackGameOpened('sudoku', 'G-ABC12345');

    expect(window.gtag).toBe(siteGtag);
    expect(siteGtag.mock.calls.map(([name]) => name)).toEqual(['js', 'config', 'event']);
    expect(window.dataLayer).toHaveLength(0);
  });

  // A tag that never loads leaves a queue that only grows. Players hear
  // nothing about it; whoever is holding the browser open should — and the
  // marker outlives the warning, which a shipped build does not carry.
  it('records a Google tag that failed to load, and says so in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(initWebAnalytics('G-ABC12345')).toBe(true);
    document.querySelector('script[data-simple-games-ga4]')?.dispatchEvent(new Event('error'));

    expect(document.querySelector('script[data-simple-games-ga4-failed]')).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('did not load'), expect.anything());
    // Recorded, never retried: one element, and no second attempt.
    expect(document.querySelectorAll('script[data-simple-games-ga4]')).toHaveLength(1);
  });

  it('says so in development when the measurement ID is set but unusable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(initWebAnalytics('UA-12345-1')).toBe(false);
    expect(document.querySelector('script[data-simple-games-ga4]')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('measurement ID'), expect.anything());
  });

  it('stays quiet when no measurement ID is configured at all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(initWebAnalytics(undefined)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
