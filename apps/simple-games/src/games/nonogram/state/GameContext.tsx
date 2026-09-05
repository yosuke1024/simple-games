/**
 * Nonogram's app context: screens, the active session, statistics, progress,
 * its own preferences, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Three games are suspended independently — one level, one daily, one free
 * board (§6, §10) — so switching modes never costs the player any of them.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§8); elapsed time is merged into the session whenever it
 * leaves this module (saves, finalization, navigation).
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
  countHintUse,
  createDailySession,
  createFreeSession,
  createLevelSession,
  crossCell,
  hintFor,
  localDateString,
  markCells as markSessionCells,
  MAX_LEVEL,
  paintCell,
  restartSession,
  type FreeTier,
  type GameMode,
  type Hint,
  type Mark,
  type NonogramSession,
} from '../game';
import {
  clearSavedGame,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
  sizeKey,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  applySolveToProgress,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly seconds: number;
  readonly hints: number;
  /** True when this solve beat the time the player had before. */
  readonly isNewBestTime: boolean;
  readonly bestSeconds: number;
  /** The record before this run, or null on a first clear (§9). */
  readonly previousBestSeconds: number | null;
}

export interface NonogramContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: NonogramSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  /** A fresh free board at the picker's tier — or the one given (§6). */
  startFree: (tier?: FreeTier | null) => void;
  /** Where the Free Play picker stands; remembered across launches. */
  freeTier: FreeTier;
  setFreeTier: (tier: FreeTier) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Paints a cell. Returns false when the tap changed nothing (§3). */
  paint: (index: number) => boolean;
  /** Crosses a cell. Same contract as paint. */
  cross: (index: number) => boolean;
  /** Sets a stretch of cells to one mark — a drag stroke (§3). */
  markCells: (indices: readonly number[], mark: Mark) => boolean;
  takeHint: () => Hint | null;
  setXMode: (value: boolean) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const NonogramContext = createContext<NonogramContextValue | null>(null);

export interface NonogramProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialProgress: Progress;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function NonogramProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialProgress,
  initialSessions,
  onExit,
  entry,
  children,
}: NonogramProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * save made later can change that — this game rewrites its three slots
   * constantly while a board is on screen (§10).
   *
   * Only a home-screen shortcut asks, and only once Quick Rules are behind
   * the player — a first launch teaches the game before it shows a board
   * (§11), and that order does not have an exception.
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  // Resume, or exactly what this line has always said. `resumeMode` already
  // answers null until Quick Rules are behind the player, so the gate is in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  // The board reads `sessions[activeMode]`, so a resumed daily or free game
  // has to arrive with its own slot selected — 'level' would render nothing.
  const [activeMode, setActiveMode] = useState<GameMode>(resumeMode ?? 'level');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const session = sessions[activeMode];

  // A game resumed at mount arrives with its clock already run, and the two
  // numbers `activate` sets when Resume is pressed on the home screen are the
  // same two. Starting them at zero would rewrite the restored elapsedSeconds
  // down to the seconds since mount on the very first mark — and book every
  // second already played into the statistics a second time (§10 — the
  // restored elapsedSeconds comes back as *already booked*).
  const resumedSeconds = resumeMode ? (initialSessions[resumeMode]?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(resumedSeconds);

  const withElapsed = useCallback((s: NonogramSession): NonogramSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state, for the reason putSession's does below: a run
    // can be booked and the next one started inside one tap, and the second
    // write reads this ref — a stale read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    // The ref leads the state, for the same reason persistStats' does.
    progressRef.current = next;
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: NonogramSession | null) => {
    // The ref leads the state deliberately. React batches updates raised in
    // one task, and a drag stroke (issue #108) can raise two before it
    // re-renders — on a slow device, two pointer moves in one frame. Reading
    // the state's ref then would hand the second move the board the first one
    // had already replaced, and its cells would be lost. The render below
    // assigns the same value again, so the two never disagree.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: NonogramSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      // Read before any record moves: what this run is measured against. A
      // level or a daily has its own board's record; a free board has no
      // board to keep one for, so it stands against its size's fastest
      // clear — the number the statistics screen shows (§6, §9).
      const previousBestSeconds =
        next.mode === 'free'
          ? statsRef.current[sizeKey(next.size)].bestSeconds
          : previousBestFor(progressRef.current, next);
      persistStats(
        applySolved(
          applyPlayTime(statsRef.current, next.size, unbooked),
          next.size,
          next.elapsedSeconds,
        ),
      );
      recordGameCompleted();
      const outcome = applySolveToProgress(progressRef.current, next);
      persistProgress(outcome.progress);
      const freeIsBest = previousBestSeconds === null || next.elapsedSeconds < previousBestSeconds;
      setLastResult({
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
        isNewBestTime: next.mode === 'free' ? freeIsBest : outcome.isNewBestTime,
        bestSeconds:
          next.mode === 'free'
            ? Math.min(next.elapsedSeconds, previousBestSeconds ?? Infinity)
            : outcome.bestSeconds,
        previousBestSeconds,
      });
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: NonogramSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: NonogramSession) => {
      persistStats(applyGameStart(statsRef.current, next.size));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistStats, putSession],
  );

  const canResume = useCallback(
    (mode: GameMode) => sessionsRef.current[mode]?.status === 'playing',
    [],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current) activate(current);
    },
    [activate],
  );

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      const current = sessionsRef.current.level;
      if (current && current.level === target && current.status === 'playing') {
        resumeGame('level');
        return;
      }
      beginSession(createLevelSession(target));
    },
    [beginSession, resumeGame],
  );

  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current.level;
    const next = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(next, progressRef.current.highestUnlocked)));
  }, [beginSession]);

  const startDaily = useCallback(
    (date?: string) => {
      const target = date ?? localDateString(new Date());
      const current = sessionsRef.current.daily;
      if (current && current.dailyDate === target && current.status === 'playing') {
        resumeGame('daily');
        return;
      }
      beginSession(createDailySession(target));
    },
    [beginSession, resumeGame],
  );

  const startFree = useCallback(
    (tier?: FreeTier | null) => {
      beginSession(createFreeSession(tier ?? prefsRef.current.freeTier));
    },
    [beginSession],
  );

  const setFreeTier = useCallback((tier: FreeTier) => {
    const next = { ...prefsRef.current, freeTier: tier };
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: NonogramSession) => NonogramSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const paint = useCallback((index: number) => mutate((s) => paintCell(s, index)), [mutate]);
  const cross = useCallback((index: number) => mutate((s) => crossCell(s, index)), [mutate]);
  const markCells = useCallback(
    (indices: readonly number[], mark: Mark) => mutate((s) => markSessionCells(s, indices, mark)),
    [mutate],
  );

  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const hint = hintFor(current);
    if (!hint) return null;
    const next = countHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return hint;
  }, [putSession, withElapsed]);

  const setXMode = useCallback((value: boolean) => {
    const next = { ...prefsRef.current, xMode: value };
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, synced.size, unbooked));
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

  // Save when the app goes to background / gets hidden (§10). This is the same
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

  const today = localDateString(new Date());
  const value = useMemo<NonogramContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      prefs,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.dailySeconds[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      freeTier: prefs.freeTier,
      setFreeTier,
      restartCurrent,
      resumeGame,
      paint,
      cross,
      markCells,
      takeHint,
      setXMode,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      prefs,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      setFreeTier,
      restartCurrent,
      resumeGame,
      paint,
      cross,
      markCells,
      takeHint,
      setXMode,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <NonogramContext.Provider value={value}>{children}</NonogramContext.Provider>;
}

export function useNonogram(): NonogramContextValue {
  const value = useContext(NonogramContext);
  if (!value) throw new Error('useNonogram must be used inside NonogramProvider');
  return value;
}
