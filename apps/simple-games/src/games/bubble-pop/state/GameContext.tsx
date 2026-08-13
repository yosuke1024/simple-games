/**
 * Bubble Pop's app context: screens, the level being attempted, statistics,
 * progress, and persistence. Pure local state — no analytics; the only ad
 * surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * Like Brick Breaker there is no suspended-run record (docs/plans/
 * 2026-08-08-mahjong-bubble-ludo.md §Bubble Pop: "途中保存なし") — an attempt
 * is 1-3 minutes and the retry is free, so leaving mid-run simply abandons
 * it. The board simulation itself lives in the game screen's canvas/rAF
 * component; this context only hears about attempts starting and ending, and
 * about play seconds to book.
 *
 * Play time is booked incrementally (the bookedRef pattern the other titles
 * use): the board reports whole seconds as they become final — on background,
 * on leaving the screen, and at the end of a run — so an app the OS kills
 * still has its minutes counted.
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
import { applyAttemptStart, applyCleared, applyClearToProgress, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'game' | 'stats';

export type RunOutcome = 'cleared' | 'failed';

export interface LastResult {
  readonly outcome: RunOutcome;
  readonly level: number;
  readonly seconds: number;
}

export interface Attempt {
  readonly level: number;
  /** Changes on every retry so the board remounts fresh. */
  readonly nonce: number;
}

export interface BubbleContextValue {
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
  /** The board reports a finished run exactly once. */
  reportRunEnd: (outcome: RunOutcome, seconds: number) => void;
  /** The board books play seconds that just became final. */
  bookPlaySeconds: (seconds: number) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const BubbleContext = createContext<BubbleContextValue | null>(null);

export interface BubbleProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function BubbleProvider({
  initialStats,
  initialFlags,
  initialProgress,
  onExit,
  children,
}: BubbleProviderProps) {
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

  // The refs are advanced here, not only on the next render: a run ends by
  // booking its last seconds and reporting the outcome in the same tick (the
  // board's settle handler), and both reads start from the ref. Waiting for
  // React to re-render would hand the second write pre-flush stats, and its
  // save would quietly undo the first one — the minutes just played.
  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  /** Begins an attempt at a level: counts it and mounts a fresh board. */
  const beginAttempt = useCallback(
    (level: number) => {
      // highestUnlocked can be LEVEL_COUNT+1 once the last level is cleared
      // (the value that means "cleared", not merely "unlocked" — see
      // statsLogic.ts), so the game-start ceiling is capped separately at
      // LEVEL_COUNT, the highest level that actually exists.
      const clamped = Math.min(
        Math.max(1, Math.floor(level)),
        Math.min(LEVEL_COUNT, progressRef.current.highestUnlocked),
      );
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
    (outcome: RunOutcome, seconds: number) => {
      const current = attemptRef.current;
      if (!current) return;
      if (outcome === 'cleared') {
        persistStats(applyCleared(statsRef.current));
        persistProgress(applyClearToProgress(progressRef.current, current.level));
        recordGameCompleted();
      }
      setLastResult({ outcome, level: current.level, seconds });
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

  const value = useMemo<BubbleContextValue>(
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

  return <BubbleContext.Provider value={value}>{children}</BubbleContext.Provider>;
}

export function useBubblePop(): BubbleContextValue {
  const value = useContext(BubbleContext);
  if (!value) throw new Error('useBubblePop must be used inside BubbleProvider');
  return value;
}
