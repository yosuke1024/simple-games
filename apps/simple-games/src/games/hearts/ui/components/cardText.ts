/**
 * Card naming shared by the table, the settlement and the tutorial: the
 * printed rank (2–10, J, Q, K, A — kept in Latin like the game titles) and the
 * localized spoken name (suit names are translation keys, not glyphs left to
 * the screen reader's mercy).
 *
 * The rank table is this game's own, not Gin Rummy's: here rank 1 is the two
 * and rank 13 is the ace, because a trick is taken by the highest card of the
 * suit led and the ace is the highest there is (game/cards.ts). Copying the
 * table rather than sharing it is what keeps that difference visible — the two
 * games disagree about what an ace is worth, and a shared table would have to
 * pretend they did not.
 */
import type { MessageKey, TranslateVars } from '@/i18n';
import { rankOf, suitOf, type Card, type PassDirection } from '../../game';

const RANK_TEXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export const rankText = (card: Card): string => RANK_TEXT[rankOf(card) - 1]!;

const SUIT_KEYS = [
  'heartsSuit_spades',
  'heartsSuit_hearts',
  'heartsSuit_diamonds',
  'heartsSuit_clubs',
] as const;

export const suitKey = (card: Card): (typeof SUIT_KEYS)[number] => SUIT_KEYS[suitOf(card)];

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** The spoken card name, e.g. "Q of spades" in the current language. */
export const cardLabel = (t: Translate, card: Card): string =>
  t('heartsCardLabel', { rank: rankText(card), suit: t(suitKey(card)) });

/** A list of cards read out as one string, e.g. the three being passed. */
export const cardListLabel = (t: Translate, cards: readonly Card[]): string =>
  cards.map((card) => cardLabel(t, card)).join(', ');

/** What a seat is called on screen. The digits are the same in every locale. */
export const seatLabel = (t: Translate, seat: number): string =>
  seat === 0 ? t('heartsYou') : t('heartsCpuSeat', { n: seat });

/**
 * Where the three cards are going, drawn and said. The arrow points at the
 * seat that will get them — left is the seat on the left of the screen,
 * across is the one at the top — which is the whole reason the table is laid
 * out as directions.
 *
 * `none` is the fourth hand of the cycle, and it is unreachable here: a hand
 * that passes nothing never enters the pass at all (game/engine.ts deals it
 * straight into the tricks). The entry exists so the map is total.
 */
export const PASS_ARROWS: Readonly<Record<PassDirection, string>> = {
  left: '←',
  across: '↑',
  right: '→',
  none: '·',
};

export const PASS_WORD_KEYS = {
  left: 'heartsPassLeft',
  across: 'heartsPassAcross',
  right: 'heartsPassRight',
  none: 'heartsPassPrompt',
} as const satisfies Record<PassDirection, MessageKey>;
