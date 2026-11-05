import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
  type Hand,
} from '../../games/blackjack/game';
import { project, validView, type View } from '../../games/blackjack/game/view';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { hostRandom } from './groupCards';

// Sixteen split hands plus the frozen seat names must fit the encrypted 4 KiB
// native frame. Tuples remove repeated property names; own hands travel once.
type WireHand = [number[], 10 | 20, number, number, number | null];
type WireView = Omit<View, 'hands' | 'revealed'> & { hands: WireHand[]; revealed: WireHand[][] };
const statuses = ['playing', 'stand', 'bust'] as const;
const packHand = (h: Hand): WireHand => [
  [...h.cards],
  h.stake,
  Number(h.split) + 2 * Number(h.splitAces),
  statuses.indexOf(h.status),
  h.payout,
];
export function projectBlackjack(s: Session, you: number): WireView {
  const v = project(s, you);
  return {
    ...v,
    hands: v.hands.map(packHand),
    revealed: v.revealed.map((hs, seat) => (seat === you ? [] : hs.map(packHand))),
  };
}
function unpackHands(raw: unknown): Hand[] | null {
  if (!Array.isArray(raw) || raw.length > 4) return null;
  const result: Hand[] = [];
  for (const h of raw) {
    if (
      !Array.isArray(h) ||
      h.length !== 5 ||
      !Array.isArray(h[0]) ||
      h[0].length > 22 ||
      (h[1] !== 10 && h[1] !== 20) ||
      !integer(h[2], 0, 3) ||
      !integer(h[3], 0, 2) ||
      (h[4] !== null && !integer(h[4], -20, 20))
    )
      return null;
    result.push({
      cards: h[0],
      stake: h[1],
      split: !!(h[2] & 1),
      splitAces: !!(h[2] & 2),
      status: statuses[h[3]]!,
      payout: h[4],
    });
  }
  return result;
}
export function decodeBlackjack(raw: unknown, seat?: number): View | null {
  if (
    !record(raw) ||
    !integer(raw.you, 0, 3) ||
    !Array.isArray(raw.revealed) ||
    raw.revealed.length !== 4
  )
    return null;
  const hands = unpackHands(raw.hands),
    revealed = raw.revealed.map(unpackHands);
  if (!hands || revealed.some((hs) => hs === null) || revealed[raw.you]!.length !== 0) return null;
  if (raw.over === true) revealed[raw.you] = hands;
  const view = { ...raw, hands, revealed };
  return validView(view, seat) ? view : null;
}
export const isBlackjackView = (raw: unknown, seat?: number) => decodeBlackjack(raw, seat) !== null;
const over = (raw: unknown) =>
  record(raw) && (raw.over === true || ['won', 'lost', 'draw'].includes(String(raw.status)));
export const game: GroupGame = {
  id: 'blackjack',
  capacity: 4,
  create: () => createSession(0, hostRandom),
  valid: isBlackjackView,
  project: (raw, seat) => projectBlackjack(raw as Session, seat),
  turn: (raw) => (raw as Session).turn,
  finished: over,
  apply: (raw, seat, a) => {
    const s = raw as Session;
    if (
      s.turn !== seat ||
      !record(a) ||
      !(['hit', 'stand', 'double', 'split'].includes(String(a.kind)) && exactKeys(a, ['kind']))
    )
      return null;
    return step(s, a as Action);
  },
  cpu: (raw) => chooseCpuMove(cpuView(raw as Session)),
  result: (raw) => {
    if (!over(raw)) return null;
    const v = record(raw) && raw.over === true ? decodeBlackjack(raw) : project(raw as Session, 0);
    return v ? { scores: [...v.scores], winner: null } : null;
  },
};
