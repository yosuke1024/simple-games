/**
 * Unblock Puzzle's app context: screens, the active session, statistics, its
 * own preference, and persistence (docs/UNBLOCK_PUZZLE_RULES.md §9–§12). Pure
 * local state — no analytics, no ad orchestration; the only ad surfaces are
 * the shared BannerSlot and ResultAdSlot the screens render.
 *
 * Two games are suspended independently — one Free Play board, one daily (§9,
 * §11) — so switching modes never costs the player either one.
 *
 * Every state change goes through one seam per record, and that seam moves
 * the ref before it calls setState (docs/ARCHITECTURE.md「状態と ref」,
 * src/test/refLeading.test.ts): a drag's release and a key press can land in
 * one task, and the second must read what the first wrote.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a board sits there. It is never shown
 * during play either (§10); elapsed time is merged into the session whenever
 * it leaves this module (saves, the clear, navigation). The clock only runs
 * while the game screen is visible, and a backgrounded app saves and books
 * its time in the same synchronous pass (§11) — returning never resumes or
 * advances anything by itself: there is nothing here that moves on its own.
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
  createDailySession,
  createFreeSession,
  doHintUse,
  doSlide,
  doUndo,
  hintFor,
  localDateString,
  restartSession,
  withElapsedSeconds,
  type Difficulty,
  type GameMode,
  type Hint,
  type UnblockSession,
} from '../game';
import {
  clearSavedGame,
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
  clearFactsOf,
  type ClearFacts,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What the result card shows about the clear just made (§10). */
export interface LastResult {
  readonly facts: ClearFacts;
  /** The clear took exactly the board's fewest moves. */
  readonly optimal: boolean;
  /**
   * True only when this clear beat a record the player already had: the
   * difficulty's fastest time in Free Play, the day's fewest moves for a
   * daily. A first clear sets a record without beating one, and says nothing.
   */
  readonly improved: boolean;
  /** The record before this clear (seconds in Free Play, moves for a daily), or null. */
  readonly previous: number | null;
}

export interface UnblockPuzzleContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The session on screen (the active mode's slot), or null. */
  session: UnblockSession | null;
  sessions: SavedGames;
  stats: Stats;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a board comes on screen: a new one, a retry, a resume. */
  sessionEpoch: number;
  /** Starts (or resumes, when that difficulty is in progress) a Free Play board. */
  startFree: (difficulty: Difficulty) => void;
  /** A fresh board at this difficulty even while one is in progress (↻, the result card). */
  startNewBoard: (difficulty: Difficulty) => void;
  startDaily: () => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** One slide (§4). False when the rules refuse it and nothing changed. */
  slide: (block: number, to: number) => boolean;
  /** Takes back the last move, whole (§6). False when there is none. */
  applyUndo: () => boolean;
  /** Searches from the board on screen (§6). Null once solved; counted only when a move is shown. */
  takeHint: () => Hint | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const UnblockPuzzleContext = createContext<UnblockPuzzleContextValue | null>(null);

export interface UnblockPuzzleProviderProps {
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

export function UnblockPuzzleProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: UnblockPuzzleProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113, §11). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * save made later can change that.
   *
   * Only a home-screen shortcut asks, and only once Quick Rules are behind the
   * player — a first launch teaches the game before it shows a board (§13).
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
   * that saves `elapsedSeconds: 0` over the suspended board (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   * Starts on the mounted game rather than at zero, because every save merges
   * this ref into the session and `syncActiveGame` runs on any background.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this session. The
   * same baseline, and it has to be: a suspended game arrives with its
   * seconds already in `totalPlaySeconds` — the sync that saved it booked
   * them. The two are one invariant; neither moves without the other.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: UnblockSession): UnblockSession => withElapsedSeconds(s, elapsedRef.current),
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

  const putSession = useCallback((mode: GameMode, next: UnblockSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: UnblockSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once (the session refuses every move after this, so
      // there is no second time). Only the seconds not yet booked are added,
      // so leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const played = applyPlayTime(statsRef.current, next.difficulty, unbooked);
      recordGameCompleted();
      const outcome = applySolved(played, next);
      persistStats(outcome.stats);
      setLastResult({
        facts: clearFactsOf(next),
        optimal: outcome.optimal,
        improved: outcome.improved,
        previous: outcome.previous,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: UnblockSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /**
   * Books the seconds the game on screen has played and not yet booked (§10).
   * `activate` hands the clock to the next board, so a board given up through
   * ↻ — the same board again, or a new one — would otherwise take its
   * unbooked seconds with it. A board that is not in play has nothing here:
   * a clear books its own time (`commitSession`), and leaving books it on
   * the way out (`syncActiveGame`).
   */
  const bookActivePlayTime = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing') return;
    const unbooked = Math.max(0, Math.floor(elapsedRef.current) - bookedRef.current);
    if (unbooked === 0) return;
    bookedRef.current += unbooked;
    persistStats(applyPlayTime(statsRef.current, current.difficulty, unbooked));
  }, [persistStats]);

  const beginSession = useCallback(
    (next: UnblockSession) => {
      bookActivePlayTime();
      persistStats(applyGameStart(statsRef.current, next.difficulty));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, bookActivePlayTime, persistStats, putSession],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current && current.status === 'playing') {
        setLastResult(null);
        activate(current);
      }
    },
    [activate],
  );

  /** Remembers the difficulty the home screen should lead with (§9). */
  const rememberDifficulty = useCallback((difficulty: Difficulty) => {
    if (prefsRef.current.difficulty === difficulty) return;
    const next: Prefs = { ...prefsRef.current, difficulty };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * Starts (or resumes) a Free Play board. Choosing the difficulty already in
   * progress picks it back up; choosing another one replaces that slot, which
   * is why the home screen asks first (§11). Dealing runs here, synchronously,
   * on the tap — bounded by the generator's work limit (§8).
   */
  const startFree = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      const current = sessionsRef.current.free;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('free');
        return;
      }
      beginSession(createFreeSession(difficulty));
    },
    [beginSession, rememberDifficulty, resumeGame],
  );

  /**
   * A fresh board at this difficulty even while one is in progress — the
   * second answer of the ↻ dialog and the first of the result card (§9).
   * `startFree` above resumes a board in progress, which is right for the
   * home; here replacing it is the point.
   */
  const startNewBoard = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      beginSession(createFreeSession(difficulty));
    },
    [beginSession, rememberDifficulty],
  );

  /** Today's board, by the device's local date — resumed if it is in progress (§9). */
  const startDaily = useCallback(() => {
    const target = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === target && current.status === 'playing') {
      resumeGame('daily');
      return;
    }
    beginSession(createDailySession(target));
  }, [beginSession, resumeGame]);

  /** The same board again, from the start: no moves, a fresh clock (§6). */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: UnblockSession) => UnblockSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const slide = useCallback(
    (block: number, to: number) => mutate((s) => doSlide(s, block, to)),
    [mutate],
  );
  const applyUndo = useCallback(() => mutate((s) => doUndo(s)), [mutate]);

  /**
   * The Hint of §6: a fresh, bounded search from the board on screen, on this
   * tap and only on it. It never moves anything. Counted for the result card
   * only when it shows a move — a search that found nothing gave no help.
   */
  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const hint = hintFor(current);
    if (hint === null) return null;
    if (hint.kind !== 'move') return hint;
    const next = doHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return hint;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, synced.difficulty, unbooked));
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
  // Mutates the ref only — zero React work per tick (battery). A hidden page
  // does not count: the interval skips its ticks, so a game left in the
  // background is not charged for the time it sat there.
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§11). This is the same
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

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange, so the seconds since the last sync would be lost. The
  // same sync runs then, and it books only what `bookedRef` has not — after
  // either exit, or a background, it adds nothing.
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

  const today = localDateString(new Date());
  const value = useMemo<UnblockPuzzleContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      prefs,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyMoves[today] !== undefined,
      lastResult,
      sessionEpoch,
      startFree,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      slide,
      applyUndo,
      takeHint,
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
      startFree,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      slide,
      applyUndo,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <UnblockPuzzleContext.Provider value={value}>{children}</UnblockPuzzleContext.Provider>;
}

export function useUnblockPuzzle(): UnblockPuzzleContextValue {
  const value = useContext(UnblockPuzzleContext);
  if (!value) throw new Error('useUnblockPuzzle must be used inside UnblockPuzzleProvider');
  return value;
}
