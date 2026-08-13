/**
 * The context's three jobs that only React can get wrong: the chain of beats,
 * the books, and the play clock.
 *
 * The chain is what a turn of Ludo actually looks like. You throw; the throw
 * may resolve itself (an automatic pass, a forfeited third six) or wait for a
 * pawn; and then three CPU seats each throw and move, in **two beats apiece**,
 * possibly several times over when a six earns another throw. It is still one
 * armed timeout, re-armed by an effect that depends on the session
 * (docs/GAME_LIFECYCLE.md), and the cases below pin what that single mechanism
 * has to cover: beats arriving one at a time rather than all at once; a timer
 * that lands against a session which has since moved on doing nothing; and
 * leaving, unmounting or starting a new match under it.
 *
 * Positions are reached by **playing** wherever a real one exists, because a
 * Ludo position is only valid if the whole match replays into it
 * (game/serialize.ts). Three positions have no reachable form inside a test
 * that finishes in milliseconds — a match one exact throw from being won, one
 * a CPU seat is about to win, and one standing on the last throw the rules
 * allow — so those three are built directly on the engine's own state and then
 * driven the rest of the way through the real functions. Every transition the
 * cases assert about is a real one.
 *
 * The clock is a ref rather than state (battery), so it is observed the way the
 * app observes it: through the session that a save or a navigation leaves
 * behind. Time spent in the background is not play time.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCpuMove,
  applyCpuRoll,
  canonicalRecordOf,
  cpuBeatOwed,
  createSession,
  doRoll,
  movablePawns,
  restoreSession,
  HOME_PROGRESS,
  MAX_ROLLS,
  YOU,
  type LudoSession,
  type MatchState,
} from '../game';
import { saveGame } from '../storage/gamePersistence';
import { gameSchema, statsSchema, type Prefs, type Stats } from '../storage/schemas';
import {
  CPU_MOVE_DELAY_MS,
  CPU_ROLL_DELAY_MS,
  LudoProvider,
  useLudo,
  type LudoContextValue,
} from './GameContext';

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

/** The review question is the shell's; here we only watch for the one call. */
const { recordGameCompleted } = vi.hoisted(() => ({ recordGameCompleted: vi.fn() }));
vi.mock('../../../services/review', () => ({ recordGameCompleted }));

// ---------- seeds, chosen for the face they turn up ----------

/** Its first throw is not a six: sixteen pawns in yards, so nothing can move. */
const SEED_OPENS_WITH_A_PASS = 'ludo-pass-0';
/** Its first throw is a six and its second is not. */
const SEED_OPENS_WITH_A_SIX = 'ludo-six1-13';
/** Its first three throws are all sixes. */
const SEED_THREE_SIXES = 'ludo-six3-298';
/** Its first throw is a one — the exact count a pawn on 58 needs. */
const SEED_OPENS_WITH_A_ONE = 'ludo-one-5';
/**
 * Its first throw is not a six — so the player's opening throw passes — and
 * its second is, which puts a CPU pawn on the board and gives the lap a move
 * beat as well as throw beats.
 */
const SEED_CPU_GETS_A_PAWN_OUT = 'ludo-cpu-19';

// ---------- positions ----------

const pawnsOf = (rows: readonly (readonly number[])[]): MatchState['pawns'] =>
  rows.map((row) => [...row]) as unknown as MatchState['pawns'];

const withState = (session: LudoSession, state: Partial<MatchState>): LudoSession => ({
  ...session,
  state: { ...session.state, ...state },
});

/** The player, three pawns home and one an exact throw of one from the fourth. */
const oneThrowFromWinning = (seed = SEED_OPENS_WITH_A_ONE): LudoSession =>
  withState(createSession('normal', seed), {
    pawns: pawnsOf([
      [HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS - 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]),
  });

/** The same, for CPU 1, and with the turn already theirs. */
const cpuOneThrowFromWinning = (seed = SEED_OPENS_WITH_A_ONE): LudoSession =>
  withState(createSession('normal', seed), {
    turn: 1,
    pawns: pawnsOf([
      [0, 0, 0, 0],
      [HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS, HOME_PROGRESS - 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]),
  });

/**
 * Standing on the last throw the rules allow. The cap belongs to the rules
 * (docs/LUDO_RULES.md §2.7), so the ending is produced by actually throwing —
 * only the count of throws already made is placed by hand.
 */
const onTheLastThrow = (seed = SEED_OPENS_WITH_A_SIX): LudoSession =>
  withState(createSession('normal', seed), { rollIndex: MAX_ROLLS - 1 });

// ---------- mounting ----------

interface Mounted {
  api: () => LudoContextValue;
  unmount: () => void;
}

function mount(
  initialSession: LudoSession | null,
  initialPrefs: Prefs = { schemaVersion: 1, difficulty: 'normal' },
): Mounted {
  let value!: LudoContextValue;
  function Probe() {
    value = useLudo();
    return null;
  }
  const { unmount } = render(
    <LudoProvider
      initialStats={statsSchema.defaultValue()}
      initialFlags={{ schemaVersion: 1, tutorialCompleted: true }}
      initialPrefs={initialPrefs}
      initialSession={initialSession}
      onExit={vi.fn()}
    >
      <Probe />
    </LudoProvider>,
  );
  return { api: () => value, unmount };
}

/** Mounts a match and brings it on screen, the way a resume does. */
function resumed(session: LudoSession, prefs?: Prefs): Mounted {
  const mounted = mount(session, prefs);
  act(() => mounted.api().resumeGame());
  return mounted;
}

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Runs one dispatch the way a tap does — inside act — and gives its answer. */
function tap<T>(run: () => T): T {
  let answer!: T;
  act(() => {
    answer = run();
  });
  return answer;
}

const settle = () => act(async () => undefined);

/** What actually survives on disk — the record the next launch will read. */
const stored = <T,>(key: string): T | null => {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
};

/**
 * Winds the same match forward off-screen, one beat at a time, waiting exactly
 * as long as the screen does for each. The expected session is computed from
 * the pure functions, so the assertion is "the screen's board is the board the
 * rules produce", never "the screen agrees with itself".
 */
async function runCpuBeats(from: LudoSession, beats = Number.POSITIVE_INFINITY) {
  let expected = from;
  for (let beat = 0; beat < beats; beat++) {
    const owed = cpuBeatOwed(expected);
    if (owed === null) break;
    await advance(owed.kind === 'roll' ? CPU_ROLL_DELAY_MS : CPU_MOVE_DELAY_MS);
    expected = (owed.kind === 'roll' ? applyCpuRoll(expected) : applyCpuMove(expected))!;
  }
  return expected;
}

let visibility = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
  deviceStore.clear();
  recordGameCompleted.mockClear();
});

// ---------- the chain ----------

describe('one throw, and the board answers in beats', () => {
  it('gives every CPU seat a throw and a move, a beat apart, and hands the turn back', async () => {
    const opening = createSession('normal', SEED_CPU_GETS_A_PAWN_OUT);
    const { api } = resumed(opening);

    // Your own throw: nothing can move out of the yard without a six, so the
    // engine has already passed it before the session came back (§2.6).
    expect(tap(() => api().roll())).toBe(true);
    expect(api().session!.lastRoll!.kind).toBe('autoPass');
    expect(api().session!.state.turn).not.toBe(YOU);

    // Nothing moves until the whole beat is up.
    const waiting = api().session!;
    await advance(CPU_ROLL_DELAY_MS - 1);
    expect(api().session).toBe(waiting);

    // Then the CPU seats, one beat each, until the board needs the player
    // again — and every step of the way the screen's board is the board the
    // rules produce from the same position.
    let expected = doRoll(opening)!;
    const kinds: string[] = [];
    while (cpuBeatOwed(expected) !== null && kinds.length < 60) {
      const owed = cpuBeatOwed(expected)!;
      await advance(owed.kind === 'roll' ? 1 : CPU_MOVE_DELAY_MS);
      expected = (owed.kind === 'roll' ? applyCpuRoll(expected) : applyCpuMove(expected))!;
      expect(api().session!.state, `beat ${kinds.length}`).toEqual(expected.state);
      kinds.push(owed.kind);
      // The next beat's own wait, minus the millisecond already spent above.
      const next = cpuBeatOwed(expected);
      if (next?.kind === 'roll') await advance(CPU_ROLL_DELAY_MS - 1);
    }
    // Three seats threw, and at least one of them had a pawn to walk — a lap
    // of nothing but automatic passes would not be a chain at all.
    expect(kinds.filter((kind) => kind === 'roll').length).toBeGreaterThanOrEqual(3);
    expect(kinds).toContain('move');

    // And then it stops: the throw is the player's again, and no timer moves
    // anything on its own.
    expect(api().session!.state.turn).toBe(YOU);
    expect(api().canRoll).toBe(true);
    const settled = api().session!;
    await advance(CPU_ROLL_DELAY_MS * 8);
    expect(api().session).toBe(settled);
  });

  it('keeps a CPU seat’s throw and its move as two beats', async () => {
    // The face has to be readable before the pawn it moves starts walking, so
    // the two are never collapsed into one timer.
    const opening = createSession('normal', SEED_CPU_GETS_A_PAWN_OUT);
    const { api } = resumed(opening);
    tap(() => api().roll());

    let expected = doRoll(opening)!;
    // Walk to the first CPU beat that is a move — a seat that rolls a six on
    // its first throw has one, and a seat that auto-passes does not.
    let guard = 0;
    while (cpuBeatOwed(expected)?.kind === 'roll' && guard < 40) {
      await advance(CPU_ROLL_DELAY_MS);
      expected = applyCpuRoll(expected)!;
      guard += 1;
    }
    // A case that never reached a move beat would prove nothing, so the seed
    // is held to producing one rather than skipped over.
    const owed = cpuBeatOwed(expected);
    expect(owed).not.toBeNull();
    expect(owed!.kind).toBe('move');

    // The die is on the table and the pawn has not moved yet.
    expect(api().session!.state.die).not.toBeNull();
    await advance(CPU_MOVE_DELAY_MS - 1);
    expect(api().session!.state.die).not.toBeNull();
    await advance(1);
    expect(api().session!.state).toEqual(applyCpuMove(expected)!.state);
  });

  it('lets a six throw again, and ends the turn on the third one', async () => {
    // Three sixes in a row (§2.1). The first two each move a pawn out and
    // earn another throw; the third forfeits the turn without a move.
    const { api } = resumed(createSession('normal', SEED_THREE_SIXES));

    tap(() => api().roll());
    expect(api().session!.lastRoll).toMatchObject({ die: 6, kind: 'move', seat: YOU });
    expect(tap(() => api().movePawn(api().movable[0]!))).toBe(true);
    // A six keeps the throw, so the turn has not moved on.
    expect(api().session!.state.turn).toBe(YOU);
    expect(api().canRoll).toBe(true);

    tap(() => api().roll());
    expect(api().session!.lastRoll!.die).toBe(6);
    tap(() => api().movePawn(api().movable[0]!));
    expect(api().session!.state.turn).toBe(YOU);

    tap(() => api().roll());
    // The third six offers nothing to move and takes the turn away.
    expect(api().session!.lastRoll).toMatchObject({ die: 6, kind: 'thirdSix' });
    expect(api().session!.state.die).toBeNull();
    expect(api().session!.state.turn).not.toBe(YOU);
    expect(api().movable).toEqual([]);
    await settle();
  });

  it('passes a throw nothing can answer, without asking anybody anything', async () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_PASS));
    tap(() => api().roll());
    // No choice was ever offered, and nothing was recorded as a choice: a pass
    // is derived, never written down (game/serialize.ts).
    expect(api().session!.lastRoll!.kind).toBe('autoPass');
    expect(api().session!.choices).toEqual([]);
    expect(api().movable).toEqual([]);
    await settle();
  });
});

describe('the chain is disarmed by everything that should disarm it', () => {
  const cpuTurn = () => {
    const opening = createSession('normal', SEED_OPENS_WITH_A_PASS);
    return doRoll(opening)!;
  };

  it('stops when the game screen does', async () => {
    const { api } = resumed(cpuTurn());
    act(() => api().goHome());
    const before = api().session!.state;
    await advance(CPU_ROLL_DELAY_MS * 8);
    expect(api().session!.state).toEqual(before);
  });

  it('stops on unmount, mid-beat', async () => {
    const { api, unmount } = resumed(cpuTurn());
    await advance(CPU_ROLL_DELAY_MS - 100);
    const onDisk = deviceStore.get(gameSchema.key);

    unmount();
    await advance(CPU_ROLL_DELAY_MS * 8);

    // No beat landed after the tree went away — the record is where it was,
    // and nothing tried to set state on a component that no longer exists.
    expect(deviceStore.get(gameSchema.key)).toBe(onDisk);
    expect(() => api()).not.toThrow();
  });

  it('does nothing when its timer lands on a session that has moved on', async () => {
    const { api } = resumed(cpuTurn());
    await advance(CPU_ROLL_DELAY_MS - 100);

    act(() => api().startNewGame('easy'));
    const dealt = api().session!;
    expect(dealt.difficulty).toBe('easy');
    expect(dealt.state.rollIndex).toBe(0);

    // The beat armed against the old session lands into a new match whose
    // throw belongs to the player: it asks what is owed *now*, is told
    // nothing, and does nothing.
    await advance(100);
    expect(api().session!.seed).toBe(dealt.seed);
    expect(api().session!.state).toEqual(dealt.state);
    await settle();
  });
});

// ---------- the player's own beats ----------

describe('the player’s beats', () => {
  it('are refused, silently, when they are not legal', async () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_SIX));
    // Nothing can move before the die is thrown.
    expect(api().movable).toEqual([]);
    expect(tap(() => api().movePawn(0))).toBe(false);

    tap(() => api().roll());
    // And the die cannot be thrown twice for one move.
    expect(api().canRoll).toBe(false);
    expect(tap(() => api().roll())).toBe(false);

    const legal = [...api().movable];
    expect(legal.length).toBeGreaterThan(0);
    for (const pawn of [0, 1, 2, 3] as const) {
      if (!legal.includes(pawn)) expect(tap(() => api().movePawn(pawn))).toBe(false);
    }
    await settle();
  });

  it('offer exactly the pawns the rules allow, and no help beyond that', async () => {
    const opening = createSession('normal', SEED_OPENS_WITH_A_SIX);
    const { api } = resumed(opening);
    tap(() => api().roll());
    // The list is the whole of the help (§7): which pawns the rules allow,
    // never which one is good.
    expect(api().movable).toEqual(movablePawns(doRoll(opening)!));
    tap(() => api().movePawn(api().movable[0]!));
    await settle();
  });

  it('are not takeable back — there is no undo in the API', () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_SIX));
    // Not an oversight: the faces are fixed by the seed before the match
    // starts, so a take-back would either preview a throw or re-roll it (§6).
    expect(Object.keys(api()).some((name) => /undo/i.test(name))).toBe(false);
  });
});

// ---------- the match ----------

describe('a match that ends', () => {
  it('books the win, clears the slot, and asks the review question once', async () => {
    const near = oneThrowFromWinning();
    await act(async () => {
      await saveGame(near);
    });
    expect(deviceStore.has(gameSchema.key)).toBe(true);

    const { api } = resumed(near);
    tap(() => api().roll());
    expect(api().session!.lastRoll!.die).toBe(1);
    tap(() => api().movePawn(api().movable[0]!));
    await settle();

    expect(api().session!.status).toBe('won');
    expect(api().lastResult).toEqual({ status: 'won' });
    expect(api().canResume).toBe(false);
    // A finished match is not one to come back to.
    expect(deviceStore.has(gameSchema.key)).toBe(false);
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({ played: 0, wins: 1, losses: 0 });
    // The question counts matches won, and this counted once
    // (docs/REVIEW_PROMPT_POLICY.md).
    expect(recordGameCompleted).toHaveBeenCalledTimes(1);
  });

  it('books the loss and asks nothing', async () => {
    const { api } = resumed(cpuOneThrowFromWinning());
    await runCpuBeats(cpuOneThrowFromWinning());
    await settle();

    expect(api().session!.status).toBe('lost');
    expect(api().lastResult!.status).toBe('lost');
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({ played: 0, wins: 0, losses: 1 });
    expect(recordGameCompleted).not.toHaveBeenCalled();
    expect(deviceStore.has(gameSchema.key)).toBe(false);
  });

  it('books a no-contest as neither a win nor a loss, and asks nothing', async () => {
    // The roll cap stops a match with nobody home (§2.7). It is not a draw —
    // the rules produce none — it is a match with no result, already counted
    // as played when it started.
    const { api } = resumed(onTheLastThrow());
    tap(() => api().roll());
    await settle();

    expect(api().session!.status).toBe('noContest');
    expect(api().lastResult!.status).toBe('noContest');
    expect(stored<Stats>(statsSchema.key)!.normal).toEqual({ played: 0, wins: 0, losses: 0 });
    expect(recordGameCompleted).not.toHaveBeenCalled();
    expect(deviceStore.has(gameSchema.key)).toBe(false);
  });

  it('counts a match as played when it starts, and a resume never', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toEqual({ played: 1, wins: 0, losses: 0 });

    // Abandoned for another: played twice, lost never.
    act(() => api().startNewGame('hard'));
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard).toEqual({ played: 2, wins: 0, losses: 0 });

    // And putting one down and picking it back up is not starting a match.
    act(() => api().goHome());
    act(() => api().resumeGame());
    await settle();
    expect(stored<Stats>(statsSchema.key)!.hard.played).toBe(2);
  });
});

// ---------- the slot ----------

describe('suspending and coming back', () => {
  it('writes a record the match replays out of, standing on the player’s throw', async () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_SIX));
    tap(() => api().roll());
    tap(() => api().movePawn(api().movable[0]!));
    await settle();

    const record = stored<ReturnType<typeof canonicalRecordOf>>(gameSchema.key)!;
    expect(record).not.toBeNull();
    const back = restoreSession(gameSchema.validate(record)!)!;
    expect(back).not.toBeNull();
    // A restored match always starts with the die still to be thrown (§10.2).
    expect(back.state.turn).toBe(YOU);
    expect(back.state.die).toBeNull();
    expect(back.choices).toEqual(api().session!.choices);
  });

  it('saves and books play time when the app is hidden', async () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_SIX));
    await advance(3000);

    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(api().session!.elapsedSeconds).toBe(3);
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(3);

    // Eight seconds in the background buy nothing.
    await advance(8000);
    visibility = 'visible';
    await advance(2000);
    act(() => api().goHome());
    await settle();
    expect(api().session!.elapsedSeconds).toBe(5);
    expect(stored<Stats>(statsSchema.key)!.totalPlaySeconds).toBe(5);
  });
});

// ---------- the opponents for next time ----------

describe('the opponents for next time', () => {
  it('are remembered, and never change the match in play', async () => {
    const { api } = resumed(createSession('normal', SEED_OPENS_WITH_A_SIX), {
      schemaVersion: 1,
      difficulty: 'easy',
    });
    expect(api().difficulty).toBe('easy');

    act(() => api().setDifficulty('hard'));
    await settle();
    expect(api().difficulty).toBe('hard');
    expect(stored<Prefs>('ld.prefs')!.difficulty).toBe('hard');
    // The match on screen keeps the strength it was started against.
    expect(api().session!.difficulty).toBe('normal');
  });

  it('follow the strength a new match is actually started against', async () => {
    const { api } = mount(null);
    act(() => api().startNewGame('easy'));
    await settle();
    expect(api().difficulty).toBe('easy');
    expect(stored<Prefs>('ld.prefs')!.difficulty).toBe('easy');
    expect(api().session!.difficulty).toBe('easy');
  });
});
