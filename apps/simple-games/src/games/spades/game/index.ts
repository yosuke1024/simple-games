/** Partnership Spades, 200-point match. See docs/SPADES_RULES.md. */
import {
  highRank,
  suitOf,
  shuffle,
  object,
  integer,
  numbers,
  cards,
  partition,
  event,
  type Card,
  type Status,
  type GameEvent,
} from './cards';
export * from './cards';
const DECK = Array.from({ length: 52 }, (_, i) => i);
export interface Play {
  seat: number;
  card: Card;
}
export interface HandScore {
  bids: number[];
  tricks: number[];
  delta: number[];
  bags: number[];
}
export interface Session {
  seed: number;
  hands: Card[][];
  played: Card[];
  trick: Play[];
  lastTrick: Play[];
  dealer: number;
  turn: number;
  handNumber: number;
  phase: 'bid' | 'play' | 'hand';
  bids: number[];
  tricks: number[];
  broken: boolean;
  scores: number[];
  bags: number[];
  lastScore: HandScore | null;
  moves: number;
  elapsedSeconds: number;
  status: Status;
  winners: number[];
  event: GameEvent;
}
export type Action = { kind: 'bid'; bid: number } | { kind: 'play'; card: Card } | { kind: 'next' };
export function createSession(seed: number, entropy?: () => number): Session {
  const deck = shuffle(DECK, seed, entropy);
  return {
    seed: seed >>> 0,
    hands: Array.from({ length: 4 }, () => deck.splice(0, 13)),
    played: [],
    trick: [],
    lastTrick: [],
    dealer: 3,
    turn: 0,
    handNumber: 1,
    phase: 'bid',
    bids: [-1, -1, -1, -1],
    tricks: [0, 0, 0, 0],
    broken: false,
    scores: [0, 0],
    bags: [0, 0],
    lastScore: null,
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    winners: [],
    event: { kind: 'deal', seat: 0, cards: [] },
  };
}
export function trickWinner(trick: readonly Play[]): number {
  const lead = suitOf(trick[0]!.card);
  const value = (c: Card) => highRank(c) + (suitOf(c) === 0 ? 100 : suitOf(c) === lead ? 50 : 0);
  return trick.reduce((best, p) => (value(p.card) > value(best.card) ? p : best)).seat;
}
export function legalCards(hand: readonly Card[], trick: readonly Play[], broken: boolean): Card[] {
  if (!trick.length) {
    const others = hand.filter((c) => suitOf(c) !== 0);
    return !broken && others.length ? others : [...hand];
  }
  const follow = hand.filter((c) => suitOf(c) === suitOf(trick[0]!.card));
  return follow.length ? follow : [...hand];
}
export function scoreHand(
  bids: readonly number[],
  tricks: readonly number[],
  previousBags: readonly number[],
): HandScore {
  const delta = [0, 0],
    bags = [...previousBags];
  for (const team of [0, 1]) {
    const seats = [team, team + 2],
      contract = seats.reduce((n, p) => n + bids[p]!, 0);
    const taken = seats.reduce((n, p) => n + (bids[p]! > 0 ? tricks[p]! : 0), 0);
    let extra = contract > 0 && taken >= contract ? taken - contract : 0;
    delta[team] = contract > 0 ? (taken >= contract ? contract * 10 + extra : -contract * 10) : 0;
    for (const p of seats)
      if (bids[p] === 0) {
        delta[team]! += tricks[p] === 0 ? 100 : -100;
        extra += tricks[p]!;
        delta[team]! += tricks[p]!;
      }
    bags[team]! += extra;
    delta[team]! -= Math.floor(bags[team]! / 10) * 100;
    bags[team]! %= 10;
  }
  return { bids: [...bids], tricks: [...tricks], delta, bags };
}
export function step(s: Session, a: Action, entropy?: () => number): Session | null {
  if (s.status !== 'playing' || !object(a)) return null;
  const seat = s.turn,
    n: Session = {
      ...s,
      hands: s.hands.map((h) => [...h]),
      played: [...s.played],
      trick: s.trick.map((p) => ({ ...p })),
      bids: [...s.bids],
      tricks: [...s.tricks],
      moves: s.moves + 1,
    };
  if (a.kind === 'bid') {
    if (s.phase !== 'bid' || !integer(a.bid, 13) || s.bids[seat] !== -1) return null;
    n.bids[seat] = a.bid;
    n.turn = (seat + 1) % 4;
    n.event = { kind: 'bid', seat, cards: [] };
    if (n.bids.every((b) => b >= 0)) {
      n.phase = 'play';
      n.turn = (s.dealer + 1) % 4;
    }
  } else if (a.kind === 'play') {
    if (s.phase !== 'play' || !legalCards(s.hands[seat]!, s.trick, s.broken).includes(a.card))
      return null;
    n.hands[seat] = n.hands[seat]!.filter((c) => c !== a.card);
    n.trick.push({ seat, card: a.card });
    n.broken ||= suitOf(a.card) === 0;
    n.turn = (seat + 1) % 4;
    n.event = { kind: 'play', seat, cards: [a.card] };
    if (n.trick.length === 4) {
      n.turn = trickWinner(n.trick);
      n.tricks[n.turn]!++;
      n.lastTrick = n.trick;
      n.played.push(...n.trick.map((p) => p.card));
      n.trick = [];
      if (n.played.length === 52) {
        n.lastScore = scoreHand(n.bids, n.tricks, n.bags);
        n.scores = s.scores.map((x, i) => x + n.lastScore!.delta[i]!);
        n.bags = n.lastScore.bags;
        n.phase = 'hand';
        n.turn = 0;
        const top = Math.max(...n.scores);
        if (top >= 200 && n.scores[0] !== n.scores[1]) {
          const team = n.scores.indexOf(top);
          n.winners = [team, team + 2];
          n.status = team === 0 ? 'won' : 'lost';
        }
      }
    }
  } else if (a.kind === 'next') {
    if (s.phase !== 'hand') return null;
    const deck = shuffle(DECK, (s.seed ^ Math.imul(s.handNumber, 0x9e3779b9)) >>> 0, entropy);
    n.hands = Array.from({ length: 4 }, () => deck.splice(0, 13));
    n.played = [];
    n.trick = [];
    n.lastTrick = [];
    n.dealer = (s.dealer + 1) % 4;
    n.turn = (n.dealer + 1) % 4;
    n.handNumber++;
    n.phase = 'bid';
    n.bids = [-1, -1, -1, -1];
    n.tricks = [0, 0, 0, 0];
    n.broken = false;
    n.event = { kind: 'deal', seat: n.turn, cards: [] };
  } else return null;
  return n;
}
export interface CpuView {
  hand: Card[];
  trick: Play[];
  bids: number[];
  tricks: number[];
  broken: boolean;
  turn: number;
  phase: Session['phase'];
}
export const cpuView = (s: Session): CpuView => ({
  hand: [...s.hands[s.turn]!],
  trick: s.trick.map((p) => ({ ...p })),
  bids: [...s.bids],
  tricks: [...s.tricks],
  broken: s.broken,
  turn: s.turn,
  phase: s.phase,
});
export function chooseCpuMove(v: CpuView): Action {
  if (v.phase === 'hand') return { kind: 'next' };
  if (v.phase === 'bid') {
    let estimate = 0;
    for (const c of v.hand) {
      const r = highRank(c),
        count = v.hand.filter((x) => suitOf(x) === suitOf(c)).length;
      estimate +=
        suitOf(c) === 0
          ? r >= 12
            ? 0.95
            : r >= 9
              ? 0.65
              : 0.35
          : r === 14
            ? 0.9
            : r === 13 && count > 1
              ? 0.6
              : r === 12 && count > 2
                ? 0.25
                : 0;
    }
    return {
      kind: 'bid',
      bid: Math.min(13, Math.max(estimate < 0.7 ? 0 : 1, Math.round(estimate))),
    };
  }
  const legal = legalCards(v.hand, v.trick, v.broken).sort(
    (a, b) => highRank(a) + (suitOf(a) === 0 ? 20 : 0) - (highRank(b) + (suitOf(b) === 0 ? 20 : 0)),
  );
  if (!v.trick.length)
    return { kind: 'play', card: v.bids[v.turn] === 0 ? legal[0]! : legal[legal.length - 1]! };
  const winners = legal.filter(
      (card) => trickWinner([...v.trick, { seat: v.turn, card }]) === v.turn,
    ),
    losers = legal.filter((c) => !winners.includes(c));
  const partner = (v.turn + 2) % 4,
    want = v.bids[v.turn] !== 0 && (trickWinner(v.trick) !== partner || v.bids[partner] === 0);
  const card = want ? (winners[0] ?? legal[0]!) : (losers[losers.length - 1] ?? legal[0]!);
  return { kind: 'play', card };
}
function plays(v: unknown): v is Play[] {
  return (
    Array.isArray(v) &&
    v.length <= 4 &&
    v.every((p) => object(p) && integer(p.seat, 3) && integer(p.card, 51)) &&
    new Set(v.map((p) => p.seat)).size === v.length &&
    cards(v.map((p) => p.card))
  );
}
export function restore(v: unknown): Session | null {
  if (
    !object(v) ||
    !integer(v.seed, 0xffffffff) ||
    !integer(v.moves) ||
    !integer(v.elapsedSeconds, 1e12) ||
    v.status !== 'playing' ||
    !integer(v.turn, 3) ||
    !integer(v.dealer, 3) ||
    !integer(v.handNumber, 1e6, 1) ||
    !['bid', 'play', 'hand'].includes(String(v.phase)) ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 4 ||
    !v.hands.every((h) => cards(h) && h.length <= 13) ||
    !cards(v.played) ||
    v.played.length % 4 !== 0 ||
    !plays(v.trick) ||
    v.trick.length > 3 ||
    !plays(v.lastTrick) ||
    ![0, 4].includes(v.lastTrick.length) ||
    !partition([...v.hands, v.played, v.trick.map((p) => p.card)], DECK) ||
    !numbers(v.bids, 4, 13, -1) ||
    !numbers(v.tricks, 4, 13) ||
    !numbers(v.scores, 2, 1e9, -1e9) ||
    !numbers(v.bags, 2, 9) ||
    typeof v.broken !== 'boolean' ||
    !cards(v.winners, 3) ||
    v.winners.length ||
    !event(v.event, 4, 51)
  )
    return null;
  if (
    v.tricks.reduce((a, b) => a + b, 0) !== v.played.length / 4 ||
    v.lastTrick.some((p) => !(v.played as Card[]).includes(p.card))
  )
    return null;
  if (
    v.lastScore !== null &&
    (!object(v.lastScore) ||
      !numbers(v.lastScore.bids, 4, 13) ||
      !numbers(v.lastScore.tricks, 4, 13) ||
      !numbers(v.lastScore.delta, 2, 1000, -1000) ||
      !numbers(v.lastScore.bags, 2, 9))
  )
    return null;
  if (v.phase === 'bid') {
    const order = [1, 2, 3, 4].map((i) => ((v.dealer as number) + i) % 4),
      count = v.bids.filter((b) => b >= 0).length;
    if (
      count === 4 ||
      v.played.length ||
      v.trick.length ||
      v.hands.some((h) => h.length !== 13) ||
      v.turn !== order[count] ||
      order.some((p, i) => (v.bids as number[])[p]! >= 0 !== i < count)
    )
      return null;
  } else if (v.bids.some((b) => b < 0)) return null;
  if (v.phase === 'play' && (!v.hands[v.turn]!.length || v.played.length === 52)) return null;
  if (
    v.phase === 'hand' &&
    (v.played.length !== 52 || v.trick.length || v.lastScore === null || v.turn !== 0)
  )
    return null;
  for (let i = 1; i < v.trick.length; i++)
    if (v.trick[i]!.seat !== (v.trick[i - 1]!.seat + 1) % 4) return null;
  if (v.trick.length && v.turn !== (v.trick[v.trick.length - 1]!.seat + 1) % 4) return null;
  return JSON.parse(JSON.stringify(v)) as Session;
}
