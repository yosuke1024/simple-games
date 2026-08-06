/**
 * The whole table (docs/SOLITAIRE_RULES.md §1, §3, §12): stock, waste, and
 * foundations up top, seven tableau columns below. Every playable spot is a
 * button; the screen owns the select-then-place state machine (§3) and this
 * component only draws and reports taps.
 *
 * A card is drawn the way a real one is: the index (rank over suit) in the
 * top-left corner, and a large suit in the middle. That split is not
 * decoration — the corner is the only part a covered card shows, so it
 * carries the identity, and the middle is what makes the top of a pile read
 * as a card at a glance. The face-up overlap is tuned to leave exactly the
 * index visible at seven columns on a 320px screen.
 *
 * Selection and highlights use a lift and an outline, never color alone
 * (§12).
 *
 * The table also replays each move after the fact (§12): the board state
 * changes the instant the tap lands, and then the card travels from where it
 * was to where it now is. That is measured from the live layout rather than
 * described in CSS, because where a card comes from depends on the deal — the
 * same tap moves a card a different distance every game.
 */
import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { SUITS, wasteTop, type Card, type SolitaireBoard, type Suit } from '../../game';
import { cardLabel, rankText } from './cardText';
import { SuitIcon } from './suits';

/** A card travelling to where it was played. */
const MOVE_MS = 260;
/** A card turning face up where it lies. */
const TURN_MS = 200;
/** A card coming off the stock: it crosses to the waste and turns at once. */
const DRAW_MS = 300;
/** Quick to leave, settling into place — a card put down, not thrown. */
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/** Where something sat, in the table's own coordinates. */
type Spot = readonly [x: number, y: number];

/**
 * One reading of the table: where every visible card sat, where the stock is,
 * and which cards were face down.
 *
 * Positions come from `offsetLeft`/`offsetTop`, not from
 * `getBoundingClientRect`. Those are the positions the layout gives a card,
 * so they ignore both the transforms these animations apply and how far the
 * table happens to be scrolled — either would poison the next move's
 * measurement, and a card would fly in from somewhere it never was.
 */
interface TableLayout {
  readonly cards: ReadonlyMap<Card, Spot>;
  readonly stock: Spot | null;
  readonly faceDown: ReadonlySet<Card>;
}

function faceDownCards(board: SolitaireBoard): ReadonlySet<Card> {
  const down = new Set<Card>(board.stock);
  for (const pile of board.tableau) for (const card of pile.down) down.add(card);
  return down;
}

function readLayout(root: HTMLElement, board: SolitaireBoard): TableLayout {
  const cards = new Map<Card, Spot>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-card]'))) {
    cards.set(Number(el.dataset.card), [el.offsetLeft, el.offsetTop]);
  }
  const stock = root.querySelector<HTMLElement>('[data-stock]');
  return {
    cards,
    stock: stock ? [stock.offsetLeft, stock.offsetTop] : null,
    faceDown: faceDownCards(board),
  };
}

/**
 * Plays one card's arrival, lifted over the table while it travels.
 *
 * Driven from script rather than from a class so that a re-render — a hint
 * landing, a selection clearing — cannot take the animation away mid-flight,
 * and so that thirteen cards of a run can each carry their own distance.
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
  | { readonly type: 'waste' }
  | { readonly type: 'tableau'; readonly pile: number; readonly index: number }
  | { readonly type: 'foundation'; readonly suit: Suit };

/** What the current hint points at, for the outline (§8). */
export interface HintMarks {
  readonly stock?: boolean;
  readonly waste?: boolean;
  readonly foundation?: boolean;
  readonly piles?: readonly number[];
}

export interface SolitaireTableProps {
  board: SolitaireBoard;
  /**
   * Counts the moves the screen has made on the board now showing (§12).
   * A move is replayed; a new deal is not — nothing on a fresh board came
   * from anywhere on the old one, so there is nothing to replay.
   */
  moveTick: number;
  selection: Selection | null;
  hint: HintMarks | null;
  /** Tableau piles a placed selection could legally land on (§3). */
  destinations: readonly number[];
  /** True when the selection could land on its foundation (§3). */
  foundationEligible: boolean;
  onStockTap: () => void;
  onWasteTap: () => void;
  onFoundationTap: (suit: Suit) => void;
  onTableauTap: (pile: number, index: number | null) => void;
}

function faceUpCard(
  card: Card,
  extraClass: string,
  label: string,
  onClick: () => void,
  overlap: 'down' | 'up' | null,
): ReactNode {
  const red = suitIsRed(card);
  return (
    <button
      key={`card-${card}`}
      type="button"
      // How the table finds this card again after it has moved. Only face-up
      // cards carry it: a face-down card's identity is not the page's to
      // give away.
      data-card={card}
      className={[
        'sol-card',
        red ? 'sol-card-red' : 'sol-card-black',
        overlap === 'down' ? 'sol-overlap-down' : '',
        overlap === 'up' ? 'sol-overlap-up' : '',
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

/**
 * The printed face: corner index plus one large suit in the middle.
 *
 * Deliberately not a real deck's face. Traditional pip layouts (a seven
 * showing seven spades) and court figures were both built and both removed:
 * at 47x66 CSS pixels they turn the card into a dense little thicket, and
 * the density reads as clutter rather than as authenticity (§13). One rank,
 * one suit, one large mark — the card is legible at a glance, which is what
 * a player actually needs from it.
 */
function CardFace({ card }: { card: Card }) {
  const suit = suitOfCard(card);
  return (
    <>
      <span className="sol-card-index" aria-hidden="true">
        <span className="sol-card-rank">{rankText(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="sol-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

const suitOfCard = (card: Card): Suit => Math.floor(card / 13) as Suit;
const suitIsRed = (card: Card): boolean => {
  const suit = suitOfCard(card);
  return suit === 1 || suit === 2;
};

export const SolitaireTable = memo(function SolitaireTable({
  board,
  moveTick,
  selection,
  hint,
  destinations,
  foundationEligible,
  onStockTap,
  onWasteTap,
  onFoundationTap,
  onTableauTap,
}: SolitaireTableProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const tableRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TableLayout | null>(null);
  const tickRef = useRef(moveTick);
  const waste = wasteTop(board);

  // Where the board was before the tap. Every move starts with a finger
  // going down — on a card, on the stock, on Undo — and reading the table
  // there is what keeps the measurement honest: nothing can resize, rotate,
  // or scroll the table between this reading and the move it explains.
  // A remembered reading could be any of those things out of date, and a card
  // would fly in from somewhere it had never been.
  useEffect(() => {
    const onPointerDown = () => {
      const root = tableRef.current;
      if (root) layoutRef.current = readLayout(root, board);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [board]);

  // Runs after the board has laid out with the move already applied and
  // before paint, so a card starts travelling on its first frame — it is
  // never seen at its destination first.
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;

    const previous = layoutRef.current;
    const current = readLayout(root, board);
    // Also leaves a reading behind for a move made without a tap at all —
    // Undo reached by keyboard.
    layoutRef.current = current;

    const replay = moveTick !== tickRef.current;
    tickRef.current = moveTick;
    if (!replay || !previous || reducedMotion) return;

    for (const [card, [x, y]] of current.cards) {
      const el = root.querySelector<HTMLElement>(`[data-card="${card}"]`);
      if (!el) continue;

      const before = previous.cards.get(card);
      if (before) {
        // Most of the board holds still; only the played run has anywhere to
        // come from.
        const dx = before[0] - x;
        const dy = before[1] - y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          play(
            el,
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
            MOVE_MS,
          );
        }
        continue;
      }

      // Not on the table a moment ago. A card that was face down has just
      // been turned over; a card that was not was merely uncovered — the
      // foundation card coming back into view has been face up all along, and
      // nothing happened to it.
      if (!previous.faceDown.has(card)) continue;

      // Off the stock, it crosses to the waste as it turns; a card the run
      // uncovered turns where it lies.
      const from = card === waste ? previous.stock : null;
      play(
        el,
        from
          ? [
              {
                transform: `translate(${from[0] - x}px, ${from[1] - y}px) perspective(500px) rotateY(-90deg)`,
              },
              { transform: 'translate(0px, 0px) perspective(500px) rotateY(0deg)' },
            ]
          : [
              { transform: 'perspective(500px) rotateY(-90deg)' },
              { transform: 'perspective(500px) rotateY(0deg)' },
            ],
        from ? DRAW_MS : TURN_MS,
      );
    }
  }, [board, moveTick, reducedMotion, waste]);

  const isSelected = (check: Selection): boolean => {
    if (!selection) return false;
    if (selection.type !== check.type) return false;
    if (selection.type === 'tableau' && check.type === 'tableau') {
      return selection.pile === check.pile && selection.index <= check.index;
    }
    if (selection.type === 'foundation' && check.type === 'foundation') {
      return selection.suit === check.suit;
    }
    return true;
  };

  return (
    <div ref={tableRef} className="sol-table" role="group" aria-label={t('solTableLabel')}>
      <div className="sol-top-row">
        {/* Stock: face-down pile, or the recycle spot when empty (§3). */}
        <button
          type="button"
          // Marked in both states: it is the same slot, and a drawn card has
          // to know where it came from even when that draw emptied it.
          data-stock=""
          className={`sol-card sol-slot ${board.stock.length > 0 ? 'sol-card-back' : 'sol-slot-empty'} ${hint?.stock ? 'sol-hinted' : ''}`}
          aria-label={
            board.stock.length > 0
              ? t('solStockLabel', { n: board.stock.length })
              : t('solStockEmpty')
          }
          onClick={onStockTap}
        >
          {board.stock.length === 0 ? (
            <span className="sol-slot-mark" aria-hidden="true">
              ↻
            </span>
          ) : null}
        </button>

        {/* Waste: only the top card is playable (§1). */}
        {waste !== null ? (
          faceUpCard(
            waste,
            [isSelected({ type: 'waste' }) ? 'sol-selected' : '', hint?.waste ? 'sol-hinted' : '']
              .filter(Boolean)
              .join(' '),
            cardLabel(t, waste),
            onWasteTap,
            null,
          )
        ) : (
          <div className="sol-card sol-slot sol-slot-empty" aria-hidden="true" />
        )}

        <div className="sol-top-gap" aria-hidden="true" />

        {SUITS.map((suit) => {
          const pile = board.foundations[suit]!;
          const top = pile[pile.length - 1];
          const highlight = [
            foundationEligible ? 'sol-destination' : '',
            hint?.foundation ? 'sol-hinted' : '',
            isSelected({ type: 'foundation', suit }) ? 'sol-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return top !== undefined ? (
            <button
              key={suit}
              type="button"
              data-card={top}
              className={`sol-card ${suitIsRed(top) ? 'sol-card-red' : 'sol-card-black'} ${highlight}`}
              aria-label={t('solFoundationCard', {
                card: cardLabel(t, top),
              })}
              onClick={() => onFoundationTap(suit)}
            >
              <CardFace card={top} />
            </button>
          ) : (
            <button
              key={suit}
              type="button"
              className={`sol-card sol-slot sol-slot-empty sol-slot-suit ${highlight}`}
              aria-label={t('solFoundationEmpty', {
                suit: t(`solSuit_${(['spades', 'hearts', 'diamonds', 'clubs'] as const)[suit]}`),
              })}
              onClick={() => onFoundationTap(suit)}
            >
              <span
                className={`sol-slot-mark ${suit === 1 || suit === 2 ? 'sol-card-red' : ''}`}
                aria-hidden="true"
              >
                <SuitIcon suit={suit} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="sol-tableau">
        {board.tableau.map((pile, pileIndex) => {
          const isDestination = destinations.includes(pileIndex);
          return (
            <div
              key={pileIndex}
              className="sol-pile"
              role="group"
              aria-label={t('solPileLabel', { n: pileIndex + 1 })}
            >
              {pile.down.length === 0 && pile.up.length === 0 ? (
                <button
                  type="button"
                  className={`sol-card sol-slot sol-slot-empty ${isDestination ? 'sol-destination' : ''}`}
                  aria-label={t('solPileEmpty', { n: pileIndex + 1 })}
                  onClick={() => onTableauTap(pileIndex, null)}
                />
              ) : (
                <>
                  {pile.down.map((card, i) => (
                    <div
                      key={`down-${card}`}
                      className={`sol-card sol-card-back ${i > 0 ? 'sol-overlap-down' : ''}`}
                      role="img"
                      aria-label={t('solCardFaceDown')}
                    />
                  ))}
                  {pile.up.map((card, i) =>
                    faceUpCard(
                      card,
                      [
                        isSelected({ type: 'tableau', pile: pileIndex, index: i })
                          ? 'sol-selected'
                          : '',
                        i === pile.up.length - 1 && isDestination ? 'sol-destination' : '',
                        hint?.piles?.includes(pileIndex) ? 'sol-hinted' : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                      cardLabel(t, card),
                      () => onTableauTap(pileIndex, i),
                      pile.down.length > 0 || i > 0 ? (i === 0 ? 'down' : 'up') : null,
                    ),
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
