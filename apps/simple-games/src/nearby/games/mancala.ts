import { isGameOver, sow, sweepRemaining } from '../../games/mancala/game/engine';
import { initialPits, isValidPits, type Pits } from '../../games/mancala/game/types';
import type { LastMove } from '../../games/mancala/game/session';
import { defineGame, type Seat } from '../gameTypes';
import { exactKeys, integer, record } from './validation';

export interface MancalaView {
  pits: Pits;
  turn: Seat;
  last: LastMove | null;
}
export type MancalaAction = { kind: 'sow'; pit: number };
export function isMancalaView(v: unknown): v is MancalaView {
  if (
    !record(v) ||
    !exactKeys(v, ['pits', 'turn', 'last']) ||
    !Array.isArray(v.pits) ||
    !isValidPits(v.pits) ||
    !integer(v.turn, 0, 1)
  )
    return false;
  if (v.last === null) return true;
  const m = v.last;
  return (
    record(m) &&
    exactKeys(m, ['by', 'pit', 'captured', 'extraTurn', 'lastIndex', 'touched', 'moveCount']) &&
    integer(m.by, 1, 2) &&
    integer(m.pit, 0, 12) &&
    m.pit !== 6 &&
    integer(m.captured, 0, 48) &&
    typeof m.extraTurn === 'boolean' &&
    integer(m.lastIndex, 0, 13) &&
    integer(m.moveCount, 1, 100000) &&
    Array.isArray(m.touched) &&
    m.touched.length <= 48 &&
    m.touched.every((n: unknown) => integer(n, 0, 13))
  );
}
export const adapter = defineGame<MancalaView, MancalaView, MancalaAction>({
  id: 'mancala',
  create: () => ({ pits: initialPits(), turn: 0, last: null }),
  project: (s) => ({
    ...s,
    pits: [...s.pits],
    last: s.last && { ...s.last, touched: [...s.last.touched] },
  }),
  isView: isMancalaView,
  isAction: (v): v is MancalaAction =>
    record(v) &&
    exactKeys(v, ['kind', 'pit']) &&
    v.kind === 'sow' &&
    integer(v.pit, 0, 12) &&
    v.pit !== 6,
  turn: (s) => s.turn,
  finished: (s) => isGameOver(s.pits),
  apply: (s, seat, action) => {
    if (isGameOver(s.pits) || s.turn !== seat) return null;
    const by = seat === 0 ? 1 : 2;
    const result = sow(s.pits, by, action.pit);
    if (!result) return null;
    const { pits, ...details } = result;
    return {
      pits: isGameOver(pits) ? sweepRemaining(pits) : pits,
      turn: result.extraTurn ? seat : seat === 0 ? 1 : 0,
      last: { ...details, by, pit: action.pit, moveCount: (s.last?.moveCount ?? 0) + 1 },
    };
  },
  result: (s) => ({
    scores: [s.pits[6]!, s.pits[13]!],
    winner: !isGameOver(s.pits)
      ? null
      : s.pits[6] === s.pits[13]
        ? 'draw'
        : s.pits[6]! > s.pits[13]!
          ? 0
          : 1,
  }),
});
