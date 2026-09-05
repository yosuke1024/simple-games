/**
 * The screens, against the real state layer: what a player sees, taps, and
 * gets back.
 *
 * Three things here are this title's own.
 *
 * The first is that the board answers in **beats**, and a CPU seat costs two
 * of them — a throw, then the move it explains — so the clock is faked and
 * wound forward one beat at a time against a copy of the same match driven by
 * the pure functions. Winding it in one jump would test the timers without
 * ever letting React answer them, and the next timer would never be armed.
 *
 * The second is that the board is a **DOM** board, which is exactly why these
 * cases exist. The Canvas title before this one hid its animation path from
 * the tests and shipped a crash in it; here the walk of a pawn, the tumble of
 * the die, the automatic pass, the third six, the win and the no-contest are
 * all reachable from a render test, so all of them are actually run.
 *
 * The third is that reduced motion is jsdom's default (there is no
 * `matchMedia`, which `useReducedMotion` reads as "skip animations"). That
 * makes the still path the one a test gets for free and the moving path the
 * one that has to be asked for — so the animation cases stub `matchMedia` and
 * assert the moving path really runs.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type MessageKey, type TranslateVars } from '@/i18n';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import {
  applyCpuMove,
  applyCpuRoll,
  canonicalRecordOf,
  cpuBeatOwed,
  createSession,
  doMovePawn,
  doRoll,
  movablePawns,
  HOME_PROGRESS,
  MAX_ROLLS,
  PAWNS_PER_SEAT,
  SEATS,
  YOU,
  type LudoSession,
  type MatchState,
  type PersistedMatch,
} from '../game';
import { CPU_MOVE_DELAY_MS, CPU_ROLL_DELAY_MS, LudoProvider } from '../state/GameContext';
import { LD_STORAGE_KEYS, prefsSchema, statsSchema, type Stats } from '../storage/schemas';
import { pawnLabel, placeLabel } from './components/seatText';
import { LudoRoot, LudoScreens } from './LudoRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote has to stand behind both.
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

const t = (key: MessageKey, vars?: TranslateVars) => translate('en', key, vars);

// ---------- seeds, chosen for the face they turn up ----------

/** Its first throw is not a six: sixteen pawns in yards, so nothing can move. */
const SEED_OPENS_WITH_A_PASS = 'ludo-pass-0';
/** Its first throw is a six and its second is not. */
const SEED_OPENS_WITH_A_SIX = 'ludo-six1-13';
/** Its first three throws are all sixes. */
const SEED_THREE_SIXES = 'ludo-six3-298';
/** Its first throw is a one — the exact count a pawn on 58 needs. */
const SEED_OPENS_WITH_A_ONE = 'ludo-one-5';
/** The player's opening throw passes and CPU 1 then throws a six. */
const SEED_CPU_GETS_A_PAWN_OUT = 'ludo-cpu-19';

// ---------- positions ----------

const pawnsOf = (rows: readonly (readonly number[])[]): MatchState['pawns'] =>
  rows.map((row) => [...row]) as unknown as MatchState['pawns'];

const withState = (session: LudoSession, state: Partial<MatchState>): LudoSession => ({
  ...session,
  state: { ...session.state, ...state },
});

/** The player, three pawns home and one an exact throw of one from the fourth. */
const oneThrowFromWinning = (): LudoSession =>
  withState(createSession('normal', SEED_OPENS_WITH_A_ONE), {
    pawns: pawnsOf([
      [HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS - 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]),
  });

/**
 * Standing on the last throw the rules allow. The ending itself is produced by
 * actually throwing — only the count of throws already made is placed by hand,
 * because ten thousand of them is not something a render test can sit through.
 */
const onTheLastThrow = (): LudoSession =>
  withState(createSession('normal', SEED_OPENS_WITH_A_SIX), { rollIndex: MAX_ROLLS - 1 });

// ---------- mounting ----------

/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LudoRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
}

/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(LD_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}

const tutorialDone = {
  [LD_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A store holding one suspended match, written the way the app writes it. */
const saved = (session: LudoSession) => ({
  ...tutorialDone,
  [LD_STORAGE_KEYS.game]: JSON.stringify(canonicalRecordOf(session, 1)),
});

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LudoRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit, unmount: view.unmount };
}

/**
 * Mounts the real screens onto a match handed straight in. Used only for the
 * two positions a record cannot carry — a match one throw from being won, and
 * one standing on the roll cap — since a saved record replays from the opening
 * and would land on a different board.
 */
function renderScreens(session: LudoSession) {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LudoProvider
        initialStats={statsSchema.defaultValue()}
        initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
        initialPrefs={prefsSchema.defaultValue()}
        initialSession={session}
        onExit={vi.fn()}
      >
        <LudoScreens />
      </LudoProvider>
    </SettingsProvider>,
  );
}

const settle = () => act(async () => undefined);

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Opens the suspended match from the home screen — always against Normal. */
function resume() {
  fireEvent.click(screen.getByRole('button', { name: /Normal/ }));
}

const board = () => screen.getByRole('group', { name: 'Ludo board' });
const line = () => screen.getByRole('status');
const dieButton = () => screen.getByRole('button', { name: 'Roll the die' });

/** The pawns the board is offering — every one of them is a button. */
const livePawns = (): HTMLElement[] =>
  within(board())
    .queryAllByRole('button')
    .filter((node) => node.className.includes('ld-pawn'));

/**
 * The whole board, read back off the screen and compared with the position the
 * rules say it is in. Every pawn is announced — its seat and its square — so
 * this is a total check rather than a spot one, and it is what makes "the CPU
 * lap did not crash" into "the CPU lap drew the right board".
 */
function expectBoardMatches(session: LudoSession) {
  const movable = movablePawns(session);
  const expectedLive = movable.map((pawn) =>
    t('ludoMovePawn', { where: placeLabel(t, YOU, session.state.pawns[YOU][pawn]!) }),
  );
  const expectedStill: string[] = [];
  for (const seat of SEATS) {
    for (let index = 0; index < PAWNS_PER_SEAT; index++) {
      if (seat === YOU && movable.includes(index as 0 | 1 | 2 | 3)) continue;
      expectedStill.push(pawnLabel(t, seat, session.state.pawns[seat][index]!));
    }
  }

  const labelOf = (node: Element) => node.getAttribute('aria-label') ?? '';
  const still = within(board())
    .getAllByRole('img')
    .map(labelOf)
    .filter((label) => label !== t('ludoSafeSquare'));
  expect(livePawns().map(labelOf).sort()).toEqual([...expectedLive].sort());
  expect(still.sort()).toEqual([...expectedStill].sort());
}

/**
 * Runs the CPU lap the way the screen does, one beat at a time, against a copy
 * of the match driven by the pure functions — and checks the screen after
 * every single beat.
 */
async function playCpuLap(from: LudoSession): Promise<{ session: LudoSession; beats: string[] }> {
  let expected = from;
  const beats: string[] = [];
  while (cpuBeatOwed(expected) !== null && beats.length < 80) {
    const owed = cpuBeatOwed(expected)!;
    await advance(owed.kind === 'roll' ? CPU_ROLL_DELAY_MS : CPU_MOVE_DELAY_MS);
    expected = (owed.kind === 'roll' ? applyCpuRoll(expected) : applyCpuMove(expected))!;
    beats.push(owed.kind);
    expectBoardMatches(expected);
  }
  return { session: expected, beats };
}

/** jsdom has no matchMedia, which the screens read as "skip animations". */
function stubMotionAllowed() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  deviceStore.clear();
});

// ---------- the first launch ----------

describe('first run', () => {
  it('shows Quick Rules — including the two places we differ — and then starts a match', async () => {
    renderGame();
    await settle();

    expect(screen.getByText('A six lets a pawn out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A six throws again')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // The mainstream gives another throw for a capture; we do not (§0, §11).
    expect(screen.getByText('Landing on an enemy sends it back')).toBeInTheDocument();
    expect(screen.getByText(/Capturing does not earn you another throw/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    // The mainstream makes a same-colour pair a blockade; we do not (§2.4).
    expect(screen.getByText('Stacking your own pawns protects nothing')).toBeInTheDocument();
    expect(screen.getByText(/a pile is a target, not a fort/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Come home on an exact count')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Sixteen pawns in four yards, and the throw is the player's.
    expect(within(board()).getAllByRole('img', { name: /in the yard/ })).toHaveLength(16);
    expect(dieButton()).toBeInTheDocument();
    expect(line()).toHaveTextContent('Your turn — throw the die.');
    await settle();
  });

  it('does not show Quick Rules again once it is done', async () => {
    renderGame(tutorialDone);
    await settle();
    expect(screen.getByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.queryByText('A six lets a pawn out')).not.toBeInTheDocument();
  });
});

// ---------- the board ----------

describe('the board', () => {
  it('shows no clock and no undo', async () => {
    renderGame(saved(createSession('normal', SEED_OPENS_WITH_A_SIX)));
    await settle();
    resume();

    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    await settle();
  });

  it('makes only the pawns the rules allow pressable, and moves one on a single tap', async () => {
    const opening = createSession('normal', SEED_OPENS_WITH_A_SIX);
    renderGame(saved(opening));
    await settle();
    resume();

    // Before the throw there is nothing to press: the die decides where a pawn
    // may go, so there is nothing to aim at either.
    expect(livePawns()).toHaveLength(0);

    fireEvent.click(dieButton());
    const thrown = doRoll(opening)!;
    expect(thrown.lastRoll!.die).toBe(6);
    expect(line()).toHaveTextContent('You rolled 6.');
    expectBoardMatches(thrown);

    // One tap, not two: the pawn goes where the die says.
    const before = livePawns().length;
    expect(before).toBeGreaterThan(0);
    fireEvent.click(livePawns()[0]!);
    expect(within(board()).getAllByRole('img', { name: /in the yard/ }).length).toBe(15);
    await settle();
  });

  it('says which square a pawn is on, and marks the safe ones', async () => {
    renderGame(saved(createSession('normal', SEED_OPENS_WITH_A_SIX)));
    await settle();
    resume();

    fireEvent.click(dieButton());
    fireEvent.click(livePawns()[0]!);
    // A pawn leaving the yard lands on its own entrance square, which is one
    // of the eight the rules make safe (§1, §2.3) — and it is announced as one.
    expect(within(board()).getAllByRole('img', { name: /You, on safe square 1/ })).toHaveLength(1);
    // The other seven are still empty, and still say what they are.
    expect(within(board()).getAllByRole('img', { name: 'Safe square' })).toHaveLength(7);
    await settle();
  });
});

// ---------- the chain ----------

describe('a CPU lap', () => {
  it('throws and moves for three seats, one beat at a time, and comes back', async () => {
    const opening = createSession('normal', SEED_CPU_GETS_A_PAWN_OUT);
    renderGame(saved(opening));
    await settle();
    resume();

    fireEvent.click(dieButton());
    const thrown = doRoll(opening)!;
    expect(thrown.state.turn).not.toBe(YOU);

    const { session, beats } = await playCpuLap(thrown);
    // Three seats threw, and at least one had a pawn to walk. Nothing crashed,
    // and after every beat the board was the board the rules produce.
    expect(beats.filter((kind) => kind === 'roll').length).toBeGreaterThanOrEqual(3);
    expect(beats).toContain('move');
    expect(session.state.turn).toBe(YOU);
    expect(dieButton()).toBeInTheDocument();

    // And then it stops: nothing moves on its own once the throw is yours.
    await advance(CPU_ROLL_DELAY_MS * 8);
    expectBoardMatches(session);
    await settle();
  });

  it('says so, quietly, when a throw has nothing to answer it', async () => {
    const opening = createSession('normal', SEED_OPENS_WITH_A_PASS);
    renderGame(saved(opening));
    await settle();
    resume();

    fireEvent.click(dieButton());
    // Sixteen pawns in yards and no six: the engine passed it before the
    // screen ever saw it, and all the screen does is say so (§2.6).
    expect(line()).toHaveTextContent(/it passes/);
    expect(livePawns()).toHaveLength(0);
    await settle();
  });

  it('lets a six throw again, and ends the turn on the third one', async () => {
    renderGame(saved(createSession('normal', SEED_THREE_SIXES)));
    await settle();
    resume();

    fireEvent.click(dieButton());
    fireEvent.click(livePawns()[0]!);
    // A six keeps the throw: the die is the player's again straight away, and
    // the line says why rather than leaving the extra throw unexplained.
    expect(dieButton()).toBeInTheDocument();
    expect(line()).toHaveTextContent(/throw again/);

    fireEvent.click(dieButton());
    fireEvent.click(livePawns()[0]!);
    expect(dieButton()).toBeInTheDocument();

    fireEvent.click(dieButton());
    // The third six forfeits the turn without offering a move (§2.1).
    expect(line()).toHaveTextContent(/Three sixes in a row/);
    expect(livePawns()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Roll the die' })).not.toBeInTheDocument();
    await settle();
  });
});

// ---------- how a match ends ----------

describe('a match that ends', () => {
  it('states a win and offers a free rematch', async () => {
    renderScreens(oneThrowFromWinning());
    await settle();
    resume();

    fireEvent.click(dieButton());
    expect(line()).toHaveTextContent('You rolled 1.');
    fireEvent.click(livePawns()[0]!);

    const result = screen.getByRole('alertdialog', { name: 'You win!' });
    expect(within(result).getByText('All four of your pawns are home.')).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    await settle();
  });

  it('states a no-contest as its own thing, neither a win nor a loss', async () => {
    renderScreens(onTheLastThrow());
    await settle();
    resume();

    fireEvent.click(dieButton());
    // The roll cap stops the match with nobody home (§2.7). There is no draw
    // in Ludo, so this is stated rather than rounded into a loss.
    const result = screen.getByRole('alertdialog', { name: 'No contest' });
    expect(within(result).getByText(/counts as played/)).toBeInTheDocument();
    await settle();
  });
});

// ---------- suspending and coming back ----------

describe('suspending and coming back', () => {
  it('resumes onto the same board, with the die still to be thrown', async () => {
    // A match played a little way in, put down, and picked back up.
    const opening = createSession('normal', SEED_OPENS_WITH_A_SIX);
    let expected = doRoll(opening)!;
    expected = { ...expected, choices: [] };
    // Play it forward through the real functions until the throw is the
    // player's again, so the record has both a roll count and a choice in it.
    expected = doMovePawn(expected, movablePawns(expected)[0]!)!;
    while (cpuBeatOwed(expected) !== null) {
      const owed = cpuBeatOwed(expected)!;
      expected = (owed.kind === 'roll' ? applyCpuRoll(expected) : applyCpuMove(expected))!;
    }
    expect(expected.state.turn).toBe(YOU);
    expect(expected.choices.length).toBeGreaterThan(0);

    renderGame(saved(expected));
    await settle();
    resume();

    // The same position, and — because the record can express no other state —
    // it opens on the throw rather than mid-choice or mid-CPU-lap (§10.2).
    expectBoardMatches(expected);
    expect(dieButton()).toBeInTheDocument();
    expect(livePawns()).toHaveLength(0);
    // Either prompt is the throw — which one depends on whether the last face
    // before the break was a six, and a run of sixes survives the replay like
    // everything else does.
    expect(line()).toHaveTextContent(/throw the die|throw again/);
    await settle();
  });

  it('drops a save that could not have come from play and goes home', async () => {
    const real = canonicalRecordOf(createSession('normal', SEED_OPENS_WITH_A_SIX), 1)!;
    renderGame({
      ...tutorialDone,
      // A record whose choices claim more moves than the match ever asked for.
      [LD_STORAGE_KEYS.game]: JSON.stringify({ ...real, rollCount: 4, choices: '3333' }),
    });
    await settle();

    // Home, with nothing to resume: fail-closed, and nothing repaired (§10.3).
    expect(screen.getByRole('button', { name: /Easy/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ludo board' })).not.toBeInTheDocument();
  });

  it('drops a save that is not a record at all', async () => {
    renderGame({ ...tutorialDone, [LD_STORAGE_KEYS.game]: '{"schemaVersion":1}' });
    await settle();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });
});

// ---------- the door the launch came through ----------

/**
 * A pinned home-screen shortcut, and what Ludo does about it (issue #113). The
 * shell says only which door was used; the decision is this game's, taken from
 * its own one save slot.
 *
 * Ambiguity is unreachable here rather than resolved, and that is §10's doing:
 * there is one slot, and what comes out of it has already been replayed and
 * dropped if play could not have produced it (§10.3) — so a suspended match at
 * all *is* the match to come back to, standing on the player's throw (§10.2).
 *
 * These launches go against the device store rather than the `kv` seam: several
 * of the saves under test are ones the game itself wrote a moment earlier, and
 * a relaunch has to read back exactly what the mount before it left behind.
 */
describe('a home-screen shortcut', () => {
  /** Quick Rules behind the player, as every launch after the first finds them. */
  function taughtAlready() {
    deviceStore.set(LD_STORAGE_KEYS.flags, tutorialDone[LD_STORAGE_KEYS.flags]!);
  }

  /** The ordinary door: a tile on the collection, or the browser's address. */
  function launch() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LudoRoot onExit={onExit} />
      </SettingsProvider>,
    );
    return { onExit };
  }

  /** The same store, entered by the other door. */
  function launchFromShortcut() {
    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LudoRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    return { onExit };
  }

  /** Starts a match against Normal and puts it down again, the way a player does. */
  async function suspendAMatch() {
    fireEvent.click(screen.getByRole('button', { name: /Normal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
  }

  /**
   * A match with moves already in it, wound forward through the pure functions
   * until the throw is the player's again — and written into the slot.
   *
   * A match put down on its opening cannot say *which* match came back: its
   * board is sixteen pawns in four yards, exactly what dealing a fresh one
   * would show. Suspending one that has been played gives the board a position
   * only this match has, so the assertion is about identity and not merely
   * about landing on a board.
   */
  function suspendAPlayedMatch(): LudoSession {
    let expected = doRoll(createSession('normal', SEED_OPENS_WITH_A_SIX))!;
    expected = doMovePawn(expected, movablePawns(expected)[0]!)!;
    while (cpuBeatOwed(expected) !== null) {
      const owed = cpuBeatOwed(expected)!;
      expected = (owed.kind === 'roll' ? applyCpuRoll(expected) : applyCpuMove(expected))!;
    }
    deviceStore.set(LD_STORAGE_KEYS.game, JSON.stringify(canonicalRecordOf(expected, 1)));
    return expected;
  }

  /** The app goes to background. Android may kill it without another event. */
  function background() {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Reflect.deleteProperty(document, 'visibilityState');
  }

  /** Play seconds as they survive on disk, booked into the statistics. */
  function storedPlaySeconds(): number {
    const raw = deviceStore.get(LD_STORAGE_KEYS.stats);
    return raw === undefined ? 0 : (JSON.parse(raw) as Stats).totalPlaySeconds;
  }

  /** The suspended match's own clock, as it survives on disk. */
  function storedMatchSeconds(): number | null {
    const raw = deviceStore.get(LD_STORAGE_KEYS.game);
    return raw === undefined ? null : (JSON.parse(raw) as PersistedMatch).elapsedSeconds;
  }

  const boardShown = () => screen.queryByRole('group', { name: 'Ludo board' });
  const homeShown = () => screen.queryByRole('button', { name: /Easy/ });

  it('opens the suspended match straight onto its board', async () => {
    taughtAlready();
    const expected = suspendAPlayedMatch();

    launchFromShortcut();
    await settle();

    // The board, with the die still to be thrown — the same place a tap on
    // Normal would have led, minus the tap. And *this* board: the whole
    // position is read back, because a launch that dealt a fresh match would
    // also show a board, a die and no home screen.
    expectBoardMatches(expected);
    expect(dieButton()).toBeInTheDocument();
    expect(homeShown()).not.toBeInTheDocument();
    await settle();
  });

  it('leaves the board for this game’s home, not the collection', async () => {
    taughtAlready();
    launch();
    await settle();
    await suspendAMatch();
    cleanup();

    const onExit = vi.fn();
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <LudoRoot onExit={onExit} entry="shortcut" />
      </SettingsProvider>,
    );
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    // One step back from a board is this game's home, whichever door the board
    // was reached through: the way in did not add a screen to undo.
    expect(homeShown()).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
    await settle();
  });

  it('opens the home screen when nothing is suspended', async () => {
    taughtAlready();
    launchFromShortcut();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(homeShown()).toBeInTheDocument();
  });

  it('opens the home screen when the save could not have come from play', async () => {
    taughtAlready();
    const real = canonicalRecordOf(createSession('normal', SEED_OPENS_WITH_A_SIX), 1)!;
    deviceStore.set(
      LD_STORAGE_KEYS.game,
      JSON.stringify({ ...real, rollCount: 4, choices: '3333' }),
    );

    launchFromShortcut();
    await settle();

    // Booting does not stop on bad local data, and a shortcut is no exception:
    // the replay drops the record and the launch lands where it always did,
    // with nothing to resume and nothing repaired (§10.3).
    expect(boardShown()).not.toBeInTheDocument();
    expect(homeShown()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });

  it('is the only door that resumes: a tile on the collection still opens the home', async () => {
    taughtAlready();
    launch();
    await settle();
    await suspendAMatch();
    cleanup();

    launch();
    await settle();

    expect(boardShown()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Normal.*Resume/ })).toBeInTheDocument();
  });

  it('teaches the game first, even with a match to come back to', async () => {
    // Quick Rules unseen *and* a suspended match — the only shape in which the
    // tutorial is the thing being asked, since without a match every launch
    // lands on Quick Rules anyway and the gate could be deleted unnoticed. It
    // is reachable: the flags record going unreadable leaves the schema default
    // (`tutorialCompleted: false`) while the save beside it is untouched.
    deviceStore.set(
      LD_STORAGE_KEYS.game,
      JSON.stringify(canonicalRecordOf(createSession('normal', SEED_OPENS_WITH_A_SIX), 1)),
    );

    launchFromShortcut();
    await settle();

    // A shortcut is not a way past Quick Rules (§11); the match keeps.
    expect(screen.getByText('A six lets a pawn out')).toBeInTheDocument();
    expect(boardShown()).not.toBeInTheDocument();
  });

  // The counterpart of the backgrounding path. Opening the board at mount skips
  // `activate`, so it has to seed the same two clocks by hand: the seconds
  // already played are neither booked again nor written away. Neither mistake
  // shows on screen — this game has no clock (§8) — so disk is the only witness,
  // and both of the numbers there are checked.
  it('does not book the resumed match’s play seconds twice, or lose them', async () => {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Normal/ }));

    await advance(5_000);
    background();
    await settle();
    expect(storedPlaySeconds()).toBe(5);
    expect(storedMatchSeconds()).toBe(5);

    // The process dies here; nothing else runs. The shortcut brings it back.
    cleanup();
    launchFromShortcut();
    await settle();
    expect(boardShown()).toBeInTheDocument();

    await advance(3_000);
    background();
    await settle();
    // Eight seconds of play, counted once — and still eight on the match, which
    // is where a clock started from zero would have written the first five away.
    expect(storedPlaySeconds()).toBe(8);
    expect(storedMatchSeconds()).toBe(8);
  });
});

// ---------- motion ----------

describe('the moving parts, actually moving', () => {
  it('tumbles the die and walks the pawn when motion is allowed', async () => {
    stubMotionAllowed();
    renderGame(saved(createSession('normal', SEED_OPENS_WITH_A_SIX)));
    await settle();
    resume();

    fireEvent.click(dieButton());
    // The tumble runs, and it is over inside its 220ms ceiling (§12).
    expect(document.querySelector('.ld-die-spin')).not.toBeNull();
    await advance(220);
    expect(document.querySelector('.ld-die-spin')).toBeNull();

    fireEvent.click(livePawns()[0]!);
    // The pawn that just left the yard walks in from where it came.
    const walking = document.querySelector('.ld-pawn-walk');
    expect(walking).not.toBeNull();
    expect((walking as HTMLElement).style.getPropertyValue('--ld-walk-ms')).not.toBe('');
    await settle();
  });

  it('shows the face and the landing with no animation under reduced motion', async () => {
    // No matchMedia stub: this is jsdom's own state, and the app reads it as
    // "reduce motion" (src/ui/useReducedMotion.ts).
    renderGame(saved(createSession('normal', SEED_OPENS_WITH_A_SIX)));
    await settle();
    resume();

    fireEvent.click(dieButton());
    expect(document.querySelector('.ld-die-spin')).toBeNull();
    // The face is there immediately all the same.
    expect(screen.getByRole('img', { name: 'Die shows 6' })).toBeInTheDocument();

    fireEvent.click(livePawns()[0]!);
    expect(document.querySelector('.ld-pawn-walk')).toBeNull();
    await settle();
  });
});

// ---------- the lifecycle ----------

describe('closing the game', () => {
  it('leaves no timer running behind it', async () => {
    const opening = createSession('normal', SEED_CPU_GETS_A_PAWN_OUT);
    const { unmount } = renderGame(saved(opening));
    await settle();
    resume();

    // Unmounted mid-lap, with a CPU beat armed and a notice still up.
    fireEvent.click(dieButton());
    await advance(CPU_ROLL_DELAY_MS - 50);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    // "The game is gone, its work is gone" (docs/GAME_LIFECYCLE.md).
    expect(vi.getTimerCount()).toBe(0);
    await advance(CPU_ROLL_DELAY_MS * 10 + CPU_MOVE_DELAY_MS);
  });
});

// ---------- home ----------

describe('home', () => {
  it('reports a record per opponent, with no draws column and no streak', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));

    expect(screen.getAllByText('Games played')).toHaveLength(3);
    expect(screen.getAllByText('Wins')).toHaveLength(3);
    expect(screen.getAllByText('Losses')).toHaveLength(3);
    // A Ludo match ends on one seat getting home, so a tie for first is
    // unreachable and there is nothing to put in a draws column.
    expect(screen.queryByText('Draws')).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('exits to the collection', async () => {
    const { onExit } = renderGame(tutorialDone);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('opening a suspended game without resuming (#109)', () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. `syncActiveGame` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
    deviceStore.set(LD_STORAGE_KEYS.flags, tutorialDone[LD_STORAGE_KEYS.flags]!);
    launch();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Easy/ }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    background();
    await settle();
    expect(storedBoardSeconds()).toBe(9);

    // The process dies here. Relaunch and stop on the game's own home.
    cleanup();
    launch();
    await settle();
    expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();

    // Away again without ever resuming: the nine seconds are still there.
    background();
    await settle();
    expect(storedBoardSeconds()).toBe(9);
  });
});
