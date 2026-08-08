/**
 * The player's own cards: the fan along the bottom, and — during the pass —
 * the tray of three above it.
 *
 * THE HAND FAN, AND WHY IT IS THREE ROWS
 *
 * The plan left this number open and asked for it to be measured before
 * anything was built rather than after; the arithmetic settles it, and it
 * settles it at three. The measurements and their conclusion are recorded in
 * docs/HEARTS_RULES.md §11.1.
 *
 * A row of n cards laid side by side, each overlapping the last, is (n − 1)
 * visible strips plus one whole card: `(n − 1)·s + w = A`, where A is the
 * fan's own width — `min(100% − 12px padding, 420px)`, never a vw (the
 * board-width lesson in ARCHITECTURE.md). The first tap of the two lands on a
 * strip, so s is the tap target, and the series' floor for one is
 * `--tap-size: 48px`.
 *
 *   one row of 13        A = 308 (320px)   A = 348 (360px)   A = 408 (420px)
 *     widest strip s        23.7px  ✗         26.8px  ✗         31.4px  ✗
 *
 *   two rows (7 + 6)     A = 308 (320px)   A = 348 (360px)   A = 408 (420px)
 *     strip at w = 20%      41.1px  ✗         46.4px  ✗         54.4px
 *     strip at w = s        44.0px  ✗         49.7px            58.3px
 *
 * Thirteen cards in one row is not close and cannot be fixed by shrinking the
 * cards; seven in a row is under the floor at 320px *however* wide the cards
 * are, because seven strips of 48px need 336px and the fan has 308. So the
 * hand takes **three rows of at most five** (`MAX_PER_ROW`), and five is where
 * the geometry closes: a card 20% of the fan wide, laid out with no horizontal
 * overlap at all, makes a full row exactly 5 × 20% = 100%.
 *
 * The overlap goes the other way instead. The rows are pitched 18% of the fan
 * apart, so a row that has one below it shows its top band — which is where
 * the index corner is printed, the same argument the horizontal overlap makes
 * turned ninety degrees. The tap target is therefore a rectangle s × p, and
 * both sides of it clear the floor:
 *
 *   three rows (5+4+4)   A = 308 (320px)   A = 348 (360px)   A = 408 (420px)
 *     card    w = 20%       61.6px            69.6px            81.6px
 *     strip   s = 20%       61.6px  ✓         69.6px  ✓         81.6px  ✓
 *     band    p = 18%       55.4px  ✓         62.6px  ✓         73.4px  ✓
 *     card height 28%       86.2px            97.4px           114.2px
 *     fan height  64%      197.1px           222.7px           261.1px
 *
 * That card is the same size as the Gin Rummy hand card at every width, which
 * is not a coincidence worth breaking: the two games differ in how many cards
 * a hand holds, not in how big a card is.
 *
 * RE-FLOWING AS THE HAND EMPTIES. The number of rows is `ceil(n / 5)`, so the
 * fan drops to two rows at ten cards and to one at five — the table gains the
 * height back exactly as the tricks pile up and the trick in the middle has
 * more to show. Rows are balanced with the earlier ones taking the extra, so
 * thirteen is 5 + 4 + 4. During the pass the fan is always two rows: three of
 * the thirteen are on the tray.
 *
 * THE ORDER IS SUIT, THEN RANK. `hands[seat]` is already stored that way
 * (a card is `suit × 13 + rank − 1`), and it is the order a trick-taking game
 * wants: following suit means finding a suit, so the suits are the groups.
 * Gin Rummy sorts by meld instead, because there the groups are melds — same
 * fan, different game. A card that starts a new suit casts a felt-coloured
 * sliver to its left, which separates the groups without moving anything.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { suitOf, type Card, type PassDirection } from '../../game';
import { CardFace, faceClass } from './CardFace';
import { cardLabel, PASS_ARROWS } from './cardText';

/**
 * The most cards one row may hold. Five is what the arithmetic above allows at
 * 320px; a sixth would put the strip under the series' 48px tap floor.
 */
export const MAX_PER_ROW = 5;

/** How many cards go to the pass. Three, always (game/types.ts PASS_SIZE). */
const TRAY_SLOTS = 3;

/**
 * The fan broken into rows: as few rows as the tap floor allows, balanced,
 * with the earlier rows taking the extra card. Thirteen is 5 + 4 + 4, eleven
 * is 4 + 4 + 3, ten is 5 + 5.
 */
export function splitRows(cards: readonly Card[]): Card[][] {
  const total = cards.length;
  if (total === 0) return [];
  const rows = Math.ceil(total / MAX_PER_ROW);
  const out: Card[][] = [];
  let at = 0;
  for (let row = 0; row < rows; row++) {
    const size = Math.ceil((total - at) / (rows - row));
    out.push([...cards.slice(at, at + size)]);
    at += size;
  }
  return out;
}

export interface HeartsHandProps {
  /** The cards still in the fan, ascending. Cards on the tray are not here. */
  cards: readonly Card[];
  /** The cards picked out to pass, ascending. Empty outside the pass. */
  chosen: readonly Card[];
  /** Whether the pass tray is on screen at all. */
  passing: boolean;
  /** Which cards a tap may do something with right now. */
  takeable: readonly Card[];
  /** Whether the player is to act — decides whether a refusal sinks the card. */
  active: boolean;
  /** The card the first tap lifted, waiting for the second. */
  lifted: Card | null;
  /** Which way the three are going, for the tray's arrow. */
  direction: PassDirection;
  onCardTap: (card: Card) => void;
}

export const HeartsHand = memo(function HeartsHand({
  cards,
  chosen,
  passing,
  takeable,
  active,
  lifted,
  direction,
  onCardTap,
}: HeartsHandProps) {
  const { t } = useSettings();
  const rows = splitRows(cards);

  return (
    <div className="ht-fan">
      {passing ? (
        <div className="ht-tray" role="group" aria-label={t('heartsTrayLabel')}>
          <span className="ht-tray-arrow" aria-hidden="true">
            {PASS_ARROWS[direction]}
          </span>
          {Array.from({ length: TRAY_SLOTS }, (_, slot) => {
            const card = chosen[slot];
            if (card === undefined) {
              // A recess rather than a button: an empty slot is a place a card
              // will go, not a place a tap can land.
              return <span key={`slot-${slot}`} className="ht-card ht-tray-slot" />;
            }
            return (
              <button
                key={card}
                type="button"
                data-card={card}
                className={faceClass(card, 'ht-tray-card')}
                aria-label={t('heartsCardChosen', { card: cardLabel(t, card) })}
                onClick={() => onCardTap(card)}
              >
                <CardFace card={card} />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="ht-hand" role="group" aria-label={t('heartsHandLabel')}>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="ht-hand-row">
            {row.map((card, index) => {
              const enabled = takeable.includes(card);
              const suitStart = index > 0 && suitOf(row[index - 1]!) !== suitOf(card);
              return (
                <button
                  key={card}
                  type="button"
                  data-card={card}
                  className={faceClass(
                    card,
                    'ht-hand-card',
                    suitStart && 'ht-suit-start',
                    lifted === card && 'ht-lifted',
                    // Sunk only while the player is actually to act. Between
                    // beats every card is refused and greying the whole hand
                    // out would say something about the rules that is not true.
                    active && !enabled && 'ht-sunk',
                  )}
                  aria-label={
                    active && !enabled
                      ? t('heartsCardBlocked', { card: cardLabel(t, card) })
                      : cardLabel(t, card)
                  }
                  aria-pressed={lifted === card}
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
