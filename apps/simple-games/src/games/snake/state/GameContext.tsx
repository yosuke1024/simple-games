/**
 * Snake's app context: the screens, the run on the board, the statistics,
 * the speed preference, persistence, and the one clock that moves the snake
 * (docs/SNAKE_RULES.md §6, §10, §11, §13). Pure local state — no analytics;
 * the only ad surfaces are the shared BannerSlot and ResultAdSlot.
 *
 * Every rule lives in game/; this module only decides WHEN a rule is asked:
 *
 * - The tick is one chained `setTimeout`, set by an effect that exists only
 *   while the game screen shows a running run. Pause, background, a dialog,
 *   the end of the run and unmount all take it down by making the effect
 *   condition false (or by unmounting). There is no requestAnimationFrame
 *   loop and no polling: a stopped board schedules nothing (§13).
 * - Every session change goes through `commit`, which is where the side
 *   effects of a transition live once: the play counted at ready → running,
 *   the running clock started and stopped, the run booked when it ends.
 * - Saving is event-driven (§11): Pause, background (visibilitychange hidden,
 *   native `pause`), the window losing focus while a run moves, leaving the
 *   screen, and unmount. Never per tick. Background always pauses first;
 *   coming back never resumes (§6).
 *
 * The running clock is two timestamps, not a timer: `runningSinceRef` is when
 * the run last started moving, `elapsedRef` what it had run before that. A
 * paused run's clock therefore costs nothing at all, and nothing re-renders
 * because time passes.
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
import { sounds } from '../../../services/sound';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  createSession,
  isFinished,
  isSuspendable,
  newSeedToken,
  pause,
  resume,
  snakeSeed,
  start,
  tick,
  TICK_MS,
  turn,
  type Crash,
  type Direction,
  type SnakeSession,
  type Speed,
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
import { applyPlayTime, applyRunEnd, applyRunStart, previousBestScore } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/**
 * A run has to be worth this much before it counts towards the review
 * question (docs/REVIEW_PROMPT_POLICY.md): every run here ends sooner or
 * later, and one that crashed three foods in is not the "completed game" the
 * counter is meant to measure. A full board always counts.
 */
const REVIEW_MIN_SCORE = 20;

export interface LastResult {
  readonly outcome: 'over' | 'cleared';
  /** What ended a run that was not a full board (§4). */
  readonly crash: Crash | null;
  readonly score: number;
  readonly length: number;
  readonly speed: Speed;
  readonly bestScore: number;
  /** The record before this run, at this speed, or null while there was none (§10). */
  readonly previousBestScore: number | null;
  readonly isNewBestScore: boolean;
}

export interface SnakeContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The run on the board or suspended, or null before the first one. */
  session: SnakeSession | null;
  stats: Stats;
  /** The speed the next new run starts at (§7). */
  speed: Speed;
  tutorialCompleted: boolean;
  /** A started, unfinished run is waiting (§11). */
  canResume: boolean;
  lastResult: LastResult | null;
  setSpeed: (speed: Speed) => void;
  /**
   * A fresh run at the preferred speed, on a new seed, standing ready on the
   * game screen. A suspended run it replaces is booked and its slot removed
   * first (§6, §10, §11); the home asks before calling this when there is one.
   */
  startNewRun: () => void;
  /** Back onto the suspended run, still paused (§6). */
  resumeRun: () => void;
  /** Pause a running run, and save it (§6, §11). */
  pauseRun: () => void;
  /**
   * Start (ready), Pause (running) or Resume (paused) — the cross's middle
   * button and the Space key (§13). Nothing else starts the snake but a
   * direction on a ready board (§5), and nothing else resumes it at all.
   */
  togglePause: () => void;
  /** A direction pressed, by any input (§5). */
  steer: (direction: Direction) => void;
  /**
   * "Retry same board" (RestartDialog and the result card): the same seed
   * and speed from the opening, ready (§6). The run it replaces is booked
   * and its slot removed in the same step.
   */
  retryRun: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SnakeContext = createContext<SnakeContextValue | null>(null);

export interface SnakeProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  /** The suspended run restored from `sn.saveGame` (always paused), or null. */
  initialSession: SnakeSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/** The clock and the entropy are read here, never in game/ (§8). */
const freshSeed = (): string => snakeSeed(newSeedToken(Date.now(), Math.random));

/** A monotonic clock: a device's wall clock can jump, and a jump is not play time. */
const now = (): number => performance.now();

export function SnakeProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: SnakeProviderProps) {
  /**
   * The suspended run this launch opens straight onto, or null for the home
   * (issue #113). Only a home-screen shortcut asks, and only once Quick Rules
   * are behind the player. There is one slot (§11), and the loader hands back
   * null for anything not worth coming back to, so "the run they were
   * playing" is never a guess: either it is there or it is not. Decided once,
   * from what the provider was mounted with.
   */
  const [resumed] = useState<SnakeSession | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted ? initialSession : null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumed ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<SnakeSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /**
   * The running seconds the run this mount holds already carries. One slot,
   * so it is the same run whichever door the launch came through — which is
   * why this is not gated on the resume: a launch that stops on the home
   * still reaches `syncActiveGame` on a background, and from a zero baseline
   * that would save `elapsedSeconds: 0` over the suspended run (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** Seconds the run had run before `runningSinceRef`. Fractional; floored when written. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Whole seconds of this run already booked into the statistics. The same
   * baseline: a suspended run arrives with its seconds already booked by the
   * sync that saved it, and seeding the clock alone would book them twice.
   */
  const bookedRef = useRef(mountedSeconds);
  /** When the run last started moving (`performance.now()`), or null while it is not moving. */
  const runningSinceRef = useRef<number | null>(null);
  /** Whether this run's record has been booked; it happens exactly once (§10). */
  const finalizedRef = useRef(false);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a run can be booked and the next one started
    // inside one tap, and the second write reads this ref — a stale read
    // would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistPrefs = useCallback((next: Prefs) => {
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: SnakeSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task —
    // a key and a tick landing together — would otherwise start from the
    // session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** The running seconds so far, the moving stretch included. */
  const readClock = useCallback((): number => {
    const since = runningSinceRef.current;
    return elapsedRef.current + (since === null ? 0 : Math.max(0, now() - since) / 1000);
  }, []);

  const stopClock = useCallback(() => {
    const since = runningSinceRef.current;
    if (since === null) return;
    elapsedRef.current += Math.max(0, now() - since) / 1000;
    runningSinceRef.current = null;
  }, []);

  /** The session with the clock's whole seconds written into it (§10, §11). */
  const withElapsed = useCallback(
    (run: SnakeSession): SnakeSession => {
      const seconds = Math.floor(readClock());
      return run.elapsedSeconds === seconds ? run : { ...run, elapsedSeconds: seconds };
    },
    [readClock],
  );

  /** Books the seconds of this run not yet in the statistics. */
  const bookTime = useCallback((run: SnakeSession, base: Stats): Stats => {
    const unbooked = Math.max(0, run.elapsedSeconds - bookedRef.current);
    bookedRef.current = Math.max(bookedRef.current, run.elapsedSeconds);
    return applyPlayTime(base, run.speed, unbooked);
  }, []);

  /**
   * Books a run that ended on the board (§4): its seconds, its score against
   * the best, a clear if it was one — then removes the slot, since a finished
   * run is not something to come back to (§11), and raises the result.
   */
  const finishRun = useCallback(
    (ended: SnakeSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const run = withElapsed(ended);
      if (run !== ended) putSession(run);
      // Read before the record moves: what this run is measured against.
      const previous = previousBestScore(statsRef.current, run.speed);
      const outcome = applyRunEnd(
        bookTime(run, statsRef.current),
        run.speed,
        run.score,
        run.status === 'cleared',
      );
      persistStats(outcome.stats);
      void clearSavedGame();
      if (run.status === 'cleared' || run.score >= REVIEW_MIN_SCORE) recordGameCompleted();
      setLastResult({
        outcome: run.status === 'cleared' ? 'cleared' : 'over',
        crash: run.crash,
        score: run.score,
        length: run.body.length,
        speed: run.speed,
        bestScore: outcome.bestScore,
        previousBestScore: previous,
        isNewBestScore: outcome.isNewBestScore,
      });
    },
    [bookTime, persistStats, putSession, withElapsed],
  );

  /**
   * Every change of the run on the board, with the side effects that belong
   * to the transition rather than to whoever caused it (§6, §10).
   */
  const commit = useCallback(
    (next: SnakeSession) => {
      const previous = sessionRef.current;
      if (next === previous) return;
      const wasRunning = previous?.status === 'running';
      const isRunning = next.status === 'running';
      if (!wasRunning && isRunning) runningSinceRef.current = now();
      if (wasRunning && !isRunning) stopClock();
      // Counted once, when the board first moves: opening a board that is
      // never started costs no play, and a restored run is not counted again.
      if (previous?.status === 'ready' && isRunning) {
        persistStats(applyRunStart(statsRef.current, next.speed));
      }
      putSession(next);
      if (isFinished(next)) finishRun(next);
    },
    [finishRun, persistStats, putSession, stopClock],
  );

  /**
   * Stops a moving run, writes the run to its slot and books its seconds —
   * the one seam every Pause, background and exit passes through, so none of
   * them can forget to save (§6, §11). A board never started has nothing to
   * save; a finished run was already booked and removed.
   */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || !isSuspendable(current)) return;
    commit(pause(current));
    const synced = withElapsed(sessionRef.current ?? current);
    putSession(synced);
    void saveGame(synced);
    const booked = bookTime(synced, statsRef.current);
    if (booked !== statsRef.current) persistStats(booked);
  }, [bookTime, commit, persistStats, putSession, withElapsed]);

  /**
   * Throws away a run that started and has not ended: its score still counts
   * towards the best and its seconds are booked, and its slot is removed at
   * the same moment — the next board is ready and not saved, so a slot left
   * behind would bring the thrown-away run back later (§6, §10, §11).
   */
  const discardSuspended = useCallback(() => {
    const current = sessionRef.current;
    if (!current || !isSuspendable(current) || finalizedRef.current) return;
    finalizedRef.current = true;
    stopClock();
    const run = withElapsed(current);
    const outcome = applyRunEnd(bookTime(run, statsRef.current), run.speed, run.score, false);
    persistStats(outcome.stats);
    void clearSavedGame();
  }, [bookTime, persistStats, stopClock, withElapsed]);

  /** Puts a fresh ready board on the game screen, its clock at zero. */
  const begin = useCallback(
    (next: SnakeSession) => {
      finalizedRef.current = false;
      elapsedRef.current = 0;
      bookedRef.current = 0;
      runningSinceRef.current = null;
      setLastResult(null);
      putSession(next);
      setScreen('game');
    },
    [putSession],
  );

  const startNewRun = useCallback(() => {
    discardSuspended();
    begin(createSession(freshSeed(), prefsRef.current.speed));
  }, [begin, discardSuspended]);

  const retryRun = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    discardSuspended();
    begin(createSession(current.seed, current.speed));
  }, [begin, discardSuspended]);

  const resumeRun = useCallback(() => {
    const current = sessionRef.current;
    if (!current || !isSuspendable(current)) return;
    // The clock already belongs to this run: the one this mount was given
    // seeded it (`mountedSeconds`), and a run paused on the way home in this
    // mount left it holding its seconds to the fraction. Re-seeding it from
    // the run's floored `elapsedSeconds` would drop that fraction on every
    // Home → Resume (§10).
    setLastResult(null);
    setScreen('game');
  }, []);

  /** Start (ready) or Resume (paused). */
  const play = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    if (current.status === 'ready') commit(start(current));
    else if (current.status === 'paused') commit(resume(current));
  }, [commit]);

  const pauseRun = useCallback(() => {
    if (sessionRef.current?.status === 'running') syncActiveGame();
  }, [syncActiveGame]);

  const togglePause = useCallback(() => {
    if (sessionRef.current?.status === 'running') pauseRun();
    else play();
  }, [pauseRun, play]);

  const steer = useCallback(
    (direction: Direction) => {
      const current = sessionRef.current;
      if (!current) return;
      commit(turn(current, direction));
    },
    [commit],
  );

  const setSpeed = useCallback(
    (speed: Speed) => {
      if (prefsRef.current.speed !== speed) persistPrefs({ ...prefsRef.current, speed });
    },
    [persistPrefs],
  );

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

  // The tick: one chained timer, alive only while the game screen shows a
  // running run (§13). Each landing moves the snake one cell through the
  // pure `tick`, then sets the next one — so the interval is the speed's and
  // there is never more than one pending. A landing re-reads the ref and does
  // nothing unless the run is still running: a timer that lands after a
  // pause, a background or the end moves nothing (§6).
  const running = screen === 'game' && session?.status === 'running';
  const tickMs = TICK_MS[session?.speed ?? prefs.speed];
  useEffect(() => {
    if (!running) return undefined;
    let id = 0;
    const step = () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'running') return;
      const { session: next, event } = tick(current);
      // Three sounds and no more (§13): eating, crashing, a full board. A
      // turn is silent.
      if (event === 'eat') sounds.select();
      else if (event === 'wall' || event === 'self') sounds.gameOver();
      else if (event === 'clear') sounds.clear();
      commit(next);
      if (next.status === 'running') id = window.setTimeout(step, tickMs);
    };
    id = window.setTimeout(step, tickMs);
    return () => window.clearTimeout(id);
  }, [running, tickMs, commit]);

  // Background (§6, §11): a moving run stops and is saved, a stopped one is
  // saved as it stands. The OS can kill a backgrounded app without another
  // event, so what this writes is all the next launch gets back. Coming back
  // does nothing at all — the run waits, paused, for the player.
  //
  // The window losing focus while it stays visible (a PC player switching to
  // another window beside this one, a tap on an ad's frame) is not a
  // background, but nobody is steering any more either: a moving run stops
  // and is saved the same way. Only a moving one — a stopped run has nothing
  // to lose to a blur, and a blur is not worth a write. Nothing here ever
  // starts the snake again; focus coming back is as silent as the return
  // from background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    const onBlur = () => {
      if (sessionRef.current?.status === 'running') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange, so the seconds since the last sync would be lost. The
  // same sync runs then, and it books only what `bookedRef` has not — after
  // either exit, or a background, it adds nothing. Like every sync it stops a
  // moving run first, so the slot holds the paused run it becomes (§11). It
  // replaced an unmount-only save of Snake's own (2026-10-18): a second path
  // that books is how a second count gets in.
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection. Registered once, on native only, and the
  // handle goes with the effect (docs/ARCHITECTURE.md「ハードウェア戻るボタン」).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142):
        // otherwise this game opens on the tutorial on every launch.
        if (screen === 'tutorial') completeTutorial();
        goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome, completeTutorial]);

  const value = useMemo<SnakeContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      speed: prefs.speed,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session !== null && isSuspendable(session),
      lastResult,
      setSpeed,
      startNewRun,
      resumeRun,
      pauseRun,
      togglePause,
      steer,
      retryRun,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      prefs.speed,
      flags.tutorialCompleted,
      lastResult,
      setSpeed,
      startNewRun,
      resumeRun,
      pauseRun,
      togglePause,
      steer,
      retryRun,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SnakeContext.Provider value={value}>{children}</SnakeContext.Provider>;
}

export function useSnake(): SnakeContextValue {
  const value = useContext(SnakeContext);
  if (!value) throw new Error('useSnake must be used inside SnakeProvider');
  return value;
}
