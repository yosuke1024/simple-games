/**
 * Ludo's app context: screens, the active match, statistics, and persistence.
 * Pure local state — no analytics, no ad orchestration; the only ad surfaces
 * are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played. The table's next beat is a
 * scheduled effect, not a callback chain: whenever the game screen shows a
 * session with a beat owing, **one** timeout is armed, and unmounting — or
 * anything that changes the session first, a new match, leaving the screen —
 * disarms it (docs/GAME_LIFECYCLE.md). This is Hearts' mechanism, copied
 * deliberately rather than reinvented: the effect depends on the session
 * itself, so every transition re-evaluates what is owed and arms the next
 * single beat, nothing polls, nothing looks ahead, and the landed timeout asks
 * the ref what is owed *now* before it does anything, because the session it
 * was armed against may no longer be the one on screen.
 *
 * **A CPU seat's roll and its move are two beats, not one** (game/session.ts
 * `cpuBeatOwed`). One beat would put the die on the table and walk the pawn in
 * the same frame, and the face — the only thing on screen that explains the
 * move — would never be readable on its own. So the die lands, it is read, and
 * then the pawn goes.
 *
 * **The screen never resolves a rule.** An automatic pass and a forfeited
 * third six are settled inside `rollDie` before the session comes back
 * (docs/LUDO_RULES.md §2.1, §2.6); what reaches here is `lastRoll.kind`, and
 * all the screen does with it is say so quietly, the way Reversi announces a
 * pass. `lastRoll` is a `RollEvent` and carries no board, so the board can
 * only ever be drawn from `session.state` — one beat stale is not a mistake
 * this shape makes available.
 *
 * **There is no undo here, and no place to add one.** The session layer does
 * not offer it (game/session.ts §6): the future is already fixed by the seed,
 * so taking a move back and rolling again would either hand the player a
 * preview of a die the rules have thrown or re-roll it. Help arrives instead
 * as `movable` — the pawns the rules allow, always on screen.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either; elapsed time is merged into the session whenever it leaves this
 * module (saves, finalization, navigation).
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { recordGameCompleted } from '../../../services/review';
import { saveRecord } from '../../../storage/repo';
import {
  applyCpuMove,
  applyCpuRoll,
  canRoll as canRollNow,
  cpuBeatOwed,
  createSession,
  doMovePawn,
  doRoll,
  movablePawns,
  type Difficulty,
  type LudoSession,
  type MatchStatus,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/**
 * How long a CPU seat holds the table before throwing. The same 450ms Hearts
 * gives one beat of its table — one event, then a moment to see it — because
 * to the eye it is the same thing.
 *
 * NOTE: this pair has not yet been checked on a device. 450/280 is the value
 * the shelf already runs at plus a shorter second half; whether a Ludo turn
 * *feels* right at that pace is a question only a phone can answer, and it has
 * not been asked yet.
 */
export const CPU_ROLL_DELAY_MS = 450;

/**
 * How long the face stays on the table before the pawn it moves walks. Shorter
 * than the throw: by now there is a number on screen to read, and the move it
 * explains is the thing being waited for.
 */
export const CPU_MOVE_DELAY_MS = 280;

/** The match's end, kept so the result overlay survives a re-render. */
export interface LastResult {
  readonly status: MatchStatus;
}

export interface LudoContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: LudoSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  /** Whether the die is the player's to throw right now. */
  canRoll: boolean;
  /**
   * The pawns the rules allow with the die on the table, ascending — the whole
   * of this game's help (docs/LUDO_RULES.md §7). Empty when there is nothing
   * to choose.
   */
  movable: readonly (0 | 1 | 2 | 3)[];
  /** Set once the match itself is over. Null while one is being played. */
  lastResult: LastResult | null;
  /** How strong the next match's three opponents are. Never changes one in play. */
  difficulty: Difficulty;
  setDifficulty: (value: Difficulty) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Throws the die. False when it is not the player's throw to make. */
  roll: () => boolean;
  /** Moves one pawn. False when the rules or the turn order refuse it. */
  movePawn: (pawn: 0 | 1 | 2 | 3) => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const LudoContext = createContext<LudoContextValue | null>(null);

/** One CPU beat: what to run, and how long the table waits before running it. */
interface Beat {
  readonly run: (session: LudoSession) => LudoSession | null;
  readonly delay: number;
}

/**
 * The beat the table owes, or null when it owes none and is waiting on the
 * player. This is the whole of the chain: one call answers "what happens next,
 * if anything", and the effect below arms exactly one timer for it.
 *
 * The two kinds are the game's own (game/session.ts). Which one is owed is
 * read off the session every time — including by the timer that has already
 * landed — so a schedule made against a session that has since moved on finds
 * a different answer, or none, and does nothing.
 */
function beatOwed(session: LudoSession): Beat | null {
  const owed = cpuBeatOwed(session);
  if (owed === null) return null;
  return owed.kind === 'roll'
    ? { run: applyCpuRoll, delay: CPU_ROLL_DELAY_MS }
    : { run: applyCpuMove, delay: CPU_MOVE_DELAY_MS };
}

export interface LudoProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: LudoSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function LudoProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: LudoProviderProps) {
  /**
   * Whether this launch opens straight onto the suspended match rather than
   * onto the home screen (issue #113). Decided once, from the record the
   * provider was mounted with: a launch means whatever it meant when it
   * happened, and no save made later can change that.
   *
   * Only a home-screen shortcut asks — every other door opens the home, as it
   * always did — and only once Quick Rules are behind the player: a first
   * launch teaches the game before it shows a board (§11), and a shortcut is
   * not a way past that. That clause lives here and nowhere else, which is why
   * the screen below asks this first and the tutorial second: written the other
   * way round the tutorial would be gated twice, and a guard nothing can
   * observe failing is not a guard.
   *
   * There is nothing to disambiguate here, and that is the slot's doing rather
   * than this line's: one match (§10), already replayed and dropped if play
   * could not have produced it (§10.3), standing on the one state a record can
   * express — you, about to throw (§10.2). So a session at all *is* the match
   * to come back to.
   */
  const [resumeDirect] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirect ? 'game' : !initialFlags.tutorialCompleted ? 'tutorial' : 'home',
  );
  const [session, setSession] = useState<LudoSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. There is one
   * slot, so it is the same session whichever door the launch came through
   * — which is why this is not gated on the resume: a launch that stops on
   * the game's own home reaches `syncActiveGame` too, and from a zero
   * baseline that saves `elapsedSeconds: 0` over the suspended board
   * (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   *
   * Starts on the mounted game rather than at zero, because every save merges
   * this ref into the session and `syncActiveGame` runs on any background,
   * not only from the game screen. `activate` re-establishes the baseline
   * whenever a game comes on screen; this line covers the mount before that.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this match.
   *
   * The same baseline, and it has to be: a suspended game arrives with its
   * seconds already in `totalPlaySeconds` — they were booked by the sync
   * that saved it. Seeding the clock alone would book its whole elapsed
   * time a second time. The two are one invariant; neither moves without
   * the other.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: LudoSession): LudoSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a match is booked and the next one started from the same
    // tap. React has not re-rendered in between, so the ref is advanced here
    // rather than waiting for the render that assigns it.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a match's unbooked play time, and — only when it actually ended —
   * its result, once. A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: LudoSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, match.elapsedSeconds - bookedRef.current);
      bookedRef.current = match.elapsedSeconds;
      persistStats(
        applyMatchEnd(applyPlayTime(statsRef.current, unbooked), match.difficulty, match.status),
      );
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: LudoSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: LudoSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      // The review question counts games *won* (docs/REVIEW_PROMPT_POLICY.md).
      // A match stopped by the roll cap is not one — nobody got home — and
      // neither is a loss, so neither asks.
      if (next.status === 'won') recordGameCompleted();
      setLastResult({ status: next.status });
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: LudoSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setScreen('game');
  }, []);

  /**
   * Resumes the suspended match. A restored session always stands on the
   * canonical state — the player, about to throw (§10.2) — so this never lands
   * mid-choice or on a CPU seat's turn, and the screen it opens starts with
   * the die still to be thrown.
   */
  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  /**
   * How strong the *next* match's opponents are. A match in progress keeps the
   * strength it was started against until it ends — this never touches it.
   *
   * The ref is what `startNewGame` reads, and both can fire from one tap on the
   * home screen — pick a strength, then start. React has not re-rendered in
   * between, so the ref is advanced here rather than in the next render.
   */
  const setDifficulty = useCallback((value: Difficulty) => {
    if (prefsRef.current.difficulty === value) return;
    const next = { ...prefsRef.current, difficulty: value };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      const next = createSession(difficulty);
      finalizedRef.current = false;
      // Starting against a strength is itself the choice of one, so the
      // preference follows the board rather than only a separate picker.
      setDifficulty(difficulty);
      // Played is counted here, at the start, and only for a new match —
      // resuming one counts nothing, because this already did (§9).
      persistStats(applyGameStart(statsRef.current, difficulty));
      setLastResult(null);
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, setDifficulty, withElapsed],
  );

  /**
   * One beat by the player. The session layer answers null when the rules or
   * the turn order refuse it, and the screen only offers what is legal — so a
   * stray tap is nothing, silently (§7).
   */
  const dispatch = useCallback(
    (play: (current: LudoSession) => LudoSession | null): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = play(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const roll = useCallback(() => dispatch(doRoll), [dispatch]);
  const movePawn = useCallback(
    (pawn: 0 | 1 | 2 | 3) => dispatch((current) => doMovePawn(current, pawn)),
    [dispatch],
  );

  // The chain: one armed timeout whenever the game screen shows a session that
  // owes a CPU beat. Depends on the session itself, so each transition arms the
  // next one — a seat throws, the face is read, the pawn walks, and straight on
  // into the same seat's extra throw after a six or into the next seat — and so
  // any change (a new match, leaving the screen, unmounting) disarms a stale
  // one via the cleanup. The landed timeout asks what is owed *now*, because
  // the session it was armed for may no longer be the one on screen.
  useEffect(() => {
    if (screen !== 'game' || !session) return;
    const armed = beatOwed(session);
    if (armed === null) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current) return;
      const beat = beatOwed(current);
      if (beat === null) return;
      const next = beat.run(withElapsed(current));
      if (!next) return;
      commitSession(next);
    }, armed.delay);
    return () => window.clearTimeout(id);
  }, [screen, session, commitSession, withElapsed]);

  /** Saves the on-screen match and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, unbooked));
      }
    }
  }, [persistStats, putSession, withElapsed]);

  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Play clock: one second at a time while the game screen is visible.
  // Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden. This is the same sync
  // as leaving the screen, statistics included: the OS can kill a backgrounded
  // app without sending another event, and the next launch hands the restored
  // elapsedSeconds back as *already booked*. Saving the board alone here would
  // drop every play second since the last sync for good.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame]);

  const movable = useMemo(() => (session === null ? [] : movablePawns(session)), [session]);
  const canRoll = session !== null && canRollNow(session);

  const value = useMemo<LudoContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      canRoll,
      movable,
      lastResult,
      difficulty: prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      roll,
      movePawn,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      flags.tutorialCompleted,
      canRoll,
      movable,
      lastResult,
      prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      roll,
      movePawn,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <LudoContext.Provider value={value}>{children}</LudoContext.Provider>;
}

export function useLudo(): LudoContextValue {
  const value = useContext(LudoContext);
  if (!value) throw new Error('useLudo must be used inside LudoProvider');
  return value;
}
