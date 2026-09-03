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
  previousBestScore,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'game' | 'stats';

export type RunOutcome = 'cleared' | 'failed';

export interface LastResult {
  readonly outcome: RunOutcome;
  /** The stage the run was flying when it ended (§2). */
  readonly stage: number;
  readonly score: number;
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
  /** The record before this run, or null while there was none (§9). */
  readonly previousBestScore: number | null;
}

export interface Attempt {
  /** The stage the run starts at; the run flies on from here (§2). */
  readonly level: number;
  /** Changes on every retry so the board remounts fresh. */
  readonly nonce: number;
  /**
   * Rolled fresh per attempt: the waves are the board seed's promise, but
   * this is what makes each run's drops and offers its own (§5). Never
   * persisted — a run lives and dies inside its attempt (§10).
   */
  readonly runSeed: string;
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
  retryLevel: () => void;
  /** The board reports each stage the run finishes, as it happens (§7). */
  reportStageCleared: (stage: number) => void;
  /** The board reports a finished run exactly once (§2). */
  reportRunEnd: (outcome: RunOutcome, score: number, stage: number) => void;
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

  // The refs are advanced here, not only on the next render: a run ends by
  // booking its last seconds and reporting the outcome in the same tick
  // (SkyBoard's `settle`), and both reads start from the ref. Waiting for
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

  /** Begins a run from a stage: counts it and mounts a fresh board (§2). */
  const beginAttempt = useCallback(
    (level: number) => {
      const clamped = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      persistStats(applyAttemptStart(statsRef.current));
      setLastResult(null);
      setAttempt((current) => ({
        level: clamped,
        nonce: (current?.nonce ?? 0) + 1,
        // Not derived from the board seed: this is exactly the part of a run
        // that must differ between runs (§5).
        runSeed: `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`,
      }));
      setScreen('game');
    },
    [persistStats],
  );

  const startLevel = useCallback((level: number) => beginAttempt(level), [beginAttempt]);

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

  /**
   * A stage the run finished, reported as it happens (§7): the frontier and
   * the cleared count move mid-run, so a run that later fails still keeps
   * every stage it actually won.
   */
  const reportStageCleared = useCallback(
    (stage: number) => {
      persistProgress(applyClearToProgress(progressRef.current, stage));
      persistStats(applyCleared(statsRef.current));
      recordGameCompleted();
    },
    [persistProgress, persistStats],
  );

  const reportRunEnd = useCallback(
    (outcome: RunOutcome, score: number, stage: number) => {
      const current = attemptRef.current;
      if (!current) return;
      // The score stands whether or not the last stage fell (§9). Stage
      // clears were already booked one by one through reportStageCleared.
      // The record is read before it moves: what this run is measured against.
      const previous = previousBestScore(statsRef.current);
      const scored = applyRunScore(statsRef.current, score);
      persistStats(scored.stats);
      setLastResult({
        outcome,
        stage,
        score,
        isNewBestScore: scored.isNewBestScore,
        bestScore: scored.bestScore,
        previousBestScore: previous,
      });
    },
    [persistStats],
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
      retryLevel,
      reportStageCleared,
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
      retryLevel,
      reportStageCleared,
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
