/**
 * The whole table: the CPU's seat above, the stock and the discard pile in the
 * middle, and the player's hand fanned along the bottom. Every place a tap can
 * land is a button; the screen owns the two-tap state machine and this
 * component only draws and reports taps.
 *
 * THE HAND FAN, AND WHY IT IS TWO ROWS
 *
 * The plan asked for eleven cards overlapped in one row, and for the tap width
 * of a single card to be measured before anything was built rather than after.
 * The arithmetic settles it, and it settles it against one row; the measurement
 * and its conclusion are recorded in docs/GIN_RUMMY_RULES.md §11.1.
 *
 * A row of n overlapping cards is (n − 1) visible strips plus one whole card:
 * `(n − 1)·s + w = A`, where A is the fan's own width — `min(100% − 12px
 * padding, 420px)`, never a vw (the board-width lesson in ARCHITECTURE.md).
 * The first tap of the two lands on a *strip*, so s is the tap target, and the
 * series' floor for one is `--tap-size: 48px`.
 *
 *   one row of 11        A = 308 (320px)   A = 348 (360px)   A = 408 (420px)
 *     widest strip s        26.4px            30.4px            35.4px
 *     …at w = s             (10s + w = A, so s = A/11 at best)
 *
 * Not close, and not fixable by shrinking the cards: at 420px — the widest
 * this game is ever laid out for — eleven strips of 48px would need 528px.
 * One row cannot hold eleven cards at this floor on any phone, so the fallback
 * the plan named is taken: **two rows, six and five** (`MAX_PER_ROW`, §11.1).
 *
 *   two rows, ≤6 each    A = 308 (320px)   A = 348 (360px)   A = 408 (420px)
 *     card    w = 20%       61.6px            69.6px            81.6px
 *     strip   s = 16%       49.3px            55.7px            65.3px  ✓
 *     height  1.4·w         86.2px            97.4px           114.2px
 *
 * Six cards is exactly 6 × 20% − 5 × 4% = 100% of the fan, so the geometry is
 * closed: a row can never overflow, and a row of five simply centres. That
 * exactness is also why a meld boundary does **not** open a gap — there is no
 * slack to open one with. Melds are marked instead, in a way that survives
 * being 80% covered: a coloured bar down the card's left edge, which is the
 * part of every overlapped card that stays visible, alternating between two
 * tints so neighbouring melds read apart. A card that starts a new group also
 * casts a felt-coloured sliver to its left, which separates the groups without
 * moving anything.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  bestMeldPlan,
  canDiscard,
  canKnock,
  isRed,
  suitOf,
  topDiscard,
  YOU,
  CPU,
  type Card,
  type HandState,
} from '../../game';
import { cardLabel, rankText } from './cardText';
import { SuitIcon } from './suits';

/**
 * The most cards one row may hold. Six is what the arithmetic above allows at
 * 320px; a seventh would put the strip under the series' 48px tap floor.
 */
const MAX_PER_ROW = 6;

/** One card of the arranged hand, and the group the arrangement put it in. */
interface FanCard {
  readonly card: Card;
  /** Which meld it belongs to, or null when it is deadwood. */
  readonly meld: number | null;
}

/**
 * The hand, sorted into melds and then deadwood (§7: the melds are arranged for
 * the player, and never arranged wrong).
 * `bestMeldPlan` is exhaustive, so this is the arrangement that leaves the
 * least deadwood, not merely a good one, and the player never has to sort
 * anything by hand (there is no manual reorder, on purpose).
 */
export function arrangeHand(cards: readonly Card[]): FanCard[] {
  const plan = bestMeldPlan(cards);
  const out: FanCard[] = [];
  plan.melds.forEach((meld, index) => {
    for (const card of meld.cards) out.push({ card, meld: index });
  });
  for (const card of plan.deadwood) out.push({ card, meld: null });
  return out;
}

/**
 * Where to break the fan into two rows. Balanced first — six and five for
 * eleven cards, five and five for ten — and then nudged, by at most one card
 * either way, onto a group boundary when one is in reach, so a meld is not
 * split across rows for nothing. Both rows stay within `MAX_PER_ROW`, which is
 * what keeps the tap width above.
 */
export function splitIndex(fan: readonly FanCard[]): number {
  const n = fan.length;
  if (n <= MAX_PER_ROW) return n;
  const balanced = Math.ceil(n / 2);
  const low = Math.max(1, n - MAX_PER_ROW);
  const high = Math.min(MAX_PER_ROW, n - 1);
  let best = Math.min(Math.max(balanced, low), high);
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let k = low; k <= high; k++) {
    if (fan[k]!.meld === fan[k - 1]!.meld) continue;
    const distance = Math.abs(k - balanced);
    if (distance < bestDistance) {
      best = k;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The printed face: corner index plus one large suit in the middle. The corner
 * is the only part an overlapped card shows, so it carries the identity — the
 * same split the patience shelf's cards use, for the same reason.
 */
function CardFace({ card }: { card: Card }) {
  const suit = suitOf(card);
  return (
    <>
      <span className="gr-card-index" aria-hidden="true">
        <span className="gr-card-rank">{rankText(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="gr-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

export interface GinRummyTableProps {
  hand: HandState;
  /** Whether the player may act at all right now (their turn, hand alive). */
  active: boolean;
  /** The knock has been asked for: only cards that could declare are takeable. */
  knockMode: boolean;
  /** The card lifted by the first tap, waiting for the second. */
  selected: Card | null;
  onDrawStock: () => void;
  onDrawDiscard: () => void;
  onCardTap: (card: Card) => void;
}

export const GinRummyTable = memo(function GinRummyTable({
  hand,
  active,
  knockMode,
  selected,
  onDrawStock,
  onDrawDiscard,
  onCardTap,
}: GinRummyTableProps) {
  const { t } = useSettings();

  const top = topDiscard(hand);
  const drawing = active && hand.phase === 'draw';
  const discarding = active && hand.phase === 'discard';

  const fan = arrangeHand(hand.hands[YOU]);
  const cut = splitIndex(fan);
  const rows = [fan.slice(0, cut), fan.slice(cut)].filter((row) => row.length > 0);

  /**
   * Whether this card can be put down this turn. A card just taken from the
   * pile cannot go straight back (the engine refuses it), and in knock mode
   * only a card that leaves a declarable hand can. Both sink the card rather
   * than scold a tap on it — an invalid tap is nothing, silently, with no
   * sound and no buzz (§2.2).
   */
  const takeable = (card: Card): boolean => {
    if (!discarding) return false;
    return knockMode ? canKnock(hand, card) : canDiscard(hand, card);
  };

  return (
    <div className="gr-table" role="group" aria-label={t('ginTableLabel')}>
      {/* The opponent's seat: how many cards it holds, and nothing about
          which — the backs are the whole truth of what is known here. */}
      <div
        className="gr-seat"
        role="group"
        aria-label={t('ginOpponentLabel', { n: hand.hands[CPU].length })}
      >
        {hand.hands[CPU].map((_, index) => (
          <span key={index} className="gr-card gr-back gr-seat-card" aria-hidden="true" />
        ))}
      </div>

      <div className="gr-centre">
        <button
          type="button"
          className="gr-card gr-back gr-pile-card"
          aria-label={t('ginStockLabel', { n: hand.stock.length })}
          disabled={!drawing || hand.stock.length === 0}
          onClick={onDrawStock}
        />

        {top !== null ? (
          <button
            type="button"
            data-card={top}
            className={`gr-card gr-pile-card ${isRed(top) ? 'gr-card-red' : 'gr-card-black'}`}
            aria-label={t('ginDiscardLabel', { card: cardLabel(t, top) })}
            // The forced stock draw after both players refuse the upcard is
            // the one moment the pile is on the table and untouchable.
            disabled={!drawing || hand.mustDrawStock}
            onClick={onDrawDiscard}
          >
            <CardFace card={top} />
          </button>
        ) : (
          // A recess rather than a button: the non-dealer may have taken the
          // upcard with nothing under it, and an empty pile is not a place a
          // tap can go. `role="img"` is what keeps it spoken all the same.
          <div
            className="gr-card gr-pile-card gr-slot-empty"
            role="img"
            aria-label={t('ginDiscardEmpty')}
          />
        )}
      </div>

      <div className="gr-hand" role="group" aria-label={t('ginHandLabel')}>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="gr-hand-row">
            {row.map((entry, index) => {
              const { card, meld } = entry;
              const enabled = takeable(card);
              const groupStart = index > 0 && row[index - 1]!.meld !== meld;
              return (
                <button
                  key={card}
                  type="button"
                  data-card={card}
                  className={[
                    'gr-card',
                    'gr-hand-card',
                    isRed(card) ? 'gr-card-red' : 'gr-card-black',
                    meld === null ? 'gr-deadwood-card' : `gr-meld-card gr-meld-${meld % 2}`,
                    groupStart ? 'gr-group-start' : '',
                    selected === card ? 'gr-selected' : '',
                    discarding && !enabled ? 'gr-sunk' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={
                    meld === null
                      ? t('ginCardDeadwood', { card: cardLabel(t, card) })
                      : t('ginCardInMeld', { card: cardLabel(t, card), n: meld + 1 })
                  }
                  aria-pressed={selected === card}
                  disabled={!enabled}
                  onClick={() => onCardTap(card)}
                >
                  <CardFace card={card} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
