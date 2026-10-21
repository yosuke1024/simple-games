/**
 * The lift-and-take machine of docs/SCOPA_RULES.md §2.5, as pure functions of
 * the table, the lifted card and the group picked so far. The screen keeps the
 * state; this decides what a tap on the table means and which cards may be
 * tapped at all. Every answer comes from `captureOptions` — the one
 * enumeration the engine, the CPU and the saved-game replay also read (§2.2) —
 * so the screen can never offer a capture the rules would refuse.
 */
import {
  captureOptions,
  sortedCards,
  valueOf,
  type Card,
  type CaptureSet,
  type Move,
} from '../game';

/** How the lifted card can take: not at all, one same-value card, or a sum. */
export type TakeKind = 'place' | 'same' | 'sum';

export interface Lift {
  readonly card: Card;
  readonly options: readonly CaptureSet[];
  readonly kind: TakeKind;
}

export function liftOf(table: readonly Card[], card: Card): Lift {
  const options = captureOptions(table, card);
  const kind: TakeKind = options.length === 0 ? 'place' : options[0]!.length === 1 ? 'same' : 'sum';
  return { card, options, kind };
}

const sumOf = (cards: readonly Card[]): number => cards.reduce((sum, c) => sum + valueOf(c), 0);

const contains = (set: readonly Card[], cards: readonly Card[]): boolean =>
  cards.every((card) => set.includes(card));

/**
 * The table cards a tap may do something with: the cards already picked (a
 * tap takes one back out), and every card that still leaves a legal capture
 * containing the group so far. A card that would pass the sum, or belongs to
 * no capture, cannot be pressed — it is simply not offered (§2.5).
 */
export function tappableCards(lift: Lift | null, picked: readonly Card[]): Set<Card> {
  const out = new Set<Card>(picked);
  if (lift === null) return out;
  for (const option of lift.options) {
    if (!contains(option, picked)) continue;
    for (const card of option) out.add(card);
  }
  return out;
}

/** What a tap on a table card does: take now, or change the group. */
export type TableTap =
  | { readonly kind: 'take'; readonly move: Move }
  | { readonly kind: 'group'; readonly picked: readonly Card[] }
  | { readonly kind: 'none' };

export function tapTable(lift: Lift | null, picked: readonly Card[], card: Card): TableTap {
  if (lift === null || !tappableCards(lift, picked).has(card)) return { kind: 'none' };
  // One same-value card, or the only capture there is: the tap takes it.
  if (lift.kind === 'same') return { kind: 'take', move: { card: lift.card, captured: [card] } };
  if (lift.options.length === 1) {
    return { kind: 'take', move: { card: lift.card, captured: lift.options[0]! } };
  }
  if (picked.includes(card)) return { kind: 'group', picked: picked.filter((c) => c !== card) };
  const group = sortedCards([...picked, card]);
  // Every set of two or more table cards summing to the card's value is a
  // capture (§2.2), so reaching the value is reaching one: take it.
  if (sumOf(group) === valueOf(lift.card)) {
    return { kind: 'take', move: { card: lift.card, captured: group } };
  }
  return { kind: 'group', picked: group };
}

/** The sum of the group so far, for the line. */
export const pickedSum = sumOf;
