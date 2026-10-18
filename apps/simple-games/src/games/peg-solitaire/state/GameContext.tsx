/**
 * Peg Solitaire's app context: screens, the game on screen, statistics, the
 * board chosen last, and persistence (docs/PEG_SOLITAIRE_RULES.md §7, §10,
 * §11). Pure local state — no analytics, no ad orchestration; the only ad
 * surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One game at a time, saved as it is played: after every jump and every
 * Undo, on every way off the game screen (an unmount included), and whenever
 * the app goes to the background. A finished game is cleared the moment it
 * ends and booked into the statistics; an Undo from any finish — a perfect
 * clear included — puts it back in play and saves it again (§6, §11).
 *
 * Nothing here runs on its own. There is no CPU, no search and no timer
 * beyond the play clock; a jump happens only when the player makes one, and
 * coming back from the background resumes nothing (the board simply waits).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * either (§5); elapsed time is merged into the session whenever it leaves
 * this module (saves, finishes, navigation).
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
  applyMove,
  createSession,
  dealProblem,
  dealSeed,
  newSeedToken,
  undo,
  type BoardKind,
  type Outcome,
  type PegSolitaireSession,
  type Problem,
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
import { applyGameEnd, applyGameStart, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What the result card says about the game that just finished (§5, §10). */
export interface LastResult {
  readonly kind: BoardKind;
  readonly outcome: Outcome;
  /** The board's fewest-left record after this finish was booked. */
  readonly best: number;
  /** True only when this finish beat an earlier record (§10). */
  readonly improved: boolean;
}

/** What a jump did — so the screen can pick its sound without re-deriving. */
export interface JumpResult {
  /** The game's ending, when this jump was the last one; otherwise null. */
  readonly outcome: Outcome | null;
}

export interface PegSolitaireContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The game on screen, playing or just finished; null before the first. */
  session: PegSolitaireSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  /** Whether a game is suspended and can be picked up again. */
  canResume: boolean;
  /** The board chosen last (§7): the home's first offer when nothing is suspended. */
  preferredBoard: BoardKind;
  lastResult: LastResult | null;
  /** A new game on `kind`, chosen from the home (§7). */
  startBoard: (kind: BoardKind) => void;
  resumeGame: () => void;
  /** The same problem again from its opening (§6). A new game for the statistics. */
  restartCurrent: () => void;
  /** Another problem on the same board, never the one just played (§8). */
  startNewBoard: () => void;
  /** The peg at `from` jumps to `to` (§2). Null when that is not a legal jump. */
  jump: (from: number, to: number) => JumpResult | null;
  /** Takes the last jump back (§6). False when there is nothing to take back. */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const PegSolitaireContext = createContext<PegSolitaireContextValue | null>(null);

export interface PegSolitaireProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: PegSolitaireSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/**
 * One problem for `kind`, from a fresh seed (§8). With `avoid`, the problem
 * just played is left out — "New board" never hands back the board it
 * replaces. The cross has one problem and always deals it.
 */
const deal = (kind: BoardKind, avoid?: Problem): Problem =>
  dealProblem(kind, dealSeed(kind, newSeedToken()), avoid);

export function PegSolitaireProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: PegSolitaireProviderProps) {
  /**
   * Whether this launch opens straight onto the suspended game rather than
   * the home screen (issue #113). Decided once, from the records the provider
   * was mounted with: a launch means whatever it meant when it happened.
   *
   * Only a home-screen shortcut asks — a tile on the collection, and the
   * browser, open this game's home as they always did. There is one slot
   * (§11), and `loadSavedGame` has already turned everything that is not a
   * game still in play into null, so a session at all IS the one suspended
   * game. Quick Rules still come first: a first launch teaches the game
   * before it shows a board (§12).
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<PegSolitaireSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

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
   * slot, so it is the same session whichever door the launch came through —
   * which is why this is not gated on the resume: a launch that stops on the
   * game's own home reaches `syncActiveGame` too, and from a zero baseline
   * that would save `elapsedSeconds: 0` over the suspended board (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   * Starts on the mounted game rather than at zero, because every save
   * merges this ref into the session and `syncActiveGame` runs on any
   * background, not only from the game screen.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this game. The same
   * baseline, and it has to be: a suspended game arrives with its seconds
   * already in `totalPlaySeconds`. The two are one invariant; neither moves
   * without the other.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback((s: PegSolitaireSession): PegSolitaireSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a game's time is booked and the next one counted from the
    // same tap. React has not re-rendered in between, so the ref is advanced
    // here rather than waiting for the render that assigns it.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: PegSolitaireSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Books the play seconds `game` carries that are not in the statistics yet. */
  const bookPlayTime = useCallback(
    (game: PegSolitaireSession) => {
      const unbooked = game.elapsedSeconds - bookedRef.current;
      if (unbooked <= 0) return;
      bookedRef.current = game.elapsedSeconds;
      persistStats(applyPlayTime(statsRef.current, unbooked));
    },
    [persistStats],
  );

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: PegSolitaireSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setScreen('game');
  }, []);

  /**
   * Starts `problem` from its opening (§3): a new game for the statistics
   * (§10). A game still in play is left behind with its time booked and
   * nothing else — it counted as played when it began, and abandoning it is
   * not a loss.
   */
  const beginGame = useCallback(
    (problem: Problem) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') bookPlayTime(withElapsed(current));

      const next = createSession(problem);
      persistStats(applyGameStart(statsRef.current, problem.kind));
      setLastResult(null);
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, bookPlayTime, persistStats, putSession, withElapsed],
  );

  const setPreferredBoard = useCallback((board: BoardKind) => {
    if (prefsRef.current.board === board) return;
    const next = { ...prefsRef.current, board };
    // Choosing a board and starting it are one tap on the home screen.
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startBoard = useCallback(
    (kind: BoardKind) => {
      setPreferredBoard(kind);
      beginGame(deal(kind));
    },
    [beginGame, setPreferredBoard],
  );

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') activate(current);
  }, [activate]);

  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (current) beginGame(current.problem);
  }, [beginGame]);

  const startNewBoard = useCallback(() => {
    const current = sessionRef.current;
    if (current) beginGame(deal(current.problem.kind, current.problem));
  }, [beginGame]);

  const jump = useCallback(
    (from: number, to: number): JumpResult | null => {
      const current = sessionRef.current;
      if (!current) return null;
      const next = applyMove(withElapsed(current), from, to);
      if (!next) return null;
      putSession(next);
      if (next.status === 'playing' || next.outcome === null) {
        void saveGame(next);
        return { outcome: null };
      }

      // The last jump (§3): nothing is left to resume, and the finish is
      // booked now — the time it took, the fewest-left record and a perfect
      // clear (§10). An Undo from any finish puts the game back in play;
      // finishing it again books again, which the min cannot count twice, and
      // a clear counts only if the game had none before this jump (`cleared`,
      // which an Undo keeps and the save carries — §6, §11).
      void clearSavedGame();
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const booking = applyGameEnd(
        applyPlayTime(statsRef.current, unbooked),
        next.problem.kind,
        next.outcome,
        current.cleared,
      );
      persistStats(booking.stats);
      setLastResult({
        kind: next.problem.kind,
        outcome: next.outcome,
        best: booking.stats[next.problem.kind].best ?? next.outcome.remaining,
        improved: booking.improved,
      });
      if (booking.firstClear) recordGameCompleted();
      return { outcome: next.outcome };
    },
    [persistStats, putSession, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    // A finish that is taken back — a perfect clear too — is a game in play
    // again: the card goes, and the slot holds it once more, `cleared` and
    // all (§6, §11).
    setLastResult(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(synced);
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
    flagsRef.current = next;
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Play clock: one second at a time while a game is in play on screen.
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

  // Save when the app goes to background / gets hidden (§11). The same sync
  // as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Coming back starts
  // nothing — the clock above only counts while the page is visible, and the
  // board waits for a tap.
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

  const value = useMemo<PegSolitaireContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      preferredBoard: prefs.board,
      lastResult,
      startBoard,
      resumeGame,
      restartCurrent,
      startNewBoard,
      jump,
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
      prefs.board,
      lastResult,
      startBoard,
      resumeGame,
      restartCurrent,
      startNewBoard,
      jump,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <PegSolitaireContext.Provider value={value}>{children}</PegSolitaireContext.Provider>;
}

export function usePegSolitaire(): PegSolitaireContextValue {
  const value = useContext(PegSolitaireContext);
  if (!value) throw new Error('usePegSolitaire must be used inside PegSolitaireProvider');
  return value;
}
