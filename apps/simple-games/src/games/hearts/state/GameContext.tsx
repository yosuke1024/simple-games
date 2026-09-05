/**
 * Hearts' app context: screens, the active match, statistics, and persistence.
 * Pure local state — no analytics, no ad orchestration; the only ad surfaces
 * are the shared BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played. The table's next beat is a
 * scheduled effect, not a callback chain: whenever the game screen shows a
 * session with a beat owing, one timeout is armed, and unmounting — or anything
 * that changes the session first, a new match, leaving the screen — disarms it
 * (docs/GAME_LIFECYCLE.md).
 *
 * **This is the shelf's first chained turn.** The four CPU titles before it
 * answered one move with one move; here the player puts a card down and up to
 * four beats follow — the three other seats, and then the finished trick being
 * folded away — and if the seat that took the trick is a CPU the chain runs
 * straight on into the next one. It is still one timer. The effect depends on
 * the session itself, so every transition re-evaluates what is owed and arms
 * the next single beat; nothing polls, nothing looks ahead, and the landed
 * timeout asks the ref what is owed *now* before it does anything, because the
 * session it was armed against may no longer be the one on screen.
 *
 * The beats resolve in the order the game defines them (game/session.ts):
 * a settled hand, then a finished trick, then whichever CPU seat is due. The
 * first of those is where the chain deliberately **stops** — dealing the next
 * hand is the player's tap, because the hand's score is the one thing here
 * worth reading and nothing should take it off the screen on its own. Resuming
 * a match saved on a CPU seat's turn, or on a trick nobody has taken in yet,
 * needs nothing special for the same reason: the effect looks at the session it
 * is given, whether that arrived from a deal or from the store.
 *
 * **There is no undo here, and no place to add one.** The session layer does
 * not offer it (game/session.ts): taking a card back after watching three
 * replies would hand back a card you now know was safe, and no take-back undoes
 * knowing it. Help arrives instead as `playable` — the cards the rules allow,
 * always on screen.
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
  canCollectTrick,
  canConfirmPass as canConfirm,
  canDealNextHand as canDeal,
  createSession,
  doCollectTrick,
  doConfirmPass,
  doNextHand,
  doPlayCard,
  doSelectPassCard,
  doUnselectPassCard,
  isCpuTurn,
  playableCards,
  type BySeat,
  type Card,
  type Difficulty,
  type ExchangeOutcome,
  type HandOutcome,
  type HeartsSession,
  type MatchStatus,
  type TurnEvent,
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
 * One beat of the table, so a beat reads as a beat. It paces three different
 * things — a CPU seat committing its pass, a CPU seat playing a card, and the
 * finished trick being folded towards whoever took it — because to the eye they
 * are the same thing: one event, then a moment to see it.
 */
export const CPU_DELAY_MS = 450;

/** What just happened at the table, for the screen's sounds and marks. */
export interface LastEvent {
  /** Public by construction: a pass beat says a seat committed, not what. */
  readonly event: TurnEvent;
  /**
   * Set when this beat was the fourth confirmation and twelve cards changed
   * hands at once. It is the only moment the exchange exists — the session
   * keeps no record of it afterwards — so the screen is handed it here.
   */
  readonly exchange: ExchangeOutcome | null;
  /**
   * Identity: one screen effect per beat, replays excluded. Every beat that
   * produces an event advances the session's count by exactly one, and the
   * count runs on across hands, so it doubles as the beat's serial number for
   * the whole match. Picking pass cards up and putting them down produces no
   * event and no beat, which is why staging never re-fires a sound.
   */
  readonly moveCount: number;
}

/** The match's end, told as the four totals it finished on. */
export interface LastResult {
  readonly status: MatchStatus;
  /**
   * Final match points, indexed by seat. Four seats and no "mine and theirs":
   * the player's standing is a place in a column, not a difference from one
   * opponent.
   */
  readonly scores: BySeat<number>;
}

export interface HeartsContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: HeartsSession | null;
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
  /** How strong the next match's three opponents are. Never changes one in play. */
  difficulty: Difficulty;
  setDifficulty: (value: Difficulty) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Picks a card out to pass, or puts it back. Staging, not a move. */
  selectPassCard: (card: Card) => boolean;
  unselectPassCard: (card: Card) => boolean;
  /** Whether the player's three are chosen and may be committed. */
  canConfirmPass: boolean;
  /** Commits the player's three. The fourth confirmation moves all twelve. */
  confirmPass: () => boolean;
  /**
   * The cards the rules allow right now, ascending — the whole of this game's
   * help (docs/HEARTS_RULES.md §7). Empty when it is not the player's turn.
   */
  playable: readonly Card[];
  /** Plays one card. False when the rules or the turn order refuse it. */
  playCard: (card: Card) => boolean;
  /** Deals the hand after a settled one. False when none is waiting. */
  dealNextHand: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const HeartsContext = createContext<HeartsContextValue | null>(null);

/**
 * The beat the table owes, or null when it owes none and is waiting on the
 * player. This is the whole of the chain: one call answers "what happens next,
 * if anything", and the effect below arms exactly one timer for it.
 *
 * The order is the game's (game/session.ts). A settled hand comes first and
 * returns null on purpose — `doNextHand` is a tap, never a timer.
 */
function beatOwed(session: HeartsSession): ((s: HeartsSession) => TurnOutcome | null) | null {
  if (canDeal(session)) return null;
  if (canCollectTrick(session)) return doCollectTrick;
  if (isCpuTurn(session)) return applyCpuStep;
  return null;
}

export interface HeartsProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: HeartsSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function HeartsProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: HeartsProviderProps) {
  /**
   * Whether this launch opens straight onto the match it left, rather than on
   * the home screen (issue #113). Decided once, from the records the provider
   * was mounted with: a launch means whatever it meant when it happened, and
   * no beat played afterwards can change that. `session` moves with every
   * beat, so asking this as a derived value would keep re-asserting itself
   * and drag the player back to the table after `goHome`.
   *
   * Only a home-screen shortcut asks. The match slot is one match (§9), and
   * `loadSavedGame` hands back null for anything that is not a match to come
   * back to — a decided one, a hand the engine cannot replay, a pass
   * direction or a move count that disagrees with the hand number — so a
   * session that got this far is the one unambiguous answer, and no
   * ambiguity between slots is possible.
   *
   * Quick Rules keep their place at the front: a first launch teaches the
   * game before it deals, and a shortcut is not a way past that (§10).
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  // Resume, or exactly what this line has always said. `resumeAtMount` already
  // answers false until Quick Rules are behind the player, so the rule is
  // stated once rather than twice — written in both places, each would cover
  // for the other, and a guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<HeartsSession | null>(initialSession);
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

  // A match that arrives on screen at mount has its clock already run, and the
  // two numbers `activate` sets when it arrives by a tap are these same two.
  // Starting them at zero would write the restored seconds back down to the
  // seconds since mount on the very next beat (450ms later, unasked); seeding
  // only the live one would book every second already played a second time.
  // The restored elapsed seconds come back as *already counted* (§9).
  const resumedSeconds = resumeAtMount ? (initialSession?.elapsedSeconds ?? 0) : 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(resumedSeconds);
  /** Play seconds already booked into the statistics for this match. */
  const bookedRef = useRef(resumedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: HeartsSession): HeartsSession => {
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
    (match: HeartsSession) => {
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
  const putSession = useCallback((next: HeartsSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: HeartsSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      // The review question counts games *won* (docs/REVIEW_PROMPT_POLICY.md),
      // and the win here is the match — the fewest points when somebody passed
      // a hundred — not a hand and not a share of the lowest score. A hand is
      // an inning; asking after one would ask a dozen times an evening.
      if (next.status === 'won') recordGameCompleted();
      setLastResult({ status: next.status, scores: next.scores });
    },
    [finalizeMatch, putSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: HeartsSession) => {
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
   * How strong the *next* match's opponents are. A match in progress keeps the
   * strength it was dealt against until it ends — this never touches it.
   *
   * The ref is what `startNewGame` reads, and both can fire from one tap on the
   * home screen — pick a strength, then deal. React has not re-rendered in
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
      // Dealing against a strength is itself the choice of one, so the
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
   * One beat by the player, whichever it is. The session layer answers null
   * when the rules or the turn order refuse it, and the screen only offers what
   * is legal — so a stray tap is nothing, silently.
   */
  const dispatch = useCallback(
    (play: (current: HeartsSession) => TurnOutcome | null): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = play(withElapsed(current));
      if (!outcome) return false;
      setLastEvent({
        event: outcome.event,
        exchange: outcome.exchange,
        moveCount: outcome.session.moveCount,
      });
      commitSession(outcome.session);
      return true;
    },
    [commitSession, withElapsed],
  );

  /**
   * Picking the three cards to pass, and putting one back. Staging rather than
   * moves: they change what is on offer and nothing else, so they save the
   * table (a card picked out survives being killed mid-choice) but leave the
   * beat count — and therefore the CPU's tie-break stream — exactly where it
   * was, and produce no event for the screen to animate.
   */
  const stage = useCallback(
    (choose: (current: HeartsSession) => HeartsSession | null): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = choose(withElapsed(current));
      if (!next) return false;
      putSession(next);
      void saveGame(next);
      return true;
    },
    [putSession, withElapsed],
  );

  const selectPassCard = useCallback(
    (card: Card) => stage((current) => doSelectPassCard(current, card)),
    [stage],
  );
  const unselectPassCard = useCallback(
    (card: Card) => stage((current) => doUnselectPassCard(current, card)),
    [stage],
  );
  const confirmPass = useCallback(() => dispatch(doConfirmPass), [dispatch]);
  const playCard = useCallback(
    (card: Card) => dispatch((current) => doPlayCard(current, card)),
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

  // The chain: one armed timeout whenever the game screen shows a session that
  // owes a beat. Depends on the session itself, so each transition arms the
  // next one — your card, three replies, the trick folding away, and straight
  // on into the next trick when a CPU seat took this one — and so any change
  // (a new match, leaving the screen, unmounting) disarms a stale one via the
  // cleanup. The landed timeout asks what is owed *now*, because the session it
  // was armed for may no longer be the one on screen.
  useEffect(() => {
    if (screen !== 'game' || !session || beatOwed(session) === null) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current) return;
      const beat = beatOwed(current);
      if (beat === null) return;
      const outcome = beat(withElapsed(current));
      if (!outcome) return;
      setLastEvent({
        event: outcome.event,
        exchange: outcome.exchange,
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

  const playable = useMemo(() => (session === null ? [] : playableCards(session)), [session]);

  const value = useMemo<HeartsContextValue>(
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
      selectPassCard,
      unselectPassCard,
      canConfirmPass: session !== null && canConfirm(session),
      confirmPass,
      playable,
      playCard,
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
      selectPassCard,
      unselectPassCard,
      confirmPass,
      playable,
      playCard,
      dealNextHand,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <HeartsContext.Provider value={value}>{children}</HeartsContext.Provider>;
}

export function useHearts(): HeartsContextValue {
  const value = useContext(HeartsContext);
  if (!value) throw new Error('useHearts must be used inside HeartsProvider');
  return value;
}
