/**
 * Gomoku's app context: screens, the active match, statistics, and
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
  BLACK,
  WHITE,
  applyCpuMove,
  applyPlayerMove,
  cpuColorOf,
  createSession,
  undo,
  type Difficulty,
  type GomokuSession,
  type Player,
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
  readonly by: Player;
  readonly placed: number;
  /** Identity: one screen effect per move, replays excluded. */
  readonly moveCount: number;
}

export interface GomokuContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: GomokuSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastMove: LastMove | null;
  /** Which colour the next match starts with (§1). Never changes one in play. */
  playerIsBlack: boolean;
  setPlayerIsBlack: (value: boolean) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Plays a stone. False when the intersection was taken or it is not your turn. */
  playCell: (cell: number) => boolean;
  /** Back to the previous decision point. False when there is none (§5). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const GomokuContext = createContext<GomokuContextValue | null>(null);

export interface GomokuProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: GomokuSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function GomokuProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: GomokuProviderProps) {
  /**
   * Whether this launch opens straight onto the suspended match instead of
   * this game's home (issue #113). Decided once, from the record the provider
   * was mounted with: a launch means whatever it meant when it happened, and
   * no save made later in the session can change that.
   *
   * Only a home-screen shortcut asks — every other door opens the home, as it
   * always did — and only once Quick Rules are behind the player: a first
   * launch teaches the game before it shows a board (§9), and that gate has no
   * close button, so its only way out starts a new easy match, which would
   * finalize the saved one away.
   *
   * There is one slot and no ambiguity to resolve: `loadSavedGame` has already
   * discarded a save that does not decode, whose stone count disagrees with
   * its move count, or that is not a match still being played (§8), so a
   * non-null session is the whole test.
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  // Resume, or exactly what this line has always said. `resumeAtMount` already
  // answers false until Quick Rules are behind the player, so the gate is in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<GomokuSession | null>(initialSession);
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

  // A match resumed at mount arrives with its clock already run, and the two
  // numbers it needs are the two `activate` sets when Resume is tapped on the
  // home screen — a direct mount is the same arrival, without the tap. Leaving
  // them at zero breaks the match's play time in one of two silent ways:
  // `withElapsed` would write the accumulated seconds back *down* to this
  // sitting's, or — with only the live clock seeded — `syncActiveGame` would
  // book every second already counted a second time (see the backgrounding
  // note below: the next launch hands the restored elapsedSeconds back as
  // *already booked*).
  const resumedSeconds = resumeAtMount ? (initialSession?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this match. */
  const bookedRef = useRef(resumedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: GomokuSession): GomokuSession => {
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
   * its result, once (§7). A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: GomokuSession) => {
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
  const putSession = useCallback((next: GomokuSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: GomokuSession) => {
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
  const activate = useCallback((next: GomokuSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A board that arrives rather than plays out has no stone to animate.
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
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, withElapsed],
  );

  const playCell = useCallback(
    (cell: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = applyPlayerMove(withElapsed(current), cell);
      if (!outcome) return false;

      setLastMove({
        by: current.playerColor,
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
    // An undone board is placed, not replayed: nothing pops, and any
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
    if (screen !== 'game' || !session || session.status !== 'playing') return;
    if (session.toMove !== cpuColorOf(session)) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      if (current.toMove !== cpuColorOf(current)) return;
      const outcome = applyCpuMove(withElapsed(current));
      if (!outcome) return;
      setLastMove({
        by: cpuColorOf(current),
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

  const value = useMemo<GomokuContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastMove,
      playerIsBlack: prefs.playerIsBlack,
      setPlayerIsBlack,
      startNewGame,
      resumeGame,
      playCell,
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
      prefs.playerIsBlack,
      setPlayerIsBlack,
      startNewGame,
      resumeGame,
      playCell,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <GomokuContext.Provider value={value}>{children}</GomokuContext.Provider>;
}

export function useGomoku(): GomokuContextValue {
  const value = useContext(GomokuContext);
  if (!value) throw new Error('useGomoku must be used inside GomokuProvider');
  return value;
}
