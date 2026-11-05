import { createSession, act, sourceSeat, type Session } from '../../games/old-maid/game/index';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { cardView, publicEvent, hostRandom, places, type CardView } from './groupCards';
export interface OldMaidView extends CardView {
  source: number;
}
export function isOldMaidView(v: unknown, you?: number): v is OldMaidView {
  return (
    cardView(v, you) &&
    record(v) &&
    exactKeys(v, ['you', 'turn', 'hand', 'counts', 'order', 'over', 'event', 'source']) &&
    integer(v.source, 0, 3) &&
    !(v.event.kind === 'draw' && v.event.seat !== v.you && v.event.cards.length)
  );
}
export function projectOldMaid(s: Session, you: number): OldMaidView {
  return {
    you,
    turn: s.turn,
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    order: [...s.order],
    over: s.status !== 'playing',
    event: publicEvent(s.event, you),
    source: sourceSeat(s),
  };
}
const over = (s: unknown) =>
  record(s) && (s.over === true || s.status === 'won' || s.status === 'lost');
export const game: GroupGame = {
  id: 'old-maid',
  capacity: 4,
  create: () => createSession(0, hostRandom, true),
  valid: isOldMaidView,
  project: (s, you) => projectOldMaid(s as Session, you),
  turn: (s) => (s as Session).turn,
  finished: over,
  apply: (raw, seat, a) => {
    const s = raw as Session;
    if (
      s.turn !== seat ||
      !record(a) ||
      !exactKeys(a, ['kind', 'index']) ||
      a.kind !== 'draw' ||
      !integer(a.index, 0, 52)
    )
      return null;
    return act(s, { kind: 'draw', index: a.index }, hostRandom, true);
  },
  cpu: (s) => ({
    kind: 'draw',
    index: Math.floor(hostRandom() * (s as Session).hands[sourceSeat(s as Session)]!.length),
  }),
  result: (s) => (over(s) ? { scores: places((s as Session).order), winner: null } : null),
};
