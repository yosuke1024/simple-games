import {
  allowedSteps,
  applyStep,
  bestUsage,
  hasWon,
  resultKindOf,
  type Usage,
} from '../../games/backgammon/game/engine';
import { diceOf, type Roll } from '../../games/backgammon/game/dice';
import {
  initialBoard,
  type Board,
  type Step,
  type ResultKind,
} from '../../games/backgammon/game/types';
import { defineGame, record, integer, type Seat, type Random } from '../gameTypes';
import { exactKeys } from './validation';
import { copy } from './hidden';
export interface BackgammonView {
  board: Board;
  turn: Seat;
  phase: 'opening' | 'roll' | 'move' | 'finished';
  roll: Roll | null;
  dice: number[];
  owed: Usage;
  rolls: number;
  winner: Seat | 'draw' | null;
  resultKind: ResultKind | null;
}
type Action = { kind: 'roll' } | { kind: 'move'; from: number; die: number };
export const steps = (s: BackgammonView) =>
  s.phase === 'move' ? allowedSteps(s.board, s.turn === 0 ? 1 : 2, s.dice, s.owed) : [];
export function isBackgammonView(v: unknown): v is BackgammonView {
  if (
    !record(v) ||
    !exactKeys(v, [
      'board',
      'turn',
      'phase',
      'roll',
      'dice',
      'owed',
      'rolls',
      'winner',
      'resultKind',
    ]) ||
    !record(v.board) ||
    !exactKeys(v.board, ['points', 'bar', 'off']) ||
    !Array.isArray(v.board.points) ||
    v.board.points.length !== 25 ||
    v.board.points[0] !== 0 ||
    !v.board.points.every((n) => integer(n, -15, 15)) ||
    !Array.isArray(v.board.bar) ||
    v.board.bar.length !== 2 ||
    !v.board.bar.every((n) => integer(n, 0, 15)) ||
    !Array.isArray(v.board.off) ||
    v.board.off.length !== 2 ||
    !v.board.off.every((n) => integer(n, 0, 15)) ||
    !integer(v.turn, 0, 1) ||
    !['opening', 'roll', 'move', 'finished'].includes(String(v.phase)) ||
    !integer(v.rolls, 0, 2000) ||
    (v.roll !== null &&
      (!Array.isArray(v.roll) || v.roll.length !== 2 || !v.roll.every((n) => integer(n, 1, 6)))) ||
    !Array.isArray(v.dice) ||
    v.dice.length > 4 ||
    !v.dice.every((n) => integer(n, 1, 6)) ||
    !record(v.owed) ||
    !exactKeys(v.owed, ['count', 'sum']) ||
    !integer(v.owed.count, 0, 4) ||
    !integer(v.owed.sum, 0, 24) ||
    ![null, 0, 1, 'draw'].includes(v.winner as null) ||
    ![null, 'single', 'gammon', 'backgammon'].includes(v.resultKind as null)
  )
    return false;
  const s = v as unknown as BackgammonView;
  for (const seat of [0, 1] as const)
    if (
      s.board.bar[seat] +
        s.board.off[seat] +
        s.board.points.reduce((n, c) => n + Math.max(0, seat === 0 ? c : -c), 0) !==
      15
    )
      return false;
  if ((s.phase === 'finished') !== (s.winner !== null)) return false;
  if (s.winner === 0 || s.winner === 1) {
    const side = s.winner === 0 ? 1 : 2;
    if (!hasWon(s.board, side) || s.resultKind !== resultKindOf(s.board, side)) return false;
  } else if (s.resultKind !== null || hasWon(s.board, 1) || hasWon(s.board, 2)) return false;
  if (s.winner === 'draw' && s.rolls !== 2000) return false;
  if (
    s.phase === 'opening' &&
    (s.rolls !== 0 || s.roll !== null || JSON.stringify(s.board) !== JSON.stringify(initialBoard()))
  )
    return false;
  if (s.phase !== 'opening' && s.rolls === 0) return false;
  if (s.phase === 'move') {
    if (!s.roll || s.owed.count < 1) return false;
    const available = [...diceOf(s.roll)];
    for (const die of s.dice) {
      const i = available.indexOf(die);
      if (i < 0) return false;
      available.splice(i, 1);
    }
    const best = bestUsage(s.board, s.turn === 0 ? 1 : 2, s.dice);
    return best.count === s.owed.count && best.sum === s.owed.sum && steps(s).length > 0;
  }
  return s.dice.length === 0 && s.owed.count === 0 && s.owed.sum === 0;
}
export const isBackgammonAction = (v: unknown): v is Action =>
  record(v) &&
  ((exactKeys(v, ['kind']) && v.kind === 'roll') ||
    (exactKeys(v, ['kind', 'from', 'die']) &&
      v.kind === 'move' &&
      integer(v.from, 1, 25) &&
      integer(v.die, 1, 6)));
function roll(s: BackgammonView, random: Random): BackgammonView {
  let rolls = s.rolls,
    dice: Roll;
  do {
    dice = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
    rolls++;
  } while (s.phase === 'opening' && dice[0] === dice[1] && rolls < 2000);
  if (rolls >= 2000) return { ...s, rolls, phase: 'finished', winner: 'draw' };
  const turn = s.phase === 'opening' ? (dice[0] > dice[1] ? 0 : 1) : s.turn;
  const remaining = [...diceOf(dice)],
    owed = bestUsage(s.board, turn === 0 ? 1 : 2, remaining);
  return {
    ...s,
    rolls,
    roll: dice,
    turn: owed.count ? turn : turn === 0 ? 1 : 0,
    phase: owed.count ? 'move' : 'roll',
    dice: owed.count ? remaining : [],
    owed,
  };
}
export const adapter = defineGame<BackgammonView, BackgammonView, Action>({
  id: 'backgammon',
  create: () => ({
    board: initialBoard(),
    turn: 0,
    phase: 'opening',
    roll: null,
    dice: [],
    owed: { count: 0, sum: 0 },
    rolls: 0,
    winner: null,
    resultKind: null,
  }),
  project: copy,
  isView: isBackgammonView,
  isAction: isBackgammonAction,
  turn: (s) => s.turn,
  finished: (s) => s.phase === 'finished',
  apply: (s, seat, a, random) => {
    if (seat !== s.turn || s.phase === 'finished') return null;
    if (a.kind === 'roll')
      return s.phase === 'opening' || s.phase === 'roll' ? roll(s, random) : null;
    if (!steps(s).some((step) => step.from === a.from && step.die === a.die)) return null;
    const side = seat === 0 ? 1 : 2,
      moved = applyStep(s.board, side, a as Step);
    if (!moved) return null;
    const dice = [...s.dice];
    dice.splice(dice.indexOf(a.die), 1);
    const owed = { count: s.owed.count - 1, sum: s.owed.sum - a.die };
    if (hasWon(moved.board, side))
      return {
        ...s,
        board: moved.board,
        phase: 'finished',
        winner: seat,
        resultKind: resultKindOf(moved.board, side),
        dice: [],
        owed: { count: 0, sum: 0 },
      };
    return {
      ...s,
      board: moved.board,
      dice: owed.count ? dice : [],
      owed: owed.count ? owed : { count: 0, sum: 0 },
      phase: owed.count ? 'move' : 'roll',
      turn: owed.count ? seat : seat === 0 ? 1 : 0,
    };
  },
  result: (s) => ({ scores: [...s.board.off], winner: s.winner }),
});
