/** No-limit Hold'em. Every contribution is settled exactly once. See TEXAS_HOLDEM_RULES.md. */
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
export const BIG_BLIND = 20,
  SMALL_BLIND = 10,
  STARTING_STACK = 1000;
export type Phase = 'preflop' | 'flop' | 'turn' | 'river' | 'hand';
export interface Pot {
  amount: number;
  eligible: number[];
  winners: number[];
}
export interface Session {
  seed: number;
  hands: Card[][];
  deck: Card[];
  burned: Card[];
  board: Card[];
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
  turn: number;
  phase: Phase;
  handNumber: number;
  payouts: number[];
  returned: number[];
  pots: Pot[];
  showdown: boolean;
  winners: number[];
  moves: number;
  elapsedSeconds: number;
  status: Status;
  event: GameEvent;
}
export type Action =
  { kind: 'fold' | 'check' | 'call' | 'all-in' | 'next' } | { kind: 'raise'; to: number };
export interface HandRank {
  category: number;
  ranks: number[];
  value: number;
}
function rankFive(hand: readonly Card[]): HandRank {
  const ranks = hand.map(highRank).sort((a, b) => b - a),
    unique = [...new Set(ranks)];
  const flush = hand.every((c) => suitOf(c) === suitOf(hand[0]!));
  const straight =
    unique.length === 5
      ? unique[0]! - unique[4]! === 4
        ? unique[0]!
        : unique.join(',') === '14,5,4,3,2'
          ? 5
          : 0
      : 0;
  const groups = unique
    .map((r) => ({ r, n: ranks.filter((x) => x === r).length }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  let category = 0,
    kickers = ranks;
  if (straight && flush) {
    category = 8;
    kickers = [straight];
  } else if (groups[0]!.n === 4) {
    category = 7;
    kickers = groups.map((g) => g.r);
  } else if (groups[0]!.n === 3 && groups[1]!.n === 2) {
    category = 6;
    kickers = groups.map((g) => g.r);
  } else if (flush) category = 5;
  else if (straight) {
    category = 4;
    kickers = [straight];
  } else if (groups[0]!.n === 3) {
    category = 3;
    kickers = groups.map((g) => g.r);
  } else if (groups[0]!.n === 2 && groups[1]!.n === 2) {
    category = 2;
    kickers = groups.map((g) => g.r);
  } else if (groups[0]!.n === 2) {
    category = 1;
    kickers = groups.map((g) => g.r);
  }
  const value = [category, ...Array.from({ length: 5 }, (_, i) => kickers[i] ?? 0)].reduce(
    (n, r) => n * 15 + r,
    0,
  );
  return { category, ranks: kickers, value };
}
export function evaluate(hand: readonly Card[]): HandRank {
  if (hand.length < 5 || hand.length > 7 || new Set(hand).size !== hand.length)
    throw new Error('Expected five to seven distinct cards');
  let best: HandRank | null = null;
  for (let a = 0; a < hand.length - 4; a++)
    for (let b = a + 1; b < hand.length - 3; b++)
      for (let c = b + 1; c < hand.length - 2; c++)
        for (let d = c + 1; d < hand.length - 1; d++)
          for (let e = d + 1; e < hand.length; e++) {
            const rank = rankFive([hand[a]!, hand[b]!, hand[c]!, hand[d]!, hand[e]!]);
            if (!best || rank.value > best.value) best = rank;
          }
  return best!;
}
const clockwise = (from: number, seats: readonly number[]): number => {
  for (let d = 1; d <= 4; d++) {
    const p = (from + d) % 4;
    if (seats.includes(p)) return p;
  }
  return from;
};
const live = (s: Session) => [0, 1, 2, 3].filter((p) => s.hands[p]!.length && !s.folded[p]);
function pay(s: Session, p: number, amount: number): void {
  const paid = Math.min(s.stacks[p]!, amount);
  s.stacks[p]! -= paid;
  s.bets[p]! += paid;
  s.contributions[p]! += paid;
}
function deal(s: Session, entropy?: (upperBound: number) => number): void {
  s.deck = shuffle(DECK, (s.seed ^ Math.imul(s.handNumber, 0x9e3779b9)) >>> 0, entropy);
  s.burned = [];
  s.board = [];
  s.hands = [[], [], [], []];
  s.bets = [0, 0, 0, 0];
  s.contributions = [0, 0, 0, 0];
  s.actedAt = [-1, -1, -1, -1];
  s.folded = s.stacks.map((x) => x === 0);
  s.bet = BIG_BLIND;
  s.minRaise = BIG_BLIND;
  s.phase = 'preflop';
  s.payouts = [0, 0, 0, 0];
  s.returned = [0, 0, 0, 0];
  s.pots = [];
  s.showdown = false;
  const seats = [0, 1, 2, 3].filter((p) => s.stacks[p]! > 0);
  for (let round = 0; round < 2; round++)
    for (let d = 1; d <= 4; d++) {
      const p = (s.dealer + d) % 4;
      if (seats.includes(p)) s.hands[p]!.push(s.deck.pop()!);
    }
  const small = seats.length === 2 ? s.dealer : clockwise(s.dealer, seats),
    big = clockwise(small, seats);
  s.smallBlind = small;
  s.bigBlind = big;
  pay(s, small, SMALL_BLIND);
  pay(s, big, BIG_BLIND);
  if (seats.filter((p) => s.stacks[p]! > 0).length < 2) s.bet = Math.max(...s.bets);
  s.event = { kind: 'deal', seat: s.dealer, cards: [] };
  progress(s, big);
}
export function createSession(seed: number, entropy?: (upperBound: number) => number): Session {
  const s: Session = {
    seed: seed >>> 0,
    hands: [],
    deck: [],
    burned: [],
    board: [],
    stacks: [1000, 1000, 1000, 1000],
    bets: [],
    contributions: [],
    folded: [],
    actedAt: [],
    bet: 20,
    minRaise: 20,
    dealer: 3,
    smallBlind: 0,
    bigBlind: 1,
    turn: 2,
    phase: 'preflop',
    handNumber: 1,
    payouts: [],
    returned: [],
    pots: [],
    showdown: false,
    winners: [],
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    event: { kind: 'deal', seat: 3, cards: [] },
  };
  deal(s, entropy);
  return s;
}
function street(s: Session): void {
  s.burned.push(s.deck.pop()!);
  const count = s.phase === 'preflop' ? 3 : 1;
  for (let i = 0; i < count; i++) s.board.push(s.deck.pop()!);
  s.phase = s.phase === 'preflop' ? 'flop' : s.phase === 'flop' ? 'turn' : 'river';
  s.bets = [0, 0, 0, 0];
  s.actedAt = [-1, -1, -1, -1];
  s.bet = 0;
  s.minRaise = BIG_BLIND;
}
/** Mutates only a freshly cloned session. Refund unmatched chips before forming pots. */
function settle(s: Session, showdown: boolean): void {
  const eligible = live(s),
    amounts = [...s.contributions],
    ordered = [...amounts].sort((a, b) => b - a);
  if (ordered[0]! > ordered[1]!) {
    const seat = amounts.indexOf(ordered[0]!);
    s.returned[seat] = ordered[0]! - ordered[1]!;
    amounts[seat] = ordered[1]!;
  }
  const levels = [...new Set(amounts.filter((x) => x > 0))].sort((a, b) => a - b);
  let previous = 0;
  s.payouts = [...s.returned];
  s.pots = [];
  for (const level of levels) {
    const contributors = [0, 1, 2, 3].filter((p) => amounts[p]! >= level),
      players = eligible.filter((p) => amounts[p]! >= level),
      amount = (level - previous) * contributors.length;
    previous = level;
    // Legal betting always leaves an eligible contributor for every called pot.
    const values = players.map((p) =>
        showdown ? evaluate([...s.hands[p]!, ...s.board]).value : 0,
      ),
      best = Math.max(...values),
      winners = players.filter((_, i) => values[i] === best);
    if (!winners.length) throw new Error('Pot has no eligible player');
    const share = Math.floor(amount / winners.length);
    for (const p of winners) s.payouts[p]! += share;
    let odd = amount % winners.length;
    for (let d = 1; d <= 4 && odd; d++) {
      const p = (s.dealer + d) % 4;
      if (winners.includes(p)) {
        s.payouts[p]!++;
        odd--;
      }
    }
    s.pots.push({ amount, eligible: players, winners });
  }
  s.stacks = s.stacks.map((n, p) => n + s.payouts[p]!);
  s.showdown = showdown;
  s.phase = 'hand';
  const remaining = [0, 1, 2, 3].filter((p) => s.stacks[p]! > 0);
  // Seat zero advances a scored hand, so a CPU dealer cannot dismiss the result.
  s.turn = 0;
  if (remaining.length === 1) {
    s.winners = remaining;
    s.status = remaining[0] === 0 ? 'won' : 'lost';
  }
  s.event = { kind: showdown ? 'showdown' : 'uncontested', seat: eligible[0]!, cards: [] };
}
function progress(s: Session, after: number): void {
  const players = live(s);
  if (players.length === 1) {
    settle(s, false);
    return;
  }
  const able = players.filter((p) => s.stacks[p]! > 0),
    pending = able.filter((p) => s.bets[p]! < s.bet || s.actedAt[p] === -1);
  if (able.length < 2) {
    // A nominal full blind is no longer owed when only an all-in opponent remains.
    // Match actual live contributions; do not ask for an uncontested side bet.
    s.bet = Math.max(...players.map((p) => s.bets[p]!));
    const owing = able.filter((p) => s.bets[p]! < s.bet);
    if (owing.length) {
      s.turn = owing[0]!;
      return;
    }
    while (s.board.length < 5) street(s);
    settle(s, true);
    return;
  }
  if (pending.length) {
    s.turn = clockwise(after, pending);
    return;
  }
  if (s.phase === 'river') {
    settle(s, true);
    return;
  }
  street(s);
  s.turn = clockwise(s.dealer, able);
}
export interface CpuView {
  hand: Card[];
  board: Card[];
  turn: number;
  phase: Phase;
  stacks: number[];
  bets: number[];
  contributions: number[];
  folded: boolean[];
  bet: number;
  minRaise: number;
  actedAt: number[];
  dealer: number;
}
export const cpuView = (s: Session): CpuView => ({
  hand: [...s.hands[s.turn]!],
  board: [...s.board],
  turn: s.turn,
  phase: s.phase,
  stacks: [...s.stacks],
  bets: [...s.bets],
  contributions: [...s.contributions],
  folded: [...s.folded],
  bet: s.bet,
  minRaise: s.minRaise,
  actedAt: [...s.actedAt],
  dealer: s.dealer,
});
export function canRaise(v: CpuView): boolean {
  return (
    v.phase !== 'hand' &&
    v.stacks[v.turn]! + v.bets[v.turn]! > v.bet &&
    v.stacks.some((n, p) => p !== v.turn && !v.folded[p] && n > 0) &&
    (v.actedAt[v.turn] === -1 || v.bet - v.actedAt[v.turn]! >= v.minRaise)
  );
}
export const callAmount = (v: CpuView) =>
  Math.min(v.stacks[v.turn]!, Math.max(0, v.bet - v.bets[v.turn]!));
export function step(
  s: Session,
  a: Action,
  entropy?: (upperBound: number) => number,
): Session | null {
  if (s.status !== 'playing' || !object(a)) return null;
  const seat = s.turn,
    v = cpuView(s),
    n: Session = {
      ...s,
      hands: s.hands.map((h) => [...h]),
      deck: [...s.deck],
      burned: [...s.burned],
      board: [...s.board],
      stacks: [...s.stacks],
      bets: [...s.bets],
      contributions: [...s.contributions],
      folded: [...s.folded],
      actedAt: [...s.actedAt],
      payouts: [...s.payouts],
      returned: [...s.returned],
      moves: s.moves + 1,
    };
  if (a.kind === 'next') {
    if (s.phase !== 'hand') return null;
    const remaining = [0, 1, 2, 3].filter((p) => s.stacks[p]! > 0);
    const big = clockwise(s.bigBlind, remaining);
    if (remaining.length === 2) n.dealer = clockwise(big, remaining);
    else {
      let small = big;
      for (let d = 1; d <= 4; d++) {
        const p = (big - d + 4) % 4;
        if (remaining.includes(p)) {
          small = p;
          break;
        }
      }
      // The button can occupy a vacant seat; the big blind keeps moving fairly.
      n.dealer = (small + 3) % 4;
    }
    n.handNumber++;
    deal(n, entropy);
    return n;
  }
  if (s.phase === 'hand' || s.folded[seat] || s.stacks[seat] === 0) return null;
  const maximum = s.stacks[seat]! + s.bets[seat]!,
    target = a.kind === 'raise' ? a.to : a.kind === 'all-in' ? maximum : null;
  if (target !== null && target > s.bet) {
    if (
      !integer(target, maximum) ||
      !canRaise(v) ||
      (target < s.bet + s.minRaise && target !== maximum)
    )
      return null;
    const raise = target - s.bet;
    pay(n, seat, target - s.bets[seat]!);
    n.bet = target;
    if (raise >= s.minRaise) n.minRaise = raise;
  } else if (a.kind === 'fold') n.folded[seat] = true;
  else if (a.kind === 'check') {
    if (s.bets[seat] !== s.bet) return null;
  } else if (a.kind === 'call' || a.kind === 'all-in') {
    if (s.bets[seat]! >= s.bet) return null;
    pay(n, seat, s.bet - s.bets[seat]!);
  } else return null;
  n.actedAt[seat] = n.bet;
  n.event = { kind: a.kind, seat, cards: [] };
  progress(n, seat);
  return n;
}
export function chooseCpuMove(v: CpuView): Action {
  if (v.phase === 'hand') return { kind: 'next' };
  const ranks = v.hand.map(highRank),
    pair = ranks[0] === ranks[1];
  let strength = pair
    ? 0.45 + ranks[0]! / 30
    : (ranks[0]! + ranks[1]!) / 50 + (suitOf(v.hand[0]!) === suitOf(v.hand[1]!) ? 0.08 : 0);
  if (v.board.length >= 3) {
    const rank = evaluate([...v.hand, ...v.board]);
    strength =
      rank.category >= 4
        ? 0.95
        : rank.category === 3
          ? 0.82
          : rank.category === 2
            ? 0.7
            : rank.category === 1
              ? 0.5
              : 0.22;
  }
  const call = callAmount(v),
    pot = v.contributions.reduce((a, b) => a + b, 0),
    maximum = v.stacks[v.turn]! + v.bets[v.turn]!;
  if (canRaise(v) && strength >= 0.78) {
    const target = Math.min(maximum, v.bet + Math.max(v.minRaise, Math.floor(pot / 2)));
    return { kind: 'raise', to: target };
  }
  if (!call) return { kind: 'check' };
  if (
    (strength < 0.35 && call > BIG_BLIND) ||
    (call > Math.max(BIG_BLIND, Math.floor(v.stacks[v.turn]! * strength)) && strength < 0.8)
  )
    return { kind: 'fold' };
  return { kind: 'call' };
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
    !integer(v.smallBlind, 3) ||
    !integer(v.bigBlind, 3) ||
    v.smallBlind === v.bigBlind ||
    !integer(v.handNumber, 1e9, 1) ||
    !['preflop', 'flop', 'turn', 'river', 'hand'].includes(String(v.phase)) ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 4 ||
    !v.hands.every((h) => cards(h) && (h.length === 0 || h.length === 2)) ||
    !cards(v.deck) ||
    !cards(v.burned) ||
    !cards(v.board) ||
    ![0, 3, 4, 5].includes(v.board.length) ||
    v.burned.length !== Math.max(0, v.board.length - 2) ||
    !partition([...v.hands, v.deck, v.burned, v.board], DECK) ||
    !numbers(v.stacks, 4, 4000) ||
    !numbers(v.bets, 4, 4000) ||
    !numbers(v.contributions, 4, 4000) ||
    !numbers(v.actedAt, 4, 4000, -1) ||
    !integer(v.bet, 4000) ||
    !integer(v.minRaise, 4000, 20) ||
    !numbers(v.payouts, 4, 4000) ||
    !numbers(v.returned, 4, 4000) ||
    !Array.isArray(v.folded) ||
    v.folded.length !== 4 ||
    !v.folded.every((x) => typeof x === 'boolean') ||
    typeof v.showdown !== 'boolean' ||
    !cards(v.winners, 3) ||
    v.winners.length ||
    !event(v.event, 4, 51) ||
    !Array.isArray(v.pots) ||
    v.pots.length > 4 ||
    !v.pots.every(
      (p) =>
        object(p) &&
        integer(p.amount, 4000, 1) &&
        cards(p.eligible, 3) &&
        p.eligible.length > 0 &&
        cards(p.winners, 3) &&
        p.winners.length > 0 &&
        p.winners.every((w) => (p.eligible as number[]).includes(w)),
    )
  )
    return null;
  const s = v as unknown as Session,
    active = s.phase !== 'hand';
  if (
    s.stacks.reduce((a, b) => a + b, 0) +
      (active ? s.contributions.reduce((a, b) => a + b, 0) : 0) !==
      4000 ||
    s.bets.some((b, p) => b > s.contributions[p]!) ||
    s.bet < Math.max(...s.bets) ||
    s.hands.some(
      (h, p) => !h.length && (!s.folded[p] || s.stacks[p] !== 0 || s.contributions[p] !== 0),
    )
  )
    return null;
  if (
    active &&
    (s.folded[s.turn] ||
      !s.stacks[s.turn] ||
      !s.hands[s.turn]!.length ||
      s.pots.length ||
      s.showdown ||
      s.payouts.some((x) => x !== 0) ||
      s.returned.some((x) => x !== 0) ||
      s.board.length !== { preflop: 0, flop: 3, turn: 4, river: 5, hand: 0 }[s.phase])
  )
    return null;
  if (
    !active &&
    (s.stacks.filter((x) => x > 0).length < 2 ||
      s.turn !== 0 ||
      s.payouts.reduce((a, b) => a + b, 0) !== s.contributions.reduce((a, b) => a + b, 0) ||
      (s.showdown && s.board.length !== 5))
  )
    return null;
  return JSON.parse(JSON.stringify(s)) as Session;
}
