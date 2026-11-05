import type { Session, Phase, Pot } from './index';
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
  hand: Card[];
  counts: number[];
  board: Card[];
  revealed: Card[][];
  stacks: number[];
  bets: number[];
  contributions: number[];
  folded: boolean[];
  actedAt: number[];
  bet: number;
  minRaise: number;
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  phase: Phase;
  handNumber: number;
  payouts: number[];
  returned: number[];
  pots: Pot[];
  showdown: boolean;
  winners: number[];
  event: GameEvent;
}
export function project(s: Session, you: number): View {
  return {
    you,
    turn: s.turn,
    over: s.status !== 'playing',
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    board: [...s.board],
    revealed: s.hands.map((h, p) => (s.showdown && !s.folded[p] ? [...h] : [])),
    stacks: [...s.stacks],
    bets: [...s.bets],
    contributions: [...s.contributions],
    folded: [...s.folded],
    actedAt: [...s.actedAt],
    bet: s.bet,
    minRaise: s.minRaise,
    dealer: s.dealer,
    smallBlind: s.smallBlind,
    bigBlind: s.bigBlind,
    phase: s.phase,
    handNumber: s.handNumber,
    payouts: [...s.payouts],
    returned: [...s.returned],
    pots: s.pots.map((p) => ({
      amount: p.amount,
      eligible: [...p.eligible],
      winners: [...p.winners],
    })),
    showdown: s.showdown,
    winners: [...s.winners],
    event: { ...s.event, cards: [...s.event.cards] },
  };
}
export function validView(v: unknown, you?: number): v is View {
  if (
    !object(v) ||
    !exactKeys(v, [
      'you',
      'turn',
      'over',
      'hand',
      'counts',
      'board',
      'revealed',
      'stacks',
      'bets',
      'contributions',
      'folded',
      'actedAt',
      'bet',
      'minRaise',
      'dealer',
      'smallBlind',
      'bigBlind',
      'phase',
      'handNumber',
      'payouts',
      'returned',
      'pots',
      'showdown',
      'winners',
      'event',
    ]) ||
    !integer(v.you, 3) ||
    (you !== undefined && you !== v.you) ||
    !integer(v.turn, 3) ||
    typeof v.over !== 'boolean' ||
    !cards(v.hand) ||
    ![0, 2].includes(v.hand.length) ||
    !numbers(v.counts, 4, 2) ||
    v.counts.some((c) => c === 1) ||
    v.counts[v.you] !== v.hand.length ||
    !cards(v.board) ||
    ![0, 3, 4, 5].includes(v.board.length) ||
    !Array.isArray(v.revealed) ||
    v.revealed.length !== 4 ||
    !v.revealed.every((h) => cards(h) && [0, 2].includes(h.length)) ||
    !numbers(v.stacks, 4, 4000) ||
    !numbers(v.bets, 4, 4000) ||
    !numbers(v.contributions, 4, 4000) ||
    !numbers(v.actedAt, 4, 4000, -1) ||
    !Array.isArray(v.folded) ||
    v.folded.length !== 4 ||
    !v.folded.every((x) => typeof x === 'boolean') ||
    !integer(v.bet, 4000) ||
    !integer(v.minRaise, 4000, 20) ||
    !integer(v.dealer, 3) ||
    !integer(v.smallBlind, 3) ||
    !integer(v.bigBlind, 3) ||
    v.smallBlind === v.bigBlind ||
    !['preflop', 'flop', 'turn', 'river', 'hand'].includes(String(v.phase)) ||
    !integer(v.handNumber, 1e9, 1) ||
    !numbers(v.payouts, 4, 4000) ||
    !numbers(v.returned, 4, 4000) ||
    typeof v.showdown !== 'boolean' ||
    !cards(v.winners, 3) ||
    v.winners.length !== (v.over ? 1 : 0) ||
    !event(v.event, 4, 51) ||
    !Array.isArray(v.pots) ||
    v.pots.length > 4 ||
    !v.pots.every(
      (p) =>
        object(p) &&
        exactKeys(p, ['amount', 'eligible', 'winners']) &&
        integer(p.amount, 4000, 1) &&
        cards(p.eligible, 3) &&
        p.eligible.length &&
        cards(p.winners, 3) &&
        p.winners.length &&
        p.winners.every((w) => (p.eligible as number[]).includes(w)),
    )
  )
    return false;
  const s = v as unknown as View;
  if (
    s.revealed.some((h, p) => h.length !== (s.showdown && !s.folded[p] ? s.counts[p] : 0)) ||
    s.revealed[s.you]!.some((c, i) => c !== s.hand[i]) ||
    !cards([...s.hand, ...s.board, ...s.revealed.flatMap((h, p) => (p === s.you ? [] : h))])
  )
    return false;
  if (
    s.phase !== 'hand' &&
    (s.showdown || s.over || s.pots.length || s.payouts.some((x) => x) || s.returned.some((x) => x))
  )
    return false;
  return (
    s.stacks.reduce((a, b) => a + b, 0) +
      (s.phase === 'hand' ? 0 : s.contributions.reduce((a, b) => a + b, 0)) ===
    4000
  );
}
