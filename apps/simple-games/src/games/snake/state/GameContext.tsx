/**
 * Snake's app context: screens, the attempt in flight, statistics, and
 * persistence. Pure local state — no analytics; the only ad surfaces are the
 * shared BannerSlot and ResultAdSlot the screens render.
 *
 * There is no suspended-game record and no progress record: a real-time board
 * cannot be restored honestly, so leaving the board abandons the attempt and
 * the retry is free (docs/SNAKE_RULES.md §10), and there is no level ladder to
 * remember (§7). The simulation itself lives in the game screen's animation
 * loop; this context only hears about attempts starting and ending, and about
 * play seconds to book (§9).
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
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyAttemptStart, applyPlayTime, applyRunEnd } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** How a run ended (§2). There is no third ending to add. */
export type RunOutcome = 'over' | 'full';

export interface LastResult {
  readonly outcome: RunOutcome;
  readonly score: number;
  readonly length: number;
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
}

export interface Attempt {
  /** Changes on every new run so the board remounts fresh. */
  readonly nonce: number;
}

export interface SnakeContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  attempt: Attempt | null;
  stats: Stats;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Counts an attempt and mounts a fresh board. */
  beginAttempt: () => void;
  /** The same act as beginAttempt — there is no board to keep (§8, §10). */
  retry: () => void;
  /** The board reports a finished run exactly once (§2). */
  reportRunEnd: (outcome: RunOutcome, score: number, length: number) => void;
  /** The board books play seconds that just became final (§9). */
  bookPlaySeconds: (seconds: number) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SnakeContext = createContext<SnakeContextValue | null>(null);

export interface SnakeProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function SnakeProvider({
  initialStats,
  initialFlags,
  onExit,
  children,
}: SnakeProviderProps) {
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

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  // The ref is advanced here, not only on the next render: a run ends by
  // booking its last seconds and reporting the outcome in the same tick
  // (SnakeBoard's `settle`), and both reads start from the ref. Waiting for
  // React to re-render would hand the second write pre-flush stats, and its
  // save would quietly undo the first one — the minutes just played.
  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const beginAttempt = useCallback(() => {
    persistStats(applyAttemptStart(statsRef.current));
    setLastResult(null);
    setAttempt((current) => ({ nonce: (current?.nonce ?? 0) + 1 }));
    setScreen('game');
  }, [persistStats]);

  const bookPlaySeconds = useCallback(
    (seconds: number) => {
      if (seconds > 0) persistStats(applyPlayTime(statsRef.current, seconds));
    },
    [persistStats],
  );

  const reportRunEnd = useCallback(
    (outcome: RunOutcome, score: number, length: number) => {
      if (!attemptRef.current) return;
      const scored = applyRunEnd(statsRef.current, { score, length });
      persistStats(scored.stats);
      // Snake has no level to clear (§7), so the unit of a finished game is a
      // finished run. The review counter asks how much someone has played,
      // and a run that ended is exactly that.
      recordGameCompleted();
      setLastResult({
        outcome,
        score,
        length,
        isNewBestScore: scored.isNewBestScore,
        bestScore: scored.stats.bestScore,
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

  const value = useMemo<SnakeContextValue>(
    () => ({
      screen,
      navigate,
      attempt,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      beginAttempt,
      retry: beginAttempt,
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
      beginAttempt,
      reportRunEnd,
      bookPlaySeconds,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SnakeContext.Provider value={value}>{children}</SnakeContext.Provider>;
}

export function useSnake(): SnakeContextValue {
  const value = useContext(SnakeContext);
  if (!value) throw new Error('useSnake must be used inside SnakeProvider');
  return value;
}
