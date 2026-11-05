import {
  dealHand,
  selectPassCard,
  confirmPass,
  playCard,
  collectTrick,
  scoreHand,
} from '../../games/hearts/game/engine';
import { buildCpuView, chooseCpuPass, chooseCpuPlay } from '../../games/hearts/game/cpu';
import {
  bySeat,
  seatToPlay,
  penaltiesTakenIn,
  type HandState,
  type BySeat,
  type Seat,
  type Trick,
} from '../../games/hearts/game/types';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { cardList, fourNumbers, hostRandom } from './groupCards';
interface Full {
  h: HandState;
  scores: BySeat<number>;
  handNumber: number;
  turn: number;
  over: boolean;
}
export interface HeartsView {
  you: number;
  hand: number[];
  counts: number[];
  scores: BySeat<number>;
  taken: BySeat<number>;
  delta: BySeat<number>;
  handNumber: number;
  turn: number;
  over: boolean;
  phase: HandState['phase'];
  passOffset: HandState['passOffset'];
  confirmed: boolean[];
  leader: Seat;
  played: number[];
  tricks: Trick[];
  heartsBroken: boolean;
}
function withTurn(s: Omit<Full, 'turn'>): Full {
  return {
    ...s,
    turn:
      s.h.phase === 'passing'
        ? s.h.confirmed.findIndex((c) => !c)
        : s.h.phase === 'over'
          ? 0
          : (seatToPlay(s.h) ?? -1),
  };
}
export function isHeartsView(v: unknown, you?: number): v is HeartsView {
  if (
    !record(v) ||
    !exactKeys(v, [
      'you',
      'hand',
      'counts',
      'scores',
      'taken',
      'delta',
      'handNumber',
      'turn',
      'over',
      'phase',
      'passOffset',
      'confirmed',
      'leader',
      'played',
      'tricks',
      'heartsBroken',
    ]) ||
    !integer(v.you, 0, 3) ||
    (you !== undefined && v.you !== you) ||
    !cardList(v.hand, 51) ||
    !fourNumbers(v.counts, 13) ||
    v.hand.length !== v.counts[v.you] ||
    !fourNumbers(v.scores, 125) ||
    !fourNumbers(v.taken, 26) ||
    !fourNumbers(v.delta, 26) ||
    !integer(v.handNumber, 1, 100) ||
    !integer(v.turn, -1, 3) ||
    typeof v.over !== 'boolean' ||
    !['passing', 'playing', 'over'].includes(String(v.phase)) ||
    !integer(v.passOffset, 0, 3) ||
    !Array.isArray(v.confirmed) ||
    v.confirmed.length !== 4 ||
    !v.confirmed.every((n) => typeof n === 'boolean') ||
    !integer(v.leader, 0, 3) ||
    !cardList(v.played, 51) ||
    v.played.length > 4 ||
    !Array.isArray(v.tricks) ||
    v.tricks.length > 13 ||
    typeof v.heartsBroken !== 'boolean'
  )
    return false;
  if (
    !v.tricks.every(
      (t) =>
        record(t) &&
        exactKeys(t, ['leader', 'cards']) &&
        integer(t.leader, 0, 3) &&
        cardList(t.cards, 51) &&
        t.cards.length === 4,
    )
  )
    return false;
  const visible = [...v.hand, ...v.played, ...v.tricks.flatMap((t) => (t as Trick).cards)];
  return new Set(visible).size === visible.length;
}
export function projectHearts(s: Full, you: number): HeartsView {
  return {
    you,
    hand: [...s.h.hands[you as Seat]],
    counts: s.h.hands.map((h) => h.length),
    scores: [...s.scores],
    taken: penaltiesTakenIn(s.h),
    delta: scoreHand(s.h)?.delta ?? [0, 0, 0, 0],
    handNumber: s.handNumber,
    turn: s.turn,
    over: s.over,
    phase: s.h.phase,
    passOffset: s.h.passOffset,
    confirmed: [...s.h.confirmed],
    leader: s.h.leader,
    played: [...s.h.played],
    tricks: s.h.tricks.map((t) => ({ ...t, cards: [...t.cards] })),
    heartsBroken: s.h.heartsBroken,
  };
}
export const game: GroupGame = {
  id: 'hearts',
  capacity: 4,
  create: () =>
    withTurn({ h: dealHand('', 1, hostRandom), scores: [0, 0, 0, 0], handNumber: 1, over: false }),
  valid: isHeartsView,
  project: (s, you) => projectHearts(s as Full, you),
  turn: (s) => (s as Full).turn,
  finished: (s) => (s as Full).over,
  automatic: (s) => ((s as Full).turn === -1 ? { kind: 'collect' } : null),
  apply: (raw, seat, a) => {
    const s = raw as Full;
    if (s.over || s.turn !== seat || !record(a)) return null;
    if (s.h.phase === 'over' && a.kind === 'next' && exactKeys(a, ['kind']))
      return withTurn({
        ...s,
        h: dealHand('', s.handNumber + 1, hostRandom),
        handNumber: s.handNumber + 1,
      });
    if (
      s.h.phase === 'passing' &&
      a.kind === 'pass' &&
      exactKeys(a, ['kind', 'cards']) &&
      cardList(a.cards, 51) &&
      a.cards.length === 3
    ) {
      let h = s.h;
      for (const c of a.cards) {
        const next = selectPassCard(h, seat as Seat, c);
        if (!next) return null;
        h = next;
      }
      const next = confirmPass(h, seat as Seat);
      return next ? withTurn({ ...s, h: next.hand }) : null;
    }
    if (a.kind === 'play' && exactKeys(a, ['kind', 'card']) && integer(a.card, 0, 51)) {
      const h = playCard(s.h, a.card);
      return h ? withTurn({ ...s, h }) : null;
    }
    if (seat === -1 && a.kind === 'collect' && exactKeys(a, ['kind'])) {
      const next = collectTrick(s.h);
      if (!next) return null;
      const result = scoreHand(next.hand);
      const scores = result ? bySeat((i) => s.scores[i] + result.delta[i]) : s.scores;
      return withTurn({ ...s, h: next.hand, scores, over: scores.some((n) => n >= 100) });
    }
    return null;
  },
  cpu: (raw) => {
    const s = raw as Full;
    const view = buildCpuView(s.h, s.turn as Seat, 'normal', s.scores);
    return s.h.phase === 'passing'
      ? { kind: 'pass', cards: chooseCpuPass(view, hostRandom()) }
      : { kind: 'play', card: chooseCpuPlay(view, hostRandom()) };
  },
  result: (raw) => {
    const s = raw as Full;
    if (!s.over) return null;
    const winners = [0, 1, 2, 3].filter((i) => s.scores[i] === Math.min(...s.scores));
    return { scores: [...s.scores], winner: winners.length === 1 ? winners[0]! : null };
  },
};
