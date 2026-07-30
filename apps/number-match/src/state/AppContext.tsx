/**
 * App context: screens, the active game session, statistics, level progress,
 * persistence hooks, and the touchpoints where ads/analytics may fire.
 * Every network-ish side effect is fire-and-forget; gameplay never waits.
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
import { track } from '../services/analytics';
import { addPlaySecond, registerCompletedGame, resetAdState } from '../services/ads/adState';
import { maybeShowInterstitial, prepareInterstitialIfNeeded } from '../services/ads/adsController';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
import { clearAllLocalData, saveRecord } from '../storage/repo';
import {
  flagsSchema,
  progressSchema,
  settingsSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { useSettings } from './SettingsContext';
import { applyClearToProgress } from './progressLogic';
import { applyGameEnd, applyGameStart, effectiveDailyStreak } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'settings' | 'stats';

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
  dailyStreakToday: number;
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
  completeTutorial: () => void;
  /** Which one-time explanations are still owed to the player (§16). */
  flags: Flags;
  /** Records that a one-time explanation has been shown. */
  markIntroSeen: (flag: 'wildIntroSeen' | 'stoneIntroSeen') => void;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSessions: SavedGames;
  children: ReactNode;
}

export function AppProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSessions,
  children,
}: AppProviderProps) {
  const { replaceSettings } = useSettings();
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
      registerCompletedGame();
      if (next.status === 'cleared') {
        const outcome = applyClearToProgress(progressRef.current, next, Date.now());
        persistProgress(outcome.progress);
        setLastResult({ isNewBest: outcome.isNewBest, bestScore: outcome.bestScore });
        track(next.mode === 'daily' ? 'daily_challenge_completed' : 'game_completed', {
          level: next.level ?? 0,
          seconds: next.elapsedSeconds,
          moves: next.moveCount,
          score: next.score.total,
        });
        void maybeShowInterstitial('gameCleared');
      } else {
        track('game_over', {
          level: next.level ?? 0,
          seconds: next.elapsedSeconds,
          moves: next.moveCount,
        });
        void maybeShowInterstitial('gameOver');
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
      track(next.mode === 'daily' ? 'daily_challenge_started' : 'game_started', {
        level: next.level ?? 0,
      });
      void prepareInterstitialIfNeeded();
    },
    [activate, persistStats, putSession],
  );

  const canResume = useCallback(
    (mode: GameMode) => sessionsRef.current[mode]?.status === 'playing',
    [],
  );

  const resumeGame = useCallback((mode: GameMode) => {
    const current = sessionsRef.current[mode];
    if (!current) return;
    activate(current);
    track('game_resumed');
  }, [activate]);

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      const current = sessionsRef.current.level;
      if (current && current.level === target && current.status === 'playing') {
        resumeGame('level');
        return;
      }
      void maybeShowInterstitial('newGame');
      beginSession(createLevelSession(target));
    },
    [beginSession, resumeGame],
  );

  /** From the clear overlay — the clear itself was the ad break. */
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

  // No interstitial here: a restart can be triggered mid-game, which is not
  // one of the allowed natural-break points (docs/ADS_POLICY.md).
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
    // Terminal games were already finalized (stats/progress/ads); undoing
    // past that point would double-count. The UI disables Undo then too.
    if (sessionsRef.current[activeModeRef.current]?.status !== 'playing') return false;
    const undone = mutate((s) => undo(s));
    if (undone) track('undo_used');
    return undone;
  }, [mutate]);

  const applyAdd = useCallback((): boolean => {
    const added = mutate((s) => performAddNumbers(s));
    if (added) track('add_numbers_used');
    return added;
  }, [mutate]);

  const takeHint = useCallback((): readonly [number, number] | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const pair = findHint(current.board);
    track('hint_used', { found: pair !== null });
    if (!pair) return null;
    const next = countHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return pair;
  }, [putSession, withElapsed]);

  const goHome = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
    }
    setScreen('home');
  }, [putSession, withElapsed]);

  const completeTutorial = useCallback(() => {
    // Side effects stay outside the setState updater (StrictMode calls
    // updaters twice in dev).
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
    track('tutorial_completed');
  }, []);

  const markIntroSeen = useCallback((flag: 'wildIntroSeen' | 'stoneIntroSeen') => {
    if (flagsRef.current[flag]) return;
    const next = { ...flagsRef.current, [flag]: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  const resetAllData = useCallback(async () => {
    await clearAllLocalData();
    resetAdState();
    elapsedRef.current = 0;
    setSessions({ level: null, daily: null });
    setActiveMode('level');
    setLastResult(null);
    setStats(statsSchema.defaultValue());
    setFlags(flagsSchema.defaultValue());
    setProgress(progressSchema.defaultValue());
    replaceSettings(settingsSchema.defaultValue());
    setScreen('tutorial');
  }, [replaceSettings]);

  // Play clock: one second at a time while the game screen is visible.
  // Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
      addPlaySecond();
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

  // Android hardware back button: leave sub-screens, minimize from home.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      const mode = activeModeRef.current;
      const current = sessionsRef.current[mode];
      if (screen === 'home') {
        void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
      } else {
        if (current && current.status === 'playing') {
          // Mirror goHome: keep React state in sync so a later Resume does
          // not rewind the play clock to a stale value.
          const synced = withElapsed(current);
          putSession(mode, synced);
          void saveGame(synced);
        }
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, putSession, withElapsed]);

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
      dailyStreakToday: effectiveDailyStreak(stats, today),
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
      completeTutorial,
      flags,
      markIntroSeen,
      resetAllData,
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
      completeTutorial,
      resetAllData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
