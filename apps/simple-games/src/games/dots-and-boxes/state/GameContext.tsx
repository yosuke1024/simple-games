/**
 * Dots and Boxes's app context: screens, the active match, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played (§8). The CPU's turn is a
 * scheduled effect, not a callback chain: whenever the session says the CPU
 * is to move on the game screen, one timeout is armed, and unmounting — or
 * anything that changes the session first, an undo, a new match — disarms it
 * (docs/GAME_LIFECYCLE.md). A CPU line that closes a box keeps the move (§2),
 * which is a new session with the CPU still to move: the effect simply arms
 * again, so a run of lines lands one per beat without a loop anywhere (§4).
 * Resuming a match saved mid-CPU-run needs nothing special either.
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
  type BoardSize,
  type DotsAndBoxesSession,
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

/** Each CPU line lands after a beat, so its run reads one line at a time (§4). */
export const CPU_DELAY_MS = 450;

export interface DotsAndBoxesContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: DotsAndBoxesSession | null;
  stats: Stats;
  /** The board last picked, which the home screen leads with (§1). */
  preferredSize: BoardSize;
  tutorialCompleted: boolean;
  canResume: boolean;
  /** Which side the next match starts with (§1). Never changes one in play. */
  playerGoesFirst: boolean;
  setPlayerGoesFirst: (value: boolean) => void;
  startNewGame: (size: BoardSize) => void;
  resumeGame: () => void;
  /**
   * Draws a line. The session it produced, or null when the edge was drawn
   * already or it is not your turn (§2).
   */
  playEdge: (edge: number) => DotsAndBoxesSession | null;
  /** Back to the previous decision point. False when there is none (§5). */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const DotsAndBoxesContext = createContext<DotsAndBoxesContextValue | null>(null);

export interface DotsAndBoxesProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: DotsAndBoxesSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function DotsAndBoxesProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: DotsAndBoxesProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match rather than the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks; there is one slot (§8),
   * and `loadSavedGame` has already discarded everything that is not a live
   * match, so a session at all IS the one suspended match. Quick Rules still
   * come first (§9).
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<DotsAndBoxesSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. There is one
   * slot, so it is the same session whichever door the launch came through
   * — which is why this is not gated on the resume: a launch that stops on
   * the game's own home reaches `syncActiveGame` too, and from a zero
   * baseline that saves `elapsedSeconds: 0` over the suspended board
   * (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this match. The same
   * baseline as the clock, and it has to be: a suspended game arrives with
   * its seconds already in `totalPlaySeconds`.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: DotsAndBoxesSession): DotsAndBoxesSession => {
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
    (match: DotsAndBoxesSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, match.elapsedSeconds - bookedRef.current);
      bookedRef.current = match.elapsedSeconds;
      persistStats(
        applyMatchEnd(applyPlayTime(statsRef.current, unbooked), match.size, match.status),
      );
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: DotsAndBoxesSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: DotsAndBoxesSession) => {
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
  const activate = useCallback(
    (next: DotsAndBoxesSession) => {
      elapsedRef.current = next.elapsedSeconds;
      bookedRef.current = next.elapsedSeconds;
      // A board that arrives rather than plays out has no line to highlight,
      // and no CPU line to sound again (§10).
      if (next.lastMove !== null) putSession({ ...next, lastMove: null });
      setScreen('game');
    },
    [putSession],
  );

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
    (size: BoardSize) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      // The board picked leads the home screen next time (§1). The ref is
      // advanced here because a tap that picks and starts is one task.
      if (prefsRef.current.size !== size) {
        const nextPrefs: Prefs = { ...prefsRef.current, size };
        prefsRef.current = nextPrefs;
        setPrefs(nextPrefs);
        void saveRecord(prefsSchema, nextPrefs);
      }

      // The side is taken at the start and stays with the match (§1); a
      // later change to the preference leaves this one alone.
      const next = createSession(size, undefined, prefsRef.current.playerGoesFirst ? PLAYER : CPU);
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, size));
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, withElapsed],
  );

  const playEdge = useCallback(
    (edge: number): DotsAndBoxesSession | null => {
      const current = sessionRef.current;
      if (!current) return null;
      const next = applyPlayerMove(withElapsed(current), edge);
      if (!next) return null;
      commitSession(next);
      return next;
    },
    [commitSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    // Any scheduled CPU line is against a session that no longer exists; the
    // effect below disarms it as the session changes.
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move (§4). Depends on the session itself, so any
  // change (undo, new match, unmount) disarms a stale one via the cleanup —
  // and a CPU line that keeps the move is a change too, which arms the next.
  useEffect(() => {
    if (screen !== 'game' || !session || session.status !== 'playing' || session.toMove !== CPU) {
      return;
    }
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing' || current.toMove !== CPU) return;
      const next = applyCpuMove(withElapsed(current));
      if (!next) return;
      commitSession(next);
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
    flagsRef.current = next;
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
  // the restored elapsedSeconds back as *already booked*.
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
        // Leaving Quick Rules by Back counts as having seen them (issue #142):
        // otherwise this game opens on the tutorial on every launch.
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const value = useMemo<DotsAndBoxesContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      preferredSize: prefs.size,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      playerGoesFirst: prefs.playerGoesFirst,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playEdge,
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
      prefs.size,
      prefs.playerGoesFirst,
      flags.tutorialCompleted,
      setPlayerGoesFirst,
      startNewGame,
      resumeGame,
      playEdge,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <DotsAndBoxesContext.Provider value={value}>{children}</DotsAndBoxesContext.Provider>;
}

export function useDotsAndBoxes(): DotsAndBoxesContextValue {
  const value = useContext(DotsAndBoxesContext);
  if (!value) throw new Error('useDotsAndBoxes must be used inside DotsAndBoxesProvider');
  return value;
}
