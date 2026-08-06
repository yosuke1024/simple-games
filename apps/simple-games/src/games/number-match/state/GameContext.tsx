/**
 * Number Match's app context: screens, the active game session, statistics,
 * level progress, and persistence hooks. Pure local state — there is no
 * analytics and no ad orchestration here; the only ad surface is the shared
 * BannerSlot the game screen renders.
 *
 * Two games are suspended independently — one level, one daily (docs §14) —
 * so switching modes never costs the player either one.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (docs §15); elapsed time is merged into the session
 * whenever it leaves this module (saves, finalization, navigation).
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
  createLevelSession,
  findHint,
  localDateString,
  matchPair,
  MAX_LEVEL,
  performAddNumbers,
  restartSession,
  undo,
  type GameMode,
  type GameSession,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { applyClearToProgress } from './progressLogic';
import { applyGameEnd, applyGameStart } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  isNewBest: boolean;
  bestScore: number;
}

export interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The game currently on screen. */
  session: GameSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  /** Set when the current session cleared; used by the result overlay. */
  lastResult: LastResult | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  /** Whether that mode has a game worth resuming. */
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  applyPair: (i: number, j: number) => boolean;
  applyUndo: () => boolean;
  applyAdd: () => boolean;
  takeHint: () => readonly [number, number] | null;
  goHome: () => void;
  /** Leaves Number Match for the collection home (game state is saved). */
  exitToCollection: () => void;
  completeTutorial: () => void;
  /** Which one-time explanations are still owed to the player (§16). */
  flags: Flags;
  /** Records that a one-time explanation has been shown. */
  markIntroSeen: (flag: 'wildIntroSeen' | 'stoneIntroSeen') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function AppProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSessions,
  onExit,
  children,
}: AppProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('level');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

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

  const session = sessions[activeMode];

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);

  /** Session with the live clock merged in — used whenever it leaves React. */
  const withElapsed = useCallback((s: GameSession): GameSession => {
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

  const putSession = useCallback((mode: GameMode, next: GameSession | null) => {
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: GameSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Terminal: finalize once, at the natural break.
      void clearSavedGame(next.mode);
      persistStats(applyGameEnd(statsRef.current, next));
      if (next.status === 'cleared') {
        recordGameCompleted();
        const outcome = applyClearToProgress(progressRef.current, next, Date.now());
        persistProgress(outcome.progress);
        setLastResult({ isNewBest: outcome.isNewBest, bestScore: outcome.bestScore });
      }
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: GameSession) => {
    elapsedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: GameSession) => {
      persistStats(applyGameStart(statsRef.current, next.mode));
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
      if (!current) return;
      activate(current);
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

  /** From the clear overlay. */
  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current.level;
    const nextLevel = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(nextLevel, progressRef.current.highestUnlocked)));
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

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to whichever game is on screen. */
  const mutate = useCallback(
    (apply: (s: GameSession) => GameSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const applyPair = useCallback(
    (i: number, j: number) => mutate((s) => matchPair(s, i, j)),
    [mutate],
  );

  const applyUndo = useCallback((): boolean => {
    // Terminal games were already finalized (stats/progress); undoing past
    // that point would double-count. The UI disables Undo then too.
    if (sessionsRef.current[activeModeRef.current]?.status !== 'playing') return false;
    return mutate((s) => undo(s));
  }, [mutate]);

  const applyAdd = useCallback((): boolean => {
    return mutate((s) => performAddNumbers(s));
  }, [mutate]);

  const takeHint = useCallback((): readonly [number, number] | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const pair = findHint(current.board);
    if (!pair) return null;
    const next = countHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return pair;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game (if any) so leaving never costs progress. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
    }
  }, [putSession, withElapsed]);

  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const completeTutorial = useCallback(() => {
    // Side effects stay outside the setState updater (StrictMode calls
    // updaters twice in dev).
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  const markIntroSeen = useCallback((flag: 'wildIntroSeen' | 'stoneIntroSeen') => {
    if (flagsRef.current[flag]) return;
    const next = { ...flagsRef.current, [flag]: true };
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

  // Save when the app goes to background / gets hidden (spec §15.1).
  useEffect(() => {
    const saveNow = () => {
      const current = sessionsRef.current[activeModeRef.current];
      if (current && current.status === 'playing') void saveGame(withElapsed(current));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Keep the listener-handle promise so cleanup works even when it runs
    // before the plugin call resolves (no leaked listeners).
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', saveNow)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [withElapsed]);

  // Android hardware back button: leave sub-screens; from the game's home,
  // hand control back to the collection (the shell decides what "back" means
  // from there).
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
  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.bestDaily[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      resumeGame,
      applyPair,
      applyUndo,
      applyAdd,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
      flags,
      markIntroSeen,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      flags,
      markIntroSeen,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      resumeGame,
      applyPair,
      applyUndo,
      applyAdd,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
