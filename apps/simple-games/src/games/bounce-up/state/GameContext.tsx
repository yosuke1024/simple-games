/**
 * Bounce Up's app context: the screens, the run on the board, the
 * statistics, the width choice, persistence and the play clock
 * (docs/BOUNCE_UP_RULES.md §4, §5).
 *
 * The run's world — the body, the platforms, the held input — lives in the
 * board component's refs (ui/components/BounceStage.tsx), because it changes
 * 120 times a second and nothing outside the canvas draws it. What lives here
 * is the run's STATUS (`ready` → `running` ⇄ `paused` → `over`), because
 * everything that is not the board decides on it: the board's loop runs only
 * while it is `running`, a background or a blur or hardware Back pauses it,
 * the result card raises on `over`.
 *
 * - Every status change goes through `commit`, where the side effects of a
 *   transition live once: the run counted at ready → running, the clock
 *   started on entering `running` and stopped on leaving it.
 * - The play clock and the height are the provider's (§5 — Overtake's
 *   shape): when the run last started moving (`runningSinceRef`), what it had
 *   run before that (`elapsedRef`), the whole seconds already booked
 *   (`bookedRef`), the run's score as the board last reported it
 *   (`scoreRef`) and the points of it already in the total
 *   (`bookedScoreRef`). The board never counts seconds or books points.
 *   `syncActiveGame` is the one booking path: the end of a run, the ↻, ←
 *   home, a background, a blur, ❚❚ and the unmount all go through it, and the
 *   two booked marks keep it to once (§5「計上は 1 本」).
 * - A run left before it ends still counts its height (§5): leaving books it
 *   first. There is no saved run: leaving the screen ends it. Nothing but the
 *   three records survives a relaunch, and there is no `entry` prop — a
 *   home-screen shortcut opens on this game's home
 *   (src/test/shortcutResumeWiring.test.ts).
 * - Coming back from a background or a blur never resumes: only the player
 *   does (§4).
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
import { sounds } from '../../../services/sound';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import type { PlatformWidth, RunStatus } from '../game/types';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { applyBooking, applyRunStart } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** The run on the board, as everything outside the canvas sees it. */
export interface RunSession {
  /** A fresh one on every run (§3「決定性」): the tower is the seed's. */
  readonly seed: string;
  /** Fixed when the run is built; ↻ keeps it (§4「幅」). */
  readonly width: PlatformWidth;
  /** Changes on every new run, so the board remounts fresh. */
  readonly nonce: number;
  readonly status: RunStatus;
  /** This width's best when the run was built: where the line is drawn (§4). */
  readonly bestAtStart: number;
}

/** What the result card shows (§7「結果」): facts only. */
export interface LastResult {
  readonly width: PlatformWidth;
  readonly score: number;
  /** This width's best after the run. */
  readonly best: number;
  /** This width's best before the run, or null when there was none (BestDelta). */
  readonly previousBest: number | null;
}

export interface BounceUpContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The run on the game screen, or null off it. */
  session: RunSession | null;
  stats: Stats;
  /** The width the next run from the home is built with (§4「幅」). */
  width: PlatformWidth;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Normal or Wide, on the home only. Takes effect from the next run. */
  setWidth: (width: PlatformWidth) => void;
  /** A fresh `ready` run at the home's width. */
  startRun: () => void;
  /** ↻ and the card's retry: a fresh seed at this run's width, no question asked (§4). */
  retryRun: () => void;
  /** Start (`ready`) or resume (`paused`) — a press on the board, a key, Space, ▶. */
  play: () => void;
  /** ❚❚, P / Esc: a running run stops (§4). */
  pauseRun: () => void;
  /** The top bar's one button: ❚❚ while running, ▶ otherwise. */
  togglePause: () => void;
  /** The board reports the run's score whenever it changes (no render here). */
  noteScore: (score: number) => void;
  /** The board reports the step the body fell out of view, once (§2). */
  finishRun: (score: number) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const BounceUpContext = createContext<BounceUpContextValue | null>(null);

export interface BounceUpProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

/** The clock and the entropy are read here, never in game/ (§3「決定性」). */
const now = (): number => Date.now();
const freshSeed = (): string =>
  `bounce-${now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;

export function BounceUpProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  onExit,
  children,
}: BounceUpProviderProps) {
  // Quick Rules first, and only until they have been completed: the
  // tutorial's own last button — or hardware Back, below — sets the flag.
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<RunSession | null>(null);
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

  /** Seconds the run had run before `runningSinceRef`. Fractional; floored when booked. */
  const elapsedRef = useRef(0);
  /** Whole seconds of this run already in the statistics. */
  const bookedRef = useRef(0);
  /** When the run last started moving (`Date.now()`), or null while it is not moving. */
  const runningSinceRef = useRef<number | null>(null);
  /** The run's score as the board last reported it. */
  const scoreRef = useRef(0);
  /** The points of this run already in the total (§5). */
  const bookedScoreRef = useRef(0);
  /** The last run's nonce: every new run gets the next one. */
  const nonceRef = useRef(0);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  // The refs lead the state (docs/ARCHITECTURE.md「状態と ref」): a run can be
  // booked and the next one started inside one tap, and the second write
  // reads the ref — a stale read would undo the first one's booking.
  const persistStats = useCallback((next: Stats) => {
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
  const putSession = useCallback((next: RunSession | null) => {
    // A key and a frame can land in one task; the second must see the first.
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

  /** Every status change, with the side effects that belong to the transition (§4, §5). */
  const commit = useCallback(
    (next: RunSession) => {
      const previous = sessionRef.current;
      const wasRunning = previous?.status === 'running';
      const isRunning = next.status === 'running';
      if (!wasRunning && isRunning) runningSinceRef.current = now();
      if (wasRunning && !isRunning) stopClock();
      // Counted once, when the run first moves: opening a board that is
      // never started costs nothing, and a resume is not a new run (§5).
      if (previous?.status === 'ready' && isRunning) {
        persistStats(applyRunStart(statsRef.current));
      }
      putSession(next);
    },
    [persistStats, putSession, stopClock],
  );

  /**
   * Stops a moving run and books what is not booked yet — the seconds and
   * the height — the one path every end, ↻, exit, background, blur, ❚❚ and
   * the unmount take (§5, docs/GAME_LIFECYCLE.md「計上の経路を増やさない」).
   * Idempotent: a second call books nothing.
   */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    if (current.status === 'running') commit({ ...current, status: 'paused' });
    const whole = Math.floor(readClock());
    const seconds = Math.max(0, whole - bookedRef.current);
    const booked = applyBooking(statsRef.current, {
      width: current.width,
      seconds,
      bookedScore: bookedScoreRef.current,
      score: scoreRef.current,
    });
    bookedRef.current = Math.max(bookedRef.current, whole);
    bookedScoreRef.current = booked.booked;
    if (booked.stats !== statsRef.current) persistStats(booked.stats);
  }, [commit, persistStats, readClock]);

  /** Books the run on the board (if any) and puts a fresh `ready` one there. */
  const begin = useCallback(
    (width: PlatformWidth) => {
      syncActiveGame();
      elapsedRef.current = 0;
      bookedRef.current = 0;
      runningSinceRef.current = null;
      scoreRef.current = 0;
      bookedScoreRef.current = 0;
      nonceRef.current += 1;
      setLastResult(null);
      putSession({
        seed: freshSeed(),
        width,
        nonce: nonceRef.current,
        status: 'ready',
        bestAtStart: statsRef.current.best[width],
      });
      setScreen('game');
    },
    [putSession, syncActiveGame],
  );

  const startRun = useCallback(() => begin(prefsRef.current.width), [begin]);

  const retryRun = useCallback(() => {
    const current = sessionRef.current;
    begin(current ? current.width : prefsRef.current.width);
  }, [begin]);

  const play = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status === 'ready' || current?.status === 'paused') {
      commit({ ...current, status: 'running' });
    }
  }, [commit]);

  const pauseRun = useCallback(() => {
    if (sessionRef.current?.status === 'running') syncActiveGame();
  }, [syncActiveGame]);

  const togglePause = useCallback(() => {
    if (sessionRef.current?.status === 'running') pauseRun();
    else play();
  }, [pauseRun, play]);

  const noteScore = useCallback((score: number) => {
    // A run's score never drops (§4); a late report must not lower it.
    if (Number.isSafeInteger(score) && score > scoreRef.current) scoreRef.current = score;
  }, []);

  const finishRun = useCallback(
    (score: number) => {
      const current = sessionRef.current;
      if (current?.status !== 'running') return;
      noteScore(score);
      commit({ ...current, status: 'over' });
      syncActiveGame();
      const final = scoreRef.current;
      sounds.gameOver();
      setLastResult({
        width: current.width,
        score: final,
        best: statsRef.current.best[current.width],
        previousBest: current.bestAtStart > 0 ? current.bestAtStart : null,
      });
    },
    [commit, noteScore, syncActiveGame],
  );

  /** Leaving the game screen ends the run (§4): booked, then gone. */
  const goHome = useCallback(() => {
    syncActiveGame();
    putSession(null);
    setLastResult(null);
    setScreen('home');
  }, [putSession, syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const setWidth = useCallback(
    (width: PlatformWidth) => {
      if (prefsRef.current.width !== width) persistPrefs({ ...prefsRef.current, width });
    },
    [persistPrefs],
  );

  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Background (§4): a moving run stops and its seconds and height are
  // booked — the OS can kill a backgrounded app without another event. The
  // window losing focus while it stays visible (a PC player moving to another
  // window) stops a moving run the same way: nobody is steering any more.
  // Coming back, or focus returning, does nothing at all.
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
  // the browser's Back takes the whole Root off screen without goHome, so the
  // same sync runs then, and books only what the booked marks have not.
  useOnUnmount(syncActiveGame);

  // Android hardware back (§4「止まるとき」): from the game's home, hand
  // control back to the collection. On a running run the first press only
  // pauses — a sideways drag from the screen edge can be the system's back
  // swipe, and one slip must not cost the run; from anything else, this
  // game's home. Registered once, on native only, and the handle goes with
  // the effect (docs/ARCHITECTURE.md「ハードウェア戻るボタン」).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142).
        if (screen === 'tutorial') completeTutorial();
        if (screen === 'game' && sessionRef.current?.status === 'running') pauseRun();
        else goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome, completeTutorial, pauseRun]);

  const value = useMemo<BounceUpContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      width: prefs.width,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      setWidth,
      startRun,
      retryRun,
      play,
      pauseRun,
      togglePause,
      noteScore,
      finishRun,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      prefs.width,
      flags.tutorialCompleted,
      lastResult,
      setWidth,
      startRun,
      retryRun,
      play,
      pauseRun,
      togglePause,
      noteScore,
      finishRun,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <BounceUpContext.Provider value={value}>{children}</BounceUpContext.Provider>;
}

export function useBounceUp(): BounceUpContextValue {
  const value = useContext(BounceUpContext);
  if (!value) throw new Error('useBounceUp must be used inside BounceUpProvider');
  return value;
}
