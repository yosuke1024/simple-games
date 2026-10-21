/**
 * Nested Tic-Tac-Toe's app context: screens, the match in progress,
 * statistics, preferences and persistence (docs/NESTED_TIC_TAC_TOE_RULES.md
 * §1, §4, §5, §7, §8). Pure local state — no analytics, no ad orchestration;
 * the only ad surfaces are the shared BannerSlot and ResultAdSlot the screens
 * render.
 *
 * One match at a time, saved as it is played (§8). The CPU's turn is a
 * scheduled effect, not a callback chain (docs/GAME_LIFECYCLE.md「CPU 探索」):
 * whenever the game screen shows a live session with the CPU to move and the
 * page is visible, one timeout is armed, and the search runs synchronously
 * inside it. Unmounting — or anything that changes the session first, an
 * undo, a new match, leaving the screen, the app going to background —
 * disarms it through the effect's cleanup. Resuming a match saved on the
 * CPU's turn needs nothing special: the effect sees whose turn it is and
 * plays it, on the same one timer (§8.3).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either (§10); elapsed time is merged into the session whenever it leaves
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
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  applyCpuMove,
  applyPlayerMove,
  createSession,
  isCpuTurn,
  takenBoards,
  undo,
  type Difficulty,
  type GameStatus,
  type NestedSession,
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

/** The CPU's reply lands after a beat, so the turn reads as a turn (§4). */
export const CPU_DELAY_MS = 450;

/** What just happened on the board, for the screen's sounds and marks (§10). */
export interface LastMove {
  readonly by: 'player' | 'cpu';
  /** The cell the mark went on — the pop and the last-move bar. */
  readonly placed: number;
  /** True when the move took its small board — the `match` sound and the fade. */
  readonly took: boolean;
  /** Identity: one screen effect per move, replays excluded. */
  readonly moveCount: number;
}

/** The finished match, told from the player's side (§7, §10). */
export interface LastResult {
  readonly status: GameStatus;
  /** Small boards the player took. */
  readonly mine: number;
  /** Small boards the CPU took. */
  readonly theirs: number;
}

export interface NestedTicTacToeContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: NestedSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  lastResult: LastResult | null;
  /** Who moves first in the next match (§1). Never changes the one in play. */
  playerGoesFirst: boolean;
  setPlayerGoesFirst: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Plays the player's mark. False when the cell was not a legal move (§2). */
  playMove: (cell: number) => boolean;
  /** Back to the previous decision point. False when there is none (§5). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const NestedTicTacToeContext = createContext<NestedTicTacToeContextValue | null>(null);

export interface NestedTicTacToeProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: NestedSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

const pageIsVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function NestedTicTacToeProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: NestedTicTacToeProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match rather than the
   * home screen (issue #113, §8.3). Decided once, from the record the
   * provider was mounted with. Only a home-screen shortcut asks, and only once
   * Quick Rules are behind the player: a first launch teaches the game before
   * it shows a board (§9). There is one slot, and `loadSavedGame` has already
   * discarded anything that is not a match to come back to, so a session at
   * all is *the* one.
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<NestedSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  /** False while the app is in the background: the CPU's timer is not armed then. */
  const [visible, setVisible] = useState(pageIsVisible);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. One slot, so it is
   * the same session whichever door the launch came through — not gated on
   * the resume: a launch that stops on the game's own home reaches
   * `syncActiveGame` too, and from a zero baseline that would save
   * `elapsedSeconds: 0` over the suspended board (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this match. The same
   * baseline: a suspended game arrives with its seconds already booked by the
   * sync that saved it.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: NestedSession): NestedSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a match can be booked and the next one started
    // inside one tap, and the second write reads this ref.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a match's unbooked play time, and — only when it actually ended —
   * its result, once (§7). A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: NestedSession) => {
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

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: NestedSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: NestedSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // A finished match is not saved (§8.1): the slot goes, the result is
      // booked once, and the card gets its facts.
      void clearSavedGame();
      finalizeMatch(next);
      recordGameCompleted();
      const taken = takenBoards(next);
      setLastResult({ status: next.status, mine: taken.player, theirs: taken.cpu });
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: NestedSession) => {
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

  const setPlayerGoesFirst = useCallback((value: boolean) => {
    if (prefsRef.current.playerGoesFirst === value) return;
    const next = { ...prefsRef.current, playerGoesFirst: value };
    // startNewGame reads this ref, and both can fire from one tap sequence on
    // the home screen before React re-renders.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * A new match (§1): from the home's difficulty buttons, the ↻ and the
   * result card alike. The side is read from `nt.prefs` every time, and it
   * stays with the match — a later change to the preference leaves this one
   * alone.
   */
  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      const next = createSession(difficulty, prefsRef.current.playerGoesFirst);
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, difficulty));
      setLastResult(null);
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, withElapsed],
  );

  const playMove = useCallback(
    (cell: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerMove(withElapsed(current), cell);
      if (!outcome) return false;
      setLastMove({
        by: 'player',
        placed: outcome.placed,
        took: outcome.took,
        moveCount: outcome.session.moves.length,
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
    // An undone board is placed, not replayed: nothing to animate, and any
    // CPU reply on its timer is against a session that no longer exists —
    // the effect's cleanup disarms it (§5).
    setLastMove(null);
    setLastResult(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move and the page is visible (§4). Depends on the
  // session itself, so any change (undo, new match, unmount, leaving the
  // screen, the background) disarms a stale one via the cleanup. The landed
  // timer still asks the ref whether it really is the CPU's turn.
  useEffect(() => {
    if (screen !== 'game' || !visible || !session || !isCpuTurn(session)) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || !isCpuTurn(current)) return;
      const outcome = applyCpuMove(withElapsed(current));
      if (!outcome) return;
      setLastMove({
        by: 'cpu',
        placed: outcome.placed,
        took: outcome.took,
        moveCount: outcome.session.moves.length,
      });
      commitSession(outcome.session);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, visible, session, commitSession, withElapsed]);

  /** Saves the on-screen match and books its play time so far. */
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

  // Play clock: one second at a time while the game screen shows a live
  // match. Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§8). The same sync as
  // leaving the screen, statistics included: the OS can kill a backgrounded
  // app without sending another event. Hidden also disarms the CPU's timer
  // (the effect above reads `visible`); coming back arms it again, on the
  // full delay — the turn was the CPU's all along.
  useEffect(() => {
    const onVisibility = () => {
      const nowVisible = pageIsVisible();
      setVisible(nowVisible);
      if (!nowVisible) syncActiveGame();
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

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange. The same sync runs then, and it books only what
  // `bookedRef` has not.
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection. Registered once, on native only.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142).
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const value = useMemo<NestedTicTacToeContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastMove,
      lastResult,
      playerGoesFirst: prefs.playerGoesFirst,
      setPlayerGoesFirst,
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
      prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playMove,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return (
    <NestedTicTacToeContext.Provider value={value}>{children}</NestedTicTacToeContext.Provider>
  );
}

export function useNestedTicTacToe(): NestedTicTacToeContextValue {
  const value = useContext(NestedTicTacToeContext);
  if (!value) throw new Error('useNestedTicTacToe must be used inside NestedTicTacToeProvider');
  return value;
}
