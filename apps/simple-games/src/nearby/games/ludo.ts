import { buildLudoView, chooseCpuMove } from '../../games/ludo/game/cpu';
import {
  applyMove,
  initialState,
  legalMovesFor,
  MAX_ROLLS,
  rollDieValue,
  type RollOutcome,
} from '../../games/ludo/game/engine';
import {
  HOME_PROGRESS,
  isSeat,
  isValidMatchState,
  SEATS,
  type MatchState,
  type Seat,
} from '../../games/ludo/game/types';
import { exactKeys, integer, record } from './validation';

/** Public four-seat snapshot. The host draws each face; no future RNG state is shared. */
export interface State extends MatchState {
  readonly lastRoll: {
    readonly seat: Seat;
    readonly die: number;
    readonly kind: RollOutcome['kind'];
  } | null;
}

export type Action = { kind: 'roll' } | { kind: 'move'; pawn: 0 | 1 | 2 | 3 };

export function isLudoAction(value: unknown): value is Action {
  return (
    record(value) &&
    ((exactKeys(value, ['kind']) && value.kind === 'roll') ||
      (exactKeys(value, ['kind', 'pawn']) && value.kind === 'move' && integer(value.pawn, 0, 3)))
  );
}

/** Checks public shape and rule invariants, without claiming to prove the host's history. */
export function isLudoState(value: unknown): value is State {
  if (
    !record(value) ||
    !exactKeys(value, ['pawns', 'turn', 'rollIndex', 'sixStreak', 'die', 'result', 'lastRoll'])
  )
    return false;
  if (
    !isSeat(value.turn) ||
    !integer(value.rollIndex, 0, MAX_ROLLS) ||
    !integer(value.sixStreak, 0, Math.min(2, value.rollIndex)) ||
    (value.die !== null && !integer(value.die, 1, 6))
  )
    return false;
  if (
    !Array.isArray(value.pawns) ||
    value.pawns.length !== 4 ||
    !value.pawns.every(
      (pawns: unknown) =>
        Array.isArray(pawns) &&
        pawns.length === 4 &&
        pawns.every((progress: unknown) => integer(progress, 0, HOME_PROGRESS)),
    )
  )
    return false;
  if (
    value.result !== null &&
    (!record(value.result) ||
      !(
        (exactKeys(value.result, ['kind']) && value.result.kind === 'noContest') ||
        (exactKeys(value.result, ['kind', 'winner']) &&
          value.result.kind === 'win' &&
          isSeat(value.result.winner))
      ))
  )
    return false;
  if (
    value.lastRoll !== null &&
    (!record(value.lastRoll) ||
      !exactKeys(value.lastRoll, ['seat', 'die', 'kind']) ||
      !isSeat(value.lastRoll.seat) ||
      !integer(value.lastRoll.die, 1, 6) ||
      typeof value.lastRoll.kind !== 'string' ||
      !['move', 'autoPass', 'thirdSix', 'noContest'].includes(value.lastRoll.kind))
  )
    return false;

  const state = value as unknown as State;
  if (!isValidMatchState(state)) return false;
  const home = SEATS.filter((seat) =>
    state.pawns[seat].every((progress) => progress === HOME_PROGRESS),
  );
  if (state.rollIndex === 0)
    return (
      state.lastRoll === null &&
      state.turn === 0 &&
      state.die === null &&
      state.result === null &&
      state.pawns.every((pawns) => pawns.every((p) => p === 0))
    );
  const last = state.lastRoll;
  if (last === null) return false;
  if (state.result?.kind === 'noContest')
    return (
      state.rollIndex === MAX_ROLLS &&
      state.die === null &&
      home.length === 0 &&
      last.kind === 'noContest' &&
      last.seat === state.turn
    );
  if (state.rollIndex >= MAX_ROLLS || last.kind === 'noContest') return false;
  if (state.result?.kind === 'win')
    return (
      home.length === 1 &&
      home[0] === state.result.winner &&
      state.turn === state.result.winner &&
      state.die === null &&
      last.kind === 'move' &&
      last.seat === state.turn
    );
  if (home.length !== 0) return false;
  if (state.die !== null)
    return (
      last.kind === 'move' &&
      last.seat === state.turn &&
      last.die === state.die &&
      (state.die === 6 ? state.sixStreak > 0 : state.sixStreak === 0) &&
      legalMovesFor(state, state.turn, state.die).length > 0
    );
  if (last.kind === 'thirdSix')
    return (
      last.die === 6 &&
      state.rollIndex >= 3 &&
      state.turn === (last.seat + 1) % 4 &&
      state.sixStreak === 0
    );
  if (last.kind === 'autoPass' && legalMovesFor(state, last.seat, last.die).length !== 0)
    return false;
  return (
    state.turn === (last.die === 6 ? last.seat : (last.seat + 1) % 4) &&
    (last.die === 6 ? state.sixStreak > 0 : state.sixStreak === 0)
  );
}

export function createLudo(random: () => number): State {
  // Initial positions are fixed. The RNG is consumed only when the host accepts a roll.
  void random;
  return { ...initialState(), lastRoll: null };
}

/** The room binds the actor to a seat before calling this; stale/illegal actions do nothing. */
export function applyLudo(
  state: State,
  seat: number,
  action: unknown,
  random: () => number,
): State | null {
  if (!isSeat(seat) || seat !== state.turn || state.result !== null || !isLudoAction(action))
    return null;
  if (action.kind === 'roll') {
    if (state.die !== null) return null;
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid host RNG');
    const outcome = rollDieValue(state, Math.floor(draw * 6) + 1);
    if (outcome === null) return null;
    return { ...outcome.state, lastRoll: { seat, die: outcome.die, kind: outcome.kind } };
  }
  if (state.die === null) return null;
  const move = legalMovesFor(state, seat, state.die).find(
    (candidate) => candidate.pawn === action.pawn,
  );
  if (!move) return null;
  const next = applyMove(state, move);
  return next === null ? null : { ...next, lastRoll: state.lastRoll };
}

/** Same normal CPU for every seat, including a human seat taken over after its roll. */
export function ludoCpuAction(state: State): Action | null {
  if (state.result !== null) return null;
  if (state.die === null) return { kind: 'roll' };
  const view = buildLudoView(state, 'normal');
  // A fixed tie-break is public and cannot reveal or inspect future dice.
  const move = view && chooseCpuMove(view, 0.5);
  return move ? { kind: 'move', pawn: move.pawn } : null;
}

export function ludoResult(state: State): { scores: number[]; winner: number | null } | null {
  if (state.result === null) return null;
  return {
    scores: state.pawns.map(
      (pawns) => pawns.filter((progress) => progress === HOME_PROGRESS).length,
    ),
    winner: state.result.kind === 'win' ? state.result.winner : null,
  };
}
