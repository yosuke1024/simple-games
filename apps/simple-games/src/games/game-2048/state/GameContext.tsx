/**
 * 2048's app context: screens, the active game, statistics, progress, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surface is the shared BannerSlot the game screen renders.
 *
 * Two games are suspended independently — one classic, one daily (§6) — so
 * switching modes never costs the player either one.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever it
 * leaves this module (saves, finalization, navigation).
 *
 * Records (best score, highest tile, a daily's score) are booked when a run
 * ends *or* is about to be replaced. Booking them on every move instead would
 * make "the score to beat" chase the score on screen, which is no target at
 * all; leaving them to the end alone would lose a run the player restarts.
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
import { saveRecord } from '../../../storage/repo';
import {
  acknowledgeWin,
  createClassicSession,
  createDailySession,
  localDateString,
  maxTile,
  move,
  restartSession,
  undoMove,
  type Direction,
  type Game2048Session,
  type GameMode,
  type MoveOutcome,
  type Movement,
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
  applyGameStart,
  applyPlayTime,
  applyRunRecords,
  applyRunToProgress,
  applyWin,
  bestScoreFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

/** The last move, for animating it. Stale entries are ignored by move number. */
export interface LastMove {
  readonly movements: readonly Movement[];
  readonly spawnIndex: number | null;
  readonly moveCount: number;
}

export interface LastResult {
  readonly score: number;
  readonly bestScore: number;
  readonly isNewBest: boolean;
  readonly bestTile: number;
  readonly moves: number;
  readonly won: boolean;
}

export interface Game2048ContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: Game2048Session | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyPlayedToday: boolean;
  /** The score to beat on the board in play (§4). Zero when there is none. */
  scoreToBeat: number;
  lastResult: LastResult | null;
  lastMove: LastMove | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startClassic: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  applyMove: (direction: Direction) => boolean;
  applyUndo: () => boolean;
  dismissWin: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const Game2048Context = createContext<Game2048ContextValue | null>(null);

export interface Game2048ProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function Game2048Provider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSessions,
  onExit,
  children,
}: Game2048ProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('classic');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
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
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: Game2048Session): Game2048Session => {
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

  const putSession = useCallback((mode: GameMode, next: Game2048Session | null) => {
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: Game2048Session) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setLastMove(null);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: Game2048Session) => {
      const outgoing = sessionsRef.current[next.mode];
      let nextStats = statsRef.current;
      let nextProgress = progressRef.current;
      if (outgoing) {
        // The run being replaced is over as far as the records go: book it now
        // or lose it (§8).
        nextStats = applyRunRecords(nextStats, outgoing);
        nextProgress = applyRunToProgress(nextProgress, outgoing).progress;
      }
      persistStats(applyGameStart(nextStats, next.mode));
      if (nextProgress !== progressRef.current) persistProgress(nextProgress);
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistProgress, persistStats, putSession],
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

  const startClassic = useCallback(() => {
    beginSession(createClassicSession());
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

  /** Applies one played move, finalizing the run if that move ended it. */
  const commitMove = useCallback(
    (before: Game2048Session, outcome: MoveOutcome) => {
      const next = outcome.session;
      putSession(next.mode, next);
      setLastMove({
        movements: outcome.movements,
        spawnIndex: outcome.spawnIndex,
        moveCount: next.moveCount,
      });

      // A 2048 is booked on the move that makes it: the game carries on (§3),
      // so there is no ending at which to count it instead.
      let nextStats = statsRef.current;
      if (!before.won && next.won) nextStats = applyWin(nextStats, next.mode);

      if (next.status === 'playing') {
        void saveGame(next);
        if (nextStats !== statsRef.current) persistStats(nextStats);
        return;
      }

      // Game over (§3): nothing to resume, so clear the slot and book the run.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const bestBefore = bestScoreFor(
        statsRef.current,
        progressRef.current,
        next.mode,
        next.dailyDate,
      );
      persistStats(applyRunRecords(applyPlayTime(nextStats, next.mode, unbooked), next));
      const outcomeProgress = applyRunToProgress(progressRef.current, next);
      persistProgress(outcomeProgress.progress);
      setLastResult({
        score: next.score,
        bestScore: Math.max(bestBefore, next.score),
        isNewBest: next.score > bestBefore,
        bestTile: maxTile(next.board),
        moves: next.moveCount,
        won: next.won,
      });
    },
    [persistProgress, persistStats, putSession],
  );

  const applyMove = useCallback(
    (direction: Direction): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current || current.status !== 'playing') return false;
      const outcome = move(withElapsed(current), direction);
      if (!outcome) return false;
      commitMove(current, outcome);
      return true;
    },
    [commitMove, withElapsed],
  );

  /**
   * Undo: unlimited and free (§5). A finished game is not reopened — game over
   * is the end of the game itself (§3), not a move to step back through.
   */
  const applyUndo = useCallback((): boolean => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return false;
    const next = undoMove(withElapsed(current));
    if (next === null) return false;
    putSession(mode, next);
    setLastMove(null);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  const dismissWin = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.winAcknowledged) return;
    const next = acknowledgeWin(withElapsed(current));
    putSession(mode, next);
    // A game that also ended has no slot left to write to.
    if (next.status === 'playing') void saveGame(next);
  }, [putSession, withElapsed]);

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
        persistStats(applyPlayTime(statsRef.current, mode, unbooked));
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

  // Save when the app goes to background / gets hidden (§6).
  useEffect(() => {
    const saveNow = () => {
      const current = sessionsRef.current[activeModeRef.current];
      if (current && current.status === 'playing') void saveGame(withElapsed(current));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', saveNow)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [withElapsed]);

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
  const scoreToBeat =
    session === null ? 0 : bestScoreFor(stats, progress, session.mode, session.dailyDate);

  const value = useMemo<Game2048ContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyPlayedToday: progress.dailyScores[today] !== undefined,
      scoreToBeat,
      lastResult,
      lastMove,
      sessionEpoch,
      canResume,
      startClassic,
      startDaily,
      restartCurrent,
      resumeGame,
      applyMove,
      applyUndo,
      dismissWin,
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
      scoreToBeat,
      lastResult,
      lastMove,
      sessionEpoch,
      canResume,
      startClassic,
      startDaily,
      restartCurrent,
      resumeGame,
      applyMove,
      applyUndo,
      dismissWin,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <Game2048Context.Provider value={value}>{children}</Game2048Context.Provider>;
}

export function useGame2048(): Game2048ContextValue {
  const value = useContext(Game2048Context);
  if (!value) throw new Error('useGame2048 must be used inside Game2048Provider');
  return value;
}
