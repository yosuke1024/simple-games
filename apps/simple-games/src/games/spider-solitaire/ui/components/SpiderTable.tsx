/**
 * The whole table (docs/SPIDER_SOLITAIRE_RULES.md §1, §3, §12): the stock and
 * the finished runs up top, ten columns below. Every playable spot is a
 * button; the screen owns the select-then-place state machine (§3) and this
 * component only draws and reports taps.
 *
 * TEN COLUMNS IS THE CONSTRAINT EVERYTHING HERE ANSWERS TO. It is the most in
 * the collection — Klondike has seven, FreeCell eight — and on a 320px screen
 * that leaves each card about 28px wide with roughly 11px of it showing once
 * the next card overlaps it. The corner index is therefore drawn as a ROW,
 * rank beside suit, not as the column the other two card games use: stacked,
 * it needs about 22px of height and the rank gets cut in half. That was
 * measured, not guessed (§12).
 *
 * The suit has to survive that squeeze along with the rank, because at four
 * suits a run is only movable if every card in it shares a suit — colour alone
 * cannot tell a spade from a club.
 *
 * Selection and highlights use a lift and an outline, never colour alone (§12).
 */
import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  dealsLeft,
  isRed,
  RUNS_TO_WIN,
  suitOf,
  type Card,
  type SpiderBoard,
  type SuitCount,
} from '../../game';
import { cardLabel, rankText } from './cardText';
import { SuitIcon } from './suits';

/** A card travelling to where it was played. */
const MOVE_MS = 260;
/** A card turning face up where it lies. */
const TURN_MS = 200;
/** Quick to leave, settling into place — a card put down, not thrown. */
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

type Spot = readonly [x: number, y: number];

/**
 * One reading of the table: where every face-up card sat, and which cards were
 * face down. Positions come from `offsetLeft`/`offsetTop`, not from
 * `getBoundingClientRect` — those are the positions the layout gives a card,
 * so they ignore both the transforms these animations apply and how far the
 * table happens to be scrolled.
 */
interface TableLayout {
  readonly cards: ReadonlyMap<Card, Spot>;
  readonly faceDown: ReadonlySet<Card>;
}

function faceDownCards(board: SpiderBoard): ReadonlySet<Card> {
  const down = new Set<Card>(board.stock);
  for (const pile of board.tableau) for (const card of pile.down) down.add(card);
  return down;
}

function readLayout(root: HTMLElement, board: SpiderBoard): TableLayout {
  const cards = new Map<Card, Spot>();
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-card]'))) {
    cards.set(Number(el.dataset.card), [el.offsetLeft, el.offsetTop]);
  }
  return { cards, faceDown: faceDownCards(board) };
}

function play(el: HTMLElement, keyframes: Keyframe[], duration: number): void {
  // Below the supported floor there may be no Web Animations at all; the card
  // is simply already where it was played (§12, and the same rule as Reduced
  // Motion). It must never take the move down with it.
  if (typeof el.animate !== 'function' || typeof el.getAnimations !== 'function') return;
  for (const running of el.getAnimations()) running.cancel();
  el.style.zIndex = '6';
  const animation = el.animate(keyframes, { duration, easing: EASE });
  animation.onfinish = () => {
    el.style.zIndex = '';
  };
}

/** What the player currently holds selected (§3). */
export interface Selection {
  readonly pile: number;
  readonly index: number;
}

/** What the current hint points at, for the outline (§8). */
export interface HintMarks {
  readonly stock?: boolean;
  readonly piles?: readonly number[];
}

export interface SpiderTableProps {
  board: SpiderBoard;
  /**
   * Counts the moves the screen has made on the board now showing (§12).
   * A move is replayed; a new deal is not — nothing on a fresh board came
   * from anywhere on the old one, so there is nothing to replay.
   */
  moveTick: number;
  selection: Selection | null;
  hint: HintMarks | null;
  /** Columns a placed selection could legally land on (§3). */
  destinations: readonly number[];
  onStockTap: () => void;
  onColumnTap: (pile: number, index: number | null) => void;
}

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

/**
 * The printed face: the corner index and one large suit in the middle.
 *
 * The index is a row — rank then suit, side by side — so that both survive in
 * the ~11px strip a covered card shows at ten columns (see the note at the top
 * of this file).
 */
function CardFace({ card, suitCount }: { card: Card; suitCount: SuitCount }) {
  const suit = suitOf(card, suitCount);
  return (
    <>
      <span className="sp-card-index" aria-hidden="true">
        <span className="sp-card-rank">{rankText(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="sp-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

export const SpiderTable = memo(function SpiderTable({
  board,
  moveTick,
  selection,
  hint,
  destinations,
  onStockTap,
  onColumnTap,
}: SpiderTableProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const tableRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TableLayout | null>(null);
  const tickRef = useRef(moveTick);
  const suitCount = board.suitCount;

  // Where the board was before the tap. Every move starts with a finger going
  // down, and reading the table there is what keeps the measurement honest.
  useEffect(() => {
    const onPointerDown = () => {
      const root = tableRef.current;
      if (root) layoutRef.current = readLayout(root, board);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [board]);

  // Runs after the board has laid out with the move already applied and before
  // paint, so a card starts travelling on its first frame.
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;

    const previous = layoutRef.current;
    const current = readLayout(root, board);
    layoutRef.current = current;

    const replay = moveTick !== tickRef.current;
    tickRef.current = moveTick;
    if (!replay || !previous || reducedMotion) return;

    for (const [card, [x, y]] of current.cards) {
      const el = root.querySelector<HTMLElement>(`[data-card="${card}"]`);
      if (!el) continue;

      const before = previous.cards.get(card);
      if (before) {
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

      // Not on the table a moment ago. A card that was face down has just been
      // turned over — whether by a run leaving or by a row being dealt.
      if (!previous.faceDown.has(card)) continue;
      play(
        el,
        [
          { transform: 'perspective(500px) rotateY(-90deg)' },
          { transform: 'perspective(500px) rotateY(0deg)' },
        ],
        TURN_MS,
      );
    }
  }, [board, moveTick, reducedMotion]);

  const deals = dealsLeft(board);

  return (
    <div ref={tableRef} className="sp-table" role="group" aria-label={t('spiderTableLabel')}>
      <div className="sp-top-row">
        {/* The stock: five deals of ten, and the count is what a player plans
            around, so it is the count — not the card total — on show (§3). */}
        <button
          type="button"
          className={`sp-card sp-slot sp-stock ${deals > 0 ? 'sp-card-back' : 'sp-slot-empty'} ${
            hint?.stock ? 'sp-hinted' : ''
          }`}
          aria-label={deals > 0 ? t('spiderStockLabel', { n: deals }) : t('spiderStockEmpty')}
          onClick={onStockTap}
        >
          {deals > 0 ? (
            <span className="sp-stock-count" aria-hidden="true">
              {deals}
            </span>
          ) : null}
        </button>

        <div className="sp-runs" role="group" aria-label={t('spiderRunsLabel')}>
          {Array.from({ length: RUNS_TO_WIN }, (_, i) => {
            const run = board.completed[i];
            if (!run) {
              return (
                <div
                  key={i}
                  className="sp-card sp-slot sp-slot-empty sp-run-slot"
                  role="img"
                  aria-label={t('spiderRunEmpty')}
                />
              );
            }
            const king = run[0]!;
            const suit = suitOf(king, suitCount);
            return (
              <div
                key={i}
                className={`sp-card sp-run-slot ${isRed(king, suitCount) ? 'sp-card-red' : 'sp-card-black'}`}
                role="img"
                aria-label={t('spiderRunCard', { suit: t(`spiderSuit_${SUIT_NAMES[suit]}`) })}
              >
                <span className="sp-card-middle" aria-hidden="true">
                  <SuitIcon suit={suit} />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sp-cascades">
        {board.tableau.map((pile, pileIndex) => {
          const isDestination = destinations.includes(pileIndex);
          const hinted = hint?.piles?.includes(pileIndex) ?? false;
          return (
            <div
              key={pileIndex}
              className="sp-pile"
              role="group"
              aria-label={t('spiderColumnLabel', { n: pileIndex + 1 })}
            >
              {pile.down.length === 0 && pile.up.length === 0 ? (
                <button
                  type="button"
                  className={`sp-card sp-slot sp-slot-empty ${isDestination ? 'sp-destination' : ''} ${
                    hinted ? 'sp-hinted' : ''
                  }`}
                  aria-label={t('spiderColumnEmpty', { n: pileIndex + 1 })}
                  onClick={() => onColumnTap(pileIndex, null)}
                />
              ) : (
                <>
                  {pile.down.map((card, i) => (
                    // No data-card on a face-down card: its identity is not the
                    // page's to give away.
                    <div
                      key={`down-${card}`}
                      className={`sp-card sp-card-back ${i > 0 ? 'sp-overlap-down' : ''}`}
                      role="img"
                      aria-label={t('spiderCardFaceDown')}
                    />
                  ))}
                  {pile.up.map((card, i) => {
                    const held =
                      selection !== null && selection.pile === pileIndex && selection.index <= i;
                    const overlapped = pile.down.length > 0 || i > 0;
                    return (
                      <button
                        key={`card-${card}`}
                        type="button"
                        data-card={card}
                        className={[
                          'sp-card',
                          isRed(card, suitCount) ? 'sp-card-red' : 'sp-card-black',
                          overlapped ? 'sp-overlap' : '',
                          held ? 'sp-selected' : '',
                          i === pile.up.length - 1 && isDestination ? 'sp-destination' : '',
                          hinted ? 'sp-hinted' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-label={cardLabel(t, card, suitCount)}
                        onClick={() => onColumnTap(pileIndex, i)}
                      >
                        <CardFace card={card} suitCount={suitCount} />
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}) as (props: SpiderTableProps) => ReactNode;
