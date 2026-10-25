/**
 * The table and the hand (docs/SCOPA_RULES.md §2.5, §7, §11). Every place a
 * tap can land is a button; the screen owns the lift-and-take machine and these
 * components only draw it and report taps.
 *
 * THE TABLE: AT MOST THREE ROWS OF FIVE (§11.1)
 *
 * A card is placed only when nothing on the table shares its value, so by
 * arithmetic the table never holds more than thirteen cards (§2.2). With the
 * "place here" slot at the end that is fourteen places, inside three rows of
 * five. Self-play never needed more than ten (p99 seven), so one or two rows
 * is what a match looks like; the third row, when it comes, is overlapped
 * upwards so the printed index of every card in the row above stays visible.
 * A table card is 16% of the table's width A = min(100%, 420px), never a vw.
 *
 *                       A = 308 (320px)  A = 348 (360px)  A = 408 (420px)
 *   table card w          49.3px           55.7px           65.3px  (≥ 48px tap floor)
 *   table card h (1.4w)   69px             78px             91px
 *   hand card w (20%)     61.6px           69.6px           81.6px
 *
 * Those heights are arithmetic, not a measurement in a browser (§15.4).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { primieraOf } from '../../game/engine';
import { primieraValueOf, SUITS, type Card } from '../../game/cards';
import { YOU, type DealState, type Seat } from '../../game/types';
import { CardFace, inkOf, MiniCard } from './CardFace';
import { cardLabel, suitKeyOf } from './cardText';
import { SuitIcon } from './suits';

/** Five places to a row of the table (§11.1). */
const PER_ROW = 5;

/** Cards on their way to the side that took them. */
export interface FoldPart {
  readonly cards: readonly Card[];
  readonly toward: Seat;
}

/**
 * One beat's folds: the capture, and on the thirty-sixth card the cards left
 * on the table going to whoever took last (§2.2) — at most one part per side.
 */
export interface Fold {
  readonly parts: readonly FoldPart[];
  /** Identity, so two captures in a row restart the animation. */
  readonly serial: number;
}

export interface TableAreaProps {
  deal?: Pick<DealState, 'table' | 'stock'>;
  view?: { table: readonly Card[]; stockCount: number };
  /** The table cards a tap may do something with right now. */
  tappable: ReadonlySet<Card>;
  /** The cards already picked into the group being built. */
  picked: readonly Card[];
  /** Whether the lifted card can only be placed — the slot is the one way. */
  canPlace: boolean;
  folding: Fold | null;
  onTableTap: (card: Card) => void;
  onPlace: () => void;
}

export const TableArea = memo(function TableArea({
  deal,
  view,
  tappable,
  picked,
  canPlace,
  folding,
  onTableTap,
  onPlace,
}: TableAreaProps) {
  const { t } = useSettings();
  const shown = view ?? (deal ? { table: deal.table, stockCount: deal.stock.length } : null);
  if (!shown) return null;
  const places: (Card | 'slot')[] = [...shown.table, 'slot'];
  const rows: (Card | 'slot')[][] = [];
  for (let at = 0; at < places.length; at += PER_ROW) rows.push(places.slice(at, at + PER_ROW));

  return (
    <div className="sc-table-area">
      <p className="sc-stock" role="img" aria-label={t('scopaStockLabel', { n: shown.stockCount })}>
        <span className="sc-back sc-stock-back" aria-hidden="true" />
        <span aria-hidden="true">{shown.stockCount}</span>
      </p>
      <div
        className={`sc-table ${rows.length > 2 ? 'sc-table-tight' : ''}`}
        role="group"
        aria-label={t('scopaTableLabel')}
      >
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="sc-table-row">
            {row.map((place) => {
              if (place === 'slot') {
                return (
                  <button
                    key="slot"
                    type="button"
                    className={`sc-card sc-slot ${canPlace ? 'sc-slot-open' : ''}`}
                    aria-label={t('scopaPlaceHere')}
                    disabled={!canPlace}
                    onClick={onPlace}
                  />
                );
              }
              const inGroup = picked.includes(place);
              const enabled = tappable.has(place);
              const label = inGroup
                ? t('scopaTableInGroup', { card: cardLabel(t, place) })
                : enabled
                  ? t('scopaTableCanTake', { card: cardLabel(t, place) })
                  : cardLabel(t, place);
              return (
                <button
                  key={place}
                  type="button"
                  data-card={place}
                  className={[
                    'sc-card',
                    'sc-table-card',
                    inkOf(place),
                    inGroup ? 'sc-picked' : enabled ? 'sc-takeable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={label}
                  aria-pressed={inGroup}
                  disabled={!enabled}
                  onClick={() => onTableTap(place)}
                >
                  <CardFace card={place} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {folding?.parts.map((part) => (
        <div
          key={`${folding.serial}-${part.toward}`}
          className={`sc-fold ${part.toward === YOU ? 'sc-fold-down' : 'sc-fold-up'}`}
          aria-hidden="true"
        >
          {part.cards.map((card) => (
            <span key={card} className={`sc-card sc-fold-card ${inkOf(card)}`}>
              <CardFace card={card} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
});

export interface HandProps {
  hand: readonly Card[];
  /** Whether it is the player's card to play (and nothing modal is up). */
  active: boolean;
  /** The hand cards that can take something from this table (§7). */
  canTake: ReadonlySet<Card>;
  lifted: Card | null;
  onHandTap: (card: Card) => void;
}

export const Hand = memo(function Hand({ hand, active, canTake, lifted, onHandTap }: HandProps) {
  const { t } = useSettings();
  return (
    <div className="sc-hand" role="group" aria-label={t('scopaHandLabel')}>
      {hand.map((card) => {
        const takes = canTake.has(card);
        return (
          <button
            key={card}
            type="button"
            data-card={card}
            className={[
              'sc-card',
              'sc-hand-card',
              inkOf(card),
              active ? (takes ? 'sc-can-take' : 'sc-cannot') : '',
              lifted === card ? 'sc-lifted' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={
              takes
                ? t('scopaHandCanTake', { card: cardLabel(t, card) })
                : t('scopaHandCannotTake', { card: cardLabel(t, card) })
            }
            aria-pressed={lifted === card}
            disabled={!active}
            onClick={() => onHandTap(card)}
          >
            <CardFace card={card} />
          </button>
        );
      })}
    </div>
  );
});

/**
 * The player's own primiera, always on (§7): the best card of each suit among
 * what they have taken, its primiera value, and the total — arithmetic of the
 * rules, never advice. A missing suit is an empty frame. The CPU's is not
 * shown: its pile is face down at a real table.
 */
export const PrimieraStrip = memo(function PrimieraStrip({ taken }: { taken: readonly Card[] }) {
  const { t } = useSettings();
  const tally = primieraOf(taken);
  return (
    <div
      className="sc-primiera"
      role="group"
      aria-label={t('scopaPrimieraLabel', { total: tally.total })}
    >
      <span className="sc-primiera-name" aria-hidden="true">
        {t('scopaCatPrimiera')}
      </span>
      {SUITS.map((suit) => {
        const best = tally.best[suit] ?? null;
        const name = t(suitKeyOf(suit));
        return best === null ? (
          <span
            key={suit}
            className="sc-primiera-slot sc-primiera-missing"
            role="img"
            aria-label={t('scopaPrimieraMissing', { suit: name })}
          >
            <SuitIcon suit={suit} />
          </span>
        ) : (
          <span
            key={suit}
            className="sc-primiera-slot"
            role="img"
            aria-label={t('scopaPrimieraSuit', {
              suit: name,
              card: cardLabel(t, best),
              value: primieraValueOf(best),
            })}
          >
            <MiniCard card={best} />
            <span className="sc-primiera-value">{primieraValueOf(best)}</span>
          </span>
        );
      })}
      <span className="sc-primiera-total" aria-hidden="true">
        = {tally.total}
      </span>
    </div>
  );
});
