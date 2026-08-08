/**
 * The opponent — and, more importantly, **what the opponent can see**.
 *
 * Closed-source card apps have been suspected of peeking at the player's hand
 * for as long as they have existed, and the suspicion cannot be argued away.
 * So it is settled in the type system instead: everything this file reads
 * arrives as a `CpuView`, and a `CpuView` has nowhere to put the opponent's
 * cards or the order of the stock. `buildCpuView` is the only bridge from the
 * full `HandState`, it copies out one seat's cards and the public record, and
 * its test re-deals every hidden card to prove the view does not move.
 *
 * What the view *does* carry is what a person at the table would have: their
 * own hand, the discard pile, how many cards are left face down, how many the
 * opponent holds, the score, and the log of what everybody did — including
 * which cards the opponent took off the pile. An expert remembers all of that;
 * this CPU may too, and no more.
 *
 * The deal's seed never reaches here (the plan: cpu.ts は配札シードを受け取
 * らない). Ties need a coin, so one float comes in as a second argument from a
 * stream of its own — a number, not a key to the deck.
 *
 * There is no search: every decision below is a heuristic that runs in a
 * handful of exhaustive eleven-card meld solves, well inside the CPU's own
 * 450ms pause (docs/GAME_LIFECYCLE.md「CPU 探索」).
 */
import { cardOf, RANKS, rankOf, SUITS, suitOf, type Card } from './cards';
import { bestMeldPlan, type MeldPlan } from './melds';
import {
  HAND_SIZE,
  KNOCK_LIMIT,
  opponentOf,
  type Difficulty,
  type HandAction,
  type HandState,
  type Phase,
  type PublicEvent,
  type Seat,
} from './types';

/**
 * Everything the CPU is allowed to know. There is deliberately no field for
 * the opponent's cards or for the stock's order: add one and the peeking is
 * visible in the diff, which is the whole point of the type existing.
 */
export interface CpuView {
  /** Which side of the table this is. The log's seats are read against it. */
  readonly seat: Seat;
  readonly difficulty: Difficulty;
  readonly phase: Phase;
  /** This seat's own cards, ascending. */
  readonly hand: readonly Card[];
  /** Face up on the table, bottom first. The end is the takeable top. */
  readonly discardPile: readonly Card[];
  /** How many cards are left face down — not which, and not in what order. */
  readonly stockCount: number;
  /** How many cards the opponent holds. Never which ones. */
  readonly opponentCardCount: number;
  /** The card taken off the pile this turn, which may not go back down. */
  readonly takenFromDiscard: Card | null;
  readonly mustDrawStock: boolean;
  /** What everyone saw, oldest first — including who took what off the pile. */
  readonly log: readonly PublicEvent[];
  readonly selfScore: number;
  readonly opponentScore: number;
}

/**
 * The one bridge from the full state to the view. Copies rather than
 * references, so a view can never be walked back to the hand it came from.
 */
export function buildCpuView(
  hand: HandState,
  seat: Seat,
  difficulty: Difficulty,
  scores: readonly [number, number],
): CpuView {
  return {
    seat,
    difficulty,
    phase: hand.phase,
    hand: [...hand.hands[seat]],
    discardPile: [...hand.discard],
    stockCount: hand.stock.length,
    opponentCardCount: hand.hands[opponentOf(seat)].length,
    takenFromDiscard: hand.takenFromDiscard,
    mustDrawStock: hand.mustDrawStock,
    log: [...hand.log],
    selfScore: scores[seat]!,
    opponentScore: scores[opponentOf(seat)]!,
  };
}

/**
 * What the public record adds up to. `gone` is every card that cannot be in
 * the stock; `holds` is the far smaller set the opponent is *known* to have,
 * because they took it off the pile in the open and it has not come back.
 */
export interface Knowledge {
  readonly gone: ReadonlySet<Card>;
  readonly holds: ReadonlySet<Card>;
  /** How many cards the opponent has taken off the pile this hand. */
  readonly takes: number;
}

export function knowledgeOf(view: CpuView): Knowledge {
  const inPile = new Set(view.discardPile);
  const mine = new Set(view.hand);
  const holds = new Set<Card>();
  let takes = 0;
  for (const event of view.log) {
    if (event.kind !== 'draw-discard' || event.seat === view.seat) continue;
    takes += 1;
    holds.add(event.card);
  }
  // A card they took and later threw away is back on the pile, and one they
  // took that has since come round to this hand is here. Either way it is no
  // longer evidence of what they are holding.
  for (const card of [...holds]) {
    if (inPile.has(card) || mine.has(card)) holds.delete(card);
  }
  const gone = new Set<Card>([...mine, ...inPile, ...holds]);
  return { gone, holds, takes };
}

/** The cards that would turn a two-card fragment into a meld. Empty when none would. */
export function completionsOf(a: Card, b: Card): Card[] {
  if (rankOf(a) === rankOf(b)) {
    const rank = rankOf(a);
    return SUITS.filter((suit) => suit !== suitOf(a) && suit !== suitOf(b)).map((suit) =>
      cardOf(suit, rank),
    );
  }
  if (suitOf(a) !== suitOf(b)) return [];
  const suit = suitOf(a);
  const low = Math.min(rankOf(a), rankOf(b));
  const high = Math.max(rankOf(a), rankOf(b));
  if (high - low === 1) {
    const out: Card[] = [];
    // The ace is the bottom of the ladder: there is no rank below it.
    if (low > 1) out.push(cardOf(suit, low - 1));
    if (high < RANKS) out.push(cardOf(suit, high + 1));
    return out;
  }
  if (high - low === 2) return [cardOf(suit, low + 1)];
  return [];
}

/** A fragment counts when a card that would finish it could still be out there. */
const isLive = (completions: readonly Card[], knowledge: Knowledge, live: boolean): boolean =>
  completions.length > 0 && (!live || completions.some((card) => !knowledge.gone.has(card)));

/** No hand has more than a few fragments worth holding; beyond that it is a wish. */
const MAX_POTENTIAL = 3;
/** What one live fragment is worth against a point of deadwood. */
const POTENTIAL_WEIGHT = 2;
/** How much a card the opponent visibly wants costs to throw. */
const DANGER_WEIGHT = 1;

/**
 * How many live two-card fragments sit in the deadwood. `live` — hard only —
 * discounts the ones whose finishing cards have all been seen already, which
 * is the card counting the difficulty is named for.
 */
export function potentialOf(
  deadwood: readonly Card[],
  knowledge: Knowledge,
  live: boolean,
): number {
  let count = 0;
  for (let i = 0; i < deadwood.length; i++) {
    for (let j = i + 1; j < deadwood.length; j++) {
      if (isLive(completionsOf(deadwood[i]!, deadwood[j]!), knowledge, live)) count += 1;
    }
  }
  return Math.min(count, MAX_POTENTIAL);
}

/**
 * How dangerous a card is to throw: the opponent took a card of that rank, or
 * a neighbour of it in the same suit, and has not thrown it back. Hard only —
 * it is the other half of reading the public record.
 */
export function riskOf(card: Card, knowledge: Knowledge): number {
  let risk = 0;
  for (const held of knowledge.holds) {
    if (held === card) continue;
    if (rankOf(held) === rankOf(card)) risk += 3;
    else if (suitOf(held) === suitOf(card) && Math.abs(rankOf(held) - rankOf(card)) <= 2) risk += 2;
  }
  return risk;
}

/**
 * What a ten-card hand is worth to hold, in points of deadwood adjusted for
 * what it might still become. Lower is better. Easy counts only the deadwood
 * — it plays what it can see and nothing more.
 */
function scoreOf(plan: MeldPlan, knowledge: Knowledge, difficulty: Difficulty): number {
  if (difficulty === 'easy') return plan.deadwoodValue;
  return (
    plan.deadwoodValue -
    POTENTIAL_WEIGHT * potentialOf(plan.deadwood, knowledge, difficulty === 'hard')
  );
}

interface DiscardOption {
  readonly card: Card;
  readonly score: number;
  readonly deadwoodValue: number;
}

/**
 * Every card that could be put down, best first. Ties inside a score are left
 * in card order, so the caller can pick from them with the tie-break float and
 * get the same answer every time.
 */
function rankDiscards(
  cards: readonly Card[],
  forbidden: Card | null,
  knowledge: Knowledge,
  difficulty: Difficulty,
): DiscardOption[] {
  const options: DiscardOption[] = [];
  for (const card of cards) {
    if (card === forbidden) continue;
    const plan = bestMeldPlan(cards.filter((held) => held !== card));
    const risk = difficulty === 'hard' ? DANGER_WEIGHT * riskOf(card, knowledge) : 0;
    options.push({
      card,
      score: scoreOf(plan, knowledge, difficulty) + risk,
      deadwoodValue: plan.deadwoodValue,
    });
  }
  return options.sort((a, b) => a.score - b.score || a.card - b.card);
}

/** Picks from equally-good candidates with the tie-break float. */
function pick<T>(options: readonly T[], tieBreak: number): T {
  const index = Math.floor(tieBreak * options.length);
  return options[Math.min(Math.max(index, 0), options.length - 1)]!;
}

/** Whether the card would sit next to something already held. */
function formsFragment(card: Card, hand: readonly Card[], knowledge: Knowledge, live: boolean) {
  return hand.some((held) => isLive(completionsOf(card, held), knowledge, live));
}

/**
 * Whether to take the face-up card rather than the stock.
 *
 * Taking is public — the opponent learns a card you wanted — so the bar is
 * "it does something", not "it is not worse". Three things clear it: the card
 * melds outright; it turns a hand that could not knock into one that can; or
 * (normal and hard) it joins a fragment and the hand is genuinely better for
 * holding it. Easy stops at the first of those, which is why it walks past
 * cards it should be collecting.
 */
function wantsUpcard(view: CpuView, knowledge: Knowledge, upcard: Card): boolean {
  const current = bestMeldPlan(view.hand);
  const extended = [...view.hand, upcard];
  if (bestMeldPlan(extended).melds.some((meld) => meld.cards.includes(upcard))) return true;

  const options = rankDiscards(extended, upcard, knowledge, view.difficulty);
  const best = options[0];
  if (best === undefined) return false;
  if (best.deadwoodValue <= KNOCK_LIMIT && current.deadwoodValue > KNOCK_LIMIT) return true;

  if (view.difficulty === 'easy') return false;
  const live = view.difficulty === 'hard';
  if (!formsFragment(upcard, view.hand, knowledge, live)) return false;
  return best.score < scoreOf(current, knowledge, view.difficulty);
}

/** Below this many cards face down, knock with whatever you have rather than nothing. */
const LATE_STOCK = 10;
/** Normal waits for a hand this tidy before knocking; hard is fussier still. */
const NORMAL_KNOCK_AT = 7;
const HARD_KNOCK_AT = 5;
/** …unless the opponent has been feeding off the pile, when waiting is the risk. */
const HARD_KNOCK_AT_PRESSED = 10;
const PRESSED_TAKES = 2;

/**
 * Whether to knock at this many points rather than play on. Knocking at ten
 * is legal and often wrong: the defender lays off and undercuts, and
 * twenty-five goes the other way. Easy does not know that.
 */
function wantsToKnock(view: CpuView, knowledge: Knowledge, deadwood: number): boolean {
  if (view.difficulty === 'easy') return true;
  if (view.stockCount <= LATE_STOCK) return true;
  if (view.difficulty === 'normal') return deadwood <= NORMAL_KNOCK_AT;
  return deadwood <= (knowledge.takes >= PRESSED_TAKES ? HARD_KNOCK_AT_PRESSED : HARD_KNOCK_AT);
}

function chooseDiscard(view: CpuView, knowledge: Knowledge, tieBreak: number): HandAction {
  const options = rankDiscards(view.hand, view.takenFromDiscard, knowledge, view.difficulty);

  // Gin is twenty-five points and cannot be laid off against. Nothing else on
  // this list is worth more, at any difficulty.
  const gin = options.filter((option) => option.deadwoodValue === 0);
  if (gin.length > 0) return { kind: 'knock', card: pick(gin, tieBreak).card };

  const knockable = options.filter((option) => option.deadwoodValue <= KNOCK_LIMIT);
  if (knockable.length > 0) {
    const lowest = Math.min(...knockable.map((option) => option.deadwoodValue));
    if (wantsToKnock(view, knowledge, lowest)) {
      const tied = knockable.filter((option) => option.deadwoodValue === lowest);
      return { kind: 'knock', card: pick(tied, tieBreak).card };
    }
  }

  const best = options[0]!.score;
  const tied = options.filter((option) => option.score === best);
  return { kind: 'discard', card: pick(tied, tieBreak).card };
}

/**
 * The CPU's turn, as an action the engine can apply. Null only when the hand
 * is over — a seat whose turn it is always has something to do.
 *
 * Deterministic: the same view and the same tie-break float always produce the
 * same action, at every difficulty. That is what makes a saved match resume
 * into the same game it was suspended from.
 */
export function chooseCpuAction(view: CpuView, tieBreak: number): HandAction | null {
  const knowledge = knowledgeOf(view);
  const upcard =
    view.discardPile.length === 0 ? null : view.discardPile[view.discardPile.length - 1]!;

  switch (view.phase) {
    case 'upcard':
      if (upcard === null) return { kind: 'pass-upcard' };
      return wantsUpcard(view, knowledge, upcard)
        ? { kind: 'take-upcard' }
        : { kind: 'pass-upcard' };
    case 'draw':
      if (view.mustDrawStock || upcard === null) return { kind: 'draw-stock' };
      return wantsUpcard(view, knowledge, upcard)
        ? { kind: 'draw-discard' }
        : { kind: 'draw-stock' };
    case 'discard':
      // Eleven cards in hand, one of which may be untouchable: there is always
      // at least one card left to put down.
      if (view.hand.length !== HAND_SIZE + 1) return null;
      return chooseDiscard(view, knowledge, tieBreak);
    default:
      return null;
  }
}
