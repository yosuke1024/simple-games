/**
 * The whole table (docs/SOLITAIRE_RULES.md §1, §3, §12): stock, waste, and
 * foundations up top, seven tableau columns below. Every playable spot is a
 * button; the screen owns the select-then-place state machine (§3) and this
 * component only draws and reports taps — and, since issue #116, drags.
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
 *
 * A drag (§3, issue #116) is the second way in, and it is only a way in: the
 * table carries the pressed card or run under the finger, works out which
 * column or foundation the pointer is over, and on release hands the screen
 * the same "put this there" the second tap would have. The screen answers it
 * with the same move functions, so a drag can never move a card a tap could
 * not. What lives here is geometry — pointer capture, the travel threshold
 * that keeps a tap a tap, the hit-testing, the card following the finger —
 * and none of it is React state: the carried cards move by an inline
 * transform written per pointer event, and the screen hears from the table
 * only when the logical drop target changes.
 */
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
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

/**
 * How far a press must travel before it is a drag rather than a tap (issue
 * #116). Below this the press ends in the click the tap path has always
 * answered; the tremor in an ordinary tap must never pick a card up. The same
 * distance Block Puzzle uses for its pieces.
 */
export const DRAG_THRESHOLD_PX = 8;

/**
 * A card in flight sits above a card being replayed (`play` below uses 6):
 * the one under the finger is the one the player is looking at.
 */
const DRAG_Z_INDEX = '7';

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

/**
 * What a drag can pick up (§3, issue #116): the waste's top card, or a
 * face-up tableau card with the run above it. A foundation top is not
 * dragged — taking one back is legal and rarely wise, and stays a
 * deliberate two-tap act.
 */
export type DragSource = Extract<Selection, { type: 'waste' | 'tableau' }>;

/** Where a drag can let go: a tableau column, or one suit's foundation. */
export type DropTarget =
  | { readonly type: 'tableau'; readonly pile: number }
  | { readonly type: 'foundation'; readonly suit: Suit };

/**
 * The table's drop zones, measured once when a drag begins: client
 * rectangles, because that is the space pointer events speak in.
 *
 * Columns are bands, not card rectangles. A card let go below the last card
 * of a short pile — or in the gap beside it — still means that column: the
 * felt under a column is part of the column. The bands meet in the middle of
 * each gap, so there is no dead pixel between two piles. The top row is the
 * band above the tableau, and only its four foundations are targets there —
 * the stock, the waste, and the gap between them take nothing.
 */
export interface DropZones {
  /** The tableau's left and right edge, with half a column of slack outside. */
  readonly left: number;
  readonly right: number;
  /** Above this line is the top row; below it, the columns. */
  readonly rowBottom: number;
  /** Above this line is off the table altogether. */
  readonly top: number;
  /** The x where column i ends and column i + 1 begins, six of them. */
  readonly columnEdges: readonly number[];
  /** Each foundation's own band in the top row. */
  readonly foundations: readonly {
    readonly suit: Suit;
    readonly left: number;
    readonly right: number;
  }[];
}

/**
 * Reads the drop zones off the live table. Null while the table has no
 * layout yet (a first frame, a hidden tab): nothing honest can be said about
 * where a column is, and a drag started then lands nowhere rather than
 * somewhere made up.
 */
function readDropZones(root: HTMLElement): DropZones | null {
  const piles = Array.from(root.querySelectorAll<HTMLElement>('[data-pile]')).map((el) =>
    el.getBoundingClientRect(),
  );
  const row = root.querySelector<HTMLElement>('[data-top-row]')?.getBoundingClientRect();
  if (piles.length === 0 || !row || row.width === 0) return null;
  const first = piles[0]!;
  const last = piles[piles.length - 1]!;
  const columnEdges: number[] = [];
  for (let i = 1; i < piles.length; i++) {
    columnEdges.push((piles[i - 1]!.right + piles[i]!.left) / 2);
  }
  const gap = piles.length > 1 ? piles[1]!.left - first.right : 0;
  // The row and the tableau are separated by the table's gap; halfway across
  // it is where one stops being the other.
  const rowBottom = row.bottom + (first.top - row.bottom) / 2;
  return {
    left: first.left - first.width / 2,
    right: last.right + last.width / 2,
    top: row.top - row.height / 2,
    rowBottom,
    columnEdges,
    foundations: Array.from(root.querySelectorAll<HTMLElement>('[data-foundation]')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        suit: Number(el.dataset.foundation) as Suit,
        left: rect.left - gap / 2,
        right: rect.right + gap / 2,
      };
    }),
  };
}

/**
 * Which spot a pointer at (x, y) is over, or null for none. Pure, so the
 * geometry can be checked without a browser laying anything out.
 */
export function dropTargetAt(zones: DropZones, x: number, y: number): DropTarget | null {
  if (x < zones.left || x > zones.right || y < zones.top) return null;
  if (y < zones.rowBottom) {
    const hit = zones.foundations.find((f) => x >= f.left && x <= f.right);
    return hit ? { type: 'foundation', suit: hit.suit } : null;
  }
  let pile = 0;
  while (pile < zones.columnEdges.length && x > zones.columnEdges[pile]!) pile++;
  return { type: 'tableau', pile };
}

/**
 * Whether a drag let go over the spot it started from: the run's own column,
 * or — for the waste, which is no target — nowhere at all.
 */
function overSource(drag: Drag): boolean {
  if (drag.source.type === 'waste') return drag.target === null;
  return drag.target?.type === 'tableau' && drag.target.pile === drag.source.pile;
}

const targetKey = (target: DropTarget | null): string =>
  target === null ? '' : target.type === 'tableau' ? `t${target.pile}` : `f${target.suit}`;

/**
 * One press on a card, from the finger going down until it comes up. A ref,
 * not state: most of it changes with every pointer event and none of it is
 * drawn by React — the carried cards move by an inline transform, and the
 * screen is told only when the logical target changes.
 */
interface Drag {
  readonly pointerId: number;
  readonly source: DragSource;
  /** The cards being carried, the pressed one first. */
  readonly cards: readonly Card[];
  readonly startX: number;
  readonly startY: number;
  /** True once the press has travelled past the threshold: a drag, not a tap. */
  moved: boolean;
  /** Measured when the drag starts; null when the table has no layout. */
  zones: DropZones | null;
  /**
   * From the finger to the middle of the pressed card, measured when the drag
   * starts. The player aims with the card, not with the fingertip under it —
   * a card grabbed by its lower edge and pushed up onto a foundation is over
   * the foundation while the finger is still on the felt below — so the spot
   * is read at the card's middle. Zero where the card has no layout to read.
   */
  grabX: number;
  grabY: number;
  /**
   * How far the run may travel from where it lay without leaving the felt,
   * per direction; null where nothing could be measured. A transformed card
   * still counts toward its scroll container's overflow, so a run carried
   * past the felt's edge would grow the felt a scrollbar and reflow the
   * table under the finger.
   */
  travel: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  } | null;
  /** How far the cards have been carried from where they lay. */
  dx: number;
  dy: number;
  /** The spot last reported to the screen, so an unchanged one costs nothing. */
  targetKey: string;
  target: DropTarget | null;
}

/** The live element of a card, if it is on the table right now. */
function cardElement(root: HTMLElement, card: Card): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-card="${card}"]`);
}

/** Puts carried cards down where they lie, transform and all. */
function releaseCards(root: HTMLElement, cards: readonly Card[]): void {
  for (const card of cards) {
    const el = cardElement(root, card);
    if (!el) continue;
    el.style.transform = '';
    el.style.zIndex = '';
  }
}

/**
 * Carries the cards back to where they came from: a drop that moved nothing,
 * or a drag the browser took away. The board never changed, so there is no
 * replay to do it — this is the one travel the table plays on its own, and
 * under Reduced Motion the cards are simply back (§12).
 */
function returnCards(root: HTMLElement, drag: Drag, reducedMotion: boolean): void {
  releaseCards(root, drag.cards);
  if (reducedMotion || (drag.dx === 0 && drag.dy === 0)) return;
  for (const card of drag.cards) {
    const el = cardElement(root, card);
    if (!el) continue;
    play(
      el,
      [
        { transform: `translate(${drag.dx}px, ${drag.dy}px)` },
        { transform: 'translate(0px, 0px)' },
      ],
      MOVE_MS,
    );
  }
}

/**
 * What the current hint points at, for the outline (§8): the move itself, not
 * the piles it happens to touch. A pile mid-game is mostly cards the move
 * leaves alone, and outlining those would say "look here" about the wrong ones.
 */
export interface HintMarks {
  readonly stock?: boolean;
  readonly waste?: boolean;
  readonly foundation?: boolean;
  /** The run to move: the cards from `index` up in tableau pile `pile`. */
  readonly from?: { readonly pile: number; readonly index: number };
  /** Where it lands: the top card of this pile, or its empty slot. */
  readonly to?: number;
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
  /** Tableau piles a held card or run could legally land on (§3). */
  destinations: readonly number[];
  /** The suit whose foundation the held card could land on, or null (§3). */
  foundationTarget: Suit | null;
  /** The card or run under the finger, drawn lifted; null between drags. */
  drag: DragSource | null;
  /** The spot the drag is over right now, and whether letting go there moves. */
  drop: DropTarget | null;
  dropLegal: boolean;
  onStockTap: () => void;
  onWasteTap: () => void;
  onFoundationTap: (suit: Suit) => void;
  onTableauTap: (pile: number, index: number | null) => void;
  /** A press has become a drag: the screen holds `source` from here on. */
  onDragStart: (source: DragSource) => void;
  /** The drag is over a different spot than before (or over none). */
  onDragTarget: (target: DropTarget | null) => void;
  /**
   * The drag is over: let go over `target`, or over nothing, or taken away
   * by the browser. Returns true when the board changed — the cards then
   * settle from where they were released — and false when it did not, in
   * which case the table carries them back to where they came from.
   */
  onDragEnd: (source: DragSource, target: DropTarget | null) => boolean;
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
  foundationTarget,
  drag,
  drop,
  dropLegal,
  onStockTap,
  onWasteTap,
  onFoundationTap,
  onTableauTap,
  onDragStart,
  onDragTarget,
  onDragEnd,
}: SolitaireTableProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const tableRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TableLayout | null>(null);
  const tickRef = useRef(moveTick);
  const dragRef = useRef<Drag | null>(null);
  /**
   * True while the next click is the one a finished drag leaves behind, and
   * must not count as a tap. Where that click lands is the engine's business
   * — the pressed card where the pointer was captured, but that card may have
   * moved piles by then, and Safari does not retarget — so the mark is the
   * table's and not one button's. Cleared by the next press anywhere: once a
   * new finger is down, the old drag's click is not coming, so the mark can
   * never swallow a later tap.
   */
  const suppressClickRef = useRef(false);
  /**
   * The screen's drag-end handler, as of the latest render, for the
   * document-level listeners below to reach without re-subscribing per render
   * (docs/ARCHITECTURE.md「状態と ref」).
   */
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const waste = wasteTop(board);

  // Where the board was before the tap. Every move starts with a finger
  // going down — on a card, on the stock, on Undo — and reading the table
  // there is what keeps the measurement honest: nothing can resize, rotate,
  // or scroll the table between this reading and the move it explains.
  // A remembered reading could be any of those things out of date, and a card
  // would fly in from somewhere it had never been.
  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = tableRef.current;
      if (root) layoutRef.current = readLayout(root, board);
      suppressClickRef.current = false;
      // The same pointer pressing again means its last release never
      // reached the table — capture refused and the button let go off it,
      // or the release went to a context menu. That drag is over, not still
      // in progress: the cards go back and nothing is played.
      const stale = dragRef.current;
      if (stale !== null && stale.pointerId === event.pointerId) abandonDrag();
    };
    // Alt-Tab, a phone call, a system gesture: the window that owned the
    // press is not the one that sees it end. A drag cannot outlive the
    // window's focus.
    const onBlur = () => abandonDrag();
    // In the capture phase, so it runs before the card's own handler has
    // recorded the new press: on the way back up it would find that press
    // and take it for the stale one.
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [board]);

  /**
   * Ends a drag whose release the table will never hear, with the cards put
   * straight back — an error path, not a move, so it earns no travel.
   */
  function abandonDrag(): void {
    const drag = dragRef.current;
    if (drag === null) return;
    dragRef.current = null;
    if (!drag.moved) return;
    const root = tableRef.current;
    if (root) releaseCards(root, drag.cards);
    onDragEndRef.current(drag.source, null);
  }

  // Runs after the board has laid out with the move already applied and
  // before paint, so a card starts travelling on its first frame — it is
  // never seen at its destination first.
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;

    // A board that changed under a drag — Undo from the keyboard, a second
    // finger on the stock — ends it: the cards it was carrying may not be
    // where the drag thinks, or on the table at all. The screen has already
    // let go of the drag on its side (its board effect), so nothing is owed
    // but the transforms. A drop's own board change never gets here: the
    // drag is gone before the screen is told.
    const interrupted = dragRef.current;
    if (interrupted) {
      dragRef.current = null;
      if (interrupted.moved) {
        releaseCards(root, interrupted.cards);
        suppressClickRef.current = true;
      }
    }

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

  /**
   * A finger down on a card that could be dragged (§3). Nothing is decided
   * yet: this is a tap until it travels, and a tap ends in the click the
   * button has always answered.
   */
  const onCardPointerDown = (event: PointerEvent<HTMLButtonElement>, source: DragSource) => {
    // One drag at a time: a second finger while one is in flight picks
    // nothing up. (The same pointer pressing again cannot get here with a
    // drag still recorded — the document listener above ended it first.)
    if (dragRef.current !== null) return;
    // Only the hand's main button: a right or middle button and a pen's
    // barrel — held as the tip comes down it arrives inside `buttons` — pick
    // nothing up.
    if (event.button !== 0 || (event.buttons & 2) !== 0) return;
    const cards =
      source.type === 'waste'
        ? waste === null
          ? []
          : [waste]
        : (board.tableau[source.pile]?.up.slice(source.index) ?? []);
    if (cards.length === 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      source,
      cards,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      zones: null,
      grabX: 0,
      grabY: 0,
      travel: null,
      dx: 0,
      dy: 0,
      targetKey: '',
      target: null,
    };
    // Capture keeps the moves coming to this card — and so, by bubbling, to
    // the table — after the finger has left it. An improvement, never a
    // precondition: it throws if the pointer is already gone, and the moves
    // that stay over the table arrive anyway.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works from the events we do get.
    }
  };

  /**
   * Bound to the table, not to the card the press began on: pointer capture
   * retargets every move to that card, and they bubble here from it.
   */
  const onTablePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const root = tableRef.current;
    if (!root) return;
    // A mouse moving with its button up let go somewhere the table never
    // heard — over a context menu, in another window. Not a drop: nobody
    // aimed the release, so the cards go back.
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      abandonDrag();
      return;
    }
    let dx = event.clientX - drag.startX;
    let dy = event.clientY - drag.startY;

    if (!drag.moved) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      // Past the threshold: a drag after all. Everything is measured now, the
      // last moment the table is certainly laid out as the finger sees it,
      // and once per drag — reading it per move would force a layout on
      // every event.
      drag.moved = true;
      drag.zones = readDropZones(root);
      const head = drag.cards[0] === undefined ? null : cardElement(root, drag.cards[0]);
      const last =
        drag.cards.length === 0 ? null : cardElement(root, drag.cards[drag.cards.length - 1]!);
      const headRect = head?.getBoundingClientRect();
      const lastRect = last?.getBoundingClientRect();
      if (headRect && headRect.width > 0) {
        drag.grabX = headRect.left + headRect.width / 2 - drag.startX;
        drag.grabY = headRect.top + headRect.height / 2 - drag.startY;
        // The felt is the table's scroll container, and the run may not leave
        // it (see `travel`). The run spans from the head's top to the last
        // card's bottom.
        const felt = root.parentElement?.getBoundingClientRect();
        if (felt && felt.width > 0 && lastRect) {
          drag.travel = {
            minX: felt.left - headRect.left,
            maxX: felt.right - headRect.right,
            minY: felt.top - headRect.top,
            maxY: felt.bottom - lastRect.bottom,
          };
        }
      }
      // A card grabbed as it lands would otherwise hold its arrival animation
      // over the finger's transform for the rest of its duration — cancelled,
      // not finished, so the lift the animation was going to strip stays.
      for (const card of drag.cards) {
        const el = cardElement(root, card);
        if (el && typeof el.getAnimations === 'function') {
          for (const running of el.getAnimations()) running.cancel();
        }
      }
      onDragStart(drag.source);
    }

    if (drag.travel) {
      dx = Math.min(Math.max(dx, drag.travel.minX), drag.travel.maxX);
      dy = Math.min(Math.max(dy, drag.travel.minY), drag.travel.maxY);
    }
    drag.dx = dx;
    drag.dy = dy;
    // The cards follow the finger by an inline transform, written here and
    // not through React: thirteen cards at sixty moves a second is not a
    // render's job, and nothing else on the table changes with them.
    for (const card of drag.cards) {
      const el = cardElement(root, card);
      if (!el) continue;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.zIndex = DRAG_Z_INDEX;
    }

    // The screen hears only about a change of spot (issue #116): a finger
    // moving inside one column would otherwise re-render the table per event.
    const target = drag.zones
      ? dropTargetAt(drag.zones, drag.startX + dx + drag.grabX, drag.startY + dy + drag.grabY)
      : null;
    const key = targetKey(target);
    if (key === drag.targetKey) return;
    drag.targetKey = key;
    drag.target = target;
    onDragTarget(target);
  };

  const onTablePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // Never travelled: a tap, and the click that follows is the tap path's.
    if (!drag.moved) return;
    // The click this release leaves behind must not count as a tap on top of
    // the drop (issue #116) — unless the cards were let go back where they
    // came from. Browsers draw their own line between a tap and a drag, a
    // little above this table's threshold on some phones, and a press that
    // fell between the two is a tap the browser will still send a click for:
    // let it through, and the tap it always was happens.
    suppressClickRef.current = !overSource(drag);

    const root = tableRef.current;
    if (root) releaseCards(root, drag.cards);
    // Should the drop move the cards, the replay must start where the finger
    // let go of them, not where they lay before the press — that is where
    // the player last saw them. The reading taken at the press is moved by
    // the drag for the carried cards, and only for them, and only once the
    // screen says the board changed: a reading moved for a drop that moved
    // nothing would send the next replay off from the wrong place.
    const previous = layoutRef.current;
    const landed = onDragEnd(drag.source, drag.target);
    if (!landed) {
      if (root) returnCards(root, drag, reducedMotion);
      return;
    }
    if (previous) {
      const cards = new Map(previous.cards);
      for (const card of drag.cards) {
        const spot = previous.cards.get(card);
        if (spot) cards.set(card, [spot[0] + drag.dx, spot[1] + drag.dy]);
      }
      layoutRef.current = { ...previous, cards };
    }
  };

  /**
   * The browser took the pointer away — a scroll it decided was its own, a
   * palm, a system gesture. Whatever the finger was over, nothing is played:
   * the cards go back and the board is as it was (issue #116).
   */
  const onTablePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    if (tableRef.current) returnCards(tableRef.current, drag, reducedMotion);
    onDragEnd(drag.source, null);
  };

  /**
   * A tap, unless it is the click a drag left behind. The mark is about the
   * click a press leaves, and `detail` is the count of clicks in that press: a
   * keyboard activation has none, and so is never the click the mark was left
   * for — Enter on a card the last drag started from must still select it.
   * While a drag is in flight (a second finger, say), no tap is heard at all.
   */
  const onTap = (event: MouseEvent<HTMLButtonElement>, tap: () => void) => {
    if (event.detail > 0 && suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current?.moved) return;
    tap();
  };

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

  /** Whether a card is in the run under the finger. */
  const isDragged = (check: DragSource): boolean => {
    if (!drag || drag.type !== check.type) return false;
    if (drag.type === 'tableau' && check.type === 'tableau') {
      return drag.pile === check.pile && drag.index <= check.index;
    }
    return true;
  };

  /** Whether a spot is the one the drag is over, and letting go there moves. */
  const isDropTarget = (check: DropTarget): boolean => {
    if (!drop || !dropLegal || drop.type !== check.type) return false;
    return drop.type === 'tableau' && check.type === 'tableau'
      ? drop.pile === check.pile
      : drop.type === 'foundation' && check.type === 'foundation' && drop.suit === check.suit;
  };

  /** A face-up card that can be tapped and, from this issue on, dragged. */
  const faceUpCard = (
    card: Card,
    source: DragSource,
    extraClass: string,
    label: string,
    onClick: () => void,
    overlap: 'down' | 'up' | null,
  ): ReactNode => {
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
          'sol-draggable',
          red ? 'sol-card-red' : 'sol-card-black',
          overlap === 'down' ? 'sol-overlap-down' : '',
          overlap === 'up' ? 'sol-overlap-up' : '',
          isDragged(source) ? 'sol-dragging' : '',
          extraClass,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        onPointerDown={(event) => onCardPointerDown(event, source)}
        onClick={(event) => onTap(event, onClick)}
      >
        <CardFace card={card} />
      </button>
    );
  };

  return (
    <div
      ref={tableRef}
      className="sol-table"
      role="group"
      aria-label={t('solTableLabel')}
      onPointerMove={onTablePointerMove}
      onPointerUp={onTablePointerUp}
      onPointerCancel={onTablePointerCancel}
    >
      <div className="sol-top-row" data-top-row="">
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
          onClick={(event) => onTap(event, onStockTap)}
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
            { type: 'waste' },
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
            foundationTarget === suit ? 'sol-destination' : '',
            hint?.foundation ? 'sol-hinted' : '',
            isSelected({ type: 'foundation', suit }) ? 'sol-selected' : '',
            isDropTarget({ type: 'foundation', suit }) ? 'sol-drop-target' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return top !== undefined ? (
            <button
              key={suit}
              type="button"
              data-card={top}
              data-foundation={suit}
              className={`sol-card ${suitIsRed(top) ? 'sol-card-red' : 'sol-card-black'} ${highlight}`}
              aria-label={t('solFoundationCard', {
                card: cardLabel(t, top),
              })}
              onClick={(event) => onTap(event, () => onFoundationTap(suit))}
            >
              <CardFace card={top} />
            </button>
          ) : (
            <button
              key={suit}
              type="button"
              data-foundation={suit}
              className={`sol-card sol-slot sol-slot-empty sol-slot-suit ${highlight}`}
              aria-label={t('solFoundationEmpty', {
                suit: t(`solSuit_${(['spades', 'hearts', 'diamonds', 'clubs'] as const)[suit]}`),
              })}
              onClick={(event) => onTap(event, () => onFoundationTap(suit))}
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
          const isDrop = isDropTarget({ type: 'tableau', pile: pileIndex });
          const hintRunStart = hint?.from?.pile === pileIndex ? hint.from.index : null;
          const hintLanding = hint?.to === pileIndex;
          return (
            <div
              key={pileIndex}
              className="sol-pile"
              data-pile={pileIndex}
              role="group"
              aria-label={t('solPileLabel', { n: pileIndex + 1 })}
            >
              {pile.down.length === 0 && pile.up.length === 0 ? (
                <button
                  type="button"
                  className={`sol-card sol-slot sol-slot-empty ${isDestination ? 'sol-destination' : ''} ${
                    hintLanding ? 'sol-hinted' : ''
                  } ${isDrop ? 'sol-drop-target' : ''}`}
                  aria-label={t('solPileEmpty', { n: pileIndex + 1 })}
                  onClick={(event) => onTap(event, () => onTableauTap(pileIndex, null))}
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
                  {pile.up.map((card, i) => {
                    // Hinted cards mirror a selection's reach: the run from its
                    // start up, plus the one card the run would land on.
                    const hinted =
                      (hintRunStart !== null && hintRunStart <= i) ||
                      (hintLanding && i === pile.up.length - 1);
                    const top = i === pile.up.length - 1;
                    return faceUpCard(
                      card,
                      { type: 'tableau', pile: pileIndex, index: i },
                      [
                        isSelected({ type: 'tableau', pile: pileIndex, index: i })
                          ? 'sol-selected'
                          : '',
                        top && isDestination ? 'sol-destination' : '',
                        top && isDrop ? 'sol-drop-target' : '',
                        hinted ? 'sol-hinted' : '',
                      ]
                        .filter(Boolean)
                        .join(' '),
                      cardLabel(t, card),
                      () => onTableauTap(pileIndex, i),
                      pile.down.length > 0 || i > 0 ? (i === 0 ? 'down' : 'up') : null,
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
});
