/**
 * Gem Swap's app context: the screens, the round on the board, the
 * statistics, the gem-count preference, and persistence
 * (docs/GEM_SWAP_RULES.md §2, §5–§7, §9). Pure local state — no analytics; the
 * only ad surfaces are the shared BannerSlot and ResultAdSlot the screens
 * render.
 *
 * Every rule lives in game/; this module only decides WHEN a rule is asked.
 * A swap is resolved whole the moment it is made (`trySwap` — every cascade
 * stage, the final board, the score), and that result is the state: the
 * stage-by-stage replay the game screen draws afterwards is a picture of a
 * move that has already happened, so stopping it — a tap, a background, Back
 * — loses nothing (§10).
 *
 * One round at a time, saved as it is played: after every valid swap and
 * every Undo, on every way off the game screen (an unmount included), and
 * whenever the app goes to the background. A finished round is removed from
 * the slot the moment it ends and booked into the statistics, once; there is
 * no Undo after the end (§6), so nothing can take that booking back.
 *
 * Nothing here runs on its own. There is no search and no timer beyond the
 * play clock; a swap happens only when the player makes one, and coming back
 * from the background resumes nothing (the board simply waits).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a round is on screen. It is never shown
 * either (§9); elapsed time is merged into the session whenever it leaves
 * this module (saves, the end of a round, navigation).
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
  canUndo,
  createRound,
  createSession,
  gemSwapSeed,
  newSeedToken,
  trySwap,
  undoRound,
  type ColorCount,
  type EndReason,
  type GemSwapSession,
  type SwapOutcome,
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
import { applyPlayTime, applyRoundEnd, applyRoundStart } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game';

/** What the result card says about the round that just ended (§5, §9). */
export interface LastResult {
  readonly score: number;
  readonly colors: ColorCount;
  readonly endReason: EndReason;
  /** Ended by 30 swaps or stuck — the rounds a best is made of (§5). */
  readonly counted: boolean;
  /** The best for this gem count after the round (0 = none). */
  readonly best: number;
  /** The best before this round, or null while there was none. */
  readonly previousBest: number | null;
  readonly isNewBest: boolean;
}

export interface GemSwapContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The round on screen or suspended (playing or just over); null before the first. */
  session: GemSwapSession | null;
  stats: Stats;
  /** The gem count the next new round starts with (§2). */
  colors: ColorCount;
  tutorialCompleted: boolean;
  /** A started, unfinished round is waiting (§7). */
  canResume: boolean;
  lastResult: LastResult | null;
  setColors: (colors: ColorCount) => void;
  /**
   * "New board": a fresh seed at the preferred gem count, on the game screen.
   * A round still being played is left behind with its time booked and
   * nothing else — it counted as played when it began (§5).
   */
  startNewRound: () => void;
  /** "Retry same board": the same seed and gem count from the first swap (§2, §9). */
  retrySameBoard: () => void;
  /** Back onto the suspended round (§7). */
  resumeRound: () => void;
  /**
   * Tries the swap of two cells (§1). Null when it is not a valid swap — and
   * then nothing at all has changed (§3). Otherwise the move, for the screen
   * to replay, and the round after it.
   */
  swap: (a: number, b: number) => SwapOutcome | null;
  /** Takes the last swap back (§6). False when there is nothing to take back. */
  undo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const GemSwapContext = createContext<GemSwapContextValue | null>(null);

export interface GemSwapProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  /** The suspended round restored from `gs.saveGame` (already through the rules), or null. */
  initialSession: GemSwapSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/** The clock and the entropy are read here, never in game/ (§4). */
const freshSeed = (): string => gemSwapSeed(newSeedToken(Date.now(), Math.random));

export function GemSwapProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: GemSwapProviderProps) {
  /**
   * Whether this launch opens straight onto the suspended round rather than
   * the home screen (issue #113). Decided once, from the records the provider
   * was mounted with. Only a home-screen shortcut asks — a tile on the
   * collection and the browser open this game's home as they always did.
   * There is one slot (§7), and the loader has already turned everything
   * that is not a round still in play into null, so a session at all IS the
   * one suspended round. Quick Rules still come first.
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<GemSwapSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /**
   * The seconds the round this mount holds already carries. There is one
   * slot, so it is the same round whichever door the launch came through —
   * which is why this is not gated on the resume: a launch that stops on the
   * game's own home reaches `syncActiveGame` on a background too, and from a
   * zero baseline that would save `elapsedSeconds: 0` over the suspended
   * round (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (whole seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds of this round already booked into the statistics. The same
   * baseline: a suspended round arrives with its seconds already booked by
   * the sync that saved it, and seeding the clock alone would book them twice.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this round's end has been booked; it happens exactly once (§5). */
  const finalizedRef = useRef(false);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a round's time can be booked and the next one
    // counted inside one tap, and the second write reads this ref — a stale
    // read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: GemSwapSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task —
    // a swap and a background landing together — would otherwise start from
    // the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** The session with the clock's seconds written into it (§7). */
  const withElapsed = useCallback(
    (s: GemSwapSession): GemSwapSession =>
      s.elapsedSeconds === elapsedRef.current ? s : { ...s, elapsedSeconds: elapsedRef.current },
    [],
  );

  /** Books the play seconds `s` carries that are not in the statistics yet. */
  const bookPlayTime = useCallback(
    (s: GemSwapSession) => {
      const unbooked = s.elapsedSeconds - bookedRef.current;
      if (unbooked <= 0) return;
      bookedRef.current = s.elapsedSeconds;
      persistStats(applyPlayTime(statsRef.current, unbooked));
    },
    [persistStats],
  );

  /**
   * Books a round that just ended (§5): its seconds, its score against the
   * best of its gem count (only a round ended by 30 swaps or stuck counts),
   * then removes the slot — a finished round is not something to come back
   * to (§7) — and raises the result.
   */
  const finishRound = useCallback(
    (ended: GemSwapSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      void clearSavedGame();
      const unbooked = Math.max(0, ended.elapsedSeconds - bookedRef.current);
      bookedRef.current = Math.max(bookedRef.current, ended.elapsedSeconds);
      const booking = applyRoundEnd(applyPlayTime(statsRef.current, unbooked), ended.round);
      persistStats(booking.stats);
      if (booking.counted) recordGameCompleted();
      setLastResult({
        score: ended.round.score,
        colors: ended.round.colors,
        endReason: ended.round.endReason ?? 'swaps',
        counted: booking.counted,
        best: booking.best,
        previousBest: booking.previousBest,
        isNewBest: booking.counted && booking.isNewBest,
      });
    },
    [persistStats],
  );

  /**
   * Puts a fresh round on the game screen (§2): counted as played when it
   * starts (§5), its clock at zero, and saved at once — so the slot never
   * still holds a round this one replaced.
   */
  const begin = useCallback(
    (seed: string, colors: ColorCount) => {
      const current = sessionRef.current;
      // A round still being played is left behind: its time is booked, and
      // nothing else — not a best, not a loss (§5).
      if (current && current.round.status === 'playing') bookPlayTime(withElapsed(current));

      const next = createSession(createRound(seed, colors));
      finalizedRef.current = false;
      elapsedRef.current = 0;
      bookedRef.current = 0;
      persistStats(applyRoundStart(statsRef.current));
      setLastResult(null);
      putSession(next);
      setScreen('game');
      void saveGame(next);
    },
    [bookPlayTime, persistStats, putSession, withElapsed],
  );

  const startNewRound = useCallback(() => {
    begin(freshSeed(), prefsRef.current.colors);
  }, [begin]);

  const retrySameBoard = useCallback(() => {
    const current = sessionRef.current;
    if (current) begin(current.round.seed, current.round.colors);
    else begin(freshSeed(), prefsRef.current.colors);
  }, [begin]);

  const resumeRound = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.round.status !== 'playing') return;
    setLastResult(null);
    setScreen('game');
  }, []);

  const swap = useCallback(
    (a: number, b: number): SwapOutcome | null => {
      const current = sessionRef.current;
      if (!current || current.round.status !== 'playing') return null;
      const outcome = trySwap(current.round, a, b);
      if (outcome === null) return null;
      const next: GemSwapSession = { round: outcome.round, elapsedSeconds: elapsedRef.current };
      putSession(next);
      if (next.round.status === 'playing') void saveGame(next);
      else finishRound(next);
      return outcome;
    },
    [finishRound, putSession],
  );

  const undo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current || !canUndo(current.round)) return false;
    const round = undoRound(current.round);
    if (round === null) return false;
    const next: GemSwapSession = { round, elapsedSeconds: elapsedRef.current };
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession]);

  /**
   * Saves the round on screen and books its play time so far — the one seam
   * every way off the game screen and every background passes through, so
   * none of them can forget to save (§7). A finished round was already
   * booked and removed.
   */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.round.status !== 'playing') return;
    const synced = withElapsed(current);
    if (synced !== current) putSession(synced);
    void saveGame(synced);
    bookPlayTime(synced);
  }, [bookPlayTime, putSession, withElapsed]);

  const setColors = useCallback((colors: ColorCount) => {
    if (prefsRef.current.colors === colors) return;
    const next: Prefs = { ...prefsRef.current, colors };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

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

  // Play clock: one second at a time while a round is being played on screen
  // and the page is visible. Mutates the ref only — zero React work per tick.
  const playing = screen === 'game' && session?.round.status === 'playing';
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§7). The same sync as
  // leaving the screen, statistics included: the OS can kill a backgrounded
  // app without another event, and the next launch hands the restored
  // elapsedSeconds back as already booked. Coming back starts nothing — the
  // board waits for a tap, and a cascade replay the background cut short is
  // not resumed (the game screen stops it on the same event, §10).
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
        goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome, completeTutorial]);

  const value = useMemo<GemSwapContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      colors: prefs.colors,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session !== null && session.round.status === 'playing',
      lastResult,
      setColors,
      startNewRound,
      retrySameBoard,
      resumeRound,
      swap,
      undo,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      prefs.colors,
      flags.tutorialCompleted,
      lastResult,
      setColors,
      startNewRound,
      retrySameBoard,
      resumeRound,
      swap,
      undo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <GemSwapContext.Provider value={value}>{children}</GemSwapContext.Provider>;
}

export function useGemSwap(): GemSwapContextValue {
  const value = useContext(GemSwapContext);
  if (!value) throw new Error('useGemSwap must be used inside GemSwapProvider');
  return value;
}
