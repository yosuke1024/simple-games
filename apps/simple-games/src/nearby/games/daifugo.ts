import {
  createSession,
  step,
  exchanged,
  sortedHand,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/daifugo/game/index';
import type { GroupGame } from '../groupSession';
import { integer, record } from '../gameTypes';
import { exactKeys } from './validation';
import {
  cardView,
  cardList,
  seatList,
  publicEvent,
  hostRandom,
  places,
  type CardView,
} from './groupCards';
export interface DaifugoView extends CardView {
  table: number[];
  passed: number[];
  revolution: boolean;
  exchangeCount: number;
}
interface Full extends Session {
  choices: Record<number, number[]>;
}
export function isDaifugoView(v: unknown, you?: number): v is DaifugoView {
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
      'passed',
      'revolution',
      'exchangeCount',
    ]) &&
    cardList(v.table) &&
    v.table.length <= 4 &&
    seatList(v.passed) &&
    typeof v.revolution === 'boolean' &&
    integer(v.exchangeCount, 0, 2)
  );
}
export function projectDaifugo(s: Full, you: number): DaifugoView {
  return {
    you,
    turn: s.turn,
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    order: [...s.order],
    over: s.status !== 'playing',
    event: publicEvent(s.event, you),
    table: [...s.table],
    passed: [...s.passed],
    revolution: s.revolution,
    exchangeCount: s.phase === 'exchange' ? Math.max(0, 2 - s.previousOrder.indexOf(you as 0)) : 0,
  };
}
const over = (s: unknown) =>
  record(s) && (s.over === true || s.status === 'won' || s.status === 'lost');
export const game: GroupGame = {
  id: 'daifugo',
  capacity: 4,
  create: (previous) => ({
    ...createSession(0, previous ? (previous as Full).order : [], hostRandom, true),
    choices: {},
  }),
  valid: isDaifugoView,
  project: (s, you) => projectDaifugo(s as Full, you),
  turn: (s) => (s as Full).turn,
  finished: over,
  apply: (raw, seat, a) => {
    const s = raw as Full;
    if (s.status !== 'playing' || s.turn !== seat || !record(a)) return null;
    if (s.phase === 'exchange') {
      const count = 2 - s.previousOrder.indexOf(seat as 0);
      if (
        !exactKeys(a, ['kind', 'cards']) ||
        a.kind !== 'exchange' ||
        !cardList(a.cards) ||
        a.cards.length !== count ||
        !a.cards.every((c) => s.hands[seat]!.includes(c))
      )
        return null;
      const choices = { ...s.choices, [seat]: [...a.cards] };
      if (Object.keys(choices).length === 2) return { ...exchanged(s, null, choices), choices: {} };
      return { ...s, choices, turn: s.previousOrder[1]! };
    }
    if (!(
      (a.kind === 'pass' && exactKeys(a, ['kind'])) ||
      (a.kind === 'play' && exactKeys(a, ['kind', 'cards']) && cardList(a.cards))
    ))
      return null;
    return step(s, a as Action);
  },
  cpu: (raw) => {
    const s = raw as Full;
    return s.phase === 'exchange'
      ? {
          kind: 'exchange',
          cards: sortedHand(s.hands[s.turn]!).slice(0, 2 - s.previousOrder.indexOf(s.turn)),
        }
      : chooseCpuMove(cpuView(s));
  },
  result: (s) =>
    over(s) ? { scores: places((s as Full).order), winner: (s as Full).order[0] ?? null } : null,
};
