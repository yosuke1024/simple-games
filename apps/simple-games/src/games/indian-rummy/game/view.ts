import { meldKind, type Session, type Meld } from './index';
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
  top: Card | null;
  indicator: Card;
  wildRank: number;
  stockCount: number;
  discardCount: number;
  phase: Session['phase'];
  picked: Card | null;
  winners: number[];
  penalties: number[];
  declaration: Meld[];
  event: GameEvent;
}
export function project(s: Session, you: number): View {
  return {
    you,
    turn: s.turn,
    over: s.status !== 'playing',
    hand: [...s.hands[you]!],
    counts: s.hands.map((h) => h.length),
    top: s.discard[s.discard.length - 1] ?? null,
    indicator: s.indicator,
    wildRank: s.wildRank,
    stockCount: s.stock.length,
    discardCount: s.discard.length,
    phase: s.phase,
    picked: you === s.turn ? s.picked : null,
    winners: [...s.winners],
    penalties: [...s.penalties],
    declaration: s.declaration.map((m) => ({ kind: m.kind, cards: [...m.cards] })),
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
      'top',
      'indicator',
      'wildRank',
      'stockCount',
      'discardCount',
      'phase',
      'picked',
      'winners',
      'penalties',
      'declaration',
      'event',
    ]) ||
    !integer(v.you, 3) ||
    (you !== undefined && you !== v.you) ||
    !integer(v.turn, 3) ||
    typeof v.over !== 'boolean' ||
    !cards(v.hand, 105) ||
    !numbers(v.counts, 4, 14, 13) ||
    v.counts[v.you] !== v.hand.length ||
    !(v.top === null || integer(v.top, 105)) ||
    !integer(v.indicator, 105) ||
    !integer(v.wildRank, 13, 1) ||
    !integer(v.stockCount, 53) ||
    !integer(v.discardCount, 53) ||
    !['draw', 'discard'].includes(String(v.phase)) ||
    !(
      v.picked === null ||
      (integer(v.picked, 105) && v.you === v.turn && v.hand.includes(v.picked))
    ) ||
    !cards(v.winners, 3) ||
    v.winners.length !== (v.over ? 1 : 0) ||
    !numbers(v.penalties, v.over ? 4 : 0, 80) ||
    !event(v.event, 4, 105) ||
    !Array.isArray(v.declaration) ||
    v.declaration.length > 4 ||
    !v.declaration.every(
      (m) =>
        object(m) &&
        exactKeys(m, ['kind', 'cards']) &&
        cards(m.cards, 105) &&
        meldKind(m.cards, v.wildRank as number) === m.kind,
    )
  )
    return false;
  const declaration = v.declaration as Meld[],
    meldCards = declaration.flatMap((m) => m.cards);
  if (
    v.over &&
    (meldCards.length !== 13 ||
      !cards(meldCards, 105) ||
      !declaration.some((m) => m.kind === 'pure') ||
      declaration.filter((m) => m.kind !== 'set').length < 2)
  )
    return false;
  if (
    v.over &&
    v.winners[0] === v.you &&
    (!v.hand.every((c) => meldCards.includes(c)) || v.hand.length !== 13)
  )
    return false;
  const known = [
    ...v.hand,
    v.indicator,
    ...(v.top === null ? [] : [v.top]),
    ...(v.over && v.winners[0] !== v.you ? meldCards : []),
  ];
  return (
    cards(known, 105) &&
    Boolean(v.discardCount) === (v.top !== null) &&
    (!v.over ? v.declaration.length === 0 : true)
  );
}
