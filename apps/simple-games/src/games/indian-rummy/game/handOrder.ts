/**
 * The player's own arrangement of their hand (docs/INDIAN_RUMMY_RULES.md, "Hand
 * arrangement"). An order is presentation only: declaring, penalties, the CPU
 * and the Nearby host read which cards a hand holds, never where they sit.
 */
import { cards, type Card } from './cards';

/**
 * Suit, then rank, the second deck's copy after the first: the order every hand
 * was shown in before arranging existed, so a save from then resumes the way
 * the player last saw it.
 */
export const sortHand = (hand: readonly Card[]): Card[] =>
  [...hand].sort((a, b) => (a % 52) - (b % 52) || a - b);

/**
 * The hand in the player's order. A card that left the hand drops out; a card
 * that joined it — a draw — goes to the right end, where a player looks for the
 * card just taken. A new deal never relies on this: its callers mark the deal
 * boundary themselves and start from `sortHand` (the game context when it
 * deals, the Nearby table at the deal it is shown). An order that keeps less
 * than half of the hand — none at all, or a stale one — still starts again
 * from the sorted hand rather than show the engine's dealing order.
 */
export function arrangeHand(order: readonly Card[], hand: readonly Card[]): Card[] {
  const inHand = new Set(hand),
    kept: Card[] = [],
    seen = new Set<Card>();
  for (const card of order)
    if (inHand.has(card) && !seen.has(card)) {
      seen.add(card);
      kept.push(card);
    }
  if (kept.length * 2 < hand.length) return sortHand(hand);
  return [...kept, ...hand.filter((card) => !seen.has(card))];
}

/** `order` with `card` taken out and put back at index `to` (clamped). */
export function moveCard(order: readonly Card[], card: Card, to: number): Card[] {
  if (!order.includes(card)) return [...order];
  const next = order.filter((c) => c !== card);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, card);
  return next;
}

export const sameOrder = (a: readonly Card[], b: readonly Card[]): boolean =>
  a.length === b.length && a.every((card, i) => card === b[i]);

/** Whether `order` lists exactly the cards of `hand`, each once. */
export function isArrangementOf(order: unknown, hand: readonly Card[]): order is Card[] {
  if (!cards(order, 105) || order.length !== hand.length) return false;
  const inHand = new Set(hand);
  return order.every((card) => inHand.has(card));
}
