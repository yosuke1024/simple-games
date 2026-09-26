/**
 * Dominoes's app context: screens, the active game, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One game at a time, saved as it is played (docs/DOMINOES_RULES.md §9).
 * The CPU's turn is a scheduled effect, not a callback chain: whenever the
 * session says the CPU is to act on the game screen, one timeout is armed,
 * and it resolves ONE action — a play, a draw or a pass (§5). A draw keeps the
 * turn, so the new session re-arms the same effect for the next beat; there
 * is no loop and no waiting on anything. Unmounting, leaving the screen, or
 * anything that changes the session first disarms the timer
 * (docs/GAME_LIFECYCLE.md「CPU 探索」). Resuming a game saved mid-CPU-turn
 * needs nothing special: the effect sees whose action it is and takes it.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
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
  applyCpuAction,
  createSession,
  CPU,
  draw,
  pass,
  play,
  PLAYER,
  type DominoesSession,
  type End,
  type Side,
  type Tile,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameEnd, applyGameStart, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** Each of the CPU's actions lands after a beat, so its turn reads as a turn (§5). */
export const CPU_DELAY_MS = 450;

/** The action that just happened, for the screen's sounds, marks and status line (§11). */
export interface LastAction {
  readonly by: Side;
  readonly kind: 'play' | 'draw' | 'pass';
  /** Which end a play went on — the newest tile's mark. Null for a draw or a pass. */
  readonly end: End | null;
  /** Identity: one screen effect per action, replays excluded. */
  readonly moveCount: number;
}

export interface DominoesContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: DominoesSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastAction: LastAction | null;
  startNewGame: () => void;
  resumeGame: () => void;
  /** Plays a tile on an end. False when it does not fit there or it is not your turn (§3). */
  playTile: (tile: Tile, end: End) => boolean;
  /** Draws one tile. False while a tile fits or the boneyard is empty (§3). */
  drawTile: () => boolean;
  /** Passes. False unless nothing fits and the boneyard is empty (§3). */
  passTurn: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const DominoesContext = createContext<DominoesContextValue | null>(null);

export interface DominoesProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: DominoesSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function DominoesProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  children,
}: DominoesProviderProps) {
  /**
   * Whether this launch opens straight onto the saved game rather than the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened.
   *
   * Only a home-screen shortcut asks — a tile on the collection, and the
   * browser, open this game's home as they always did. There is one slot
   * (§9), and `loadSavedGame` has already discarded everything that is not a
   * live game, so a session at all IS the one suspended game. Quick Rules
   * still come first: a first launch teaches the game before it deals (§10).
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<DominoesSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. There is one
   * slot, so it is the same session whichever door the launch came through
   * — which is why this is not gated on the resume: a launch that stops on
   * the game's own home reaches `syncActiveGame` too, and from a zero
   * baseline that saves `elapsedSeconds: 0` over the suspended game
   * (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   * `activate` re-establishes the baseline whenever a game comes on screen;
   * this line covers the mount before that.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this game. The same
   * baseline, and it has to be: a suspended game arrives with its seconds
   * already in `totalPlaySeconds`. The two are one invariant.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this game's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: DominoesSession): DominoesSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a game is booked and the next one started from the same tap.
    // React has not re-rendered in between, so the ref is advanced here.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a game's unbooked play time, and — only when it actually ended —
   * its result, once (§8). A game abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeGame = useCallback(
    (game: DominoesSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, game.elapsedSeconds - bookedRef.current);
      bookedRef.current = game.elapsedSeconds;
      persistStats(applyGameEnd(applyPlayTime(statsRef.current, unbooked), game.status));
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: DominoesSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: DominoesSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeGame(next);
      recordGameCompleted();
    },
    [finalizeGame, putSession],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: DominoesSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A game that arrives rather than plays out has no newest tile to mark.
    setLastAction(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const startNewGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') finalizeGame(withElapsed(current));

    const next = createSession();
    finalizedRef.current = false;
    persistStats(applyGameStart(statsRef.current));
    putSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, finalizeGame, persistStats, putSession, withElapsed]);

  const playTile = useCallback(
    (tile: Tile, end: End): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = play(withElapsed(current), PLAYER, tile, end);
      if (!next) return false;
      setLastAction({ by: PLAYER, kind: 'play', end, moveCount: next.moveCount });
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const drawTile = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = draw(withElapsed(current), PLAYER);
    if (!next) return false;
    setLastAction({ by: PLAYER, kind: 'draw', end: null, moveCount: next.moveCount });
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  const passTurn = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = pass(withElapsed(current), PLAYER);
    if (!next) return false;
    setLastAction({ by: PLAYER, kind: 'pass', end: null, moveCount: next.moveCount });
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to act (§5). It resolves one action and commits it;
  // a draw leaves the CPU to act again, so the new session arms the next beat.
  // Depends on the session itself, so any change (a new game, leaving the
  // screen, unmount) disarms a stale one via the cleanup.
  useEffect(() => {
    if (screen !== 'game' || !session || session.status !== 'playing' || session.toMove !== CPU) {
      return;
    }
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing' || current.toMove !== CPU) return;
      const outcome = applyCpuAction(withElapsed(current));
      if (!outcome) return;
      const { action } = outcome;
      setLastAction({
        by: CPU,
        kind: action.kind,
        end: action.kind === 'play' ? action.end : null,
        moveCount: outcome.session.moveCount,
      });
      commitSession(outcome.session);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, session, commitSession, withElapsed]);

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

  // Save when the app goes to background / gets hidden (§9). This is the same
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

  const value = useMemo<DominoesContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastAction,
      startNewGame,
      resumeGame,
      playTile,
      drawTile,
      passTurn,
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
      lastAction,
      startNewGame,
      resumeGame,
      playTile,
      drawTile,
      passTurn,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <DominoesContext.Provider value={value}>{children}</DominoesContext.Provider>;
}

export function useDominoes(): DominoesContextValue {
  const value = useContext(DominoesContext);
  if (!value) throw new Error('useDominoes must be used inside DominoesProvider');
  return value;
}
