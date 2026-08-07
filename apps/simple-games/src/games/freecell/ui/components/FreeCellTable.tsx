/**
 * The whole table (docs/FREECELL_RULES.md §1, §3, §12): four free cells and
 * four foundations up top, eight columns below. Eight slots over eight
 * columns, so the two halves share one grid and the cells sit squarely above
 * the cards they serve. Every playable spot is a button; the screen owns the
 * select-then-place state machine (§3) and this component only draws and
 * reports taps.
 *
 * A card is drawn the way a real one is: the index (rank over suit) in the
 * top-left corner, and a large suit in the middle. That split is not
 * decoration — the corner is the only part a covered card shows, so it
 * carries the identity, and the middle is what makes the top of a pile read
 * as a card at a glance.
 *
 * Selection and highlights use a lift and an outline, never colour alone (§12).
 *
 * The table replays each move after the fact (§12): the board changes the
 * instant the tap lands, and then the card travels from where it was to where
 * it now is, measured from the live layout. There is no turn to animate here
 * as there is in Klondike — nothing in FreeCell is ever face down (§1).
 */
import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { SUITS, type Card, type FreeCellBoard, type Suit } from '../../game';
import { cardLabel, rankText } from './cardText';
import { SuitIcon } from './suits';

/** A card travelling to where it was played. */
const MOVE_MS = 260;
/** Quick to leave, settling into place — a card put down, not thrown. */
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/** Where something sat, in the table's own coordinates. */
type Spot = readonly [x: number, y: number];

/**
 * Where every card sat. Positions come from `offsetLeft`/`offsetTop`, not
 * from `getBoundingClientRect`: those are the positions the layout gives a
 * card, so they ignore both the transforms these animations apply and how far
 * the table happens to be scrolled — either would poison the next move's
 * measurement, and a card would fly in from somewhere it never was.
 */
type TableLayout = ReadonlyMap<Card, Spot>;

function readLayout(root: HTMLElement): TableLayout {
  const cards = new Map<Card, Spot>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-card]'))) {
    cards.set(Number(el.dataset.card), [el.offsetLeft, el.offsetTop]);
  }
  return cards;
}

/**
 * Plays one card's arrival, lifted over the table while it travels.
 *
 * Driven from script rather than from a class so that a re-render cannot take
 * the animation away mid-flight, and so that every card of a carried run can
 * hold its own distance.
 */
function play(el: HTMLElement, keyframes: Keyframe[], duration: number): void {
  // Below the supported floor there may be no Web Animations at all; the card
  // is simply already where it was played (§12, and the same rule as Reduced
  // Motion). It must never take the move down with it.
  if (typeof el.animate !== 'function' || typeof el.getAnimations !== 'function') return;
  // A card played twice in quick succession would otherwise carry two
  // transforms at once and land nowhere; the second move replaces the first.
  for (const running of el.getAnimations()) running.cancel();
  el.style.zIndex = '6';
  const animation = el.animate(keyframes, { duration, easing: EASE });
  animation.onfinish = () => {
    el.style.zIndex = '';
  };
}

/** What the player currently holds selected (§3). */
export type Selection =
  | { readonly type: 'cell'; readonly cell: number }
  | { readonly type: 'cascade'; readonly pile: number; readonly index: number };

export interface FreeCellTableProps {
  board: FreeCellBoard;
  /**
   * Counts the moves the screen has made on the board now showing (§12).
   * A move is replayed; a new deal is not — nothing on a fresh board came
   * from anywhere on the old one, so there is nothing to replay.
   */
  moveTick: number;
  selection: Selection | null;
  /** Columns a placed selection could legally land on (§3). */
  destinations: readonly number[];
  /** True when the selection could land on its foundation (§3). */
  foundationEligible: boolean;
  /** True when the selection is one card and a cell stands empty (§3). */
  cellEligible: boolean;
  onCellTap: (cell: number) => void;
  onFoundationTap: (suit: Suit) => void;
  onCascadeTap: (pile: number, index: number | null) => void;
}

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

const suitOfCard = (card: Card): Suit => Math.floor(card / 13) as Suit;
const suitIsRed = (card: Card): boolean => {
  const suit = suitOfCard(card);
  return suit === 1 || suit === 2;
};

/**
 * The printed face: corner index plus one large suit in the middle.
 *
 * Deliberately not a real deck's face. At this size traditional pip layouts
 * turn the card into a dense little thicket, and the density reads as clutter
 * rather than as authenticity (§13).
 */
function CardFace({ card }: { card: Card }) {
  const suit = suitOfCard(card);
  return (
    <>
      <span className="fc-card-index" aria-hidden="true">
        <span className="fc-card-rank">{rankText(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="fc-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

function cardButton(
  card: Card,
  extraClass: string,
  label: string,
  onClick: () => void,
  overlapped: boolean,
): ReactNode {
  return (
    <button
      key={`card-${card}`}
      type="button"
      // How the table finds this card again after it has moved.
      data-card={card}
      className={[
        'fc-card',
        suitIsRed(card) ? 'fc-card-red' : 'fc-card-black',
        overlapped ? 'fc-overlap' : '',
        extraClass,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      onClick={onClick}
    >
      <CardFace card={card} />
    </button>
  );
}

export const FreeCellTable = memo(function FreeCellTable({
  board,
  moveTick,
  selection,
  destinations,
  foundationEligible,
  cellEligible,
  onCellTap,
  onFoundationTap,
  onCascadeTap,
}: FreeCellTableProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const tableRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TableLayout | null>(null);
  const tickRef = useRef(moveTick);

  // Where the board was before the tap. Every move starts with a finger going
  // down — on a card, on a cell, on Undo — and reading the table there is what
  // keeps the measurement honest: nothing can resize, rotate, or scroll the
  // table between this reading and the move it explains.
  useEffect(() => {
    const onPointerDown = () => {
      const root = tableRef.current;
      if (root) layoutRef.current = readLayout(root);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Runs after the board has laid out with the move already applied and before
  // paint, so a card starts travelling on its first frame — it is never seen at
  // its destination first.
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;

    const previous = layoutRef.current;
    const current = readLayout(root);
    // Also leaves a reading behind for a move made without a tap at all —
    // Undo reached by keyboard.
    layoutRef.current = current;

    const replay = moveTick !== tickRef.current;
    tickRef.current = moveTick;
    if (!replay || !previous || reducedMotion) return;

    for (const [card, [x, y]] of current) {
      const before = previous.get(card);
      if (!before) continue;
      // Most of the board holds still; only the played run has anywhere to
      // come from.
      const dx = before[0] - x;
      const dy = before[1] - y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
      const el = root.querySelector<HTMLElement>(`[data-card="${card}"]`);
      if (!el) continue;
      play(
        el,
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
        MOVE_MS,
      );
    }
  }, [board, moveTick, reducedMotion]);

  const isSelected = (check: Selection): boolean => {
    if (!selection) return false;
    if (selection.type === 'cell' && check.type === 'cell') return selection.cell === check.cell;
    if (selection.type === 'cascade' && check.type === 'cascade') {
      // The whole carried run lights up, not just the card that was tapped.
      return selection.pile === check.pile && selection.index <= check.index;
    }
    return false;
  };

  return (
    <div ref={tableRef} className="fc-table" role="group" aria-label={t('fcTableLabel')}>
      <div className="fc-top-row" role="group" aria-label={t('fcCellsLabel')}>
        {board.cells.map((card, cell) =>
          card !== null ? (
            cardButton(
              card,
              [isSelected({ type: 'cell', cell }) ? 'fc-selected' : '', 'fc-cell-card']
                .filter(Boolean)
                .join(' '),
              t('fcCellLabel', { n: cell + 1, card: cardLabel(t, card) }),
              () => onCellTap(cell),
              false,
            )
          ) : (
            <button
              key={`cell-${cell}`}
              type="button"
              className={`fc-card fc-slot fc-slot-empty ${cellEligible ? 'fc-destination' : ''}`}
              aria-label={t('fcCellEmpty', { n: cell + 1 })}
              onClick={() => onCellTap(cell)}
            />
          ),
        )}

        {SUITS.map((suit) => {
          const pile = board.foundations[suit]!;
          const top = pile[pile.length - 1];
          const highlight = foundationEligible ? 'fc-destination' : '';
          return top !== undefined ? (
            <button
              key={`foundation-${suit}`}
              type="button"
              data-card={top}
              className={`fc-card ${suitIsRed(top) ? 'fc-card-red' : 'fc-card-black'} ${highlight}`}
              aria-label={t('fcFoundationCard', { card: cardLabel(t, top) })}
              onClick={() => onFoundationTap(suit)}
            >
              <CardFace card={top} />
            </button>
          ) : (
            <button
              key={`foundation-${suit}`}
              type="button"
              className={`fc-card fc-slot fc-slot-empty fc-slot-suit ${highlight}`}
              aria-label={t('fcFoundationEmpty', { suit: t(`fcSuit_${SUIT_NAMES[suit]}`) })}
              onClick={() => onFoundationTap(suit)}
            >
              <span
                className={`fc-slot-mark ${suit === 1 || suit === 2 ? 'fc-card-red' : ''}`}
                aria-hidden="true"
              >
                <SuitIcon suit={suit} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="fc-cascades">
        {board.cascades.map((cascade, pileIndex) => {
          const isDestination = destinations.includes(pileIndex);
          return (
            <div
              key={pileIndex}
              className="fc-pile"
              role="group"
              aria-label={t('fcColumnLabel', { n: pileIndex + 1 })}
            >
              {cascade.length === 0 ? (
                <button
                  type="button"
                  className={`fc-card fc-slot fc-slot-empty ${isDestination ? 'fc-destination' : ''}`}
                  aria-label={t('fcColumnEmpty', { n: pileIndex + 1 })}
                  onClick={() => onCascadeTap(pileIndex, null)}
                />
              ) : (
                cascade.map((card, i) =>
                  cardButton(
                    card,
                    [
                      isSelected({ type: 'cascade', pile: pileIndex, index: i })
                        ? 'fc-selected'
                        : '',
                      i === cascade.length - 1 && isDestination ? 'fc-destination' : '',
                    ]
                      .filter(Boolean)
                      .join(' '),
                    cardLabel(t, card),
                    () => onCascadeTap(pileIndex, i),
                    i > 0,
                  ),
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
