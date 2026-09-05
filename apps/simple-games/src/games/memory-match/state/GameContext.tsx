/**
 * Memory Match's app context: screens, the active session, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surface is the shared BannerSlot the game screen renders.
 *
 * Two games are suspended independently — one difficulty, one daily (§10) —
 * so switching modes never costs the player either one.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever
 * it leaves this module (saves, finalization, navigation).
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
  createDifficultySession,
  localDateString,
  restartSession,
  tapCard,
  type Difficulty,
  type GameMode,
  type MemorySession,
} from '../game';
import {
  clearSavedGame,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applySolved, previousBestsFor } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

/** What a flip did — so the screen can pick a sound without re-deriving it. */
export type FlipOutcome = 'none' | 'flip' | 'match' | 'mismatch' | 'solved';

export interface LastResult {
  readonly isNewBestMoves: boolean;
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
  /** The records before this run, null for each it is the first of (§9). */
  readonly previousBestMoves: number | null;
  readonly previousBestSeconds: number | null;
  readonly moves: number;
  readonly seconds: number;
}

export interface MemoryContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: MemorySession | null;
  sessions: SavedGames;
  stats: Stats;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  canResume: (mode: GameMode) => boolean;
  startDifficulty: (difficulty: Difficulty) => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Flips a card. Returns 'none' when the tap was not a legal move (§3). */
  flipCard: (index: number) => FlipOutcome;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const MemoryContext = createContext<MemoryContextValue | null>(null);

export interface MemoryProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function MemoryProvider({
  initialStats,
  initialFlags,
  initialSessions,
  onExit,
  entry,
  children,
}: MemoryProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * save made later can change that.
   *
   * Only a home-screen shortcut asks, and only once Quick Rules are behind the
   * player — a first launch teaches the game before it shows a board (§11),
   * and that order has no exception. The two records are independent, so a
   * flags record that failed to read would otherwise let an intact save walk
   * straight past the tutorial.
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  // Resume, or exactly what this line has always said. `resumeMode` already
  // answers null until Quick Rules are behind the player, so the gate lives in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  // The mode has to arrive with the screen: `session` below is
  // `sessions[activeMode]`, so opening the board on 'difficulty' while the
  // resumed game is the daily would render nothing at all.
  const [activeMode, setActiveMode] = useState<GameMode>(resumeMode ?? 'difficulty');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const session = sessions[activeMode];

  // A game resumed at mount arrives with its clock already run, and the two
  // numbers `activate` sets when Resume is pressed on the home screen are these
  // same two. Leaving them at zero would not merely lose the count: withElapsed
  // rewrites the live session to elapsedRef, so the first sync would save the
  // board back with only the seconds since mount — the play time gone for good,
  // and a solve stamping a fabricated bestSeconds. Seeding only elapsedRef is
  // the mirror mistake, booking the whole restored elapse a second time (§10 —
  // the restored elapsedSeconds comes back as *already booked*).
  const resumedSeconds = resumeMode ? (initialSessions[resumeMode]?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(resumedSeconds);

  const withElapsed = useCallback((s: MemorySession): MemorySession => {
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

  const putSession = useCallback((mode: GameMode, next: MemorySession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: MemorySession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      // Read before the records move: what this run is measured against.
      const previous = previousBestsFor(statsRef.current, next);
      const outcome = applySolved(applyPlayTime(statsRef.current, next.difficulty, unbooked), next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        isNewBestMoves: outcome.isNewBestMoves,
        isNewBestTime: outcome.isNewBestTime,
        bestMoves: outcome.bestMoves,
        bestSeconds: outcome.bestSeconds,
        previousBestMoves: previous.moves,
        previousBestSeconds: previous.seconds,
        moves: next.moveCount,
        seconds: next.elapsedSeconds,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: MemorySession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: MemorySession) => {
      persistStats(applyGameStart(statsRef.current, next.difficulty));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistStats, putSession],
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

  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionsRef.current.difficulty;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('difficulty');
        return;
      }
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, resumeGame],
  );

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

  const flipCard = useCallback(
    (index: number): FlipOutcome => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return 'none';
      const next = tapCard(withElapsed(current), index);
      if (!next) return 'none';
      commitSession(next);
      if (next.status === 'solved') return 'solved';
      if (next.matched.filter(Boolean).length > current.matched.filter(Boolean).length) {
        return 'match';
      }
      return next.faceUp.length === 2 ? 'mismatch' : 'flip';
    },
    [commitSession, withElapsed],
  );

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, synced.difficulty, unbooked));
      }
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

  // Save when the app goes to background / gets hidden (§10). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Saving the board
  // alone here would drop every play second since the last sync for good.
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
  const value = useMemo<MemoryContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyMoves[today] !== undefined,
      lastResult,
      canResume,
      startDifficulty,
      startDaily,
      restartCurrent,
      resumeGame,
      flipCard,
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
      flags.tutorialCompleted,
      today,
      lastResult,
      canResume,
      startDifficulty,
      startDaily,
      restartCurrent,
      resumeGame,
      flipCard,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>;
}

export function useMemoryMatch(): MemoryContextValue {
  const value = useContext(MemoryContext);
  if (!value) throw new Error('useMemoryMatch must be used inside MemoryProvider');
  return value;
}
