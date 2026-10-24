/**
 * Chess's app context: screens, the game in progress, statistics, the side
 * preference and persistence (docs/CHESS_RULES.md §1, §4–§7). Pure local
 * state — no analytics, no ad orchestration; the only ad surfaces are the
 * shared BannerSlot and ResultAdSlot the screens render.
 *
 * One game at a time, saved as it is played (§7.1). The CPU's turn is a
 * scheduled effect, not a callback chain (docs/GAME_LIFECYCLE.md「CPU 探索」):
 * whenever the game screen shows a live session with the CPU to move and the
 * page is visible, one timeout (`CPU_DELAY_MS`) is armed, and the search runs
 * synchronously inside it, bounded by its node limit (§5). Unmounting — or
 * anything that changes the session first, an undo, a new game, leaving the
 * screen, the app going to the background — disarms it through the effect's
 * cleanup. Coming back to the foreground arms it again on the full delay, as
 * Nested Tic-Tac-Toe does (§5 — the same provisional exception). Resuming a
 * game saved on the CPU's turn needs nothing special: the effect sees whose
 * turn it is and plays it, on the same one timer (§7.1).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * either (§9); elapsed time is merged into the session whenever it leaves this
 * module (saves, finalization, navigation).
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
  BLACK,
  WHITE,
  applyCpuMove,
  applyPlayerMove,
  createSession,
  endReasonOf,
  isCpuTurn,
  statusOf,
  undo,
  type ChessSession,
  type Difficulty,
  type EndReason,
  type GameStatus,
  type Move,
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

/** What just landed on the board, for the screen's sounds and marks (§9). */
export interface LastMove {
  readonly by: 'player' | 'cpu';
  readonly move: Move;
  /** Identity: one screen effect per move — the number of plies after it. */
  readonly plies: number;
}

/** The finished game, told from the player's side (§3, §9). */
export interface LastResult {
  readonly status: Exclude<GameStatus, 'playing'>;
  readonly reason: EndReason;
  /** Plies played in the whole game. */
  readonly plies: number;
}

export interface ChessContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: ChessSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  lastResult: LastResult | null;
  /** The side the next game starts with (§1). Never changes the one in play. */
  playerIsWhite: boolean;
  setPlayerIsWhite: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /**
   * Plays the player's move `from` → `to` (with the piece kind for a
   * promotion). False when it was not legal or not the player's turn (§4).
   */
  playMove: (from: number, to: number, promotion?: number) => boolean;
  /** Back to the previous decision point. False when there is none (§6). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const ChessContext = createContext<ChessContextValue | null>(null);

export interface ChessProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: ChessSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

const pageIsVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function ChessProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: ChessProviderProps) {
  /**
   * Whether this launch opens straight onto the saved game rather than the
   * home screen (issue #113, §7.1). Decided once, from the record the provider
   * was mounted with. Only a home-screen shortcut asks, and only once Quick
   * Rules are behind the player: a first launch teaches the game before it
   * shows a board (§8). There is one slot, and `loadSavedGame` has already
   * discarded anything that is not a game to come back to, so a session at
   * all is *the* one.
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<ChessSession | null>(initialSession);
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
   * Play seconds already booked into the statistics for this game. The same
   * baseline: a suspended game arrives with its seconds already booked by the
   * sync that saved it.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this game's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: ChessSession): ChessSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a game can be booked and the next one started
    // inside one tap, and the second write reads this ref.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a game's unbooked play time, and — only when it actually ended —
   * its result, once (§7.3). A game abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (game: ChessSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, game.elapsedSeconds - bookedRef.current);
      bookedRef.current = game.elapsedSeconds;
      persistStats(
        applyMatchEnd(applyPlayTime(statsRef.current, unbooked), game.difficulty, statusOf(game)),
      );
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: ChessSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: ChessSession) => {
      putSession(next);
      const status = statusOf(next);
      const reason = endReasonOf(next);
      if (status === 'playing' || reason === null) {
        void saveGame(next);
        return;
      }
      // A finished game is not saved (§7.1): the slot goes, the result is
      // booked once, and the card gets its facts.
      void clearSavedGame();
      finalizeMatch(next);
      recordGameCompleted();
      setLastResult({ status, reason, plies: next.game.moves.length });
    },
    [finalizeMatch, putSession],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: ChessSession) => {
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

  const setPlayerIsWhite = useCallback((value: boolean) => {
    if (prefsRef.current.playerIsWhite === value) return;
    const next = { ...prefsRef.current, playerIsWhite: value };
    // startNewGame reads this ref, and both can fire from one tap sequence on
    // the home screen before React re-renders.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * A new game (§1): from the home's difficulty buttons, the ↻ and the result
   * card alike. The side is read from `ch.prefs` every time, and it stays with
   * the game — a later change to the preference leaves this one alone.
   */
  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && statusOf(current) === 'playing') finalizeMatch(withElapsed(current));

      const next = createSession(difficulty, prefsRef.current.playerIsWhite ? WHITE : BLACK);
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
    (from: number, to: number, promotion = 0): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerMove(withElapsed(current), from, to, promotion);
      if (!outcome) return false;
      setLastMove({ by: 'player', move: outcome.move, plies: outcome.session.game.moves.length });
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
    // the effect's cleanup disarms it (§6).
    setLastMove(null);
    setLastResult(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move and the page is visible (§5). Depends on the
  // session itself, so any change (undo, new game, unmount, leaving the
  // screen, the background) disarms a stale one via the cleanup. The landed
  // timer still asks the ref whether it really is the CPU's turn.
  useEffect(() => {
    if (screen !== 'game' || !visible || !session || !isCpuTurn(session)) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || !isCpuTurn(current)) return;
      const outcome = applyCpuMove(withElapsed(current));
      if (!outcome) return;
      setLastMove({ by: 'cpu', move: outcome.move, plies: outcome.session.game.moves.length });
      commitSession(outcome.session);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, visible, session, commitSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && statusOf(current) === 'playing') {
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
  // game. Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session !== null && statusOf(session) === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§7.1). The same sync
  // as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event. Hidden also disarms the
  // CPU's timer (the effect above reads `visible`); coming back arms it again,
  // on the full delay — the turn was the CPU's all along.
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
  // control back to the collection. Registered once, on native only, and the
  // handle goes with the effect (docs/ARCHITECTURE.md「ハードウェア戻るボタン」,
  // src/test/gameBackButtonWiring.test.ts).
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

  const value = useMemo<ChessContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session !== null && statusOf(session) === 'playing',
      lastMove,
      lastResult,
      playerIsWhite: prefs.playerIsWhite,
      setPlayerIsWhite,
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
      prefs.playerIsWhite,
      setPlayerIsWhite,
      startNewGame,
      resumeGame,
      playMove,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <ChessContext.Provider value={value}>{children}</ChessContext.Provider>;
}

export function useChess(): ChessContextValue {
  const value = useContext(ChessContext);
  if (!value) throw new Error('useChess must be used inside ChessProvider');
  return value;
}
