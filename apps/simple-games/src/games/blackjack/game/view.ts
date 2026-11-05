import { total, type Session, type Hand } from './index';
import {
  object,
  integer,
  numbers,
  cards,
  event,
  exactKeys,
  type Card,
  type GameEvent,
} from './cards';
export interface View {
  you: number;
  turn: number;
  over: boolean;
  hands: Hand[];
  counts: number[];
  dealer: Card[];
  dealerCount: number;
  handIndex: number;
  revealed: Hand[][];
  scores: number[];
  event: GameEvent;
}
const copyHand = (h: Hand): Hand => ({ ...h, cards: [...h.cards] });
export function project(s: Session, you: number): View {
  const over = s.status !== 'playing';
  return {
    you,
    turn: s.turn,
    over,
    hands: s.hands[you]!.map(copyHand),
    counts: s.hands.map((hs) => hs.reduce((n, h) => n + h.cards.length, 0)),
    dealer: over ? [...s.dealer] : s.dealer.slice(0, 1),
    dealerCount: s.dealer.length,
    handIndex: s.handIndex,
    revealed: s.hands.map((hs) => (over ? hs.map(copyHand) : [])),
    scores: [...s.scores],
    event: { ...s.event, cards: [...s.event.cards] },
  };
}
function validHand(v: unknown, over: boolean): v is Hand {
  return (
    object(v) &&
    exactKeys(v, ['cards', 'stake', 'split', 'splitAces', 'status', 'payout']) &&
    cards(v.cards, 311) &&
    v.cards.length >= 2 &&
    v.cards.length <= 22 &&
    (v.stake === 10 || v.stake === 20) &&
    typeof v.split === 'boolean' &&
    typeof v.splitAces === 'boolean' &&
    ['playing', 'stand', 'bust'].includes(String(v.status)) &&
    (over ? integer(v.payout, 20, -20) : v.payout === null) &&
    (v.status === 'bust') === total(v.cards).value > 21
  );
}
export function validView(v: unknown, you?: number): v is View {
  if (
    !object(v) ||
    !exactKeys(v, [
      'you',
      'turn',
      'over',
      'hands',
      'counts',
      'dealer',
      'dealerCount',
      'handIndex',
      'revealed',
      'scores',
      'event',
    ]) ||
    !integer(v.you, 3) ||
    (you !== undefined && you !== v.you) ||
    !integer(v.turn, 3) ||
    typeof v.over !== 'boolean' ||
    !Array.isArray(v.hands) ||
    v.hands.length < 1 ||
    v.hands.length > 4 ||
    !v.hands.every((h) => validHand(h, v.over as boolean)) ||
    !numbers(v.counts, 4, 88, 2) ||
    !cards(v.dealer, 311) ||
    !integer(v.dealerCount, 22, 2) ||
    v.dealer.length !== (v.over ? v.dealerCount : 1) ||
    !integer(v.handIndex, 3) ||
    !numbers(v.scores, v.over ? 4 : 0, 80, -80) ||
    !Array.isArray(v.revealed) ||
    v.revealed.length !== 4 ||
    !v.revealed.every(
      (hs) =>
        Array.isArray(hs) &&
        (v.over ? hs.length >= 1 && hs.length <= 4 : hs.length === 0) &&
        hs.every((h) => validHand(h, v.over as boolean)),
    ) ||
    !event(v.event, 4, 311)
  )
    return false;
  const s = v as unknown as View,
    own = s.hands.flatMap((h) => h.cards),
    other = s.revealed.flatMap((hs, p) => (p === s.you ? [] : hs.flatMap((h) => h.cards)));
  return (
    own.length === s.counts[s.you] &&
    cards([...own, ...s.dealer, ...other], 311) &&
    (!s.over || JSON.stringify(s.revealed[s.you]) === JSON.stringify(s.hands))
  );
}
