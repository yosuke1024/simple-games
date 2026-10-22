/**
 * Pipe Link's app context: screens, the active session, statistics, its own
 * preference, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Two games are suspended independently — one difficulty game, one daily
 * (docs/PIPE_LINK_RULES.md §7, §8) — so switching modes never costs the
 * player either one.
 *
 * Searches run here only on an explicit action (§4「仕事量と上限」): a new
 * board is generated when the player asks for one (a difficulty with nothing
 * suspended, New Board, today's daily), and the technique solver runs inside
 * the first Hint tap on a board. Mounting, resuming and Restart run none.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§8); elapsed time is merged into the session whenever
 * it leaves this module (saves, finalization, navigation).
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
  askHint,
  createDailySession,
  createDifficultySession,
  localDateString,
  periodOf,
  restartSession,
  turnTile,
  undo,
  withElapsedSeconds,
  type Difficulty,
  type GameMode,
  type Hint,
  type PipeLinkSession,
  type TurnDirection,
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
  bucketOf,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

export interface LastResult {
  readonly seconds: number;
  readonly hints: number;
  /** True when this clear beat the time the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat after this clear. */
  readonly bestSeconds: number;
  /** The record before this run, or null on a first clear. */
  readonly previousBestSeconds: number | null;
}

/** What one turn (or its undo) did to one tile (§3, §6). */
export interface TileStep {
  readonly cell: number;
  readonly before: number;
  readonly after: number;
  /** Which way the tile went round — what the drawing turns it by (§10). */
  readonly direction: TurnDirection;
}

export interface PipeLinkContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: PipeLinkSession | null;
  sessions: SavedGames;
  stats: Stats;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a game comes on screen (new, restarted or resumed). */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startDifficulty: (difficulty: Difficulty) => void;
  startNewBoard: (difficulty: Difficulty) => void;
  startDaily: () => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /**
   * One quarter turn of one tile (§3): clockwise for a tap, Enter or Space,
   * counter-clockwise for a right click or Shift+Enter. Null when nothing
   * changed — the board is solved, or the cell does not exist. Read from the
   * session the turn was applied to, never from a render's copy: two turns
   * in one task each see the one before.
   */
  turn: (cell: number, direction: TurnDirection) => TileStep | null;
  /** Takes back the last turn (§6), or null when there is none to take back. */
  applyUndo: () => TileStep | null;
  /** One tap on Hint (§6): the hint, or null on a solved board. */
  takeHint: () => Hint | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const PipeLinkContext = createContext<PipeLinkContextValue | null>(null);

export interface PipeLinkProviderProps {
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
const INITIAL_MODE: GameMode = 'difficulty';

export function PipeLinkProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: PipeLinkProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks, and only once Quick Rules
   * are behind the player — a first launch teaches the game first (§9).
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /**
   * The slot this mount is pointed at, read by both the active mode and the
   * clock seed below: a mode taken from one slot and a clock taken from
   * another is the whole trap (src/test/playClockSeed.test.ts).
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
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this session. The
   * same baseline: a suspended game arrives with its seconds already booked
   * by the sync that saved it. The two move together.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: PipeLinkSession): PipeLinkSession => withElapsedSeconds(s, elapsedRef.current),
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

  const putSession = useCallback((mode: GameMode, next: PipeLinkSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    // Two quick taps can land in one task, and the second must read the first.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: PipeLinkSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice. The session
      // refuses every move once solved (§2), so this branch runs once a board.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const played = applyPlayTime(statsRef.current, bucketOf(next), unbooked);
      // Read before the record moves: what this clear is measured against.
      const previousBestSeconds = previousBestFor(played, next);
      recordGameCompleted();
      const outcome = applySolved(played, next);
      persistStats(outcome.stats);
      setLastResult({
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
        isNewBest: outcome.isNewBest,
        bestSeconds: outcome.bestSeconds,
        previousBestSeconds,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: PipeLinkSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /**
   * Books a session's play seconds not yet in the statistics (§8) — once:
   * the booked mark moves with them, so a later sync adds only what came after.
   */
  const bookPlayTime = useCallback(
    (played: PipeLinkSession) => {
      const unbooked = Math.max(0, played.elapsedSeconds - bookedRef.current);
      if (unbooked === 0) return;
      bookedRef.current = played.elapsedSeconds;
      persistStats(applyPlayTime(statsRef.current, bucketOf(played), unbooked));
    },
    [persistStats],
  );

  /**
   * The board on screen is about to be replaced mid-game (↻ Restart or New
   * Board): its seconds since the last sync go into the statistics first
   * (§8「途中で盤面を替えても、それまでの時間は数える」). `activate` hands the
   * clock to the new board and starts it from zero, so without this those
   * seconds would be lost. A solved board was booked as it finished.
   */
  const bookReplacedBoard = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current && current.status === 'playing') bookPlayTime(withElapsed(current));
  }, [bookPlayTime, withElapsed]);

  const beginSession = useCallback(
    (next: PipeLinkSession) => {
      persistStats(applyGameStart(statsRef.current, bucketOf(next)));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistStats, putSession],
  );

  const canResume = useCallback(
    (mode: GameMode) => sessionsRef.current[mode]?.status === 'playing',
    [],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current) activate(current);
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
   * Starts (or resumes) a difficulty game. Choosing the difficulty already in
   * progress picks it back up; choosing another one replaces that slot, which
   * is why the home screen asks first (§7).
   */
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      const current = sessionsRef.current.difficulty;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('difficulty');
        return;
      }
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, rememberDifficulty, resumeGame],
  );

  /**
   * A fresh board at this difficulty even while one is in progress — the
   * second answer of the ↻ dialog and of the result card (§8).
   */
  const startNewBoard = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      bookReplacedBoard();
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, bookReplacedBoard, rememberDifficulty],
  );

  const startDaily = useCallback(() => {
    const target = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === target && current.status === 'playing') {
      resumeGame('daily');
      return;
    }
    beginSession(createDailySession(target));
  }, [beginSession, resumeGame]);

  /**
   * The same board from its starting orientations, free and immediate — no
   * history, no hints, the clock at zero (§8). Rebuilt from the board on
   * screen, not the seed: no search runs, and a bundled board comes back as
   * itself.
   */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    bookReplacedBoard();
    beginSession(restartSession(current));
  }, [beginSession, bookReplacedBoard]);

  /**
   * Applies a pure session transition to the game on screen. Hands back the
   * session it started from (read from the ref, so the latest) with the one
   * it made.
   */
  const mutate = useCallback(
    (
      apply: (s: PipeLinkSession) => PipeLinkSession | null,
    ): { readonly from: PipeLinkSession; readonly to: PipeLinkSession } | null => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return null;
      const next = apply(withElapsed(current));
      if (!next) return null;
      commitSession(next);
      return { from: current, to: next };
    },
    [commitSession, withElapsed],
  );

  const turn = useCallback(
    (cell: number, direction: TurnDirection): TileStep | null => {
      const change = mutate((s) => turnTile(s, cell, direction));
      if (change === null) return null;
      return {
        cell,
        before: change.from.current[cell]!,
        after: change.to.current[cell]!,
        direction,
      };
    },
    [mutate],
  );

  const applyUndo = useCallback((): TileStep | null => {
    const change = mutate((s) => undo(s));
    if (change === null) return null;
    // One turn changes one tile, so its undo changes that tile back.
    const move = change.from.history[change.from.history.length - 1]!;
    const cell = move.cell;
    const before = change.from.current[cell]!;
    const after = change.to.current[cell]!;
    const period = periodOf(change.from.board.types[cell]!);
    // Undoing a clockwise turn goes back counter-clockwise, and the other way
    // round. A straight's two orientations are a half turn apart either way;
    // it goes back counter-clockwise.
    const direction: TurnDirection = (before - after + period) % period === 1 ? 'ccw' : 'cw';
    return { cell, before, after, direction };
  }, [mutate]);

  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const asked = askHint(withElapsed(current));
    putSession(mode, asked.session);
    // Saved only when the count moved; the solver's result is never saved (§6).
    if (asked.session.hintCount !== current.hintCount) void saveGame(asked.session);
    return asked.hint;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
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

  // Play clock: one second at a time while the game screen is visible (§8).
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

  // Save when the app goes to background / gets hidden (§7). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Coming back changes
  // nothing by itself: the clock only counts while the page is visible, and
  // no tile turns until the player turns it.
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
  const value = useMemo<PipeLinkContextValue>(
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
      turn,
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
      canResume,
      startDifficulty,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      turn,
      applyUndo,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <PipeLinkContext.Provider value={value}>{children}</PipeLinkContext.Provider>;
}

export function usePipeLink(): PipeLinkContextValue {
  const value = useContext(PipeLinkContext);
  if (!value) throw new Error('usePipeLink must be used inside PipeLinkProvider');
  return value;
}
