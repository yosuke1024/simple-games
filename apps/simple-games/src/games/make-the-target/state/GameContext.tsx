/**
 * Make the Target's app context: screens, the active session, statistics, its
 * own preference, and persistence (docs/MAKE_THE_TARGET_RULES.md §8–§10).
 * Pure local state — no analytics, no ad orchestration; the only ad surface
 * is the shared BannerSlot the game screen renders.
 *
 * Two games are suspended independently — one Free Play problem, one daily
 * (§8, §10) — so switching modes never costs the player either one. A problem
 * on the `missed` panel (§4) is still a game in play: it is saved, resumed
 * and timed like one, because Undo takes it straight back into play.
 *
 * What is selected (a tile, an operator) is part of the session, because the
 * rules decide what a tap means from it (§3) — but it is never saved: a save
 * is written only when the moves change, and a resumed game starts with
 * nothing chosen (§10).
 *
 * A new problem is searched for only on a tap — a tier on the home, "New
 * problem", and opening the day's daily — through `game/newSession.ts`, the
 * one door to the generator (§5, §6; docs/GAME_LIFECYCLE.md「CPU 探索」).
 * Resuming, retrying and showing the solution replay what the session holds
 * and search nothing.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§9); elapsed time is merged into the session whenever
 * it leaves this module (saves, finalization, navigation). The clock only
 * counts while the game screen is visible, so a backgrounded board neither
 * ages nor moves: coming back resumes exactly where it was (§9).
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
  canReveal,
  clearSelection,
  localDateString,
  newSeedToken,
  restartSession,
  revealSolution,
  tapOperator,
  tapTile,
  undo,
  withElapsed as withElapsedSeconds,
  type Difficulty,
  type GameMode,
  type MakeTheTargetSession,
  type Operator,
} from '../game';
import { newDailySession, newFreeSession } from '../game/newSession';
import {
  clearSavedGame,
  isSuspendable,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  bucketOf,
  type RecordComparison,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What the result card says about a clear (§9). */
export interface LastResult {
  readonly seconds: number;
  /** Null for a clear that is compared with no record (a retry of a solved problem). */
  readonly comparison: RecordComparison | null;
}

/** One accepted tap: the session before it and the one it made. */
export interface SessionChange {
  readonly from: MakeTheTargetSession;
  readonly to: MakeTheTargetSession;
}

export interface MakeTheTargetContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: MakeTheTargetSession | null;
  sessions: SavedGames;
  stats: Stats;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a game comes on screen (new, retried or resumed). */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startDifficulty: (difficulty: Difficulty) => void;
  startNewBoard: (difficulty: Difficulty) => void;
  startDaily: () => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** A tap on the tile in `slot` (§3). Null when it changed nothing (a refused merge is one). */
  pressTile: (slot: number) => SessionChange | null;
  /** A tap on an operator (§3). Null when it changed nothing. */
  pressOperator: (op: Operator) => SessionChange | null;
  /** Escape (§3): clears the selection. False when nothing was selected. */
  clearChoice: () => boolean;
  /** Takes back the last move (§5). Null when there is none. */
  applyUndo: () => SessionChange | null;
  /** Ends the problem by showing its kept solution (§5) — Free Play's `missed` panel only. */
  revealCurrent: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const MakeTheTargetContext = createContext<MakeTheTargetContextValue | null>(null);

export interface MakeTheTargetProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/**
 * The mode a freshly mounted game is pointed at when nothing is resumed.
 * Named because the play-clock baseline has to be read from the same slot.
 */
const INITIAL_MODE: GameMode = 'free';

/** A new Free Play problem: its seed minted here, where the clock and randomness live (§8). */
const freshFreeSession = (difficulty: Difficulty): MakeTheTargetSession =>
  newFreeSession(difficulty, newSeedToken(Date.now(), Math.random)).session;

export function MakeTheTargetProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: MakeTheTargetProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks, and only once Quick Rules
   * are behind the player — a first launch teaches the game first (§8, §11).
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /**
   * The slot this mount is pointed at: the one a shortcut opened straight
   * onto, or the one the home screen starts on. Read by both the active mode
   * and the clock seed below, because a mode taken from one slot and a clock
   * taken from another is the whole trap (src/test/playClockSeed.test.ts).
   */
  const mountedMode = resumeMode ?? INITIAL_MODE;
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>(mountedMode);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const session = sessions[activeMode];

  /**
   * The seconds the game on that slot already carries. Read from the slot
   * itself rather than gated on the resume: a launch that stops on the
   * game's own home reaches `syncActiveGame` too, and from a zero baseline
   * that saves `elapsedSeconds: 0` over the suspended problem (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   * `activate` re-establishes the baseline whenever a game comes on screen;
   * this line covers the mount before that.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this session — the
   * same baseline, because a suspended game arrives with its seconds already
   * in `totalPlaySeconds` (the sync that saved it booked them).
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: MakeTheTargetSession): MakeTheTargetSession => withElapsedSeconds(s, elapsedRef.current),
    [],
  );

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state, for the reason putSession's does below: a run
    // can be booked and the next one started inside one tap, and the second
    // write reads this ref — a stale read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: MakeTheTargetSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second tap in that task would
    // otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: MakeTheTargetSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /**
   * Books a session's play seconds not yet in the statistics (§9) — once:
   * the booked mark moves with them, so a later sync adds only what came after.
   */
  const bookPlayTime = useCallback(
    (played: MakeTheTargetSession) => {
      const unbooked = Math.max(0, played.elapsedSeconds - bookedRef.current);
      if (unbooked === 0) return;
      bookedRef.current = played.elapsedSeconds;
      persistStats(applyPlayTime(statsRef.current, bucketOf(played), unbooked));
    },
    [persistStats],
  );

  /**
   * Handles a session transition. A change of the moves is saved (a change of
   * the selection alone is not — it is never saved, §10); the move that
   * solves the problem finalizes it, once: a solved session refuses every
   * later tap, so this branch runs once a problem (§5).
   */
  const commitSession = useCallback(
    (previous: MakeTheTargetSession, next: MakeTheTargetSession) => {
      putSession(next.mode, next);
      if (next.status !== 'solved') {
        if (next.moves !== previous.moves) void saveGame(next);
        return;
      }
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const played = applyPlayTime(statsRef.current, bucketOf(next), unbooked);
      recordGameCompleted();
      const outcome = applySolved(played, next);
      persistStats(outcome.stats);
      setLastResult({ seconds: next.elapsedSeconds, comparison: outcome.comparison });
    },
    [persistStats, putSession],
  );

  /**
   * The problem on screen is about to be replaced mid-game (↻ Retry or New
   * problem): its seconds since the last sync go into the statistics first,
   * because `activate` hands the clock to the new one from zero (§9
   * `bookReplacedBoard`). A finished problem was booked as it ended, so this
   * adds nothing then.
   */
  const bookReplacedBoard = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current && isSuspendable(current)) bookPlayTime(withElapsed(current));
  }, [bookPlayTime, withElapsed]);

  const beginSession = useCallback(
    (next: MakeTheTargetSession) => {
      persistStats(applyGameStart(statsRef.current, bucketOf(next)));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistStats, putSession],
  );

  const canResume = useCallback((mode: GameMode) => isSuspendable(sessionsRef.current[mode]), []);

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current && isSuspendable(current)) activate(current);
    },
    [activate],
  );

  /** Remembers the difficulty the home screen should lead with (§8). */
  const rememberDifficulty = useCallback((difficulty: Difficulty) => {
    if (prefsRef.current.difficulty === difficulty) return;
    const next: Prefs = { ...prefsRef.current, difficulty };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * Starts (or resumes) a Free Play problem. Choosing the difficulty already
   * in progress picks it back up; choosing another replaces that slot, which
   * is why the home screen asks first (§8).
   */
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      const current = sessionsRef.current.free;
      if (current && current.difficulty === difficulty && isSuspendable(current)) {
        resumeGame('free');
        return;
      }
      beginSession(freshFreeSession(difficulty));
    },
    [beginSession, rememberDifficulty, resumeGame],
  );

  /**
   * A fresh problem at this difficulty even while one is in progress — the
   * second answer of the ↻ dialog and the first of the result card (§5, §8).
   */
  const startNewBoard = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      bookReplacedBoard();
      beginSession(freshFreeSession(difficulty));
    },
    [beginSession, bookReplacedBoard, rememberDifficulty],
  );

  /** Today's daily: resumed when it is in progress, otherwise dealt from the date (§8). */
  const startDaily = useCallback(() => {
    const today = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === today && isSuspendable(current)) {
      resumeGame('daily');
      return;
    }
    beginSession(newDailySession(today).session);
  }, [beginSession, resumeGame]);

  /**
   * The same problem again, free and immediate — its own numbers, target and
   * kept solution, no moves, the clock at zero, nothing searched (§5). A
   * Free Play retry of a solved problem is a `repeat` (§9).
   */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    const next = restartSession(current);
    if (!next) return;
    bookReplacedBoard();
    beginSession(next);
  }, [beginSession, bookReplacedBoard]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: MakeTheTargetSession) => MakeTheTargetSession | null): SessionChange | null => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return null;
      const timed = withElapsed(current);
      const next = apply(timed);
      if (next === null || next === timed) return null;
      commitSession(current, next);
      return { from: current, to: next };
    },
    [commitSession, withElapsed],
  );

  const pressTile = useCallback((slot: number) => mutate((s) => tapTile(s, slot)), [mutate]);
  const pressOperator = useCallback((op: Operator) => mutate((s) => tapOperator(s, op)), [mutate]);
  const clearChoice = useCallback(() => mutate((s) => clearSelection(s)) !== null, [mutate]);
  const applyUndo = useCallback(() => mutate((s) => undo(s)), [mutate]);

  /**
   * Shows the solution kept with the problem (§5): the problem ends here. It
   * was counted as played when it began; it is not counted as solved and
   * moves no record. Its unbooked seconds go into the play time once, and its
   * save is cleared — a finished problem is not something to resume.
   */
  const revealCurrent = useCallback((): boolean => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || !canReveal(current)) return false;
    const next = revealSolution(withElapsed(current));
    if (!next) return false;
    putSession(mode, next);
    void clearSavedGame(mode);
    bookPlayTime(next);
    setLastResult(null);
    return true;
  }, [bookPlayTime, putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && isSuspendable(current)) {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      bookPlayTime(synced);
    }
  }, [bookPlayTime, putSession, withElapsed]);

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

  // Play clock: one second at a time while the game screen is visible and the
  // problem is still in play (the `missed` panel included — Undo is one tap
  // away). Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && isSuspendable(session);
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
  // the restored elapsedSeconds back as *already booked*. Coming back changes
  // nothing by itself: the clock only counts while the page is visible, and
  // nothing moves on the board until the player taps.
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

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange. The same sync runs then, and it books only what
  // `bookedRef` has not — after either exit, or a background, it adds nothing.
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection. Registered once, on native only, and the
  // handle goes with the effect: Capacitor delivers the event to every
  // listener ever registered, so a second owner would minimize the app under
  // whatever screen the first one just closed
  // (docs/ARCHITECTURE.md「ハードウェア戻るボタン」, src/test/gameBackButtonWiring.test.ts).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142):
        // otherwise this game opens on the tutorial on every launch
        // (src/test/tutorialBackWiring.test.tsx).
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const today = localDateString(new Date());
  const value = useMemo<MakeTheTargetContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      prefs,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyTimes[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startDifficulty,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      pressTile,
      pressOperator,
      clearChoice,
      applyUndo,
      revealCurrent,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      prefs,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startDifficulty,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      pressTile,
      pressOperator,
      clearChoice,
      applyUndo,
      revealCurrent,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <MakeTheTargetContext.Provider value={value}>{children}</MakeTheTargetContext.Provider>;
}

export function useMakeTheTarget(): MakeTheTargetContextValue {
  const value = useContext(MakeTheTargetContext);
  if (!value) throw new Error('useMakeTheTarget must be used inside MakeTheTargetProvider');
  return value;
}
