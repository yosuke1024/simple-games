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
import { applyGameStart, applyPlayTime, applyRunEnd } from './statsLogic';

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
  children: ReactNode;
}

export function BlockProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  children,
}: BlockProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
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

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: BlockSession): BlockSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: BlockSession) => {
      setSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Out of room: finalize once. Only the seconds not yet booked are added,
      // so leaving and returning cannot count the same time twice.
      void clearSavedGame();
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const outcome = applyRunEnd(applyPlayTime(statsRef.current, unbooked), next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        isNewBestScore: outcome.isNewBestScore,
        bestScore: outcome.stats.bestScore,
      });
    },
    [persistStats],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: BlockSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setScreen('game');
  }, []);

  const startNewGame = useCallback(() => {
    const next = createSession();
    persistStats(applyGameStart(statsRef.current));
    setLastResult(null);
    setSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, persistStats]);

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
    setSession(next);
    void saveGame(next);
    return true;
  }, [withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      setSession(synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, unbooked));
      }
    }
  }, [persistStats, withElapsed]);

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
