/**
 * Water Sort's app context: screens, the active session, statistics,
 * progress, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Three games are suspended independently — one level, one daily, one free
 * board (§10) — so switching modes never costs the player any of them.
 *
 * The Hint runs the solver on the main thread; benched worst cases are a few
 * milliseconds (§5), and it only ever runs on an explicit tap — no polling,
 * no background work (battery).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever
 * it leaves this module (saves, finalization, navigation).
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
  createDailySession,
  createFreeSession,
  createLevelSession,
  findWinningPour,
  localDateString,
  MAX_LEVEL,
  pour as applyPourToSession,
  recordHint,
  restartSession,
  undo,
  type FreeTier,
  type GameMode,
  type Pour,
  type WaterSession,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
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
  readonly isNewBestMoves: boolean;
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
  /** The board's records before this run, or null on its first clear (§9). */
  readonly previousBestMoves: number | null;
  readonly previousBestSeconds: number | null;
  readonly moves: number;
  readonly seconds: number;
  readonly hints: number;
}

export interface WaterContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: WaterSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  /** A fresh free board at the picker's tier — or the one given (§6). */
  startFree: (tier?: FreeTier) => void;
  /** Where the Free Play picker stands; remembered across launches. */
  freeTier: FreeTier;
  setFreeTier: (tier: FreeTier) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Pours one tube into another. False when the pour was not legal (§3). */
  tryPour: (from: number, to: number) => boolean;
  applyUndo: () => boolean;
  /**
   * Asks the solver for a proven next move (§8). Null means none was found —
   * the caller words that honestly, covering dead ends and capped searches.
   */
  requestHint: () => Pour | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const WaterContext = createContext<WaterContextValue | null>(null);

export interface WaterProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialPrefs: Prefs;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function WaterProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialPrefs,
  initialSessions,
  onExit,
  children,
}: WaterProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('level');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [freeTier, setFreeTierState] = useState<FreeTier>(initialPrefs.freeTier);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const freeTierRef = useRef(freeTier);
  freeTierRef.current = freeTier;

  const session = sessions[activeMode];

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: WaterSession): WaterSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: WaterSession | null) => {
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: WaterSession) => {
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
      persistStats(applySolved(applyPlayTime(statsRef.current, unbooked)));
      recordGameCompleted();
      // Read before the records move: what this run is measured against.
      // A free board has none (statsLogic), and its card says so by silence.
      const previous = previousBestFor(progressRef.current, next);
      const outcome = applySolveToProgress(progressRef.current, next);
      persistProgress(outcome.progress);
      setLastResult({
        isNewBestMoves: outcome.isNewBestMoves,
        isNewBestTime: outcome.isNewBestTime,
        bestMoves: outcome.bestMoves,
        bestSeconds: outcome.bestSeconds,
        previousBestMoves: previous.moves,
        previousBestSeconds: previous.seconds,
        moves: next.moveCount,
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
      });
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: WaterSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: WaterSession) => {
      persistStats(applyGameStart(statsRef.current));
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
    (tier: FreeTier = freeTierRef.current) => {
      beginSession(createFreeSession(tier));
    },
    [beginSession],
  );

  const setFreeTier = useCallback(
    (tier: FreeTier) => {
      setFreeTierState(tier);
      // The picker is the only thing that writes this record.
      void saveRecord(prefsSchema, { ...initialPrefs, freeTier: tier });
    },
    [initialPrefs],
  );

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: WaterSession) => WaterSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const tryPour = useCallback(
    (from: number, to: number) => mutate((s) => applyPourToSession(s, from, to)),
    [mutate],
  );

  const applyUndo = useCallback((): boolean => {
    if (sessionsRef.current[activeModeRef.current]?.status !== 'playing') return false;
    return mutate((s) => undo(s));
  }, [mutate]);

  const requestHint = useCallback((): Pour | null => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing') return null;
    const move = findWinningPour(current.tubes);
    if (move) mutate((s) => recordHint(s));
    return move;
  }, [mutate]);

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
  const value = useMemo<WaterContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.dailyMoves[today] !== undefined,
      lastResult,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      freeTier,
      setFreeTier,
      restartCurrent,
      resumeGame,
      tryPour,
      applyUndo,
      requestHint,
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
      flags.tutorialCompleted,
      today,
      lastResult,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      freeTier,
      setFreeTier,
      restartCurrent,
      resumeGame,
      tryPour,
      applyUndo,
      requestHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <WaterContext.Provider value={value}>{children}</WaterContext.Provider>;
}

export function useWaterSort(): WaterContextValue {
  const value = useContext(WaterContext);
  if (!value) throw new Error('useWaterSort must be used inside WaterProvider');
  return value;
}
