/**
 * LudoSession — one match as the screen holds it: the seed and the strength it
 * was started at, the board, the pawns the player has chosen so far, and the
 * roll being shown. Pure and immutable, like Hearts' session
 * (src/games/hearts/game/session.ts): the React layer only dispatches into
 * these functions, and all the rules live in engine.ts and cpu.ts.
 *
 * **There is no undo, and no function here to add one to** (§6). The board
 * games' undo works because both players can see everything and neither has
 * been handed anything the other has not; a match against dice is not that.
 * Two shapes of take-back are imaginable here and both break something:
 *
 *   - Undo the move but keep the die, and the player tries one pawn, watches
 *     what it exposes, takes it back and tries the next. That is a look-ahead
 *     over a roll already thrown, which nobody at a real board is offered.
 *   - Undo the roll as well, and the die comes back — every face is
 *     `rollFor(seed, rollIndex)` (dice.ts), fixed before the match started. To
 *     make a take-back feel like a fresh throw the match would have to skip a
 *     roll index, which is a re-roll of a die the rules have already thrown,
 *     and it would cut the one thread the save format hangs from: a match is
 *     its seed plus the player's choices, and nothing else (serialize.ts).
 *
 * Hearts reaches the same conclusion, but what leaks differs, and that is
 * worth being precise about: there, a take-back hands back a card after the
 * other seats' hidden choices have been seen. Here nothing is hidden — every
 * pawn is public — and what a take-back would reach into is the *future* the
 * seed has already settled. Help arrives instead as the always-on list of
 * pawns the player may legally move (`movablePawns`), the same way Hearts
 * offers `playableCards`.
 *
 * **A beat is one thing happening.** A CPU seat's roll and a CPU seat's move
 * are two beats, not one, so the screen can show the die, let it be read, and
 * only then walk the pawn. The caller schedules each beat off session state,
 * so a timer that lands late finds nothing owed and does nothing.
 */
import { buildLudoView, chooseCpuMove } from './cpu';
import { applyMove, legalMovesFor, rollDie, initialState, type RollOutcome } from './engine';
import { createRng } from './rng';
import { isCpuSeat, YOU, type Difficulty, type MatchState, type Seat } from './types';

/**
 * The match's verdict from the player's side of the table. `MatchResult`
 * (types.ts) says who won; this says what that means for the person holding
 * the device, which is what the screen and the statistics ask for. A match
 * stopped by the roll cap (§2.9) is neither a win nor a loss, and it is not a
 * draw either — nobody got home — so it keeps the engine's own word for it.
 */
export type MatchStatus = 'playing' | 'won' | 'lost' | 'noContest';

/**
 * What the screen needs to show about the roll that just happened: the face,
 * who threw it, and whether it left a move to make, passed automatically, ran
 * a third six out, or ended the match at the roll cap.
 *
 * Deliberately **not** the engine's `RollOutcome`. That carries the board as
 * it stood the moment the die landed, and this value outlives that moment —
 * it stays on the session while the pawn moves and the turn passes. A screen
 * handed the whole outcome could read its `state` and draw a board one beat
 * stale, and it would look almost right. The narrower type has nowhere to
 * read a board from, so the mistake is not available.
 */
export interface RollEvent {
  readonly seat: Seat;
  readonly die: number;
  readonly kind: RollOutcome['kind'];
}

export interface LudoSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly state: MatchState;
  /**
   * Which pawn the player chose, in order, one entry per move they made. This
   * is the whole of what a save records about them (serialize.ts) — everything
   * else on this session is derived from the seed and this list.
   */
  readonly choices: readonly (0 | 1 | 2 | 3)[];
  /** The most recent roll, for the screen. Stays put until the next roll is made. */
  readonly lastRoll: RollEvent | null;
  readonly status: MatchStatus;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets new dice — while the seed still
 * pins every face and every CPU answer in the match down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `ludo-${token}`;

export function createSession(
  difficulty: Difficulty,
  seed: string = matchSeed(newSeedToken()),
): LudoSession {
  return {
    seed,
    difficulty,
    state: initialState(),
    choices: [],
    lastRoll: null,
    status: 'playing',
    elapsedSeconds: 0,
  };
}

/** The verdict, said from seat 0's side: only seat 0 winning is a win. */
export function statusOf(state: MatchState): MatchStatus {
  if (state.result === null) return 'playing';
  if (state.result.kind === 'noContest') return 'noContest';
  return state.result.winner === YOU ? 'won' : 'lost';
}

/** Whether the match is still live — a decided match takes no more beats. */
const live = (session: LudoSession): boolean => session.status === 'playing';

/**
 * The tie-break float for the move that answers the roll numbered
 * `rollIndex`, drawn from a stream of its own (`:cpu:` rather than `:dice:`).
 *
 * **The index is the roll's own number, before that roll was counted** — the
 * same value `rollFor` (dice.ts) was given for the face now on the table. A
 * roll and the move it calls for share one index, which is what lets
 * serialize.ts replay a CPU seat's choice without recording it, and what
 * cpu.test.ts and the self-play sweep were both built against.
 */
const cpuTieBreakFor = (seed: string, rollIndex: number): number =>
  createRng(`${seed}:cpu:${rollIndex}`)();

/**
 * The index of the roll whose face is on the table — one behind the count,
 * because `rollDie` advanced the count when it threw it.
 */
const indexOfRollInHand = (state: MatchState): number => state.rollIndex - 1;

/** Rolls once for whoever is on turn, carrying the roll to a stop (engine.ts). */
function rolled(session: LudoSession): LudoSession | null {
  const seat = session.state.turn;
  const outcome = rollDie(session.state, session.seed);
  if (outcome === null) return null;
  return {
    ...session,
    state: outcome.state,
    lastRoll: { seat, die: outcome.die, kind: outcome.kind },
    status: statusOf(outcome.state),
  };
}

// ---------------------------------------------------------------------------
// The player's beats
// ---------------------------------------------------------------------------

/** Whether it is the player's turn and their die is still to be thrown. */
export const canRoll = (session: LudoSession): boolean =>
  live(session) && session.state.turn === YOU && session.state.die === null;

/**
 * The player throws. One call carries the roll all the way to a stop, so it
 * may come back waiting on a move, or already past an automatic pass or a
 * forfeited third six — those are not choices anybody makes (engine.ts).
 * Null when it is not the player's throw to make.
 */
export function doRoll(session: LudoSession): LudoSession | null {
  if (!canRoll(session)) return null;
  return rolled(session);
}

/**
 * The pawns the player may move with the die on the table, ascending. Empty
 * when there is nothing to choose — not their turn, no die thrown yet, or a
 * decided match. This is the help this game offers in place of undo.
 */
export function movablePawns(session: LudoSession): (0 | 1 | 2 | 3)[] {
  if (!live(session) || session.state.turn !== YOU || session.state.die === null) return [];
  return legalMovesFor(session.state, YOU, session.state.die).map((move) => move.pawn);
}

/**
 * The player moves one pawn. Null when it is not their turn, no die is on the
 * table, or that pawn cannot legally take this roll — the screen sinks the
 * pawns it may not move, so a stray tap is nothing, silently.
 *
 * This is the one beat in the whole game that a save records: the chosen pawn
 * is appended to `choices`, and that list plus the seed is the match
 * (serialize.ts).
 */
export function doMovePawn(session: LudoSession, pawn: 0 | 1 | 2 | 3): LudoSession | null {
  if (!live(session) || session.state.turn !== YOU || session.state.die === null) return null;
  const move = legalMovesFor(session.state, YOU, session.state.die).find(
    (candidate) => candidate.pawn === pawn,
  );
  if (move === undefined) return null;
  const state = applyMove(session.state, move);
  if (state === null) return null;
  return {
    ...session,
    state,
    choices: [...session.choices, pawn],
    status: statusOf(state),
  };
}

// ---------------------------------------------------------------------------
// The CPU's beats
// ---------------------------------------------------------------------------

/** One thing a CPU seat owes: a throw, or the move that answers its throw. */
export type CpuBeat =
  | { readonly kind: 'roll'; readonly seat: Seat }
  | { readonly kind: 'move'; readonly seat: Seat; readonly die: number };

/**
 * What a CPU seat is waiting to do, or null when none is — the match is
 * decided, or the seat on turn is the player's. The screen schedules against
 * this the way Hearts' schedules against `cpuSeatToAct`, and the two beats are
 * kept apart on purpose: the die has to be readable on screen before the pawn
 * it moves starts walking.
 */
export function cpuBeatOwed(session: LudoSession): CpuBeat | null {
  if (!live(session)) return null;
  const seat = session.state.turn;
  if (!isCpuSeat(seat)) return null;
  const die = session.state.die;
  return die === null ? { kind: 'roll', seat } : { kind: 'move', seat, die };
}

/** Whether the screen should be scheduling a CPU beat right now. */
export const isCpuTurn = (session: LudoSession): boolean => cpuBeatOwed(session) !== null;

/** A CPU seat throws. Null when no CPU seat owes a throw — a stale schedule does nothing. */
export function applyCpuRoll(session: LudoSession): LudoSession | null {
  const beat = cpuBeatOwed(session);
  if (beat === null || beat.kind !== 'roll') return null;
  return rolled(session);
}

/**
 * A CPU seat answers its own throw. Null when no CPU seat owes a move.
 *
 * The seat is handed a `LudoView` — the public board and the face already
 * thrown, never the seed and never a roll still to come (cpu.ts) — plus one
 * float for ties, keyed on this roll's own index. That key is the whole reason
 * a save can leave the CPU's moves out and still resume into the same match.
 */
export function applyCpuMove(session: LudoSession): LudoSession | null {
  const beat = cpuBeatOwed(session);
  if (beat === null || beat.kind !== 'move') return null;
  const view = buildLudoView(session.state, session.difficulty);
  if (view === null) return null;
  const tieBreak = cpuTieBreakFor(session.seed, indexOfRollInHand(session.state));
  const move = chooseCpuMove(view, tieBreak);
  if (move === null) return null;
  const state = applyMove(session.state, move);
  if (state === null) return null;
  return { ...session, state, status: statusOf(state) };
}
