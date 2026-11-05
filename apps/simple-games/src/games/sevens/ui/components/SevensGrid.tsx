import { useSettings } from '@/state/SettingsContext';
import { canPlay } from '../../game';
import { CardFace, cardClass, rankText, SUITS } from './CardFace';
export function SevensGrid({
  hand,
  table,
  lastCards,
  blocked,
  onPlay,
  animate = false,
}: {
  hand: readonly number[];
  table: readonly number[];
  lastCards: readonly number[];
  blocked: boolean;
  onPlay: (card: number) => void;
  animate?: boolean;
}) {
  const { t } = useSettings();
  const cardLabel = (card: number) =>
    t('sevensCard', { rank: rankText(card), suit: SUITS[Math.floor(card / 13)]! });
  return (
    <div className="sv-sevens-grid">
      {[0, 1, 2, 3].flatMap((suit) =>
        Array.from({ length: 13 }, (_, r) => {
          const card = suit * 13 + r,
            laid = table.includes(card),
            legal = hand.includes(card) && canPlay(card, table);
          return laid ? (
            <span
              className={`${cardClass(card)} ${lastCards.includes(card) ? 'sv-last-card' : ''} ${lastCards.includes(card) && animate ? 'sv-event-card' : ''}`}
              key={card}
              role="img"
              aria-label={cardLabel(card)}
            >
              <CardFace card={card} />
            </span>
          ) : legal ? (
            <button
              type="button"
              className="sv-slot is-target"
              key={card}
              disabled={blocked}
              aria-label={t('sevensPlaceCard', { card: cardLabel(card) })}
              onClick={() => onPlay(card)}
            >
              {rankText(card)}
            </button>
          ) : (
            <span className="sv-slot" key={card} aria-hidden="true">
              {rankText(card)}
            </span>
          );
        }),
      )}
    </div>
  );
}
