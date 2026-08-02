/**
 * Sky Fighter's app context: screens, the level being attempted, statistics,
 * progress, and persistence. Pure local state — no analytics; the only ad
 * surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * There is no suspended-game record: a real-time sky cannot be restored
 * honestly, so leaving a level abandons the attempt and the retry is free
 * (docs/SKY_FIGHTER_RULES.md §10). The simulation itself lives in the game
 * screen's animation loop; this context only hears about attempts starting
 * and ending, and about play seconds to book (§9).
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
import { LEVEL_COUNT } from '../game/levels';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import {
  applyAttemptStart,
  applyCleared,
  applyClearToProgress,
  applyPlayTime,
  applyRunScore,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'game' | 'stats';

export type RunOutcome = 'cleared' | 'failed';

export interface LastResult {
  readonly outcome: RunOutcome;
  readonly level: number;
  readonly score: number;
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
}

export interface Attempt {
  readonly level: number;
  /** Changes on every retry so the board remounts fresh. */
  readonly nonce: number;
}

export interface SkyContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  attempt: Attempt | null;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  retryLevel: () => void;
  /** The board reports a finished run exactly once (§2). */
  reportRunEnd: (outcome: RunOutcome, score: number) => void;
  /** The board books play seconds that just became final (§9). */
  bookPlaySeconds: (seconds: number) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SkyContext = createContext<SkyContextValue | null>(null);

export interface SkyProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function SkyProvider({
  initialStats,
  initialFlags,
  initialProgress,
  onExit,
  children,
}: SkyProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  /** Begins an attempt at a level: counts it and mounts a fresh board. */
  const beginAttempt = useCallback(
    (level: number) => {
      const clamped = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      persistStats(applyAttemptStart(statsRef.current));
      setLastResult(null);
      setAttempt((current) => ({ level: clamped, nonce: (current?.nonce ?? 0) + 1 }));
      setScreen('game');
    },
    [persistStats],
  );

  const startLevel = useCallback((level: number) => beginAttempt(level), [beginAttempt]);

  const startNextLevel = useCallback(() => {
    const current = attemptRef.current;
    beginAttempt(Math.min(LEVEL_COUNT, (current?.level ?? 0) + 1));
  }, [beginAttempt]);

  const retryLevel = useCallback(() => {
    const current = attemptRef.current;
    if (current) beginAttempt(current.level);
  }, [beginAttempt]);

  const bookPlaySeconds = useCallback(
    (seconds: number) => {
      if (seconds > 0) persistStats(applyPlayTime(statsRef.current, seconds));
    },
    [persistStats],
  );

  const reportRunEnd = useCallback(
    (outcome: RunOutcome, score: number) => {
      const current = attemptRef.current;
      if (!current) return;
      // The score stands whether or not the last wave fell (§9).
      const scored = applyRunScore(statsRef.current, score);
      let next = scored.stats;
      if (outcome === 'cleared') {
        next = applyCleared(next);
        persistProgress(applyClearToProgress(progressRef.current, current.level));
        recordGameCompleted();
      }
      persistStats(next);
      setLastResult({
        outcome,
        level: current.level,
        score,
        isNewBestScore: scored.isNewBestScore,
        bestScore: scored.bestScore,
      });
    },
    [persistProgress, persistStats],
  );

  const goHome = useCallback(() => {
    setAttempt(null);
    setLastResult(null);
    setScreen('home');
  }, []);

  const exitToCollection = useCallback(() => {
    setAttempt(null);
    onExit();
  }, [onExit]);

  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome]);

  const value = useMemo<SkyContextValue>(
    () => ({
      screen,
      navigate,
      attempt,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      startLevel,
      startNextLevel,
      retryLevel,
      reportRunEnd,
      bookPlaySeconds,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      attempt,
      stats,
      progress,
      flags.tutorialCompleted,
      lastResult,
      startLevel,
      startNextLevel,
      retryLevel,
      reportRunEnd,
      bookPlaySeconds,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SkyContext.Provider value={value}>{children}</SkyContext.Provider>;
}

export function useSkyFighter(): SkyContextValue {
  const value = useContext(SkyContext);
  if (!value) throw new Error('useSkyFighter must be used inside SkyProvider');
  return value;
}
