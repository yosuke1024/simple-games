/**
 * Card naming shared by the table, the settlement and the tutorial: the
 * printed rank (A, 2–10, J, Q, K — kept in Latin like the game titles) and the
 * localized spoken name (suit names are translation keys, not glyphs left to
 * the screen reader's mercy).
 */
import type { MessageKey, TranslateVars } from '@/i18n';
import { rankOf, suitOf, type Card } from '../../game';

const RANK_TEXT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export const rankText = (card: Card): string => RANK_TEXT[rankOf(card) - 1]!;

const SUIT_KEYS = [
  'ginSuit_spades',
  'ginSuit_hearts',
  'ginSuit_diamonds',
  'ginSuit_clubs',
] as const;

export const suitKey = (card: Card): (typeof SUIT_KEYS)[number] => SUIT_KEYS[suitOf(card)];

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** The spoken card name, e.g. "Q of hearts" in the current language. */
export const cardLabel = (t: Translate, card: Card): string =>
  t('ginCardLabel', { rank: rankText(card), suit: t(suitKey(card)) });

/** A list of cards read out as one string, e.g. for a meld or the lay-offs. */
export const cardListLabel = (t: Translate, cards: readonly Card[]): string =>
  cards.map((card) => cardLabel(t, card)).join(', ');
