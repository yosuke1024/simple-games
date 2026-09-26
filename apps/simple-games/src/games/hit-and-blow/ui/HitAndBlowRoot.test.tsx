/**
 * The game as a player meets it (docs/HIT_AND_BLOW_RULES.md §3, §4, §5, §8,
 * §9): three steps of Quick Rules and straight into a game, a row composed
 * from the palette or the keyboard, a check that lands in the history, a
 * solve that says so once — and neither a clock nor an undo anywhere.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, pushSymbol, secretFor, submitGuess, type HitAndBlowSession } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { HB_STORAGE_KEYS, type PersistedGame, type Stats } from '../storage/schemas';
import { HitAndBlowRoot } from './HitAndBlowRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote stands behind both (`launch`).
 */
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

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <HitAndBlowRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches the game against the device store, the way a player's phone does. */
function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <HitAndBlowRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** The same store a launch reads, entered by the other door (issue #113). */
function launchFromShortcut() {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <HitAndBlowRoot onExit={onExit} entry="shortcut" />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Lets the local reads and the saves they trigger resolve. */
const settle = () => act(async () => undefined);

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const tutorialDone = {
  [HB_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const SEED = 'hit-and-blow-uitest';

/** A saved easy game one wrong guess in. */
function suspended(): { session: HitAndBlowSession; store: Record<string, string> } {
  const start = createSession('easy', SEED);
  const composed = [...start.secret]
    .reverse()
    .reduce((current, symbol) => pushSymbol(current, symbol)!, start);
  const session = submitGuess(composed)!;
  return {
    session,
    store: { ...tutorialDone, [HB_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)) },
  };
}

const palette = () => screen.getByRole('group', { name: 'Symbols' });
const draft = () => screen.getByRole('group', { name: 'Your guess' });
const history = () => screen.getByRole('list', { name: 'Guesses so far' });
const pick = (name: string) => within(palette()).getByRole('button', { name });
const check = () => screen.getByRole('button', { name: 'Check' });
const SYMBOL_NAMES = [
  'Circle',
  'Triangle',
  'Square',
  'Diamond',
  'Star',
  'Cross',
  'Hexagon',
  'Heart',
];

function storedGame(): PersistedGame | null {
  const raw = deviceStore.get(HB_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as PersistedGame);
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(HB_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run (§9)', () => {
  it('shows Quick Rules, then deals an easy game', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByRole('heading', { level: 1, name: 'How to Play' })).toBeVisible();
    expect(screen.getByText('Find the hidden row')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Line up a guess')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Read the pegs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Easy: four slots, six symbols (§1).
    expect(within(draft()).getAllByRole('button')).toHaveLength(4);
    expect(within(palette()).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText('Guess 1')).toBeInTheDocument();
  });
});

describe('composing and checking (§3, §4)', () => {
  it('fills slots from the palette, clears one by tapping it, and checks a full row', async () => {
    const user = userEvent.setup();
    // A known deal rather than a fresh random one, so the guess below can
    // never be the secret by chance and end the game early.
    const fresh = createSession('normal', `${SEED}-normal`);
    expect(fresh.secret).not.toEqual([7, 4, 2, 3]);
    renderGame({
      ...tutorialDone,
      [HB_STORAGE_KEYS.game]: JSON.stringify(toPersisted(fresh, 1)),
    });
    await user.click(await screen.findByRole('button', { name: /^Normal/ }));

    expect(check()).toBeDisabled();
    await user.click(pick('Circle'));
    await user.click(pick('Star'));
    // A symbol in the row is announced as used and cannot be placed again.
    expect(pick('Circle')).toBeDisabled();
    expect(pick('Circle')).toHaveAttribute('aria-pressed', 'true');
    expect(pick('Square')).toHaveAttribute('aria-pressed', 'false');

    // Tapping a filled slot empties it; the next pick fills that gap first.
    await user.click(within(draft()).getByRole('button', { name: 'Slot 1: Circle' }));
    expect(within(draft()).getByRole('button', { name: 'Slot 1: empty' })).toBeDisabled();
    expect(pick('Circle')).toBeEnabled();
    await user.click(pick('Heart'));
    expect(within(draft()).getByRole('button', { name: 'Slot 1: Heart' })).toBeInTheDocument();

    await user.click(pick('Square'));
    expect(check()).toBeDisabled();
    await user.click(pick('Diamond'));
    // A full row: nowhere left to put a symbol, and Check is ready.
    expect(pick('Hexagon')).toBeDisabled();
    expect(check()).toBeEnabled();

    await user.click(check());
    const rows = within(history()).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/Guess 1: Heart, Star, Square, Diamond\. Hit \d, Blow \d\./);
    // The row empties and the counter moves on.
    expect(within(draft()).getAllByRole('button', { name: /empty/ })).toHaveLength(4);
    expect(screen.getByText('Guess 2')).toBeInTheDocument();
    expect(storedGame()?.guesses).toEqual([[7, 4, 2, 3]]);
  });

  it('shows the pegs for the hits and blows the guess scored', async () => {
    const user = userEvent.setup();
    const secret = secretFor(SEED, 'easy');
    const { store } = suspended();
    renderGame(store);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));

    // The saved guess was the secret reversed: four blows, no hits (§4).
    const row = within(history()).getAllByRole('listitem')[0]!;
    expect(row).toHaveTextContent('Hit 0, Blow 4.');
    expect(row.querySelectorAll('.hb-peg-blow')).toHaveLength(4);
    expect(row.querySelectorAll('.hb-peg-hit')).toHaveLength(0);
    expect(secret).toHaveLength(4);
  });

  it('takes digits, Backspace and Enter from the keyboard', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Easy/ }));

    // 1–8 in palette order; 7 and 8 are not on the easy palette (§1).
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: '1' });
    expect(within(draft()).getByRole('button', { name: 'Slot 1: Square' })).toBeInTheDocument();
    expect(within(draft()).getByRole('button', { name: 'Slot 2: Circle' })).toBeInTheDocument();
    // A symbol already in the row is refused, not placed twice.
    fireEvent.keyDown(window, { key: '1' });
    expect(within(draft()).getByRole('button', { name: 'Slot 3: empty' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(within(draft()).getByRole('button', { name: 'Slot 2: empty' })).toBeInTheDocument();

    for (const key of ['2', '4', '5']) fireEvent.keyDown(window, { key });
    // A repeat of a held key does nothing.
    fireEvent.keyDown(window, { key: 'Backspace', repeat: true });
    expect(check()).toBeEnabled();
    // Enter on a focused button is that button's own press, never a Check.
    fireEvent.keyDown(within(draft()).getByRole('button', { name: 'Slot 1: Square' }), {
      key: 'Enter',
    });
    expect(screen.queryByRole('list', { name: 'Guesses so far' })).not.toBeInTheDocument();
    expect(screen.getByText('Your guesses will line up here.')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(within(history()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(history()).getByText(/Guess 1: Square, Triangle, Diamond, Star\./)).toBeTruthy();
  });

  it('solves on the secret: the result card, the count, and the statistics (§5, §7)', async () => {
    const user = userEvent.setup();
    const { session, store } = suspended();
    launchWithStore(store);
    await settle();
    await user.click(screen.getByRole('button', { name: /^Easy/ }));

    for (const symbol of session.secret) await user.click(pick(SYMBOL_NAMES[symbol]!));
    await user.click(check());

    const card = await screen.findByRole('alertdialog', { name: 'Code cracked' });
    expect(within(card).getByText('Guesses')).toBeInTheDocument();
    expect(within(card).getByText('2')).toBeInTheDocument();
    await settle();
    // A won game is not kept to come back to (§8), and the solve is booked.
    expect(storedGame()).toBeNull();
    expect(storedStats()?.easy).toMatchObject({ solved: 1, bestGuesses: 2, totalGuesses: 2 });
  });
});

describe('the screen', () => {
  it('shows no clock and no undo or hint while playing (§6, §10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /^Hard/ }));

    expect(within(draft()).getAllByRole('button')).toHaveLength(5);
    expect(within(palette()).getAllByRole('button')).toHaveLength(8);
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('leads with the difficulty last picked, and asks before replacing a game (§1)', async () => {
    const user = userEvent.setup();
    renderGame({
      ...tutorialDone,
      [HB_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, difficulty: 'hard' }),
    });
    const hard = await screen.findByRole('button', { name: /^Hard/ });
    expect(hard).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveClass('btn-secondary');
    expect(hard).toHaveTextContent('5 of 8 symbols');

    await user.click(hard);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /^Hard.*Resume/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Easy/ }));
    expect(
      screen.getByRole('alertdialog', { name: 'Replace the game in progress?' }),
    ).toBeInTheDocument();
  });
});

/**
 * A pinned home-screen shortcut, and what Hit & Blow does about it (issue
 * #113). The shell says only which door was used; the decision is this
 * game's, taken from its own single save slot (§8).
 */
describe('a home-screen shortcut', () => {
  const homeShown = () => screen.queryByText('Choose a difficulty');

  it('opens the one suspended game straight onto its history', async () => {
    const { store } = suspended();
    for (const [key, value] of Object.entries(store)) deviceStore.set(key, value);
    launchFromShortcut();
    await settle();

    expect(homeShown()).not.toBeInTheDocument();
    expect(within(history()).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Guess 2')).toBeInTheDocument();
  });

  it('opens the home screen when nothing is suspended', async () => {
    for (const [key, value] of Object.entries(tutorialDone)) deviceStore.set(key, value);
    launchFromShortcut();
    await settle();
    expect(homeShown()).toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    const { store } = suspended();
    for (const [key, value] of Object.entries(store)) deviceStore.set(key, value);
    launch('collection');
    await settle();
    expect(homeShown()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Easy.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules', async () => {
    const { store } = suspended();
    deviceStore.set(HB_STORAGE_KEYS.game, store[HB_STORAGE_KEYS.game]!);
    launchFromShortcut();
    expect(await screen.findByText('Find the hidden row')).toBeInTheDocument();

    // And Quick Rules lead onto the game that was waiting, not over it: its
    // one guess is still in the history, and the save keeps its seed.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(within(history()).getAllByRole('listitem')).toHaveLength(1);
    expect((JSON.parse(deviceStore.get(HB_STORAGE_KEYS.game)!) as { seed: string }).seed).toBe(
      SEED,
    );
  });
});

describe('suspending (§8)', () => {
  it('keeps the play seconds across a background and a resume, booked once', async () => {
    for (const [key, value] of Object.entries(tutorialDone)) deviceStore.set(key, value);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));

      act(() => vi.advanceTimersByTime(5_000));
      background();
      await settle();
      expect(storedGame()?.elapsedSeconds).toBe(5);
      expect(storedStats()?.totalPlaySeconds).toBe(5);

      cleanup();
      launchFromShortcut();
      await settle();
      act(() => vi.advanceTimersByTime(3_000));
      background();
      await settle();
      expect(storedGame()?.elapsedSeconds).toBe(8);
      expect(storedStats()?.totalPlaySeconds).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Seeds the device store, so saves and loads meet in one place. */
function launchWithStore(store: Record<string, string>) {
  for (const [key, value] of Object.entries(store)) deviceStore.set(key, value);
  return launch();
}
