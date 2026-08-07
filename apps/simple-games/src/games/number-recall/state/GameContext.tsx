/**
 * Number Recall's app context: screens, the round on screen, statistics and
 * progress. Pure local state — no analytics, no ad orchestration; the only ad
 * surface is the shared BannerSlot the game screen renders.
 *
 * There is exactly one round at a time and it is never persisted (§12). A
 * round holds short-term memory of a layout, and that does not survive the app
 * being closed — so leaving books what happened (play time) and drops the
 * rest, and the way back in is always a fresh look at a fresh layout.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a round is running. It is never shown
 * during play either (§5); elapsed time is merged into the session whenever it
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
  retrySession,
  tapCell,
  type RecallSession,
} from '../game';
import {
  flagsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { applyCleared, applyClearToProgress, applyGameStart, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
  readonly seconds: number;
  /** True when the level was done at the first attempt (§5). */
  readonly firstTry: boolean;
}

/**
 * Levels short enough to finish in seconds are not a "game completed" worth
 * asking for a store review over (docs/REVIEW_PROMPT_POLICY.md). The three-tile
 * band runs to level 5, so the ask starts once the boards do.
 */
export const REVIEW_FROM_LEVEL = 11;

export interface RecallContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: RecallSession | null;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  /** Same difficulty, new layout — never the layout just revealed (§8). */
  retryRound: () => void;
  /** Taps a cell. Returns true when the tap was part of the question. */
  tap: (index: number) => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const RecallContext = createContext<RecallContextValue | null>(null);

export interface RecallProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function RecallProvider({
  initialStats,
  initialFlags,
  initialProgress,
  onExit,
  children,
}: RecallProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<RecallSession | null>(null);
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

  const withElapsed = useCallback((s: RecallSession): RecallSession => {
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

  /** Books the play seconds of `session` that have not been counted yet. */
  const bookPlayTime = useCallback((current: RecallSession, base: Stats): Stats => {
    const unbooked = Math.max(0, current.elapsedSeconds - bookedRef.current);
    bookedRef.current = current.elapsedSeconds;
    return applyPlayTime(base, current.size, unbooked);
  }, []);

  /**
   * Finalizes a finished round exactly once, at the natural break. Both endings
   * come through here: a failed round was still played, and its seconds are
   * still play seconds (§11).
   */
  const finish = useCallback(
    (next: RecallSession) => {
      const timed = bookPlayTime(next, statsRef.current);
      if (next.status !== 'cleared') {
        persistStats(timed);
        return;
      }

      persistStats(applyCleared(timed, next));

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
        firstTry: next.attempt === 0,
      });
    },
    [bookPlayTime, persistProgress, persistStats],
  );

  const beginSession = useCallback(
    (next: RecallSession) => {
      persistStats(applyGameStart(statsRef.current, next.size));
      setLastResult(null);
      setSession(next);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      setScreen('game');
    },
    [persistStats],
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

  const retryRound = useCallback(() => {
    const current = sessionRef.current;
    if (current) beginSession(retrySession(current));
  }, [beginSession]);

  const tap = useCallback(
    (index: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = tapCell(withElapsed(current), index);
      if (!next) return false;
      setSession(next);
      if (next.status !== 'playing') finish(next);
      return true;
    },
    [finish, withElapsed],
  );

  /**
   * Books what an unfinished round leaves behind, then forgets it (§12).
   *
   * The seconds were played whether or not the player carried on; the round
   * itself is not counted as finished, because it was not. `played` was
   * already counted when it started.
   */
  const abandonActiveRound = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    persistStats(bookPlayTime(withElapsed(current), statsRef.current));
  }, [bookPlayTime, persistStats, withElapsed]);

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

  // Play clock: one second at a time while the game screen is visible. It runs
  // through the memorise phase too — looking at the tiles is part of the round
  // and part of the time (§3). Mutates the ref only, so nothing re-renders.
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
  // player may be answering a message and coming straight back. Booking is what
  // stops the OS killing a backgrounded app from taking the seconds with it.
  useEffect(() => {
    const bookNow = () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      if (elapsedRef.current <= bookedRef.current) return;
      persistStats(bookPlayTime(withElapsed(current), statsRef.current));
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
  }, [bookPlayTime, persistStats, withElapsed]);

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
  const value = useMemo<RecallContextValue>(
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
      retryRound,
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
      retryRound,
      tap,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <RecallContext.Provider value={value}>{children}</RecallContext.Provider>;
}

export function useRecall(): RecallContextValue {
  const value = useContext(RecallContext);
  if (!value) throw new Error('useRecall must be used inside RecallProvider');
  return value;
}
