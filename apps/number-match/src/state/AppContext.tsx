/**
 * App context: screens, the active game session, statistics, level progress,
 * persistence hooks, and the touchpoints where ads/analytics may fire.
 * Every network-ish side effect is fire-and-forget; gameplay never waits.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state — nothing re-renders per second (the timer display is an isolated
 * component polling the ref). Elapsed time is merged into the session
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
  type GameSession,
} from '../game';
import { track } from '../services/analytics';
import { addPlaySecond, registerCompletedGame, resetAdState } from '../services/ads/adState';
import { maybeShowInterstitial, prepareInterstitialIfNeeded } from '../services/ads/adsController';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
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

export type Screen = 'home' | 'tutorial' | 'levels' | 'game' | 'settings' | 'stats';

export interface LastResult {
  isNewBest: boolean;
  bestScore: number;
}

export interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: GameSession | null;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  hasResumableGame: boolean;
  dailyDoneToday: boolean;
  dailyStreakToday: number;
  /** Set when the current session cleared; used by the result overlay. */
  lastResult: LastResult | null;
  /** Changes whenever a new game begins (timer display reset key). */
  sessionEpoch: number;
  /** Battery-friendly play clock access (no per-second re-renders). */
  readElapsedSeconds: () => number;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: () => void;
  restartCurrent: () => void;
  resumeGame: () => void;
  applyPair: (i: number, j: number) => boolean;
  applyUndo: () => boolean;
  applyAdd: () => boolean;
  takeHint: () => readonly [number, number] | null;
  goHome: () => void;
  completeTutorial: () => void;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSession: GameSession | null;
  children: ReactNode;
}

export function AppProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSession,
  children,
}: AppProviderProps) {
  const { replaceSettings } = useSettings();
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<GameSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  /** Increments per begun game — lets the timer display reset immediately. */
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(initialSession?.elapsedSeconds ?? 0);
  const readElapsedSeconds = useCallback(() => elapsedRef.current, []);

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

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: GameSession) => {
      setSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Terminal: finalize once, at the natural break.
      void clearSavedGame();
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
    [persistProgress, persistStats],
  );

  const beginSession = useCallback(
    (next: GameSession) => {
      persistStats(applyGameStart(statsRef.current, next.mode));
      elapsedRef.current = next.elapsedSeconds;
      setLastResult(null);
      setSessionEpoch((epoch) => epoch + 1);
      setSession(next);
      void saveGame(next);
      setScreen('game');
      track(next.mode === 'daily' ? 'daily_challenge_started' : 'game_started', {
        level: next.level ?? 0,
      });
      void prepareInterstitialIfNeeded();
    },
    [persistStats],
  );

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      const current = sessionRef.current;
      if (
        current &&
        current.mode === 'level' &&
        current.level === target &&
        current.status === 'playing'
      ) {
        setScreen('game');
        track('game_resumed');
        return;
      }
      void maybeShowInterstitial('newGame');
      beginSession(createLevelSession(target));
    },
    [beginSession],
  );

  /** From the clear overlay — the clear itself was the ad break. */
  const startNextLevel = useCallback(() => {
    const current = sessionRef.current;
    const nextLevel = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(nextLevel, progressRef.current.highestUnlocked)));
  }, [beginSession]);

  const startDaily = useCallback(() => {
    const today = localDateString(new Date());
    const current = sessionRef.current;
    if (
      current &&
      current.mode === 'daily' &&
      current.dailyDate === today &&
      current.status === 'playing'
    ) {
      setScreen('game');
      track('game_resumed');
      return;
    }
    beginSession(createDailySession(today));
  }, [beginSession]);

  // No interstitial here: a restart can be triggered mid-game, which is not
  // one of the allowed natural-break points (docs/ADS_POLICY.md).
  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    beginSession(restartSession(current));
  }, [beginSession]);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    // Monotonic within a run: never rewind the clock to a stale snapshot.
    elapsedRef.current = Math.max(elapsedRef.current, current.elapsedSeconds);
    setScreen('game');
    track('game_resumed');
  }, []);

  const applyPair = useCallback(
    (i: number, j: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = matchPair(withElapsed(current), i, j);
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    // Terminal games were already finalized (stats/progress/ads); undoing
    // past that point would double-count. The UI disables Undo then too.
    if (!current || current.status !== 'playing') return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    track('undo_used');
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  const applyAdd = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = performAddNumbers(withElapsed(current));
    if (!next) return false;
    track('add_numbers_used');
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  const takeHint = useCallback((): readonly [number, number] | null => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return null;
    const pair = findHint(current.board);
    track('hint_used', { found: pair !== null });
    if (!pair) return null;
    const next = countHintUse(withElapsed(current));
    setSession(next);
    void saveGame(next);
    return pair;
  }, [withElapsed]);

  const goHome = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      setSession(synced);
      void saveGame(synced);
    }
    setScreen('home');
  }, [withElapsed]);

  const completeTutorial = useCallback(() => {
    // Side effects stay outside the setState updater (StrictMode calls
    // updaters twice in dev).
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
    track('tutorial_completed');
  }, []);

  const resetAllData = useCallback(async () => {
    await clearAllLocalData();
    resetAdState();
    elapsedRef.current = 0;
    setSession(null);
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
      const current = sessionRef.current;
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
      const current = sessionRef.current;
      if (screen === 'home') {
        void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
      } else {
        if (current && current.status === 'playing') {
          // Mirror goHome: keep React state in sync so a later Resume does
          // not rewind the play clock to a stale value.
          const synced = withElapsed(current);
          setSession(synced);
          void saveGame(synced);
        }
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, withElapsed]);

  const today = localDateString(new Date());
  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      hasResumableGame: session !== null && session.status === 'playing',
      dailyDoneToday: stats.daily.lastCompletedDate === today,
      dailyStreakToday: effectiveDailyStreak(stats, today),
      lastResult,
      sessionEpoch,
      readElapsedSeconds,
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
    }),
    [
      screen,
      navigate,
      session,
      stats,
      progress,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      readElapsedSeconds,
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
