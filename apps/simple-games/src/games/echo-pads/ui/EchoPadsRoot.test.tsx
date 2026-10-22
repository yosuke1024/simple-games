/**
 * Echo Pads through its screens, the way a player meets it
 * (docs/ECHO_PADS_RULES.md; test ⑦ and the plan's game-specific list):
 * Quick Rules and straight into a level that waits for ▶; the playback
 * walking the timetable one pad at a time and stopping on Stop, the
 * background and `blur` without coming back; presses refused while it plays;
 * ▶ withheld once input began; a miss — the pad that came next ringed, the
 * slot gone, the round heard again, a new sequence — and a clear; the Pace;
 * the keyboard; the two slots coming back (decision 8 (B)), a shortcut that
 * opens onto a run without playing it; the replace question; the statistics;
 * the play clock booked on unmount.
 *
 * Saves go to Capacitor Preferences, mocked here as `deviceStore`. The
 * timers are vitest's fake ones — `performance` included, because the
 * playback measures each delay from ▶ — so a playback of 2,350 ms is walked
 * in exact steps.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  beginDailyRun,
  beginLevelRun,
  buildTimetable,
  createDailySession,
  createLevelSession,
  emptyProgress,
  endPlayback,
  LEAD_IN_MS,
  localDateString,
  periodOf,
  play,
  press,
  roundSequence,
  type EchoSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import {
  EP_STORAGE_KEYS,
  type PersistedGame,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { EchoPadsRoot } from './EchoPadsRoot';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  });
});

afterEach(async () => {
  cleanup();
  // An unmount saves; let that land before the store is wiped.
  await settle();
  vi.useRealTimers();
  deviceStore.clear();
  vi.restoreAllMocks();
});

/** Lets promise chains (loads, saves) land without moving the clock. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

/** Moves the fake clock, timers and React updates included. */
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

async function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <EchoPadsRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  await settle();
  return { onExit };
}

const put = (key: string, value: unknown) => deviceStore.set(key, JSON.stringify(value));
const read = <T,>(key: string): T | null => {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
};
const savedGame = () => read<PersistedGame>(EP_STORAGE_KEYS.game);
const savedDaily = () => read<PersistedGame>(EP_STORAGE_KEYS.dailyGame);
const savedStats = () => read<Stats>(EP_STORAGE_KEYS.stats);
const savedProgress = () => read<Progress>(EP_STORAGE_KEYS.progress);
const savedPrefs = () => read<Prefs>(EP_STORAGE_KEYS.prefs);

const taughtAlready = () =>
  put(EP_STORAGE_KEYS.flags, { schemaVersion: 1, tutorialCompleted: true });

const TODAY = localDateString(new Date());

/** The progress a run at `level` (attempt 0) and today's daily (attempt 0) leave. */
function progressWithRuns(): Progress {
  const afterLevel = beginLevelRun(emptyProgress(), 1)!.progress;
  return { schemaVersion: 1, ...beginDailyRun(afterLevel, TODAY).progress };
}

const suspend = (session: EchoSession) => {
  put(EP_STORAGE_KEYS.progress, progressWithRuns());
  put(
    session.mode === 'daily' ? EP_STORAGE_KEYS.dailyGame : EP_STORAGE_KEYS.game,
    toPersisted(session, 1),
  );
};

const pad = (index: number) =>
  within(screen.getByRole('group', { name: 'Pads' })).getAllByRole('button')[index]!;
const litPads = () =>
  [...document.querySelectorAll('.ep-pad-lit')].map((el) => Number(el.getAttribute('data-pad')));
const playButton = () => document.querySelector<HTMLButtonElement>('.ep-play')!;
const paceButton = (name: string) =>
  within(screen.getByRole('group', { name: 'Pace' })).getByRole('button', { name });
const status = () => document.querySelector('.ep-status')!.textContent ?? '';
const roundLine = () => document.querySelector('.ep-round')!.textContent ?? '';
const key = (k: string) => fireEvent.keyDown(document.body, { key: k });

/** Level 1 attempt 0's sequence: what the first run plays. */
const L1 = createLevelSession(1, 0)!.sequence;

/** Opens a first-run Quick Rules and starts level 1 from it. */
async function startFirstRun() {
  await launch();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
  await settle();
}

/** ▶ and the whole playback of round k at Normal. */
function playRound(k: number) {
  fireEvent.click(playButton());
  advance(LEAD_IN_MS + (k - 1) * periodOf('normal') + 450 + 1);
}

describe('Quick Rules into a level, and nothing plays by itself (§4 condition 1)', () => {
  it('opens on Quick Rules, then level 1 waiting for ▶', async () => {
    await startFirstRun();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(roundLine()).toContain('Length 3 of 4');
    expect(status()).toBe('Press Play to hear 3 pads.');
    expect(playButton()).toHaveTextContent('Play');
    advance(10_000);
    expect(litPads()).toEqual([]);
    expect(status()).toBe('Press Play to hear 3 pads.');
    // The run was saved as it started, and counted.
    expect(savedGame()?.round).toBe(3);
    expect(savedStats()?.rows.pads4.played).toBe(1);
    expect(savedProgress()?.nextAttempt[0]).toBe(1);
  });

  it('refuses presses before the round was heard (§5)', async () => {
    await startFirstRun();
    fireEvent.click(pad(L1[0]!));
    expect(litPads()).toEqual([]);
    expect(pad(0)).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('the playback walks the timetable (§4)', () => {
  it('lights one pad at a time, in order, at the timetable’s moments', async () => {
    await startFirstRun();
    fireEvent.click(playButton());
    expect(status()).toBe('Playing 3 pads…');
    expect(playButton()).toHaveTextContent('Stop');
    const timetable = buildTimetable(L1.slice(0, 3), 'normal');
    let t = 0;
    for (const step of timetable.steps) {
      advance(step.onAt - t + 1);
      t = step.onAt + 1;
      expect(litPads()).toEqual([step.pad]);
      advance(step.offAt - t + 1);
      t = step.offAt + 1;
      expect(litPads()).toEqual([]);
    }
    expect(status()).toBe('Your turn: tap the 3 pads in the same order.');
    expect(playButton()).toHaveTextContent('Listen again');
  });

  it('refuses presses and the Pace while it plays', async () => {
    await startFirstRun();
    fireEvent.click(playButton());
    advance(LEAD_IN_MS + 10);
    fireEvent.click(pad(L1[0]!));
    expect(roundLine()).not.toContain('/ 3');
    expect(paceButton('Quick')).toBeDisabled();
    fireEvent.click(paceButton('Quick'));
    expect(savedPrefs()).toBeNull();
  });

  it('stops on Stop and stays stopped', async () => {
    await startFirstRun();
    fireEvent.click(playButton());
    advance(LEAD_IN_MS + 10);
    expect(litPads()).toEqual([L1[0]]);
    fireEvent.click(playButton());
    expect(litPads()).toEqual([]);
    advance(10_000);
    expect(litPads()).toEqual([]);
    expect(status()).toBe('Your turn: tap the 3 pads in the same order.');
    // The stopped playback was heard once; the next ▶ is a replay.
    await settle();
    expect(savedGame()?.roundPlays).toBe(1);
    fireEvent.click(playButton());
    await settle();
    expect(savedGame()?.replays).toBe(1);
  });

  it('stops in the background and on blur, and does not resume', async () => {
    await startFirstRun();
    fireEvent.click(playButton());
    advance(LEAD_IN_MS + 10);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    advance(10_000);
    expect(litPads()).toEqual([]);
    expect(status()).toBe('Your turn: tap the 3 pads in the same order.');

    fireEvent.click(playButton());
    advance(LEAD_IN_MS + 10);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    advance(10_000);
    expect(litPads()).toEqual([]);
    expect(playButton()).toHaveTextContent('Listen again');
  });
});

describe('input (§5, §6)', () => {
  it('returns a round, then waits for ▶ at the next length', async () => {
    await startFirstRun();
    playRound(3);
    fireEvent.click(pad(L1[0]!));
    // Input began: ▶ is withheld until the round ends (§6), and it was saved.
    expect(playButton()).toBeDisabled();
    await settle();
    expect(savedGame()?.inputStarted).toBe(true);
    expect(roundLine()).toContain('1 / 3');
    fireEvent.click(pad(L1[1]!));
    fireEvent.click(pad(L1[2]!));
    expect(roundLine()).toContain('Length 4 of 4');
    expect(status()).toBe('Press Play to hear 4 pads.');
    advance(10_000);
    expect(litPads()).toEqual([]);
    await settle();
    expect(savedGame()?.round).toBe(4);
  });

  it('clears the level: the facts, the slot gone, the next level open', async () => {
    await startFirstRun();
    playRound(3);
    for (const p of L1.slice(0, 3)) fireEvent.click(pad(p));
    playRound(4);
    for (const p of L1.slice(0, 4)) fireEvent.click(pad(p));
    await settle();
    const card = screen.getByRole('alertdialog', { name: 'All 4 returned' });
    expect(within(card).getByText('Length 4')).toBeInTheDocument();
    expect(savedGame()).toBeNull();
    expect(savedProgress()?.cleared[0]).toBe(true);
    expect(savedStats()?.rows.pads4).toMatchObject({ played: 1, cleared: 1, failed: 0 });
    fireEvent.click(within(card).getByRole('button', { name: 'Next Level' }));
    await settle();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    expect(savedGame()?.level).toBe(2);
  });

  it('ends the run on a miss: the next pad ringed, the slot gone, the round heard again', async () => {
    await startFirstRun();
    playRound(3);
    const wrong = (L1[0]! + 1) % 4;
    fireEvent.click(pad(wrong));
    await settle();
    expect(screen.getByRole('heading', { name: 'The run ended at length 3' })).toBeInTheDocument();
    expect(pad(L1[0]!).getAttribute('aria-label')).toMatch(/\(the pad that came next\)$/);
    expect(document.querySelectorAll('.ep-pad-expected')).toHaveLength(1);
    // The panel takes the room (§11): the length line goes (the title says
    // it), and the spoken line stays live but is no longer drawn.
    expect(document.querySelector('.ep-round')).toBeNull();
    expect(document.querySelector('.ep-status')).toHaveClass('ep-status-quiet');
    expect(document.querySelector('.ep-status')).toHaveAttribute('aria-live', 'polite');
    expect(savedGame()).toBeNull();
    expect(savedStats()?.rows.pads4).toMatchObject({ played: 1, cleared: 0, failed: 1 });
    // No time limit on the reveal: still there after a long look.
    advance(60_000);
    expect(document.querySelectorAll('.ep-pad-expected')).toHaveLength(1);
    // The missed round can be heard again; it is not counted as a replay.
    expect(playButton()).toHaveTextContent('Listen again');
    fireEvent.click(playButton());
    advance(LEAD_IN_MS + 10);
    expect(litPads()).toEqual([L1[0]]);
    expect(status()).toBe('Playing the 3 pads of this round again…');
    advance(5_000);
    expect(litPads()).toEqual([]);
    expect(within(document.querySelector('.ep-miss')!).getByText('0')).toBeInTheDocument();
    // A new sequence is the next attempt (§1, §9).
    fireEvent.click(screen.getByRole('button', { name: 'New sequence' }));
    await settle();
    expect(savedGame()?.attempt).toBe(1);
    expect(savedProgress()?.nextAttempt[0]).toBe(2);
    expect(savedStats()?.rows.pads4.played).toBe(2);
  });
});

describe('the Pace (§4)', () => {
  it('changes while nothing plays, and is remembered', async () => {
    await startFirstRun();
    fireEvent.click(paceButton('Quick'));
    expect(paceButton('Quick')).toHaveAttribute('aria-pressed', 'true');
    await settle();
    expect(savedPrefs()?.pace).toBe('quick');
    fireEvent.click(playButton());
    // Quick: the first light 600 ms in, off 280 ms later.
    advance(LEAD_IN_MS + 281);
    expect(litPads()).toEqual([]);
    advance(140);
    expect(litPads()).toEqual([L1[1]]);
    advance(5_000);
    await settle();
    expect(savedGame()?.pacesHeard).toEqual(['quick']);
  });
});

describe('the keyboard (§11)', () => {
  it('plays with Space and presses with the digits', async () => {
    await startFirstRun();
    key(' ');
    advance(LEAD_IN_MS + 10);
    expect(litPads()).toEqual([L1[0]]);
    advance(5_000);
    key(String(L1[0]! + 1));
    expect(roundLine()).toContain('1 / 3');
    // A digit past the pads presses nothing.
    key('9');
    expect(roundLine()).toContain('1 / 3');
  });

  it('presses a focused button once for a held Enter or Space, not once per repeat', async () => {
    await startFirstRun();
    playRound(3);
    // Input: a held Enter on a focused pad would click it again on each repeat.
    pad(L1[0]!).focus();
    const first = fireEvent.keyDown(pad(L1[0]!), { key: 'Enter' });
    expect(first).toBe(true); // the first press is the button's own
    expect(fireEvent.keyDown(pad(L1[0]!), { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(pad(L1[0]!), { key: ' ', repeat: true })).toBe(false);
    // ▶ and the Pace are buttons too: a held key toggles nothing.
    expect(fireEvent.keyDown(playButton(), { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(paceButton('Calm'), { key: ' ', repeat: true })).toBe(false);
    // Other keys pass untouched.
    expect(fireEvent.keyDown(pad(L1[0]!), { key: 'Tab', repeat: true })).toBe(true);
  });
});

describe('a run comes back (§8)', () => {
  const heard = endPlayback(play(createLevelSession(1, 0)!, 'normal')!)!;

  it('left before input: ▶ offered again, nothing playing', async () => {
    taughtAlready();
    suspend(heard);
    await launch('shortcut');
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    advance(10_000);
    expect(litPads()).toEqual([]);
    expect(playButton()).toHaveTextContent('Listen again');
    expect(playButton()).toBeEnabled();
    // That ▶ is the round's second: a replay.
    fireEvent.click(playButton());
    await settle();
    expect(savedGame()?.replays).toBe(1);
  });

  it('left mid-input: from the first pad again, with ▶ withheld (decision 8 (B))', async () => {
    taughtAlready();
    suspend(press(heard, roundSequence(heard)[0]!)!);
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <EchoPadsRoot onExit={() => undefined} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();
    expect(status()).toBe('Tap all 3 pads again, from the first.');
    expect(playButton()).toBeDisabled();
    advance(10_000);
    expect(litPads()).toEqual([]);
    for (const p of L1.slice(0, 3)) fireEvent.click(pad(p));
    expect(roundLine()).toContain('Length 4 of 4');
  });

  it('opens the home when two runs are suspended, and resumes each from it', async () => {
    taughtAlready();
    suspend(heard);
    put(EP_STORAGE_KEYS.dailyGame, toPersisted(createDailySession(TODAY, 0)!, 1));
    await launch('shortcut');
    expect(screen.getByRole('heading', { name: 'Echo Pads' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Daily Challenge/ }));
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(roundLine()).toContain('Length 3 of 10');
    expect(document.querySelectorAll('.ep-pad')).toHaveLength(6);
    expect(savedDaily()?.attempt).toBe(0);
  });

  it('opens on the home from the collection, even with a run suspended', async () => {
    taughtAlready();
    suspend(heard);
    await launch();
    expect(screen.getByRole('button', { name: /^Resume/ })).toBeInTheDocument();
  });
});

describe('the home (§9, §13)', () => {
  it('asks before replacing a suspended level run, and Escape keeps it', async () => {
    taughtAlready();
    suspend(endPlayback(play(createLevelSession(1, 0)!, 'normal')!)!);
    await launch();
    // The run is at the suggested level: the button under Resume is a new
    // sequence there, not "Level 1" a second time.
    expect(screen.queryByRole('button', { name: /^Level 1/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^New sequence/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the run in progress?' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(savedGame()?.attempt).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /^New sequence/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    expect(savedGame()?.attempt).toBe(1);
  });

  it('lists the 22 levels with only 1 and 12 open, and shows the statistics', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /^Levels/ }));
    const open = screen
      .getAllByRole('button')
      .filter((b) => b.classList.contains('level-cell') && !b.hasAttribute('disabled'));
    expect(open.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Level 1, 4 pads · length 4',
      'Level 12, 6 pads · length 4',
    ]);
    expect(document.querySelectorAll('.level-cell')).toHaveLength(22);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(screen.getByRole('heading', { name: '6 pads' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Daily Challenge' })).toBeInTheDocument();
  });

  it('names a cleared level in one catalog entry, the language’s order and commas (§14)', async () => {
    taughtAlready();
    put(EP_STORAGE_KEYS.progress, {
      schemaVersion: 1,
      ...emptyProgress(),
      // Played once and cleared: a clear needs an attempt started (§9).
      cleared: emptyProgress().cleared.map((_, i) => i === 0),
      nextAttempt: emptyProgress().nextAttempt.map((_, i) => (i === 0 ? 1 : 0)),
    });
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /^Levels/ }));
    expect(
      screen.getByRole('button', { name: 'Level 1, 4 pads · length 4, cleared' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level 2, 4 pads · length 5' })).toBeEnabled();
  });
});

describe('the daily (§7)', () => {
  it('is six pads to length 10, and its first clear marks the day', async () => {
    taughtAlready();
    await launch();
    fireEvent.click(screen.getByRole('button', { name: /^Daily Challenge/ }));
    await settle();
    const sequence = createDailySession(TODAY, 0)!.sequence;
    for (let k = 3; k <= 10; k++) {
      playRound(k);
      for (const p of sequence.slice(0, k)) fireEvent.click(pad(p));
    }
    await settle();
    const card = screen.getByRole('alertdialog', { name: 'All 10 returned' });
    expect(savedDaily()).toBeNull();
    expect(savedStats()?.dailyDates).toEqual([TODAY]);
    expect(savedStats()?.rows.daily).toMatchObject({ played: 1, cleared: 1 });
    // No next level on a daily; a new sequence is today's next attempt.
    expect(within(card).queryByRole('button', { name: 'Next Level' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Home' }));
    expect(screen.getByText('Completed today')).toBeInTheDocument();
    // Eight rounds through the whole screen: about 1 s alone, but 5.9 s once
    // in a full run on a loaded machine (2026-10-22) — past vitest's 5 s.
  }, 20_000);
});

describe('the play clock (docs/GAME_LIFECYCLE.md「アンマウントで計上する」)', () => {
  it('books the seconds played when the game is unmounted, and once', async () => {
    await startFirstRun();
    advance(5_000);
    cleanup();
    await settle();
    expect(savedStats()?.rows.pads4.seconds).toBe(5);
    expect(savedGame()?.elapsedSeconds).toBe(5);
    // Launched again and left from its home: nothing more is booked.
    await launch();
    cleanup();
    await settle();
    expect(savedStats()?.rows.pads4.seconds).toBe(5);
    expect(savedGame()?.elapsedSeconds).toBe(5);
  });
});
