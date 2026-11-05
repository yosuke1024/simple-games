/** Two-seat throw-in Durak. See docs/DURAK_RULES.md. */
import {
  highRank,
  suitOf,
  shuffle,
  object,
  integer,
  cards,
  partition,
  event,
  outcome,
  type Card,
  type Status,
  type GameEvent,
} from './cards';
export * from './cards';
export const DECK = Array.from({ length: 52 }, (_, i) => i).filter((c) => highRank(c) >= 6);
export interface Pair {
  attack: Card;
  defense: Card | null;
}
export interface Session {
  seed: number;
  hands: Card[][];
  stock: Card[];
  discarded: Card[];
  trump: Card;
  table: Pair[];
  attacker: number;
  turn: number;
  limit: number;
  taking: boolean;
  moves: number;
  elapsedSeconds: number;
  status: Status;
  winners: number[];
  event: GameEvent;
}
export type Action =
  | { kind: 'attack'; card: Card }
  | { kind: 'defend'; card: Card }
  | { kind: 'take' }
  | { kind: 'done' };
export function createSession(seed: number, entropy?: () => number): Session {
  const deck = shuffle(DECK, seed, entropy),
    hands = [deck.splice(0, 6), deck.splice(0, 6)],
    trump = deck[0]!;
  const trumps = hands.map((h) =>
    Math.min(...h.filter((c) => suitOf(c) === suitOf(trump)).map(highRank)),
  );
  const attacker = trumps[1]! < trumps[0]! ? 1 : 0;
  return {
    seed: seed >>> 0,
    hands,
    stock: deck,
    discarded: [],
    trump,
    table: [],
    attacker,
    turn: attacker,
    limit: 6,
    taking: false,
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    winners: [],
    event: { kind: 'deal', seat: attacker, cards: [] },
  };
}
export const tableCards = (table: readonly Pair[]) =>
  table.flatMap((p) => (p.defense === null ? [p.attack] : [p.attack, p.defense]));
export function beats(defense: Card, attack: Card, trump: number): boolean {
  return suitOf(defense) === suitOf(attack)
    ? highRank(defense) > highRank(attack)
    : suitOf(defense) === trump;
}
export interface CpuView {
  hand: Card[];
  table: Pair[];
  trump: Card;
  attacker: number;
  turn: number;
  limit: number;
  taking: boolean;
  stockCount: number;
  counts: number[];
}
export const cpuView = (s: Session): CpuView => ({
  hand: [...s.hands[s.turn]!],
  table: s.table.map((p) => ({ ...p })),
  trump: s.trump,
  attacker: s.attacker,
  turn: s.turn,
  limit: s.limit,
  taking: s.taking,
  stockCount: s.stock.length,
  counts: s.hands.map((h) => h.length),
});
export function legalCards(v: CpuView): Card[] {
  if (v.turn !== v.attacker) {
    const open = v.table.find((p) => p.defense === null);
    return open ? v.hand.filter((c) => beats(c, open.attack, suitOf(v.trump))) : [];
  }
  if (v.table.length >= v.limit || (!v.taking && v.table.some((p) => p.defense === null)))
    return [];
  const ranks = tableCards(v.table).map(highRank);
  return v.hand.filter((c) => !v.table.length || ranks.includes(highRank(c)));
}
function finishBout(n: Session): void {
  const defender = 1 - n.attacker,
    all = tableCards(n.table);
  if (n.taking) n.hands[defender]!.push(...all);
  else n.discarded.push(...all);
  for (const seat of [n.attacker, defender])
    while (n.hands[seat]!.length < 6 && n.stock.length) n.hands[seat]!.push(n.stock.pop()!);
  if (!n.stock.length) {
    n.winners = [0, 1].filter((p) => !n.hands[p]!.length);
    if (n.winners.length) n.status = outcome(n.winners);
  }
  if (!n.taking) n.attacker = defender;
  n.table = [];
  n.taking = false;
  n.turn = n.attacker;
  n.limit = Math.min(6, n.hands[1 - n.attacker]!.length);
}
export function step(s: Session, a: Action): Session | null {
  if (s.status !== 'playing' || !object(a)) return null;
  const n: Session = {
      ...s,
      hands: s.hands.map((h) => [...h]),
      stock: [...s.stock],
      discarded: [...s.discarded],
      table: s.table.map((p) => ({ ...p })),
      moves: s.moves + 1,
    },
    seat = s.turn;
  if (a.kind === 'attack' || a.kind === 'defend') {
    if ((a.kind === 'attack') !== (seat === s.attacker) || !legalCards(cpuView(s)).includes(a.card))
      return null;
    n.hands[seat] = n.hands[seat]!.filter((c) => c !== a.card);
    if (a.kind === 'attack') {
      n.table.push({ attack: a.card, defense: null });
      if (!s.taking) n.turn = 1 - seat;
    } else {
      n.table.find((p) => p.defense === null)!.defense = a.card;
      n.turn = s.attacker;
    }
    n.event = { kind: a.kind, seat, cards: [a.card] };
  } else if (a.kind === 'take') {
    if (seat === s.attacker || !s.table.some((p) => p.defense === null) || s.taking) return null;
    n.taking = true;
    n.turn = s.attacker;
    n.event = { kind: 'take', seat, cards: [] };
  } else if (a.kind === 'done') {
    if (
      seat !== s.attacker ||
      !s.table.length ||
      (!s.taking && s.table.some((p) => p.defense === null))
    )
      return null;
    n.event = {
      kind: s.taking ? 'pickup' : 'defended',
      seat: 1 - s.attacker,
      cards: tableCards(s.table),
    };
    finishBout(n);
  } else return null;
  return n;
}
export function chooseCpuMove(v: CpuView): Action {
  const legal = legalCards(v).sort(
    (a, b) =>
      highRank(a) +
      (suitOf(a) === suitOf(v.trump) ? 20 : 0) -
      (highRank(b) + (suitOf(b) === suitOf(v.trump) ? 20 : 0)),
  );
  if (v.turn !== v.attacker)
    return legal.length ? { kind: 'defend', card: legal[0]! } : { kind: 'take' };
  if (
    legal.length &&
    (!v.table.length || v.taking || suitOf(legal[0]!) !== suitOf(v.trump) || v.stockCount === 0)
  )
    return { kind: 'attack', card: legal[0]! };
  return { kind: 'done' };
}
export function restore(v: unknown): Session | null {
  if (
    !object(v) ||
    !integer(v.seed, 0xffffffff) ||
    !integer(v.moves) ||
    !integer(v.elapsedSeconds, 1e12) ||
    v.status !== 'playing' ||
    !integer(v.turn, 1) ||
    !integer(v.attacker, 1) ||
    !integer(v.trump, 51) ||
    !DECK.includes(v.trump) ||
    !integer(v.limit, 6, 1) ||
    typeof v.taking !== 'boolean' ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 2 ||
    !v.hands.every((h) => cards(h)) ||
    !cards(v.stock) ||
    !cards(v.discarded) ||
    !cards(v.winners, 1) ||
    v.winners.length ||
    !Array.isArray(v.table) ||
    v.table.length > v.limit ||
    !v.table.every(
      (p) => object(p) && integer(p.attack, 51) && (p.defense === null || integer(p.defense, 51)),
    ) ||
    !event(v.event, 2, 51)
  )
    return null;
  const t = v.table as Pair[],
    defender = 1 - v.attacker;
  if (
    !partition([...v.hands, v.stock, v.discarded, tableCards(t)], DECK) ||
    (v.stock.length && v.stock[0] !== v.trump) ||
    t.some((p) => p.defense !== null && !beats(p.defense, p.attack, suitOf(v.trump as number))) ||
    (!v.taking && t.filter((p) => p.defense === null).length > 1) ||
    v.turn !== (v.taking || !t.some((p) => p.defense === null) ? v.attacker : defender) ||
    (!t.length && (v.taking || !v.hands[0]!.length || !v.hands[1]!.length))
  )
    return null;
  for (let i = 1; i < t.length; i++)
    if (!tableCards(t.slice(0, i)).some((c) => highRank(c) === highRank(t[i]!.attack))) return null;
  return JSON.parse(JSON.stringify(v)) as Session;
}
