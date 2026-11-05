/** Thirteen-card Indian Rummy. See docs/INDIAN_RUMMY_RULES.md. */
import {
  rankOf,
  suitOf,
  shuffle,
  object,
  integer,
  numbers,
  cards,
  partition,
  event,
  outcome,
  type Card,
  type Status,
  type GameEvent,
} from './cards';
export * from './cards';
const DECK = Array.from({ length: 106 }, (_, i) => i);
export const isWild = (card: Card, wildRank: number) => card >= 104 || rankOf(card) === wildRank;
export const points = (card: Card, wildRank: number) =>
  isWild(card, wildRank) ? 0 : rankOf(card) === 1 ? 10 : Math.min(rankOf(card), 10);
export type MeldKind = 'pure' | 'sequence' | 'set';
export interface Meld {
  cards: Card[];
  kind: MeldKind;
}
export function meldKind(hand: readonly Card[], wildRank: number): MeldKind | null {
  if (hand.length < 3 || hand.length > 13 || new Set(hand).size !== hand.length) return null;
  const ordinary = hand.filter((c) => !isWild(c, wildRank)),
    wilds = hand.length - ordinary.length;
  const sequence = (cs: readonly Card[], length: number) => {
    if (!cs.length || cs.some((c) => c >= 104 || suitOf(c) !== suitOf(cs[0]!))) return false;
    const low = cs.map(rankOf);
    if (new Set(low).size !== low.length) return false;
    return [low, low.map((r) => (r === 1 ? 14 : r))].some((rs) => {
      const lo = Math.min(...rs),
        hi = Math.max(...rs);
      return hi - lo < length && Math.max(1, hi - length + 1) <= Math.min(lo, 15 - length);
    });
  };
  if (sequence(hand, hand.length)) return 'pure';
  if (wilds && sequence(ordinary, hand.length)) return 'sequence';
  if (
    hand.length <= 4 &&
    ordinary.length &&
    ordinary.every((c) => rankOf(c) === rankOf(ordinary[0]!)) &&
    new Set(ordinary.map(suitOf)).size === ordinary.length
  )
    return 'set';
  return null;
}
interface Candidate {
  mask: number;
  kind: MeldKind;
  points: number;
  count: number;
}
interface Packed {
  points: number;
  count: number;
  quality: number;
  melds: Candidate[];
}
export interface Analysis {
  complete: boolean;
  groups: Meld[];
  unmatched: Card[];
  penalty: number;
  quality: number;
}
/** One memoized search is reused for every possible discard from a fourteen-card hand. */
export function analyzer(hand: readonly Card[], wildRank: number): (mask?: number) => Analysis {
  if (hand.length > 14 || new Set(hand).size !== hand.length)
    throw new Error('Expected at most fourteen distinct cards');
  const full = (1 << hand.length) - 1,
    byBit: Candidate[][] = Array.from({ length: hand.length }, () => []),
    candidates: Candidate[] = [];
  for (let mask = 1; mask <= full; mask++) {
    const cs: Card[] = [];
    for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) cs.push(hand[i]!);
    if (cs.length < 3) continue;
    const kind = meldKind(cs, wildRank);
    if (!kind) continue;
    const candidate = {
      mask,
      kind,
      points: cs.reduce((n, c) => n + points(c, wildRank), 0),
      count: cs.length,
    };
    candidates.push(candidate);
    for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) byBit[i]!.push(candidate);
  }
  const pureCandidates = candidates.filter((m) => m.kind === 'pure');
  const memo = new Map<string, Packed | null>();
  function solve(
    mask: number,
    sequences: number,
    pure: boolean,
    mode: 'points' | 'progress' | 'pure',
  ): Packed | null {
    if (!mask) return !sequences && !pure ? { points: 0, count: 0, quality: 0, melds: [] } : null;
    const key = `${mask}:${sequences}:${pure ? 1 : 0}:${mode}`,
      cached = memo.get(key);
    if (cached !== undefined) return cached;
    const bit = 31 - Math.clz32(mask & -mask);
    // Choose the required pure sequence first. Otherwise identical wild-card
    // substitutions create thousands of branches that can never satisfy it.
    let best = pure ? null : solve(mask & ~(1 << bit), sequences, false, mode);
    const value = (x: Packed) => (mode === 'progress' ? x.quality : x.points * 100 + x.count);
    for (const m of pure ? pureCandidates : byBit[bit]!) {
      if ((mask & m.mask) !== m.mask || (mode === 'pure' && m.kind !== 'pure')) continue;
      const rest = solve(
        mask ^ m.mask,
        Math.max(0, sequences - (m.kind === 'set' ? 0 : 1)),
        pure && m.kind !== 'pure',
        mode,
      );
      if (!rest) continue;
      const proposal: Packed = {
        points: rest.points + m.points,
        count: rest.count + m.count,
        quality:
          rest.quality +
          m.count * 20 +
          m.points +
          (m.kind === 'pure' ? 200 : m.kind === 'sequence' ? 40 : 0),
        melds: [m, ...rest.melds],
      };
      if (!best || value(proposal) > value(best)) best = proposal;
    }
    memo.set(key, best);
    return best;
  }
  function greedyProgress(mask: number): Packed {
    const result: Packed = { points: 0, count: 0, quality: 0, melds: [] };
    for (const m of [...candidates].sort((a, b) => b.count - a.count || b.points - a.points)) {
      if ((mask & m.mask) !== m.mask) continue;
      result.melds.push(m);
      result.count += m.count;
      result.points += m.points;
      result.quality += m.count * 20 + m.points + (m.kind === 'sequence' ? 40 : 0);
      mask ^= m.mask;
    }
    return result;
  }
  return (mask = full) => {
    const total = hand.reduce((n, c, i) => n + (mask & (1 << i) ? points(c, wildRank) : 0), 0),
      count = hand.filter((_, i) => mask & (1 << i)).length;
    const legal = solve(mask, 2, true, 'points'),
      complete = Boolean(legal && legal.count === count),
      pure = complete ? legal : solve(mask, 0, true, 'pure'),
      // This affects CPU preference only; declaration and penalties remain exact.
      progress = complete
        ? legal!
        : !pure && hand.filter((c, i) => mask & (1 << i) && isWild(c, wildRank)).length >= 5
          ? greedyProgress(mask)
          : solve(mask, 0, false, 'progress')!;
    const best = legal && (!pure || legal.points >= pure.points) ? legal : pure,
      shown = legal ?? progress,
      covered = shown.melds.reduce((n, m) => n | m.mask, 0);
    return {
      complete,
      groups: shown.melds.map((m) => ({
        kind: m.kind,
        cards: hand.filter((_, i) => m.mask & (1 << i)),
      })),
      unmatched: hand.filter((_, i) => mask & (1 << i) && !(covered & (1 << i))),
      penalty: Math.min(80, total - (best?.points ?? 0)),
      quality: (complete ? 100000 : 0) + progress.quality - (total - (best?.points ?? 0)),
    };
  };
}
export const analyze = (hand: readonly Card[], wildRank: number): Analysis =>
  analyzer(hand, wildRank)();
export interface Session {
  seed: number;
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  indicator: Card;
  wildRank: number;
  phase: 'draw' | 'discard';
  picked: Card | null;
  turn: number;
  moves: number;
  elapsedSeconds: number;
  status: Status;
  winners: number[];
  penalties: number[];
  declaration: Meld[];
  event: GameEvent;
}
export type Action =
  { kind: 'draw'; source: 'stock' | 'discard' } | { kind: 'discard' | 'declare'; card: Card };
export function createSession(seed: number, entropy?: () => number): Session {
  const deck = shuffle(DECK, seed, entropy),
    hands = Array.from({ length: 4 }, () => deck.splice(0, 13)),
    indicator = deck.pop()!,
    top = deck.pop()!;
  return {
    seed: seed >>> 0,
    hands,
    stock: deck,
    discard: [top],
    indicator,
    wildRank: indicator >= 104 ? 1 : rankOf(indicator),
    phase: 'draw',
    picked: null,
    turn: 0,
    moves: 0,
    elapsedSeconds: 0,
    status: 'playing',
    winners: [],
    penalties: [],
    declaration: [],
    event: { kind: 'deal', seat: 0, cards: [top] },
  };
}
export interface CpuView {
  hand: Card[];
  top: Card | null;
  wildRank: number;
  phase: Session['phase'];
  picked: Card | null;
  stockCount: number;
  counts: number[];
}
export const cpuView = (s: Session): CpuView => ({
  hand: [...s.hands[s.turn]!],
  top: s.discard[s.discard.length - 1] ?? null,
  wildRank: s.wildRank,
  phase: s.phase,
  picked: s.picked,
  stockCount: s.stock.length,
  counts: s.hands.map((h) => h.length),
});
export function bestDiscard(
  hand: readonly Card[],
  wildRank: number,
  picked: Card | null = null,
): { card: Card; analysis: Analysis } {
  const inspect = analyzer(hand, wildRank),
    full = (1 << hand.length) - 1;
  const choices: { card: Card; analysis: Analysis }[] = [];
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    if (card === picked) continue;
    const choice = { card, analysis: inspect(full ^ (1 << i)) };
    if (choice.analysis.complete) return choice;
    choices.push(choice);
  }
  return choices.sort(
    (a, b) =>
      b.analysis.quality - a.analysis.quality ||
      points(b.card, wildRank) - points(a.card, wildRank) ||
      a.card - b.card,
  )[0]!;
}
export function chooseCpuMove(v: CpuView): Action {
  if (v.phase === 'draw') {
    if (
      v.top !== null &&
      !isWild(v.top, v.wildRank) &&
      bestDiscard([...v.hand, v.top], v.wildRank, v.top).analysis.quality >
        analyze(v.hand, v.wildRank).quality
    )
      return { kind: 'draw', source: 'discard' };
    return { kind: 'draw', source: 'stock' };
  }
  const choice = bestDiscard(v.hand, v.wildRank, v.picked);
  return { kind: choice.analysis.complete ? 'declare' : 'discard', card: choice.card };
}
export function step(s: Session, a: Action, entropy?: () => number): Session | null {
  if (s.status !== 'playing' || !object(a)) return null;
  const seat = s.turn,
    n: Session = {
      ...s,
      hands: s.hands.map((h) => [...h]),
      stock: [...s.stock],
      discard: [...s.discard],
      moves: s.moves + 1,
    };
  if (a.kind === 'draw') {
    if (s.phase !== 'draw' || !['stock', 'discard'].includes(a.source)) return null;
    if (a.source === 'discard') {
      const card = s.discard[s.discard.length - 1];
      if (card === undefined || isWild(card, s.wildRank)) return null;
      n.hands[seat]!.push(n.discard.pop()!);
      n.picked = card;
    } else {
      if (!n.stock.length) {
        if (n.discard.length < 2) return null;
        n.stock = shuffle(
          n.discard.slice(0, -1),
          (s.seed ^ Math.imul(n.moves, 0x9e3779b9)) >>> 0,
          entropy,
        );
        n.discard = n.discard.slice(-1);
      }
      n.hands[seat]!.push(n.stock.pop()!);
      n.picked = null;
    }
    n.phase = 'discard';
    n.event = {
      kind: a.source === 'stock' ? 'draw' : 'pickup',
      seat,
      cards: a.source === 'discard' ? [n.picked!] : [],
    };
  } else if (a.kind === 'discard' || a.kind === 'declare') {
    if (s.phase !== 'discard' || !s.hands[seat]!.includes(a.card) || a.card === s.picked)
      return null;
    n.hands[seat] = n.hands[seat]!.filter((c) => c !== a.card);
    if (a.kind === 'declare') {
      const result = analyze(n.hands[seat]!, s.wildRank);
      if (!result.complete) return null;
      n.winners = [seat];
      n.penalties = n.hands.map((h, p) => (p === seat ? 0 : analyze(h, s.wildRank).penalty));
      n.declaration = result.groups;
      n.status = outcome(n.winners);
    }
    n.discard.push(a.card);
    n.phase = 'draw';
    n.picked = null;
    n.turn = (seat + 1) % 4;
    n.event = { kind: a.kind, seat, cards: [a.card] };
  } else return null;
  return n;
}
export function restore(v: unknown): Session | null {
  if (
    !object(v) ||
    !integer(v.seed, 0xffffffff) ||
    !integer(v.moves) ||
    !integer(v.elapsedSeconds, 1e12) ||
    v.status !== 'playing' ||
    !integer(v.turn, 3) ||
    !integer(v.indicator, 105) ||
    !integer(v.wildRank, 13, 1) ||
    v.wildRank !== (v.indicator >= 104 ? 1 : rankOf(v.indicator)) ||
    !['draw', 'discard'].includes(String(v.phase)) ||
    !(v.picked === null || integer(v.picked, 105)) ||
    !Array.isArray(v.hands) ||
    v.hands.length !== 4 ||
    !v.hands.every(
      (h, p) => cards(h, 105) && h.length === (v.phase === 'discard' && p === v.turn ? 14 : 13),
    ) ||
    !cards(v.stock, 105) ||
    !cards(v.discard, 105) ||
    !partition([...v.hands, v.stock, v.discard, [v.indicator]], DECK) ||
    !numbers(v.winners, 0) ||
    !numbers(v.penalties, 0) ||
    !Array.isArray(v.declaration) ||
    v.declaration.length ||
    !event(v.event, 4, 105)
  )
    return null;
  if (
    (v.phase === 'draw' && (v.picked !== null || !v.discard.length)) ||
    (v.picked !== null &&
      (isWild(v.picked, v.wildRank) || !(v.hands[v.turn] as Card[]).includes(v.picked)))
  )
    return null;
  return JSON.parse(JSON.stringify(v)) as Session;
}
