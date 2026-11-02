/**
 * One match of Backgammon as an immutable value and the transitions that move
 * it (docs/BACKGAMMON_RULES.md §2, §3, §5, §6). Pure: no React, no timers, no
 * storage. The screen's context holds a session and replaces it; the CPU's
 * beats and the persistence replay (persistence.ts) drive the very same
 * functions, so there is one implementation of a turn, not two.
 *
 * A match rests in one of four phases. `opening` is before the first throw;
 * `awaitingRoll` is a side about to throw; `moving` is a side with dice on
 * the table, part-way through placing them (`steps` so far, `dice` still to
 * play, `owed` how much of the roll it must still use — §2.3); `finished` is
 * the end. The turn completes itself the moment nothing more can be played
 * (§2.5): there is no "done" to press.
 */
import { buildView, chooseTurn } from './cpu';
import { diceOf, rollFor, type Roll } from './dice';
import {
  allowedSteps,
  applyStep,
  bestUsage,
  boardKey,
  hasWon,
  resultKindOf,
  type Usage,
} from './engine';
import { createRng } from './rng';
import {
  CPU,
  initialBoard,
  opponentOf,
  PLAYER,
  type Board,
  type Difficulty,
  type GameStatus,
  type ResultKind,
  type Side,
  type Step,
  type Turn,
} from './types';

/**
 * Rolls after which an undecided match is abandoned as no result (§3). A rule,
 * not a validation: a legal match that merely ran long is never thrown away
 * as corrupt. Provisional until the Phase 2 self-play distribution is in (§16).
 */
export const MAX_ROLLS = 2000;

export type Phase =
  | { readonly kind: 'opening' }
  | { readonly kind: 'awaitingRoll'; readonly side: Side }
  | {
      readonly kind: 'moving';
      readonly side: Side;
      readonly roll: Roll;
      /** Dice still to play this turn. */
      readonly dice: readonly number[];
      /** Steps played this turn, in order. */
      readonly steps: readonly Step[];
      /** The board when this turn began — what "待った" returns towards (§6). */
      readonly turnStart: Board;
      /** How many dice and pips this turn must still use (§2.3). */
      readonly owed: Usage;
      /** The CPU's chosen whole turn, replayed one step a beat; null for the player. */
      readonly plan: Turn | null;
    }
  | { readonly kind: 'finished' };

export interface OpeningResult {
  readonly player: number;
  readonly cpu: number;
  readonly winner: Side;
}

export interface LastTurn {
  readonly side: Side;
  readonly steps: Turn;
  /** True when the side had no legal step and the turn passed by itself (§2.4). */
  readonly passed: boolean;
}

export interface MatchResult {
  readonly winner: Side;
  readonly kind: ResultKind;
}

export interface BackgammonSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly board: Board;
  readonly phase: Phase;
  /** Rolls completed so far, the opening throws included (§4). */
  readonly rollIndex: number;
  /** Every completed turn that moved a checker, in order — the record's input (§9). */
  readonly turns: readonly Turn[];
  readonly status: GameStatus;
  readonly result: MatchResult | null;
  readonly opening: OpeningResult | null;
  readonly lastTurn: LastTurn | null;
  /** The dice most recently thrown and by whom — what the screen draws, even after a pass. */
  readonly lastRoll: { readonly side: Side; readonly roll: Roll } | null;
  readonly elapsedSeconds: number;
}

/** A fresh token for a new match: the clock and a random tail, never reused. */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `backgammon-${token}`;

export function createSession(difficulty: Difficulty, seed: string): BackgammonSession {
  return {
    seed,
    difficulty,
    board: initialBoard(),
    phase: { kind: 'opening' },
    rollIndex: 0,
    turns: [],
    status: 'playing',
    result: null,
    opening: null,
    lastTurn: null,
    lastRoll: null,
    elapsedSeconds: 0,
  };
}

const finishedNoResult = (session: BackgammonSession): BackgammonSession => ({
  ...session,
  status: 'noResult',
  phase: { kind: 'finished' },
});

/**
 * A side has thrown `roll`: either the turn opens with the dice on the table,
 * or — with no legal step at all — it passes on the spot (§2.4). A pass is
 * not written to `turns`; it is derived whenever the match is replayed.
 */
function beginTurn(session: BackgammonSession, side: Side, roll: Roll): BackgammonSession {
  const dice = diceOf(roll);
  const owed = bestUsage(session.board, side, dice);
  const lastRoll = { side, roll };
  if (owed.count === 0) {
    const passed: BackgammonSession = {
      ...session,
      lastRoll,
      phase: { kind: 'awaitingRoll', side: opponentOf(side) },
      lastTurn: { side, steps: [], passed: true },
    };
    return session.rollIndex >= MAX_ROLLS ? finishedNoResult(passed) : passed;
  }
  return {
    ...session,
    lastRoll,
    phase: {
      kind: 'moving',
      side,
      roll,
      dice,
      steps: [],
      turnStart: session.board,
      owed,
      plan: null,
    },
  };
}

/**
 * The opening (§1): one die each, the higher starting with both; equal dice
 * are thrown again, each attempt counting as a roll (§4).
 */
export function doOpening(session: BackgammonSession): BackgammonSession | null {
  if (session.phase.kind !== 'opening' || session.status !== 'playing') return null;
  let rollIndex = session.rollIndex;
  for (;;) {
    if (rollIndex >= MAX_ROLLS) return finishedNoResult({ ...session, rollIndex });
    const roll = rollFor(session.seed, rollIndex);
    rollIndex += 1;
    const [player, cpu] = roll;
    if (player === cpu) continue;
    const winner: Side = player > cpu ? PLAYER : CPU;
    const opened: BackgammonSession = { ...session, rollIndex, opening: { player, cpu, winner } };
    return beginTurn(opened, winner, roll);
  }
}

/** The player throws (§2.1). Null when it is not the player's throw. */
export function doRoll(session: BackgammonSession): BackgammonSession | null {
  if (session.status !== 'playing') return null;
  if (session.phase.kind !== 'awaitingRoll' || session.phase.side !== PLAYER) return null;
  return rollFor_(session, PLAYER);
}

function rollFor_(session: BackgammonSession, side: Side): BackgammonSession {
  const roll = rollFor(session.seed, session.rollIndex);
  return beginTurn({ ...session, rollIndex: session.rollIndex + 1 }, side, roll);
}

/** The steps the moving side may play next (§2.3, §7); empty outside a turn. */
export function currentAllowedSteps(session: BackgammonSession): Step[] {
  const phase = session.phase;
  if (phase.kind !== 'moving') return [];
  return allowedSteps(session.board, phase.side, phase.dice, phase.owed);
}

/** The moving side's turn is over: book it, decide the match or hand over (§3). */
function completeTurn(session: BackgammonSession, side: Side, steps: Turn): BackgammonSession {
  const turns = [...session.turns, steps];
  const lastTurn: LastTurn = { side, steps, passed: false };
  if (hasWon(session.board, side)) {
    return {
      ...session,
      turns,
      lastTurn,
      status: side === PLAYER ? 'won' : 'lost',
      result: { winner: side, kind: resultKindOf(session.board, side) },
      phase: { kind: 'finished' },
    };
  }
  const next: BackgammonSession = {
    ...session,
    turns,
    lastTurn,
    phase: { kind: 'awaitingRoll', side: opponentOf(side) },
  };
  return session.rollIndex >= MAX_ROLLS ? finishedNoResult(next) : next;
}

/**
 * One step of the moving side's turn, whichever side that is — the single
 * door every step goes through (§2.5). Null when the step is not among the
 * allowed ones. The turn completes itself when nothing is owed any more.
 */
export function applyTurnStep(session: BackgammonSession, step: Step): BackgammonSession | null {
  const phase = session.phase;
  if (session.status !== 'playing' || phase.kind !== 'moving') return null;
  const legal = allowedSteps(session.board, phase.side, phase.dice, phase.owed).some(
    (s) => s.from === step.from && s.die === step.die,
  );
  if (!legal) return null;
  const effect = applyStep(session.board, phase.side, step);
  if (effect === null) return null;
  const index = phase.dice.indexOf(step.die);
  const dice = [...phase.dice.slice(0, index), ...phase.dice.slice(index + 1)];
  const steps = [...phase.steps, step];
  const owed: Usage = { count: phase.owed.count - 1, sum: phase.owed.sum - step.die };
  const moved: BackgammonSession = { ...session, board: effect.board };
  if (owed.count === 0) return completeTurn(moved, phase.side, steps);
  return { ...moved, phase: { ...phase, dice, steps, owed } };
}

/** The player's step (§2.5): the same door, with the side checked. */
export function applyPlayerStep(session: BackgammonSession, step: Step): BackgammonSession | null {
  if (session.phase.kind !== 'moving' || session.phase.side !== PLAYER) return null;
  return applyTurnStep(session, step);
}

/** Whether 待った has a step to take back (§6). */
export const canUndoStep = (session: BackgammonSession): boolean =>
  session.status === 'playing' &&
  session.phase.kind === 'moving' &&
  session.phase.side === PLAYER &&
  session.phase.steps.length > 0;

/**
 * 待った (§6): the last step of the player's current turn is unmade. The
 * board is rebuilt from the turn's start so that a hit is un-hit too. Null
 * when there is nothing to take back.
 */
export function undoStep(session: BackgammonSession): BackgammonSession | null {
  if (!canUndoStep(session)) return null;
  const phase = session.phase as Extract<Phase, { kind: 'moving' }>;
  const steps = phase.steps.slice(0, -1);
  let board = phase.turnStart;
  for (const step of steps) {
    const effect = applyStep(board, PLAYER, step);
    if (effect === null) return null;
    board = effect.board;
  }
  const full = diceOf(phase.roll);
  const dice = [...full];
  for (const step of steps) dice.splice(dice.indexOf(step.die), 1);
  const startOwed = bestUsage(phase.turnStart, PLAYER, full);
  const used = steps.reduce((sum, step) => sum + step.die, 0);
  const owed: Usage = { count: startOwed.count - steps.length, sum: startOwed.sum - used };
  return { ...session, board, phase: { ...phase, dice, steps, owed } };
}

export type CpuBeat = 'roll' | 'step';

/** What the CPU owes next, or null when it is not the CPU's turn (§5.4). */
export function cpuBeatOwed(session: BackgammonSession): CpuBeat | null {
  if (session.status !== 'playing') return null;
  const phase = session.phase;
  if (phase.kind === 'awaitingRoll' && phase.side === CPU) return 'roll';
  if (phase.kind === 'moving' && phase.side === CPU) return 'step';
  return null;
}

/**
 * The CPU throws and, unless `plan` is false, decides its whole turn at once
 * (§5). The tie-break float is drawn from `${seed}:cpu:${rollIndex}` — the
 * roll index after this throw, which the record carries (§5.1). The replay
 * passes `plan: false`: it takes the CPU's steps from the record and only
 * checks them for legality (§9.1).
 */
export function applyCpuRoll(session: BackgammonSession, plan: boolean = true): BackgammonSession | null {
  if (cpuBeatOwed(session) !== 'roll') return null;
  const rolled = rollFor_(session, CPU);
  if (!plan || rolled.phase.kind !== 'moving') return rolled;
  return planCpuTurn(rolled);
}

/**
 * The last few CPU plans, by the position they answer. The plan is a pure
 * function of (seed, roll index, strength, board, dice), and two callers ask
 * for the same one in quick succession: a save that winds the CPU's turn
 * forward to the canonical state (§9.2) and the beat that then plays it on
 * screen (§5.4). Remembering the answer keeps the search to one per turn
 * without changing what it returns.
 */
const PLAN_CACHE_LIMIT = 8;
const planCache = new Map<string, Turn>();

/** Decides the CPU's turn for a `moving` CPU phase that has no plan yet. */
export function planCpuTurn(session: BackgammonSession): BackgammonSession {
  const phase = session.phase;
  if (phase.kind !== 'moving' || phase.side !== CPU || phase.plan !== null) return session;
  const key = `${session.seed}:${session.rollIndex}:${session.difficulty}:${boardKey(session.board)}:${phase.dice.join('')}`;
  let turn = planCache.get(key);
  if (turn === undefined) {
    const view = buildView(session.board, CPU, session.difficulty, phase.dice);
    const tieBreak = createRng(`${session.seed}:cpu:${session.rollIndex}`)();
    turn = chooseTurn(view, tieBreak).turn;
    planCache.set(key, turn);
    if (planCache.size > PLAN_CACHE_LIMIT) {
      const oldest = planCache.keys().next().value;
      if (oldest !== undefined) planCache.delete(oldest);
    }
  }
  return { ...session, phase: { ...phase, plan: turn } };
}

/** The CPU plays the next step of its plan (§5.4). Null when none is owed. */
export function applyCpuStep(session: BackgammonSession): BackgammonSession | null {
  if (cpuBeatOwed(session) !== 'step') return null;
  const planned = planCpuTurn(session);
  const phase = planned.phase as Extract<Phase, { kind: 'moving' }>;
  const step = phase.plan?.[phase.steps.length];
  if (!step) {
    // A plan the engine could not finish is a position this game cannot be in.
    return null;
  }
  return applyTurnStep(planned, step);
}

/** Whether a session value could have come from play — the fail-closed floor for restores. */
export function isPlayable(session: BackgammonSession): boolean {
  return session.status === 'playing' && session.phase.kind !== 'finished';
}

export type { Board, Difficulty, GameStatus, Side, Step, Turn };
