/**
 * Block Puzzle's app context: screens, the active session, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One game is suspended at a time (§10). A turn-based board restores exactly,
 * so leaving mid-game costs nothing and there is no "are you sure" on the way
 * out — only on the way to a *new* board, which does discard one.
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
  canUndo,
  clearedCells,
  createSession,
  pieceById,
  pieceCells,
  placePiece,
  undo,
  type BlockSession,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applyRunEnd, previousBestScore } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What a placement did — so the screen can pick sounds and the fade (§12). */
export interface PlaceOutcome {
  /** False for an illegal drop: nothing happened and nothing is said (§3). */
  readonly placed: boolean;
  /** Lines removed by this placement (§4). */
  readonly lines: number;
  /** The board just ran out of room (§2). */
  readonly over: boolean;
  /** Board indices the clear emptied, for the fade (§12). */
  readonly cleared: readonly number[];
}

const NOTHING_HAPPENED: PlaceOutcome = { placed: false, lines: 0, over: false, cleared: [] };

export interface LastResult {
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
  /** The record before this run, or null while there was none (§9). */
  readonly previousBestScore: number | null;
}

export interface BlockContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: BlockSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  canResume: boolean;
  canUndoNow: boolean;
  startNewGame: () => void;
  resumeGame: () => void;
  /** Places tray slot `slot` with its top-left corner at (row, col) (§3). */
  play: (slot: number, row: number, col: number) => PlaceOutcome;
  /** Takes one placement back. False when there was nothing to take back (§7). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const BlockContext = createContext<BlockContextValue | null>(null);

export interface BlockProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: BlockSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function BlockProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  children,
}: BlockProviderProps) {
  /**
   * Whether this launch opens straight onto the suspended board (issue #113).
   * Decided once, from the record the provider was mounted with: a launch
   * means whatever it meant when it happened, and no save made afterwards can
   * change what it meant.
   *
   * Nothing to disambiguate here — there is one save slot (§10), and
   * `loadSavedGame` returns null for anything that cannot be picked up, so a
   * playable session *is* the game they were playing. Only a home-screen
   * shortcut asks, and only once Quick Rules are behind the player: a first
   * launch teaches the game before it shows a board (§11), and a shortcut is
   * not a way around that.
   */
  const [resumeOnMount] = useState(
    () =>
      entry === 'shortcut' &&
      initialFlags.tutorialCompleted &&
      initialSession?.status === 'playing',
  );
  // Resume, or exactly what this line has always said. `resumeOnMount` already
  // answers false until Quick Rules are behind the player, so the gate is in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeOnMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<BlockSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // A board resumed at mount arrives with its clock already run, and the two
  // numbers `activate` sets when Resume is pressed on the home screen are the
  // same two — mounting straight onto the board is the one way onto it that
  // does not go through `activate`, so it has to set them itself (§9).
  // Leaving them at zero would book the restored elapse into the statistics a
  // second time on the first sync (the load path hands elapsedSeconds back as
  // *already booked*) and write the saved board's own elapse back down to the
  // seconds since mount.
  const resumedSeconds = resumeOnMount ? (initialSession?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(resumedSeconds);

  const withElapsed = useCallback((s: BlockSession): BlockSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — the running board's seconds are booked and the next game is
    // started from the same tap. React has not re-rendered in between, so the
    // ref is advanced here rather than waiting for the render that assigns
    // it; otherwise the second write is computed from pre-booking statistics
    // and quietly undoes the first.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Hands the statistics the seconds this run has played but not yet booked
   * (§9). Only the difference, so calling it twice cannot count the same
   * second twice — which is what lets every exit from a running board call it
   * without any of them having to know about the others.
   */
  const bookElapsed = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    const unbooked = Math.max(0, elapsedRef.current - bookedRef.current);
    if (unbooked === 0) return;
    bookedRef.current = elapsedRef.current;
    persistStats(applyPlayTime(statsRef.current, unbooked));
  }, [persistStats]);

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: BlockSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: BlockSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Out of room: finalize once. Only the seconds not yet booked are added,
      // so leaving and returning cannot count the same time twice.
      void clearSavedGame();
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      // Read before the record moves: what this run is measured against.
      const previous = previousBestScore(statsRef.current);
      const outcome = applyRunEnd(applyPlayTime(statsRef.current, unbooked), next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        isNewBestScore: outcome.isNewBestScore,
        bestScore: outcome.stats.bestScore,
        previousBestScore: previous,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: BlockSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setScreen('game');
  }, []);

  const startNewGame = useCallback(() => {
    // The board being replaced may have been played for minutes without ever
    // leaving the screen, and `activate` below resets the clock refs to the
    // new game's zero. Booking first is what keeps those minutes: nothing
    // else was ever going to come back for them (§9).
    bookElapsed();

    const next = createSession();
    persistStats(applyGameStart(statsRef.current));
    setLastResult(null);
    putSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, bookElapsed, persistStats, putSession]);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') activate(current);
    else startNewGame();
  }, [activate, startNewGame]);

  const play = useCallback(
    (slot: number, row: number, col: number): PlaceOutcome => {
      const current = sessionRef.current;
      if (!current) return NOTHING_HAPPENED;
      const piece = pieceById(current.tray[slot]);
      const next = placePiece(withElapsed(current), slot, row, col);
      if (!next || !piece) return NOTHING_HAPPENED;
      commitSession(next);
      return {
        placed: true,
        lines: next.linesCleared - current.linesCleared,
        over: next.status === 'over',
        cleared: clearedCells(current.board, next.board, pieceCells(piece, row, col)),
      };
    },
    [commitSession, withElapsed],
  );

  /**
   * One placement back (§7). Offered only while a game is running: a run that
   * has ended is finalized — its score is booked into the best and its lines
   * into the total — and walking that back would mean un-booking statistics
   * the player has already been shown. What an ended run gets instead is a
   * new board, free, right there on the result screen (§8).
   */
  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(synced);
      void saveGame(synced);
    }
    bookElapsed();
  }, [bookElapsed, putSession, withElapsed]);

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

  const value = useMemo<BlockContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      canResume: session?.status === 'playing',
      canUndoNow: session !== null && session.status === 'playing' && canUndo(session),
      startNewGame,
      resumeGame,
      play,
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
      startNewGame,
      resumeGame,
      play,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlockPuzzle(): BlockContextValue {
  const value = useContext(BlockContext);
  if (!value) throw new Error('useBlockPuzzle must be used inside BlockProvider');
  return value;
}
