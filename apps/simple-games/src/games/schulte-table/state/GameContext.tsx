/**
 * Schulte Table's app context: screens, the round on screen, statistics and
 * progress. Pure local state — no analytics, no ad orchestration; the only ad
 * surface is the shared BannerSlot the game screen renders.
 *
 * There is exactly one round at a time and it is never persisted (§11), which
 * is the whole difference from the puzzle titles: they hold a suspended game
 * per mode, this holds a round that ends when you leave it. A round is tens of
 * seconds of held attention, and attention cannot be suspended and restored —
 * so leaving books what happened (play time, wrong taps) and drops the rest.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a round is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever it
 * leaves this module (finalization, navigation).
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
  createLevelSession,
  localDateString,
  MAX_LEVEL,
  restartSession,
  tapCell,
  type SchulteSession,
} from '../game';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import {
  applyAbandonedMisses,
  applyCleared,
  applyClearToProgress,
  applyGameStart,
  applyPlayTime,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
  readonly seconds: number;
  readonly misses: number;
}

/**
 * Levels short enough to finish in seconds are not a "game completed" worth
 * asking for a store review over (docs/REVIEW_PROMPT_POLICY.md). The 3x3 band
 * ends at 15, so the ask starts once the boards do.
 */
export const REVIEW_FROM_LEVEL = 11;

export interface SchulteContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: SchulteSession | null;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  /** Taps a cell. Returns true only when it was the number being waited for. */
  tap: (index: number) => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SchulteContext = createContext<SchulteContextValue | null>(null);

export interface SchulteProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function SchulteProvider({
  initialStats,
  initialFlags,
  initialProgress,
  onExit,
  children,
}: SchulteProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<SchulteSession | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this round. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: SchulteSession): SchulteSession => {
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

  /** Finalizes a finished round exactly once, at the natural break. */
  const finish = useCallback(
    (next: SchulteSession) => {
      // Only the seconds not yet booked are added, so leaving and coming back
      // cannot count the same time twice.
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      persistStats(applyCleared(applyPlayTime(statsRef.current, next.size, unbooked), next));

      // A level short enough to finish in seconds is not worth a review ask.
      if (next.mode === 'daily' || (next.level ?? 0) >= REVIEW_FROM_LEVEL) {
        recordGameCompleted();
      }

      const outcome = applyClearToProgress(progressRef.current, next);
      persistProgress(outcome.progress);
      setLastResult({
        isNewBest: outcome.isNewBest,
        bestSeconds: outcome.bestSeconds,
        seconds: next.elapsedSeconds,
        misses: next.missCount,
      });
    },
    [persistProgress, persistStats],
  );

  /**
   * Books what an unfinished round leaves behind, and returns the updated
   * statistics rather than persisting them.
   *
   * Returning instead of saving is what makes it safe to chain: `statsRef`
   * only catches up on the next render, so two `persistStats` calls in one
   * tick would both read the pre-change record and the first would be lost.
   */
  const bookAbandoned = useCallback(
    (stats: Stats): Stats => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return stats;
      const synced = withElapsed(current);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      bookedRef.current = synced.elapsedSeconds;
      return applyAbandonedMisses(
        applyPlayTime(stats, synced.size, unbooked),
        synced.size,
        synced.missCount,
      );
    },
    [withElapsed],
  );

  const beginSession = useCallback(
    (next: SchulteSession) => {
      // Whatever was on screen is being thrown away right now — Retry is the
      // path that reaches here mid-round — so book its seconds and its wrong
      // taps before the new round replaces it. A finished round has already
      // been booked by `finish`, and `bookAbandoned` leaves it alone.
      persistStats(applyGameStart(bookAbandoned(statsRef.current), next.size));
      setLastResult(null);
      setSession(next);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      setScreen('game');
    },
    [bookAbandoned, persistStats],
  );

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      beginSession(createLevelSession(target));
    },
    [beginSession],
  );

  const startNextLevel = useCallback(() => {
    const next = Math.min(MAX_LEVEL, (sessionRef.current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(next, progressRef.current.highestUnlocked)));
  }, [beginSession]);

  const startDaily = useCallback(
    (date?: string) => beginSession(createDailySession(date ?? localDateString(new Date()))),
    [beginSession],
  );

  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  const tap = useCallback(
    (index: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = tapCell(withElapsed(current), index);
      if (!outcome) return false;
      setSession(outcome.session);
      if (outcome.session.status === 'cleared') finish(outcome.session);
      return outcome.hit;
    },
    [finish, withElapsed],
  );

  /**
   * Books what an unfinished round leaves behind, then forgets it (§11).
   *
   * Play seconds and wrong taps happened whether or not the player carried on,
   * so both are counted; the round itself is not, because it was never
   * finished. `played` was already counted when it started.
   */
  const abandonActiveRound = useCallback(() => {
    persistStats(bookAbandoned(statsRef.current));
  }, [bookAbandoned, persistStats]);

  const goHome = useCallback(() => {
    abandonActiveRound();
    setSession(null);
    setScreen('home');
  }, [abandonActiveRound]);

  const exitToCollection = useCallback(() => {
    abandonActiveRound();
    setSession(null);
    onExit();
  }, [abandonActiveRound, onExit]);

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

  // Backgrounding books the play time so far but does NOT end the round: the
  // player may be answering a message and coming straight back, and the board
  // is still on screen. Booking is what stops the OS killing a backgrounded app
  // from taking the seconds with it.
  useEffect(() => {
    const bookNow = () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      const unbooked = Math.max(0, elapsedRef.current - bookedRef.current);
      if (unbooked <= 0) return;
      bookedRef.current = elapsedRef.current;
      persistStats(applyPlayTime(statsRef.current, current.size, unbooked));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') bookNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', bookNow)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [persistStats]);

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

  const today = localDateString(new Date());
  const value = useMemo<SchulteContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.dailySeconds[today] !== undefined,
      lastResult,
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      tap,
      goHome,
      exitToCollection,
      completeTutorial,
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
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      tap,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SchulteContext.Provider value={value}>{children}</SchulteContext.Provider>;
}

export function useSchulte(): SchulteContextValue {
  const value = useContext(SchulteContext);
  if (!value) throw new Error('useSchulte must be used inside SchulteProvider');
  return value;
}
