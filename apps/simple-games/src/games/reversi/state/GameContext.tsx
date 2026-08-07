/**
 * Reversi's app context: screens, the active match, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played (§9). The CPU's turn is a
 * scheduled effect, not a callback chain: whenever the session says the CPU
 * is to move on the game screen, one timeout is armed, and unmounting — or
 * anything that changes the session first, an undo, a new match — disarms it
 * (docs/GAME_LIFECYCLE.md). Resuming a match saved mid-CPU-turn needs nothing
 * special: the effect sees whose turn it is and plays it.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either (§11); elapsed time is merged into the session whenever it leaves
 * this module (saves, finalization, navigation).
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
  applyCpuMove,
  applyPlayerMove,
  BLACK,
  countDiscs,
  cpuColorOf,
  createSession,
  undo,
  WHITE,
  type Difficulty,
  type GameStatus,
  type Player,
  type ReversiSession,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** The CPU's reply lands after a beat, so the turn reads as a turn (§5). */
export const CPU_DELAY_MS = 450;

/** What just happened on the board, for the screen's sounds and marks (§11). */
export interface LastMove {
  readonly by: Player;
  readonly placed: number;
  readonly flipped: readonly number[];
  /** The side whose turn the move skipped, or null (§4). */
  readonly passed: Player | null;
  /** Identity: one screen effect per move, replays excluded. */
  readonly moveCount: number;
}

/** The final count, told from the player's side rather than by colour (§3). */
export interface LastResult {
  readonly status: GameStatus;
  readonly mine: number;
  readonly theirs: number;
}

export interface ReversiContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: ReversiSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  lastResult: LastResult | null;
  /** Which colour the next match starts with (§1). Never changes one in play. */
  playerIsBlack: boolean;
  setPlayerIsBlack: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Places the player's disc. False when the tap was not a legal move (§2). */
  playMove: (cell: number) => boolean;
  /** Back to the previous decision point. False when there is none (§6). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const ReversiContext = createContext<ReversiContextValue | null>(null);

export interface ReversiProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: ReversiSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function ReversiProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  children,
}: ReversiProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<ReversiSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this match. */
  const bookedRef = useRef(0);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: ReversiSession): ReversiSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a match is booked and the next one started from the same
    // tap. React has not re-rendered in between, so the ref is advanced here
    // rather than waiting for the render that assigns it.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a match's unbooked play time, and — only when it actually ended —
   * its result, once (§8). A match abandoned for a new one books its time
   * and nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: ReversiSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, match.elapsedSeconds - bookedRef.current);
      bookedRef.current = match.elapsedSeconds;
      persistStats(
        applyMatchEnd(applyPlayTime(statsRef.current, unbooked), match.difficulty, match.status),
      );
    },
    [persistStats],
  );

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: ReversiSession) => {
      setSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      recordGameCompleted();
      const { black, white } = countDiscs(next.board);
      const playerIsBlack = next.playerColor === BLACK;
      setLastResult({
        status: next.status,
        mine: playerIsBlack ? black : white,
        theirs: playerIsBlack ? white : black,
      });
    },
    [finalizeMatch],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: ReversiSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A board that arrives rather than plays out has no move to animate.
    setLastMove(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const setPlayerIsBlack = useCallback((value: boolean) => {
    if (prefsRef.current.playerIsBlack === value) return;
    const next = { ...prefsRef.current, playerIsBlack: value };
    // The ref is what startNewGame reads, and both can fire from one tap on
    // the home screen — pick a colour, then start. React has not re-rendered
    // in between, so the ref is advanced here rather than in the next render.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      // The colour is taken at the start and stays with the match (§1); a
      // later change to the preference leaves this one alone.
      const next = createSession(difficulty, prefsRef.current.playerIsBlack ? BLACK : WHITE);
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, difficulty));
      setLastResult(null);
      setSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, withElapsed],
  );

  const playMove = useCallback(
    (cell: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerMove(withElapsed(current), cell);
      if (!outcome) return false;

      setLastMove({
        by: current.playerColor,
        placed: outcome.placed,
        flipped: outcome.flipped,
        passed: outcome.passed,
        moveCount: outcome.session.moveCount,
      });
      commitSession(outcome.session);
      return true;
    },
    [commitSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    // An undone board is placed, not replayed: no flips to animate, and any
    // scheduled CPU reply is against a session that no longer exists.
    setLastMove(null);
    setLastResult(null);
    setSession(next);
    void saveGame(next);
    return true;
  }, [withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move (§5). Depends on the session itself so a
  // pass — the CPU moving twice — arms the next reply, and so any change
  // (undo, new match, unmount) disarms a stale one via the cleanup.
  useEffect(() => {
    if (
      screen !== 'game' ||
      !session ||
      session.status !== 'playing' ||
      session.toMove !== cpuColorOf(session)
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing' || current.toMove !== cpuColorOf(current)) {
        return;
      }
      const outcome = applyCpuMove(withElapsed(current));
      if (!outcome) return;
      setLastMove({
        by: cpuColorOf(current),
        placed: outcome.placed,
        flipped: outcome.flipped,
        passed: outcome.passed,
        moveCount: outcome.session.moveCount,
      });
      commitSession(outcome.session);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, session, commitSession, withElapsed]);

  /** Saves the on-screen match and books its play time so far. */
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

  // Save when the app goes to background / gets hidden (§9). This is the same
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

  const value = useMemo<ReversiContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastMove,
      lastResult,
      playerIsBlack: prefs.playerIsBlack,
      setPlayerIsBlack,
      startNewGame,
      resumeGame,
      playMove,
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
      lastMove,
      lastResult,
      prefs.playerIsBlack,
      setPlayerIsBlack,
      startNewGame,
      resumeGame,
      playMove,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <ReversiContext.Provider value={value}>{children}</ReversiContext.Provider>;
}

export function useReversi(): ReversiContextValue {
  const value = useContext(ReversiContext);
  if (!value) throw new Error('useReversi must be used inside ReversiProvider');
  return value;
}
