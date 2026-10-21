/**
 * Card naming shared by the table, the hand, the line, the settlement and the
 * tutorial: the printed face (A 2–7 J Q K — ASCII in every language,
 * docs/SCOPA_RULES.md §1) and the localized spoken name. Suit names are
 * translation keys, not glyphs left to the screen reader's mercy (§11.2).
 */
import type { MessageKey, TranslateVars } from '@/i18n';
import { faceOf, suitOf, type Card } from '../../game';

const SUIT_KEYS = [
  'scopaSuit_spades',
  'scopaSuit_hearts',
  'scopaSuit_diamonds',
  'scopaSuit_clubs',
] as const;

export const suitKey = (card: Card): (typeof SUIT_KEYS)[number] => SUIT_KEYS[suitOf(card)];

/** The spoken name of a suit by its number, for the primiera slots. */
export const suitKeyOf = (suit: number): (typeof SUIT_KEYS)[number] => SUIT_KEYS[suit]!;

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** The spoken card name, e.g. "7 of diamonds" in the current language. */
export const cardLabel = (t: Translate, card: Card): string =>
  t('scopaCardLabel', { face: faceOf(card), suit: t(suitKey(card)) });

/** A list of cards read out as one string — every card, however many (§11.2). */
export const cardListLabel = (t: Translate, cards: readonly Card[]): string =>
  cards.map((card) => cardLabel(t, card)).join(', ');

/** Hearts and diamonds print red, in any deck. */
export const isRed = (card: Card): boolean => suitOf(card) === 1 || suitOf(card) === 2;
