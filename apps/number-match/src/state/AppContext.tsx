/**
 * App context: screens, the active game session, statistics, persistence
 * hooks, and the touchpoints where ads/analytics may fire. Every network-ish
 * side effect is fire-and-forget; gameplay never waits for any of it.
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
  createSession,
  dailySeed,
  findHint,
  localDateString,
  matchPair,
  performAddNumbers,
  randomSeed,
  tickSeconds,
  undo,
  type GameSession,
} from '../game';
import { track } from '../services/analytics';
import { addPlaySecond, registerCompletedGame } from '../services/ads/adState';
import { maybeShowInterstitial, prepareInterstitialIfNeeded } from '../services/ads/adsController';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { clearAllLocalData, saveRecord } from '../storage/repo';
import { flagsSchema, settingsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { useSettings } from './SettingsContext';
import { applyGameEnd, applyGameStart, effectiveDailyStreak } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'settings' | 'stats';

export interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: GameSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  hasResumableGame: boolean;
  dailyDoneToday: boolean;
  dailyStreakToday: number;
  startClassic: () => void;
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
  initialSession: GameSession | null;
  children: ReactNode;
}

export function AppProvider({
  initialStats,
  initialFlags,
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

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
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
      persistStats(applyGameEnd(stats, next));
      registerCompletedGame();
      if (next.status === 'cleared') {
        track(next.mode === 'daily' ? 'daily_challenge_completed' : 'game_completed', {
          seconds: next.elapsedSeconds,
          moves: next.moveCount,
        });
        void maybeShowInterstitial('gameCleared');
      } else {
        track('game_over', { seconds: next.elapsedSeconds, moves: next.moveCount });
        void maybeShowInterstitial('gameOver');
      }
    },
    [persistStats, stats],
  );

  const beginSession = useCallback(
    (next: GameSession) => {
      persistStats(applyGameStart(stats, next.mode));
      setSession(next);
      void saveGame(next);
      setScreen('game');
      track(next.mode === 'daily' ? 'daily_challenge_started' : 'game_started');
      void prepareInterstitialIfNeeded();
    },
    [persistStats, stats],
  );

  const startClassic = useCallback(() => {
    void maybeShowInterstitial('newGame');
    beginSession(createSession('classic', randomSeed()));
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
    beginSession(createSession('daily', dailySeed(today), today));
  }, [beginSession]);

  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    void maybeShowInterstitial('newGame');
    beginSession(createSession(current.mode, current.seed, current.dailyDate));
  }, [beginSession]);

  const resumeGame = useCallback(() => {
    if (!sessionRef.current) return;
    setScreen('game');
    track('game_resumed');
  }, []);

  const applyPair = useCallback(
    (i: number, j: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = matchPair(current, i, j);
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(current);
    if (!next) return false;
    track('undo_used');
    commitSession(next);
    return true;
  }, [commitSession]);

  const applyAdd = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = performAddNumbers(current);
    if (!next) return false;
    track('add_numbers_used');
    commitSession(next);
    return true;
  }, [commitSession]);

  const takeHint = useCallback((): readonly [number, number] | null => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return null;
    const pair = findHint(current.board);
    track('hint_used', { found: pair !== null });
    if (!pair) return null;
    setSession(countHintUse(current));
    return pair;
  }, []);

  const goHome = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') void saveGame(current);
    setScreen('home');
  }, []);

  const completeTutorial = useCallback(() => {
    setFlags((current) => {
      if (current.tutorialCompleted) return current;
      const next = { ...current, tutorialCompleted: true };
      void saveRecord(flagsSchema, next);
      track('tutorial_completed');
      return next;
    });
  }, []);

  const resetAllData = useCallback(async () => {
    await clearAllLocalData();
    setSession(null);
    setStats(statsSchema.defaultValue());
    setFlags(flagsSchema.defaultValue());
    replaceSettings(settingsSchema.defaultValue());
    setScreen('tutorial');
  }, [replaceSettings]);

  // Play clock: one second at a time while the game screen is visible.
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      setSession((current) => (current ? tickSeconds(current, 1) : current));
      addPlaySecond();
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (spec §15.1).
  useEffect(() => {
    const saveNow = () => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') void saveGame(current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let remove: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('pause', saveNow).then((handle) => {
        remove = () => void handle.remove();
      });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      remove?.();
    };
  }, []);

  // Android hardware back button: leave sub-screens, minimize from home.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | null = null;
    void CapacitorApp.addListener('backButton', () => {
      const current = sessionRef.current;
      if (screen === 'home') {
        void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
      } else {
        if (current && current.status === 'playing') void saveGame(current);
        setScreen('home');
      }
    }).then((handle) => {
      remove = () => void handle.remove();
    });
    return () => remove?.();
  }, [screen]);

  const today = localDateString(new Date());
  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      hasResumableGame: session !== null && session.status === 'playing',
      dailyDoneToday: stats.daily.lastCompletedDate === today,
      dailyStreakToday: effectiveDailyStreak(stats, today),
      startClassic,
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
      flags.tutorialCompleted,
      today,
      startClassic,
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
