/**
 * 2048's app context: screens, the active session, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One board at a time, saved as it is played (§10). There are no modes and no
 * daily, so there is nothing to keep a second slot for (§13).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§12); elapsed time is merged into the session whenever
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
  applyMove,
  createSession,
  largestTile,
  undo,
  type Direction,
  type Game2048Session,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applyRunEnd, previousBestScore } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What a swipe did — so the screen can pick its sounds without re-deriving. */
export interface SlideOutcome {
  /** False when the board did not change: nothing happens, silently (§3). */
  readonly moved: boolean;
  readonly merged: boolean;
  /** The biggest tile the move made, 0 when none joined — its sound's pitch (§12). */
  readonly largestMerge: number;
  readonly over: boolean;
}

const NOTHING_HAPPENED: SlideOutcome = {
  moved: false,
  merged: false,
  largestMerge: 0,
  over: false,
};

export interface LastResult {
  readonly score: number;
  readonly bestScore: number;
  /** The record before this run, or null while there was none (§9). */
  readonly previousBestScore: number | null;
  readonly bestTile: number;
  readonly isNewBestScore: boolean;
}

export interface Game2048ContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: Game2048Session | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastResult: LastResult | null;
  /** The direction that produced the current board, for the slide (§12). */
  lastDirection: Direction | null;
  /** Set on the one move that first reaches 2048, until it is read (§2). */
  announceReached: boolean;
  dismissReached: () => void;
  startNewGame: () => void;
  resumeGame: () => void;
  slide: (direction: Direction) => SlideOutcome;
  /** Takes one move back. False when there was nothing to take back (§6). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const Game2048Context = createContext<Game2048ContextValue | null>(null);

export interface Game2048ProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: Game2048Session | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function Game2048Provider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  children,
}: Game2048ProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<Game2048Session | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [lastDirection, setLastDirection] = useState<Direction | null>(null);
  const [announceReached, setAnnounceReached] = useState(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(0);
  /** Whether this run's records have been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: Game2048Session): Game2048Session => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a run is booked and the next game is started from the same
    // tap. React has not re-rendered in between, so the ref is advanced here
    // rather than waiting for the render that assigns it.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a run's records, once. A run ends either because the board ran out
   * of moves or because the player started a new one over the top of it; both
   * are runs that happened, and only counting the first would report a best
   * score the player knows they have beaten (§9).
   */
  const finalizeRun = useCallback(
    (run: Game2048Session) => {
      if (finalizedRef.current) return null;
      finalizedRef.current = true;
      // Only the seconds not yet booked are added, so leaving and returning
      // cannot count the same time twice.
      const unbooked = Math.max(0, run.elapsedSeconds - bookedRef.current);
      bookedRef.current = run.elapsedSeconds;
      const outcome = applyRunEnd(applyPlayTime(statsRef.current, unbooked), run);
      persistStats(outcome.stats);
      return outcome;
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: Game2048Session | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: Game2048Session) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      // Read before the record moves: what this run is measured against.
      const previous = previousBestScore(statsRef.current);
      const outcome = finalizeRun(next);
      recordGameCompleted();
      setLastResult({
        score: next.score,
        bestScore: outcome?.stats.bestScore ?? statsRef.current.bestScore,
        previousBestScore: previous,
        bestTile: largestTile(next.board),
        isNewBestScore: outcome?.isNewBestScore ?? false,
      });
    },
    [finalizeRun, putSession],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: Game2048Session) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A board that arrives rather than slides in has no direction to animate.
    setLastDirection(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const startNewGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') finalizeRun(withElapsed(current));

    const next = createSession();
    finalizedRef.current = false;
    persistStats(applyGameStart(statsRef.current));
    setLastResult(null);
    setAnnounceReached(false);
    putSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, finalizeRun, persistStats, putSession, withElapsed]);

  const slide = useCallback(
    (direction: Direction): SlideOutcome => {
      const current = sessionRef.current;
      if (!current) return NOTHING_HAPPENED;
      const outcome = applyMove(withElapsed(current), direction);
      if (!outcome) return NOTHING_HAPPENED;

      setLastDirection(direction);
      if (outcome.justReached) setAnnounceReached(true);
      commitSession(outcome.session);
      return {
        moved: true,
        merged: outcome.merged,
        largestMerge: outcome.largestMerge,
        over: outcome.session.status === 'over',
      };
    },
    [commitSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    // An undone board is placed, not slid: the tiles did not travel backwards.
    setLastDirection(null);
    setLastResult(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  const dismissReached = useCallback(() => setAnnounceReached(false), []);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, unbooked));
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

  const value = useMemo<Game2048ContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastResult,
      lastDirection,
      announceReached,
      dismissReached,
      startNewGame,
      resumeGame,
      slide,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      flags.tutorialCompleted,
      lastResult,
      lastDirection,
      announceReached,
      dismissReached,
      startNewGame,
      resumeGame,
      slide,
      applyUndo,
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
