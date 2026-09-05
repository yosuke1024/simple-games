/**
 * Connect Four's app context: screens, the active match, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played (§8). The CPU's turn is a
 * scheduled effect, not a callback chain: whenever the session says the CPU
 * is to move on the game screen, one timeout is armed, and unmounting — or
 * anything that changes the session first, an undo, a new match — disarms it
 * (docs/GAME_LIFECYCLE.md). Resuming a match saved mid-CPU-turn needs nothing
 * special: the effect sees whose turn it is and plays it.
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
import {
  applyCpuMove,
  applyPlayerMove,
  CPU,
  createSession,
  PLAYER,
  undo,
  type ConnectFourSession,
  type Difficulty,
  type Side,
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

/** What just landed on the board, for the screen's sounds and marks (§10). */
export interface LastMove {
  readonly by: Side;
  readonly placed: number;
  /** Identity: one screen effect per move, replays excluded. */
  readonly moveCount: number;
}

export interface ConnectFourContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: ConnectFourSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  /** Which side the next match starts with (§1). Never changes one in play. */
  playerGoesFirst: boolean;
  setPlayerGoesFirst: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Drops a disc. False when the column was full or it is not your turn (§2). */
  playColumn: (col: number) => boolean;
  /** Back to the previous decision point. False when there is none (§5). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const ConnectFourContext = createContext<ConnectFourContextValue | null>(null);

export interface ConnectFourProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: ConnectFourSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function ConnectFourProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: ConnectFourProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match rather than the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * match started later can change that.
   *
   * Only a home-screen shortcut asks — a tile on the collection, and the
   * browser, open this game's home as they always did.
   *
   * There is one slot (§8), so "the match they were playing" is never a
   * guess here: `loadSavedGame` has already discarded everything that is not
   * a live match — a finished board, a board whose disc count disagrees with
   * the move count, a board that could not have been played — so a session at
   * all IS the one suspended match. Quick Rules still come first: a first
   * launch teaches the game before it shows a board (§9), and the two records
   * can disagree if one write was lost.
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  // Resume, or exactly what this line has always said. `resumeDirectly` already
  // answers false until Quick Rules are behind the player, so the gate is in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<ConnectFourSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // A match that arrives on screen at mount has its clock already run, and the
  // two numbers `activate` sets when Resume is pressed on the home screen are
  // these two. Leaving them at zero would write the played seconds back *down*
  // to this sitting's on the first save; seeding only the first would book the
  // whole restored elapse into the statistics a second time (§8 — a restored
  // elapsedSeconds comes back as already booked).
  const resumedSeconds = resumeDirectly ? (initialSession?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this match. */
  const bookedRef = useRef(resumedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: ConnectFourSession): ConnectFourSession => {
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
   * its result, once (§7). A match abandoned for a new one books its time
   * and nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: ConnectFourSession) => {
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
  const putSession = useCallback((next: ConnectFourSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: ConnectFourSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      recordGameCompleted();
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: ConnectFourSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A board that arrives rather than plays out has no drop to animate.
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
    // The ref is what startNewGame reads, and both can fire from one tap on
    // the home screen — pick a side, then start. React has not re-rendered in
    // between, so the ref is advanced here rather than in the next render.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      // The side is taken at the start and stays with the match (§1); a
      // later change to the preference leaves this one alone.
      const next = createSession(difficulty, prefsRef.current.playerGoesFirst ? PLAYER : CPU);
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, difficulty));
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, withElapsed],
  );

  const playColumn = useCallback(
    (col: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerMove(withElapsed(current), col);
      if (!outcome) return false;

      setLastMove({
        by: PLAYER,
        placed: outcome.placed,
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
    // An undone board is placed, not replayed: nothing falls, and any
    // scheduled CPU reply is against a session that no longer exists.
    setLastMove(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move (§4). Depends on the session itself, so any
  // change (undo, new match, unmount) disarms a stale one via the cleanup.
  useEffect(() => {
    if (screen !== 'game' || !session || session.status !== 'playing' || session.toMove !== CPU) {
      return;
    }
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing' || current.toMove !== CPU) return;
      const outcome = applyCpuMove(withElapsed(current));
      if (!outcome) return;
      setLastMove({
        by: CPU,
        placed: outcome.placed,
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

  // Save when the app goes to background / gets hidden (§8). This is the same
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

  const value = useMemo<ConnectFourContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastMove,
      playerGoesFirst: prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playColumn,
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
      prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playColumn,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <ConnectFourContext.Provider value={value}>{children}</ConnectFourContext.Provider>;
}

export function useConnectFour(): ConnectFourContextValue {
  const value = useContext(ConnectFourContext);
  if (!value) throw new Error('useConnectFour must be used inside ConnectFourProvider');
  return value;
}
