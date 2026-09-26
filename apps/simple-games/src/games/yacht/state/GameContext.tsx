/**
 * Yacht's app context: screens, the game in progress, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One game at a time, saved as it is played (docs/YACHT_RULES.md §7): every
 * throw, every hold and every box goes through `putSession` and is saved.
 * Nothing here runs on its own — there is no CPU and no countdown — so the
 * only timer is the play clock, and it lives while the game screen does.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * either (§9); elapsed time is merged into the session whenever it leaves
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
  createSession,
  roll,
  score,
  statusOf,
  toggleHold as toggleHoldIn,
  totalOf,
  type Category,
  type YachtSession,
  type YachtStatus,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameEnd, applyGameStart, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** The throw that just landed, for the dice's tumble (§9). */
export interface LastRoll {
  /** Identity: the session's `rollIndex` after this throw — one tumble each. */
  readonly rollIndex: number;
  /** Which dice took a new face; kept dice do not tumble. */
  readonly rolled: readonly boolean[];
}

/** What the result card says about a filled sheet (§6). */
export interface LastResult {
  readonly total: number;
  readonly bestScore: number;
  /** The record before this sheet, or null while there was none. */
  readonly previousBest: number | null;
  readonly isNewBest: boolean;
}

export interface YachtContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: YachtSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastRoll: LastRoll | null;
  lastResult: LastResult | null;
  startNewGame: () => void;
  resumeGame: () => void;
  /** Throws the dice. False when no throw is possible (§2). */
  rollDice: () => boolean;
  /** Keeps a die or lets it go. False when keeping means nothing now (§2). */
  toggleHold: (index: number) => boolean;
  /** Ends the turn in a box. The status it leaves, or null when refused (§2). */
  scoreCategory: (category: Category) => YachtStatus | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const YachtContext = createContext<YachtContextValue | null>(null);

export interface YachtProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: YachtSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function YachtProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  children,
}: YachtProviderProps) {
  /**
   * Whether this launch opens straight onto the saved sheet rather than the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks; a tile on the collection,
   * and the browser, open this game's home as they always did.
   *
   * There is one slot (§7), and `loadSavedGame` has already discarded
   * everything that is not a live sheet, so a session at all IS the one
   * suspended game. Quick Rules still come first (§8).
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<YachtSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastRoll, setLastRoll] = useState<LastRoll | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. There is one
   * slot, so it is the same session whichever door the launch came through —
   * which is why this is not gated on the resume (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this game. The same
   * baseline as the clock: a suspended game arrives with its seconds already
   * in `totalPlaySeconds`, booked by the sync that saved it.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this game's end has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: YachtSession): YachtSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a game is booked and the next one started from the same
    // tap. React has not re-rendered in between, so the ref is advanced here.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a game's unbooked play time, and — only when the sheet is full —
   * its total, once (§6). A game abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeGame = useCallback(
    (game: YachtSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, game.elapsedSeconds - bookedRef.current);
      bookedRef.current = game.elapsedSeconds;
      const timed = applyPlayTime(statsRef.current, unbooked);
      if (statusOf(game) !== 'finished') {
        persistStats(timed);
        return;
      }
      const total = totalOf(game);
      const previousBest = timed.bestScore;
      const next = applyGameEnd(timed, total);
      persistStats(next);
      setLastResult({
        total,
        bestScore: next.bestScore ?? total,
        previousBest,
        isNewBest: previousBest === null || total > previousBest,
      });
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: YachtSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // — two digit keys in one frame — would otherwise start from the session
    // the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: YachtSession) => {
      putSession(next);
      if (statusOf(next) === 'playing') {
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
  const activate = useCallback((next: YachtSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // Dice that arrive rather than land have no tumble to play.
    setLastRoll(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const startNewGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && statusOf(current) === 'playing') finalizeGame(withElapsed(current));

    const next = createSession();
    finalizedRef.current = false;
    setLastResult(null);
    persistStats(applyGameStart(statsRef.current));
    putSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, finalizeGame, persistStats, putSession, withElapsed]);

  const rollDice = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = roll(withElapsed(current));
    if (!next) return false;
    setLastRoll({ rollIndex: next.rollIndex, rolled: next.held.map((kept) => !kept) });
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  const toggleHold = useCallback(
    (index: number): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = toggleHoldIn(withElapsed(current), index);
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const scoreCategory = useCallback(
    (category: Category): YachtStatus | null => {
      const current = sessionRef.current;
      if (!current) return null;
      const next = score(withElapsed(current), category);
      if (!next) return null;
      commitSession(next);
      return statusOf(next);
    },
    [commitSession, withElapsed],
  );

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

  // Play clock: one second at a time while the game screen is visible.
  // Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session !== null && statusOf(session) === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§7). The same sync as
  // leaving the screen, statistics included: the OS can kill a backgrounded
  // app without another event, and the next launch hands the restored
  // elapsedSeconds back as *already booked*.
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

  const value = useMemo<YachtContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session !== null && statusOf(session) === 'playing',
      lastRoll,
      lastResult,
      startNewGame,
      resumeGame,
      rollDice,
      toggleHold,
      scoreCategory,
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
      lastRoll,
      lastResult,
      startNewGame,
      resumeGame,
      rollDice,
      toggleHold,
      scoreCategory,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <YachtContext.Provider value={value}>{children}</YachtContext.Provider>;
}

export function useYacht(): YachtContextValue {
  const value = useContext(YachtContext);
  if (!value) throw new Error('useYacht must be used inside YachtProvider');
  return value;
}
