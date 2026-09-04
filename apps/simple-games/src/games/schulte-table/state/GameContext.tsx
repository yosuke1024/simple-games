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
  type Size,
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
  applyCleared,
  applyClearToProgress,
  applyGameStart,
  applyMisses,
  applyPlayTime,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
  /** The record before this round, or null on the first clear (§10). */
  readonly previousBestSeconds: number | null;
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
  /**
   * Wrong taps already booked for this round.
   *
   * The round is never persisted (§11), so a wrong tap survives the OS killing
   * a backgrounded app only if it was booked before the kill — the same reason
   * the seconds are booked there. That forces both to be deltas: a checkpoint
   * that booked the whole `missCount` would count the earlier taps again every
   * time the player came back.
   */
  const bookedMissesRef = useRef(0);

  /** Books the wrong taps of a round that have not been counted yet. */
  const bookMisses = useCallback((stats: Stats, size: Size, misses: number): Stats => {
    const unbooked = Math.max(0, misses - bookedMissesRef.current);
    bookedMissesRef.current = misses;
    return applyMisses(stats, size, unbooked);
  }, []);

  const withElapsed = useCallback((s: SchulteSession): SchulteSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state, for the reason putSession's does below: a run
    // can be booked and the next one started inside one tap, and the second
    // write reads this ref — a stale read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    // The ref leads the state, for the same reason persistStats' does.
    progressRef.current = next;
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
      const timed = applyPlayTime(statsRef.current, next.size, unbooked);
      persistStats(applyCleared(bookMisses(timed, next.size, next.missCount), next));

      // A level short enough to finish in seconds is not worth a review ask.
      if (next.mode === 'daily' || (next.level ?? 0) >= REVIEW_FROM_LEVEL) {
        recordGameCompleted();
      }

      // Read before the record moves: what this round is measured against.
      const previousBestSeconds = previousBestFor(progressRef.current, next);
      const outcome = applyClearToProgress(progressRef.current, next);
      persistProgress(outcome.progress);
      setLastResult({
        isNewBest: outcome.isNewBest,
        bestSeconds: outcome.bestSeconds,
        previousBestSeconds,
        seconds: next.elapsedSeconds,
        misses: next.missCount,
      });
    },
    [bookMisses, persistProgress, persistStats],
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
      return bookMisses(applyPlayTime(stats, synced.size, unbooked), synced.size, synced.missCount);
    },
    [bookMisses, withElapsed],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: SchulteSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  const beginSession = useCallback(
    (next: SchulteSession) => {
      // Whatever was on screen is being thrown away right now — Retry is the
      // path that reaches here mid-round — so book its seconds and its wrong
      // taps before the new round replaces it. A finished round has already
      // been booked by `finish`, and `bookAbandoned` leaves it alone.
      persistStats(applyGameStart(bookAbandoned(statsRef.current), next.size));
      setLastResult(null);
      putSession(next);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      bookedMissesRef.current = 0;
      setScreen('game');
    },
    [bookAbandoned, persistStats, putSession],
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
      putSession(outcome.session);
      if (outcome.session.status === 'cleared') finish(outcome.session);
      return outcome.hit;
    },
    [finish, putSession, withElapsed],
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
    putSession(null);
    setScreen('home');
  }, [abandonActiveRound, putSession]);

  const exitToCollection = useCallback(() => {
    abandonActiveRound();
    putSession(null);
    onExit();
  }, [abandonActiveRound, onExit, putSession]);

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

  // Backgrounding books what has happened so far but does NOT end the round:
  // the player may be answering a message and coming straight back, and the
  // board is still on screen. Booking is what stops the OS killing a
  // backgrounded app from taking the seconds — and the wrong taps — with it.
  // Nothing here is the end of the round, so both are booked as deltas and the
  // player coming back to finish adds only what happened after.
  useEffect(() => {
    const bookNow = () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      const unbookedSeconds = Math.max(0, elapsedRef.current - bookedRef.current);
      const unbookedMisses = Math.max(0, current.missCount - bookedMissesRef.current);
      if (unbookedSeconds <= 0 && unbookedMisses <= 0) return;
      bookedRef.current = elapsedRef.current;
      const timed = applyPlayTime(statsRef.current, current.size, unbookedSeconds);
      persistStats(bookMisses(timed, current.size, current.missCount));
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
  }, [bookMisses, persistStats]);

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
