/**
 * Card naming shared by the table and the tutorial: the printed rank (A, 2–10,
 * J, Q, K — kept in Latin like the game titles) and the localized spoken name
 * (docs/SPIDER_SOLITAIRE_RULES.md §12: suit names are translation keys, not
 * glyphs left to the screen reader's mercy).
 *
 * Everything here takes the suit count, because a card's suit is derived from
 * the difficulty rather than stored on the card (game/types.ts).
 */
import type { MessageKey, TranslateVars } from '@/i18n';
import { rankOf, suitOf, type Card, type SuitCount } from '../../game';

const RANK_TEXT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export const rankText = (card: Card): string => RANK_TEXT[rankOf(card) - 1]!;

const SUIT_KEYS = [
  'spiderSuit_spades',
  'spiderSuit_hearts',
  'spiderSuit_diamonds',
  'spiderSuit_clubs',
] as const;

export const suitKey = (card: Card, suitCount: SuitCount): (typeof SUIT_KEYS)[number] =>
  SUIT_KEYS[suitOf(card, suitCount)];

/** The spoken card name, e.g. "Q of hearts" in the current language. */
export function cardLabel(
  t: (key: MessageKey, vars?: TranslateVars) => string,
  card: Card,
  suitCount: SuitCount,
): string {
  return t('spiderCardLabel', { rank: rankText(card), suit: t(suitKey(card, suitCount)) });
}
