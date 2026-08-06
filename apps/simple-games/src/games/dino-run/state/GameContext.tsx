/**
 * Dino Run's app context: screens, the run being attempted, statistics, and
 * persistence. Pure local state — no analytics; the only ad surfaces are the
 * shared BannerSlot and ResultAdSlot the screens render.
 *
 * There is no suspended-run record: a real-time track cannot be restored
 * honestly, so leaving a run ends it and the next one is free
 * (docs/DINO_RUN_RULES.md §10). The simulation itself lives in the board's
 * animation loop; this context only hears about runs starting and ending, and
 * about play seconds to book (§9).
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
import { dinoSeed, newSeedToken } from '../game/seed';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyPlayTime, applyRunEnd, applyRunStart } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/**
 * A run has to be worth this much before it counts towards the review
 * question. Every run here ends in a crash, and one that ended two seconds in
 * is not the "completed game" the counter is meant to measure
 * (docs/REVIEW_PROMPT_POLICY.md) — counting those would ask a player to rate
 * the app after ten seconds of play.
 */
const REVIEW_MIN_SCORE = 100;

export interface LastResult {
  readonly score: number;
  readonly obstaclesPassed: number;
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
}

export interface Attempt {
  /** The track. A new one every run — there are no levels to come back to. */
  readonly seed: string;
  /** Changes on every run so the board remounts fresh. */
  readonly nonce: number;
}

export interface DinoContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  attempt: Attempt | null;
  stats: Stats;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Starts a run on a new track. Retry is the same call, by design (§8). */
  startRun: () => void;
  /** The board reports a finished run exactly once (§2). */
  reportRunEnd: (score: number, obstaclesPassed: number) => void;
  /** The board books play seconds that just became final (§9). */
  bookPlaySeconds: (seconds: number) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const DinoContext = createContext<DinoContextValue | null>(null);

export interface DinoProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function DinoProvider({ initialStats, initialFlags, onExit, children }: DinoProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const endedRef = useRef(false);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  // The ref is advanced here, not only on the next render: a run ends by
  // booking its last seconds and reporting the outcome in the same tick
  // (DinoBoard's `settle`), and both reads start from the ref. Waiting for
  // React to re-render would hand the second write pre-flush stats, and its
  // save would quietly undo the first one — the minutes just played.
  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const startRun = useCallback(() => {
    persistStats(applyRunStart(statsRef.current));
    setLastResult(null);
    endedRef.current = false;
    setAttempt((current) => ({
      seed: dinoSeed(newSeedToken()),
      nonce: (current?.nonce ?? 0) + 1,
    }));
    setScreen('game');
  }, [persistStats]);

  const bookPlaySeconds = useCallback(
    (seconds: number) => {
      if (seconds > 0) persistStats(applyPlayTime(statsRef.current, seconds));
    },
    [persistStats],
  );

  const reportRunEnd = useCallback(
    (score: number, obstaclesPassed: number) => {
      if (!attemptRef.current || endedRef.current) return;
      endedRef.current = true;
      const outcome = applyRunEnd(statsRef.current, score, obstaclesPassed);
      persistStats(outcome.stats);
      if (score >= REVIEW_MIN_SCORE) recordGameCompleted();
      setLastResult({
        score,
        obstaclesPassed,
        isNewBestScore: outcome.isNewBestScore,
        bestScore: outcome.bestScore,
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

  const value = useMemo<DinoContextValue>(
    () => ({
      screen,
      navigate,
      attempt,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      startRun,
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
      flags.tutorialCompleted,
      lastResult,
      startRun,
      reportRunEnd,
      bookPlaySeconds,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <DinoContext.Provider value={value}>{children}</DinoContext.Provider>;
}

export function useDinoRun(): DinoContextValue {
  const value = useContext(DinoContext);
  if (!value) throw new Error('useDinoRun must be used inside DinoProvider');
  return value;
}
