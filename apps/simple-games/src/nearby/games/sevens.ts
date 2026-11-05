import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/sevens/game/index';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import {
  cardView,
  cardList,
  seatList,
  fourNumbers,
  publicEvent,
  hostRandom,
  places,
  type CardView,
} from './groupCards';
export interface SevensView extends CardView {
  table: number[];
  passes: number[];
  finished: number[];
  eliminated: number[];
}
export function isSevensView(v: unknown, you?: number): v is SevensView {
  return (
    cardView(v, you) &&
    record(v) &&
    exactKeys(v, [
      'you',
      'turn',
      'hand',
      'counts',
      'order',
      'over',
      'event',
      'table',
      'passes',
      'finished',
      'eliminated',
    ]) &&
    cardList(v.table, 51) &&
    fourNumbers(v.passes, 4) &&
    seatList(v.finished) &&
    seatList(v.eliminated)
  );
}
export function projectSevens(s: Session, you: number): SevensView {
  return {
    you,
    turn: s.turn,
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    order: [...s.order],
    over: s.status !== 'playing',
    event: publicEvent(s.event, you),
    table: [...s.table],
    passes: [...s.passes],
    finished: [...s.finished],
    eliminated: [...s.eliminated],
  };
}
const over = (s: unknown) =>
  record(s) && (s.over === true || s.status === 'won' || s.status === 'lost');
export const game: GroupGame = {
  id: 'sevens',
  capacity: 4,
  create: () => createSession(0, hostRandom),
  valid: isSevensView,
  project: (s, you) => projectSevens(s as Session, you),
  turn: (s) => (s as Session).turn,
  finished: over,
  apply: (raw, seat, a) => {
    const s = raw as Session;
    if (
      s.turn !== seat ||
      !record(a) ||
      !(
        (a.kind === 'pass' && exactKeys(a, ['kind'])) ||
        (a.kind === 'play' && exactKeys(a, ['kind', 'card']) && integer(a.card, 0, 51))
      )
    )
      return null;
    return step(s, a as Action);
  },
  cpu: (s) => chooseCpuMove(cpuView(s as Session)),
  result: (s) =>
    over(s)
      ? { scores: places((s as Session).order), winner: (s as Session).order[0] ?? null }
      : null,
};
