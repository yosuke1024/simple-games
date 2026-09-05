/**
 * Checkers' app context: screens, the active match, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played (§8). The CPU's turn is a
 * scheduled effect, not a callback chain: whenever the session says the CPU
 * is to move on the game screen, one timeout is armed, and unmounting — or
 * anything that changes the session first, an undo, a new match — disarms it
 * (docs/GAME_LIFECYCLE.md).
 *
 * A capture sequence is where this differs from the other two CPU titles. The
 * CPU decides its whole turn at once, but the screen plays it one jump at a
 * time, so the effect arms again for each remaining step: the long pause
 * before the turn, a shorter one between the jumps of it. The planned steps
 * live in a ref, because re-deciding between jumps could pick a different
 * branch of the same sequence and the player would watch a piece change its
 * mind mid-air. Anything that abandons the turn clears the ref.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either (§10); elapsed time is merged into the session whenever it leaves
 * this module (saves, finalization, navigation).
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
  applyCpuStep,
  applyPlayerStep,
  CPU,
  createSession,
  planCpuTurn,
  PLAYER,
  undo,
  type CheckersSession,
  type Difficulty,
  type Move,
  type Side,
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

/** The CPU's turn lands after a beat, so the turn reads as a turn (§4). */
export const CPU_DELAY_MS = 450;
/**
 * Between the jumps of one sequence. Shorter than the turn's own pause: this
 * is not the opponent thinking, it is one move still being made (§10).
 */
export const CPU_STEP_MS = 260;

/** What just landed on the board, for the screen's sounds and marks (§10). */
export interface LastMove {
  readonly by: Side;
  readonly move: Move;
  /** True when this step crowned a man, so the ring can pop (§10). */
  readonly crowned: boolean;
  /** Identity: one screen effect per step, replays excluded. */
  readonly stepId: number;
}

export interface CheckersContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: CheckersSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  /** Which side the next match starts with (§1). Never changes one in play. */
  playerGoesFirst: boolean;
  setPlayerGoesFirst: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Plays one step. False when it was not legal or not your turn (§2). */
  playStep: (move: Move) => boolean;
  /** Back to the previous decision point. False when there is none (§5). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const CheckersContext = createContext<CheckersContextValue | null>(null);

export interface CheckersProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: CheckersSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function CheckersProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  children,
}: CheckersProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<CheckersSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** The steps of the CPU turn still to be shown, in order (§10). */
  const cpuStepsRef = useRef<readonly Move[]>([]);
  /** Rises with every step shown, so each one animates exactly once. */
  const stepIdRef = useRef(0);

  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   *
   * Seeded from the restored game rather than from zero, because every save
   * merges this ref into the session and `syncActiveGame` runs on any
   * background, not only from the game screen. Open the game, stay on its own
   * home without pressing Resume, then background the app: from a zero
   * baseline that writes `elapsedSeconds: 0` over a suspended board, and the
   * minutes already on its clock are gone. `activate` re-establishes the
   * baseline whenever a game comes on screen; this line covers the mount
   * before that.
   */
  const elapsedRef = useRef(initialSession?.elapsedSeconds ?? 0);
  /**
   * Play seconds already booked into the statistics for this match.
   *
   * Seeded from the restored game rather than from zero, because a suspended
   * game arrives with its seconds already in `totalPlaySeconds` — they were
   * booked by the sync that saved it. `activate` re-establishes this baseline
   * whenever a game comes on screen, but the mount before that is reachable:
   * opening the game and leaving from its home without resuming runs
   * `syncActiveGame` against the restored session, and from a zero baseline
   * that books its whole elapsed time a second time. Open and leave twice and
   * it lands twice. The comment on the visibility effect below already states
   * this invariant — this is the line that makes it true.
   */
  const bookedRef = useRef(initialSession?.elapsedSeconds ?? 0);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: CheckersSession): CheckersSession => {
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
   * its result, once (§7). A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: CheckersSession) => {
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
  const putSession = useCallback((next: CheckersSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: CheckersSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      recordGameCompleted();
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: CheckersSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A board that arrives rather than plays out has no move to animate, and
    // no CPU turn half-shown.
    cpuStepsRef.current = [];
    setLastMove(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const setPlayerGoesFirst = useCallback((value: boolean) => {
    if (prefsRef.current.playerGoesFirst === value) return;
    const next = { ...prefsRef.current, playerGoesFirst: value };
    // The ref is what startNewGame reads, and both can fire from one tap on
    // the home screen — pick a side, then start. React has not re-rendered in
    // between, so the ref is advanced here rather than in the next render.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      // The side is taken at the start and stays with the match (§1); a later
      // change to the preference leaves this one alone.
      const next = createSession(difficulty, prefsRef.current.playerGoesFirst ? PLAYER : CPU);
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, difficulty));
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, withElapsed],
  );

  const playStep = useCallback(
    (move: Move): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerStep(withElapsed(current), move);
      if (!outcome) return false;

      stepIdRef.current += 1;
      setLastMove({
        by: PLAYER,
        move: outcome.move,
        crowned: outcome.crowned,
        stepId: stepIdRef.current,
      });
      commitSession(outcome.session);
      return true;
    },
    [commitSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    // An undone board is placed, not replayed: nothing slides, and any
    // scheduled CPU step is against a session that no longer exists.
    cpuStepsRef.current = [];
    setLastMove(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move (§4). Depends on the session itself, so any
  // change (undo, new match, unmount) disarms a stale one via the cleanup.
  // Between the jumps of one sequence the same effect re-arms on the shorter
  // pause, because the session has changed but the CPU is still to move.
  useEffect(() => {
    if (screen !== 'game' || !session || session.status !== 'playing' || session.toMove !== CPU) {
      return;
    }
    const midSequence = session.pendingJumpFrom !== null;
    const id = window.setTimeout(
      () => {
        const current = sessionRef.current;
        if (!current || current.status !== 'playing' || current.toMove !== CPU) return;

        if (cpuStepsRef.current.length === 0) {
          const planned = planCpuTurn(withElapsed(current));
          if (planned === null) return;
          cpuStepsRef.current = planned;
        }
        const [next, ...rest] = cpuStepsRef.current;
        if (next === undefined) return;
        const outcome = applyCpuStep(withElapsed(current), next);
        // A step the rules refuse means the plan and the board have drifted
        // apart; drop the plan rather than force it, and the next pass will
        // decide again from the position actually on screen.
        if (!outcome) {
          cpuStepsRef.current = [];
          return;
        }
        cpuStepsRef.current = rest;
        stepIdRef.current += 1;
        setLastMove({
          by: CPU,
          move: outcome.move,
          crowned: outcome.crowned,
          stepId: stepIdRef.current,
        });
        commitSession(outcome.session);
      },
      midSequence ? CPU_STEP_MS : CPU_DELAY_MS,
    );
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

  // Save when the app goes to background / gets hidden (§8). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Saving the board
  // alone here would drop every play second since the last sync for good.
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

  const value = useMemo<CheckersContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastMove,
      playerGoesFirst: prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playStep,
      applyUndo,
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
      lastMove,
      prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playStep,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <CheckersContext.Provider value={value}>{children}</CheckersContext.Provider>;
}

export function useCheckers(): CheckersContextValue {
  const value = useContext(CheckersContext);
  if (!value) throw new Error('useCheckers must be used inside CheckersProvider');
  return value;
}
