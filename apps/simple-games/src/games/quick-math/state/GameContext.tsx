/**
 * Quick Math's app context: screens, the active set, statistics, progress and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surface is the shared BannerSlot the game screen renders.
 *
 * Two sets are suspended independently — one level, one daily (§9) — so
 * switching modes never costs the player either one. This is the drill that
 * saves: arithmetic survives being put down, where held attention and
 * short-term memory do not (the reason the other two drills save nothing).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a set is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever it
 * leaves this module (saves, finalization, navigation).
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
  answerQuestion,
  createDailySession,
  createLevelSession,
  localDateString,
  MAX_LEVEL,
  restartSession,
  type GameMode,
  type QuickMathSession,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
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
  applyDiscardedMisses,
  applyGameStart,
  applyPlayTime,
  bucketFor,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
  /** The record before this set, or null on the first clear (§10). */
  readonly previousBestSeconds: number | null;
  readonly seconds: number;
  readonly misses: number;
}

/**
 * Levels short enough to finish in under a minute are not a "game completed"
 * worth asking for a store review over (docs/REVIEW_PROMPT_POLICY.md). Ten
 * one-digit sums are that; the ask starts once the questions do.
 */
export const REVIEW_FROM_LEVEL = 11;

export interface QuickMathContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: QuickMathSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a new set begins — the keypad clears on it. */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Submits an answer. Returns true when it was right. */
  submitAnswer: (value: number) => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const QuickMathContext = createContext<QuickMathContextValue | null>(null);

export interface QuickMathProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function QuickMathProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSessions,
  onExit,
  children,
}: QuickMathProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('level');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const session = sessions[activeMode];

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this set. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: QuickMathSession): QuickMathSession => {
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

  const putSession = useCallback((mode: GameMode, next: QuickMathSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: QuickMathSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Cleared: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const bucket = bucketFor(next);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      persistStats(applyCleared(applyPlayTime(statsRef.current, bucket, unbooked), next));

      if (next.mode === 'daily' || (next.level ?? 0) >= REVIEW_FROM_LEVEL) {
        recordGameCompleted();
      }

      // Read before the record moves: what this set is measured against.
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
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's set on screen and hands the clock over to it. */
  const activate = useCallback((next: QuickMathSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /**
   * Books what a set in `mode`'s slot leaves behind, because it is about to be
   * replaced, and returns the updated statistics rather than persisting them.
   *
   * Returning instead of saving is what makes it safe to chain: `statsRef`
   * only catches up on the next render, so two `persistStats` calls in one
   * tick would both read the pre-change record and the first would be lost.
   *
   * Play time is booked only for the set on screen. A suspended set had its
   * seconds booked when the player left it (`syncActiveGame`), and a set
   * restored from disk arrives with its time already counted, so booking again
   * here would double it.
   */
  const bookDiscarded = useCallback(
    (stats: Stats, mode: GameMode): Stats => {
      const current = sessionsRef.current[mode];
      if (!current || current.status !== 'playing') return stats;
      const onScreen = mode === activeModeRef.current;
      const synced = onScreen ? withElapsed(current) : current;
      const bucket = bucketFor(synced);

      let next = stats;
      if (onScreen) {
        const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
        bookedRef.current = synced.elapsedSeconds;
        next = applyPlayTime(next, bucket, unbooked);
      }
      return applyDiscardedMisses(next, bucket, synced.missCount);
    },
    [withElapsed],
  );

  const beginSession = useCallback(
    (next: QuickMathSession) => {
      // Every path that throws a set away comes through here — Retry, and
      // picking a different level or day while one is suspended — so the
      // discard is booked in one place rather than at each call site. A
      // finished set was already booked by `commitSession`, and
      // `bookDiscarded` leaves it alone.
      persistStats(applyGameStart(bookDiscarded(statsRef.current, next.mode), bucketFor(next)));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, bookDiscarded, persistStats, putSession],
  );

  const canResume = useCallback(
    (mode: GameMode) => sessionsRef.current[mode]?.status === 'playing',
    [],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current) activate(current);
    },
    [activate],
  );

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      const current = sessionsRef.current.level;
      if (current && current.level === target && current.status === 'playing') {
        resumeGame('level');
        return;
      }
      beginSession(createLevelSession(target));
    },
    [beginSession, resumeGame],
  );

  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current.level;
    const next = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(next, progressRef.current.highestUnlocked)));
  }, [beginSession]);

  const startDaily = useCallback(
    (date?: string) => {
      const target = date ?? localDateString(new Date());
      const current = sessionsRef.current.daily;
      if (current && current.dailyDate === target && current.status === 'playing') {
        resumeGame('daily');
        return;
      }
      beginSession(createDailySession(target));
    },
    [beginSession, resumeGame],
  );

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  const submitAnswer = useCallback(
    (value: number): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const outcome = answerQuestion(withElapsed(current), value);
      if (!outcome) return false;
      commitSession(outcome.session);
      return outcome.correct;
    },
    [commitSession, withElapsed],
  );

  /** Saves the on-screen set and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return;
    const synced = withElapsed(current);
    putSession(mode, synced);
    void saveGame(synced);
    const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
    if (unbooked > 0) {
      bookedRef.current = synced.elapsedSeconds;
      persistStats(applyPlayTime(statsRef.current, bucketFor(synced), unbooked));
    }
  }, [persistStats, putSession, withElapsed]);

  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

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

  // Save when the app goes to background (§9). This is the same sync as
  // leaving the screen, statistics included: the OS can kill a backgrounded app
  // without sending another event, and the next launch hands the restored
  // elapsedSeconds back as *already booked*. Saving the set alone here would
  // drop every play second since the last sync for good.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame]);

  const today = localDateString(new Date());
  const value = useMemo<QuickMathContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.dailySeconds[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      resumeGame,
      submitAnswer,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      restartCurrent,
      resumeGame,
      submitAnswer,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <QuickMathContext.Provider value={value}>{children}</QuickMathContext.Provider>;
}

export function useQuickMath(): QuickMathContextValue {
  const value = useContext(QuickMathContext);
  if (!value) throw new Error('useQuickMath must be used inside QuickMathProvider');
  return value;
}
