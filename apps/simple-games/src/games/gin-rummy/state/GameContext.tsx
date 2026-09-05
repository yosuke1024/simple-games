/**
 * Gin Rummy's app context: screens, the active match, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surfaces are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played. The CPU's turn is a scheduled
 * effect, not a callback chain: whenever the session says the CPU is to move on
 * the game screen, one timeout is armed, and unmounting — or anything that
 * changes the session first, a new match, leaving the screen — disarms it
 * (docs/GAME_LIFECYCLE.md).
 *
 * The CPU takes **one beat per action**, not one per turn: it draws, the effect
 * sees it is still the CPU to move and arms again, and it puts a card down.
 * That is two beats of `CPU_DELAY_MS` for an ordinary turn, and it is why the
 * effect depends on the session itself rather than on "is it my turn" — every
 * transition re-evaluates it. Resuming a match saved on the CPU's turn needs
 * nothing special for the same reason: the effect sees whose turn it is and
 * plays it, whether the session arrived from a deal or from the store.
 *
 * **There is no undo here, and no place to add one.** The session layer does
 * not offer it (game/session.ts): taking a move back after seeing the reply
 * would hand back a card you now know the opponent wanted, and no take-back
 * undoes knowing it.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either; elapsed time is merged into the session whenever it leaves this
 * module (saves, finalization, navigation).
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
  applyCpuStep,
  canDealNextHand as canDeal,
  CPU,
  createSession,
  doDiscard,
  doDrawDiscard,
  doDrawStock,
  doKnock,
  doNextHand,
  doPassUpcard,
  doTakeUpcard,
  isCpuTurn,
  YOU,
  type Card,
  type Difficulty,
  type GinRummySession,
  type HandOutcome,
  type MatchStatus,
  type PublicEvent,
  type TurnOutcome,
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

/**
 * One beat of the CPU's turn, so a turn reads as a turn. A whole turn is two
 * of these — the card it takes, then the card it throws — because the screen
 * wants to show them in that order, which is the order they happen in.
 */
export const CPU_DELAY_MS = 450;

/** What just happened at the table, for the screen's sounds and marks. */
export interface LastEvent {
  /** Public by construction: a stock draw says a card was taken, not which. */
  readonly event: PublicEvent;
  /** Identity: one screen effect per action, replays excluded. */
  readonly moveCount: number;
}

/** The match's end, told from the player's side of the table. */
export interface LastResult {
  readonly status: MatchStatus;
  readonly mine: number;
  readonly theirs: number;
}

export interface GinRummyContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: GinRummySession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastEvent: LastEvent | null;
  /** The settled hand waiting to be shown, or null mid-hand. */
  handResult: HandOutcome | null;
  /** Whether the settled hand is waiting for the next deal. */
  canDealNextHand: boolean;
  /** Set once the match itself is over. Null while one is being played. */
  lastResult: LastResult | null;
  /** Which opponent the next match is dealt against. Never changes one in play. */
  difficulty: Difficulty;
  setDifficulty: (value: Difficulty) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** The upcard, taken or refused — the one choice a hand opens with. */
  takeUpcard: () => boolean;
  passUpcard: () => boolean;
  /** The draw: the face-down stock, or the pile's top. */
  drawStock: () => boolean;
  drawDiscard: () => boolean;
  /** The card put down. False when the rules or the turn order refuse it. */
  discard: (card: Card) => boolean;
  /** Puts a card down and declares. False unless the hand is under the limit. */
  knock: (card: Card) => boolean;
  /** Deals the hand after a settled one. False when none is waiting. */
  dealNextHand: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const GinRummyContext = createContext<GinRummyContextValue | null>(null);

export interface GinRummyProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: GinRummySession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function GinRummyProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: GinRummyProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match instead of the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means what it meant when it happened, and a match
   * saved or cleared afterwards cannot reach back and change it.
   *
   * Only a pinned home-screen shortcut asks. There is one match slot (§9), and
   * the loader has already answered the whole question — a record the decoder
   * refuses, a history that could not have been played, a move count that
   * disagrees with the hand, a finished match: all of them come back null — so
   * a session here IS the one match there is to come back to, the same fact
   * `canResume` states to the home screen. Nothing is guessed and nothing is
   * ranked, because with one slot there is never a second candidate.
   *
   * Quick Rules still come first (§10). A save can outlive a lost flag, and
   * teaching the game before showing a table has no exception.
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  // Resume, or exactly what this line has always said. `resumeAtMount` already
  // answers false until Quick Rules are behind the player, so the gate lives in
  // one place rather than two — written twice, each copy covers for the other
  // and neither can be seen to fail, and a guard nothing can observe failing is
  // not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<GinRummySession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);
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
   * slot, so it is the same session whichever door the launch came through
   * — which is why this is not gated on the resume: a launch that stops on
   * the game's own home reaches `syncActiveGame` too, and from a zero
   * baseline that saves `elapsedSeconds: 0` over the suspended board
   * (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   *
   * Starts on the mounted game rather than at zero, because every save merges
   * this ref into the session and `syncActiveGame` runs on any background,
   * not only from the game screen. `activate` re-establishes the baseline
   * whenever a game comes on screen; this line covers the mount before that.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this match.
   *
   * The same baseline, and it has to be: a suspended game arrives with its
   * seconds already in `totalPlaySeconds` — they were booked by the sync
   * that saved it. Seeding the clock alone would book its whole elapsed
   * time a second time. The two are one invariant; neither moves without
   * the other.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: GinRummySession): GinRummySession => {
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
   * its result, once. A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: GinRummySession) => {
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
  const putSession = useCallback((next: GinRummySession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: GinRummySession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      // The review question counts games *won* (docs/REVIEW_PROMPT_POLICY.md),
      // and the win here is the match — a hundred points — not a hand. A hand
      // is an inning; asking after one would ask a dozen times an evening.
      if (next.status === 'won') recordGameCompleted();
      setLastResult({ status: next.status, mine: next.scores[YOU], theirs: next.scores[CPU] });
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: GinRummySession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A table that arrives rather than plays out has no card to animate.
    setLastEvent(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  /**
   * The opponent the *next* match is dealt against. A match in progress keeps
   * the one it was started against until it ends — this never touches it.
   *
   * The ref is what `startNewGame` reads, and both can fire from one tap on the
   * home screen — pick an opponent, then deal. React has not re-rendered in
   * between, so the ref is advanced here rather than in the next render.
   */
  const setDifficulty = useCallback((value: Difficulty) => {
    if (prefsRef.current.difficulty === value) return;
    const next = { ...prefsRef.current, difficulty: value };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

      const next = createSession(difficulty);
      finalizedRef.current = false;
      // Dealing against an opponent is itself the choice of one, so the
      // preference follows the table rather than only a separate picker.
      setDifficulty(difficulty);
      persistStats(applyGameStart(statsRef.current, difficulty));
      setLastResult(null);
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, setDifficulty, withElapsed],
  );

  /**
   * One action by the player, whichever it is. The session layer answers null
   * when the rules or the turn order refuse it, and the screen only offers what
   * is legal — so a stray tap is nothing, silently.
   */
  const dispatch = useCallback(
    (play: (current: GinRummySession) => TurnOutcome | null): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = play(withElapsed(current));
      if (!outcome) return false;
      setLastEvent({ event: outcome.event, moveCount: outcome.session.moveCount });
      commitSession(outcome.session);
      return true;
    },
    [commitSession, withElapsed],
  );

  const takeUpcard = useCallback(() => dispatch(doTakeUpcard), [dispatch]);
  const passUpcard = useCallback(() => dispatch(doPassUpcard), [dispatch]);
  const drawStock = useCallback(() => dispatch(doDrawStock), [dispatch]);
  const drawDiscard = useCallback(() => dispatch(doDrawDiscard), [dispatch]);
  const discard = useCallback(
    (card: Card) => dispatch((current) => doDiscard(current, card)),
    [dispatch],
  );
  const knock = useCallback(
    (card: Card) => dispatch((current) => doKnock(current, card)),
    [dispatch],
  );

  /**
   * The next deal, after the settled hand has been shown. It is a tap rather
   * than a timer: the hand's result is the one thing in this game worth
   * reading, and nothing should take it off the screen on its own.
   */
  const dealNextHand = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = doNextHand(withElapsed(current));
    if (!next) return false;
    // A fresh deal arrives rather than plays out: no card to animate.
    setLastEvent(null);
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with the CPU to move. Depends on the session itself, so each
  // transition arms the next beat — draw, then discard — and so any change
  // (a new match, leaving the screen, unmounting) disarms a stale one via the
  // cleanup. The landed timeout asks again before it plays, because the
  // session it was armed for may no longer be the one on screen.
  useEffect(() => {
    if (screen !== 'game' || !session || !isCpuTurn(session)) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || !isCpuTurn(current)) return;
      const outcome = applyCpuStep(withElapsed(current));
      if (!outcome) return;
      setLastEvent({ event: outcome.event, moveCount: outcome.session.moveCount });
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

  // Save when the app goes to background / gets hidden. This is the same sync
  // as leaving the screen, statistics included: the OS can kill a backgrounded
  // app without sending another event, and the next launch hands the restored
  // elapsedSeconds back as *already booked*. Saving the table alone here would
  // drop every play second since the last sync for good.
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

  const value = useMemo<GinRummyContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastEvent,
      handResult: session?.lastHand ?? null,
      canDealNextHand: session !== null && canDeal(session),
      lastResult,
      difficulty: prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      takeUpcard,
      passUpcard,
      drawStock,
      drawDiscard,
      discard,
      knock,
      dealNextHand,
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
      lastEvent,
      lastResult,
      prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      takeUpcard,
      passUpcard,
      drawStock,
      drawDiscard,
      discard,
      knock,
      dealNextHand,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <GinRummyContext.Provider value={value}>{children}</GinRummyContext.Provider>;
}

export function useGinRummy(): GinRummyContextValue {
  const value = useContext(GinRummyContext);
  if (!value) throw new Error('useGinRummy must be used inside GinRummyProvider');
  return value;
}
