/**
 * The whole table (docs/SPIDER_SOLITAIRE_RULES.md §1, §3, §12): the stock and
 * the finished runs up top, ten columns below. Every playable spot is a
 * button; the screen owns the select-then-place state machine (§3) and this
 * component draws and reports taps — and, since issue #119, drags.
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
 *
 * A drag (§3, issue #119) is the second way in, and it is only a way in: the
 * table carries the pressed run under the finger, works out which column the
 * pointer is over, and on release hands the screen the same "put this there"
 * the second tap would have. The screen answers it with the same
 * `placeOnColumn`, so a drag can never move a card a tap could not — including
 * a mixed, non-run stack: the table does not re-check `isMovableRun` on the
 * drag side any more than the tap side does, so lifting one just lights
 * nothing and every drop returns it (§3). What lives here is geometry —
 * pointer capture, the travel threshold that keeps a tap a tap, the
 * hit-testing, the card following the finger — and none of it is React state:
 * the carried cards move by an inline transform written per pointer event, and
 * the screen hears from the table only when the logical drop target changes.
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

/**
 * How far a press must travel before it is a drag rather than a tap (issue
 * #119). Below this the press ends in the click the tap path has always
 * answered; the tremor in an ordinary tap must never pick a card up. The same
 * distance Solitaire uses (issue #116) and Block Puzzle uses for its pieces.
 */
export const DRAG_THRESHOLD_PX = 8;

/**
 * How far from the press a release can still be the tap the browser thinks it
 * is. Every platform draws its own line between a tap and a drag, a little
 * above this table's threshold — and a mouse sends a click however far it
 * travelled — so a press let go this close to where it began is handed back to
 * the tap path whole rather than spent on a drop nobody aimed. Comfortably
 * under a column's width: a real drag is farther than this.
 */
const TAP_SLOP_PX = 24;

/**
 * A card in flight sits above a card being replayed (`play` below uses 6):
 * the one under the finger is the one the player is looking at.
 */
const DRAG_Z_INDEX = '7';

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
export interface Selection {
  readonly pile: number;
  readonly index: number;
}

/**
 * What a drag can pick up (§3, issue #119): any face-up column card, with
 * everything above it — whether or not that happens to be a movable
 * same-suit run. There is nothing else to drag: unlike Klondike there is no
 * waste and no foundation, and the stock deals by a tap of its own (§3).
 */
export type DragSource = Selection;

/** Where a drag can let go: one of the ten columns. A column is the only spot
 *  a drop can land — the stock and the completed-run slots take nothing. */
export interface DropTarget {
  readonly pile: number;
}

/**
 * The table's drop zones, measured once when a drag begins: client
 * rectangles, because that is the space pointer events speak in.
 *
 * Columns are bands, not card rectangles. A card let go below the last card
 * of a short column — or in the gap beside it — still means that column: the
 * felt under a column is part of the column. The bands meet in the middle of
 * each gap, so there is no dead pixel between two columns. The top row (the
 * stock and the completed-run slots) takes nothing: there is nowhere up there
 * a drag could legally land.
 */
export interface DropZones {
  /** The tableau's left and right edge, with half a column of slack outside. */
  readonly left: number;
  readonly right: number;
  /** Above this line is the top row; below it, the columns. */
  readonly rowBottom: number;
  /** Above this line is off the table altogether. */
  readonly top: number;
  /** The x where column i ends and column i + 1 begins, nine of them. */
  readonly columnEdges: readonly number[];
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
  // The row and the tableau are separated by the table's gap; halfway across
  // it is where one stops being the other.
  const rowBottom = row.bottom + (first.top - row.bottom) / 2;
  return {
    left: first.left - first.width / 2,
    right: last.right + last.width / 2,
    top: row.top - row.height / 2,
    rowBottom,
    columnEdges,
  };
}

/**
 * Which column a pointer at (x, y) is over, or null for none. Pure, so the
 * geometry can be checked without a browser laying anything out. The top row
 * is never a target — a run let go on the stock or a completed-run slot goes
 * back where it came from (§3).
 */
export function dropTargetAt(zones: DropZones, x: number, y: number): DropTarget | null {
  if (x < zones.left || x > zones.right || y < zones.top) return null;
  if (y < zones.rowBottom) return null;
  let pile = 0;
  while (pile < zones.columnEdges.length && x > zones.columnEdges[pile]!) pile++;
  return { pile };
}

const targetKey = (target: DropTarget | null): string => (target === null ? '' : `p${target.pile}`);

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
   * a card grabbed by its lower edge and pushed up a column is over that
   * column while the finger is still on the felt below — so the spot is read
   * at the card's middle. Zero where the card has no layout to read.
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
  /**
   * Where the felt was scrolled to when the drag began. Everything below is
   * measured in the viewport's coordinates once, so the felt scrolling under
   * the drag — a wheel on a desktop, the one way it can still happen — would
   * silently move the cards away from the finger and the spots away from
   * where they were read. The drag ends instead of lying about where it is.
   */
  scrollTop: number;
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
 * the columns it happens to touch. A column mid-game is mostly cards the move
 * leaves alone, and outlining those would say "look here" about the wrong ones.
 */
export interface HintMarks {
  readonly stock?: boolean;
  /** The run to move: the cards from `index` up in column `pile`. */
  readonly from?: { readonly pile: number; readonly index: number };
  /** Where it lands: the top card of this column, or its empty slot. */
  readonly to?: number;
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
  /** The run under the finger, drawn lifted; null between drags. */
  drag: DragSource | null;
  /** The spot the drag is over right now, and whether letting go there moves. */
  drop: DropTarget | null;
  dropLegal: boolean;
  onStockTap: () => void;
  onColumnTap: (pile: number, index: number | null) => void;
  /** A press has become a drag: the screen holds `source` from here on. */
  onDragStart: (source: DragSource) => void;
  /** The drag is over a different spot than before (or over none). */
  onDragTarget: (target: DropTarget | null) => void;
  /**
   * The drag is over: let go over `target`, or over nothing, or taken away
   * by the browser. Returns true when the board changed — the cards then
   * settle from where they were released — and false when it did not, in
   * which case the table carries them back to where they came from.
   *
   * `tapFollows` says the press was let go all but where it began and the
   * click it leaves is still coming: the screen puts back whatever the tap
   * path was holding and places nothing, so the press finishes as the tap it
   * always was.
   */
  onDragEnd: (source: DragSource, target: DropTarget | null, tapFollows: boolean) => boolean;
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
  drag,
  drop,
  dropLegal,
  onStockTap,
  onColumnTap,
  onDragStart,
  onDragTarget,
  onDragEnd,
}: SpiderTableProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const tableRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<TableLayout | null>(null);
  const tickRef = useRef(moveTick);
  const suitCount = board.suitCount;
  const dragRef = useRef<Drag | null>(null);
  /**
   * True while the next click is the one a finished drag leaves behind, and
   * must not count as a tap. Where that click lands is the engine's business
   * — the pressed card where the pointer was captured, but that card may have
   * moved columns by then, and Safari does not retarget — so the mark is the
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

  // Where the board was before the tap. Every move starts with a finger going
  // down, and reading the table there is what keeps the measurement honest.
  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = tableRef.current;
      if (root) layoutRef.current = readLayout(root, board);
      // The same pointer pressing again means its last release never
      // reached the table — capture refused and the button let go off it,
      // or the release went to a context menu. That drag is over, not still
      // in progress: the cards go back and nothing is played.
      const stale = dragRef.current;
      if (stale !== null && stale.pointerId === event.pointerId) abandonDrag();
      // Cleared after that, and not before: this press's own click is live
      // whatever mark the drag it just ended left behind.
      suppressClickRef.current = false;
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
    // A click may still be coming — the button let go over the table once the
    // window came back — and it belongs to a drag that is over, not to a tap.
    suppressClickRef.current = true;
    const root = tableRef.current;
    if (root) releaseCards(root, drag.cards);
    onDragEndRef.current(drag.source, null, false);
  }

  /**
   * A board that changed under a drag — Undo from the keyboard, a dealt row —
   * ends it: the cards it was carrying may not be where the drag thinks, or
   * on the table at all. The screen is told, so it puts the marks down too; a
   * drop's own board change never gets here, because the drag is already gone
   * before the screen hears about it.
   *
   * Its own effect, keyed on the board alone: folded into the replay below it
   * would also fire on a motion-preference flip, and take a drag nobody had
   * let go of with it.
   */
  useLayoutEffect(() => {
    const root = tableRef.current;
    const interrupted = dragRef.current;
    if (!root || !interrupted) return;
    dragRef.current = null;
    if (!interrupted.moved) return;
    releaseCards(root, interrupted.cards);
    suppressClickRef.current = true;
    onDragEndRef.current(interrupted.source, null, false);
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

  /**
   * A finger down on a card that could be dragged (§3). Nothing is decided
   * yet: this is a tap until it travels, and a tap ends in the click the
   * button has always answered.
   */
  const onCardPointerDown = (event: PointerEvent<HTMLButtonElement>, source: DragSource) => {
    const root = tableRef.current;
    if (!root) return;
    // One drag at a time: a second finger while one is in flight picks
    // nothing up. (The same pointer pressing again cannot get here with a
    // drag still recorded — the document listener above ended it first.)
    if (dragRef.current !== null) return;
    // Only the hand's main button: a right or middle button and a pen's
    // barrel — held as the tip comes down it arrives inside `buttons` — pick
    // nothing up.
    if (event.button !== 0 || (event.buttons & 2) !== 0) return;
    const cards = board.tableau[source.pile]?.up.slice(source.index) ?? [];
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
      scrollTop: root.parentElement?.scrollTop ?? 0,
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
    // Read before anything is written this frame, so it costs no layout: the
    // felt scrolling under a drag would move the cards away from the finger
    // and the spots away from where they were measured.
    const body = root.parentElement;
    if (drag.moved && body && body.scrollTop !== drag.scrollTop) {
      abandonDrag();
      return;
    }
    let dx = event.clientX - drag.startX;
    let dy = event.clientY - drag.startY;

    if (!drag.moved) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      // Measured against where the felt stands now, which is the frame
      // everything below is read in.
      drag.scrollTop = body?.scrollTop ?? drag.scrollTop;
      // Past the threshold: a drag after all. Everything is measured now, the
      // last moment the table is certainly laid out as the finger sees it,
      // and once per drag — reading it per move would force a layout on
      // every event.
      //
      // First, though, the cards have to be showing where they lie. A card
      // grabbed as it lands is still travelling under its arrival animation,
      // and one picked by a tap wears the selection's lift: a rectangle read
      // through either is of a place the card is passing through, not of the
      // place it sits. The animation is cancelled rather than finished, so
      // the z-index it would have stripped stays with the drag, and the
      // transform written here is replaced by the carry a few lines below.
      for (const card of drag.cards) {
        const el = cardElement(root, card);
        if (!el) continue;
        if (typeof el.getAnimations === 'function') {
          for (const running of el.getAnimations()) running.cancel();
        }
        el.style.transform = 'translate(0px, 0px)';
      }
      drag.zones = readDropZones(root);
      const head = drag.cards[0] === undefined ? null : cardElement(root, drag.cards[0]);
      const last =
        drag.cards.length === 0 ? null : cardElement(root, drag.cards[drag.cards.length - 1]!);
      const headRect = head?.getBoundingClientRect();
      const lastRect = last?.getBoundingClientRect();
      if (headRect && headRect.width > 0) {
        // The player aims with the card, not with the fingertip under it: a
        // card grabbed by its lower edge and pushed up a column is over that
        // column while the finger is still down on the felt.
        drag.grabX = headRect.left + headRect.width / 2 - drag.startX;
        drag.grabY = headRect.top + headRect.height / 2 - drag.startY;
        const felt = body?.getBoundingClientRect();
        if (body && felt && felt.width > 0 && lastRect) {
          // The run may not leave the felt (see `travel`) — but the felt
          // scrolls where the screen is short (§3), so what it may not leave
          // is the felt's CONTENT, not the part of it in view: half a column
          // can already lie below the fold. Bounded by the content, and never
          // tighter than where the run already lies, because a clamp that
          // excluded the resting place would jerk the run on the drag's very
          // first move — or, for a run taller than the felt, pin it there.
          const contentTop = felt.top - body.scrollTop;
          const contentBottom = contentTop + Math.max(body.scrollHeight, felt.height);
          drag.travel = {
            minX: Math.min(0, felt.left - headRect.left),
            maxX: Math.max(0, felt.right - headRect.right),
            minY: Math.min(0, contentTop - headRect.top),
            maxY: Math.max(0, contentBottom - lastRect.bottom),
          };
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
    // not through React: a run of twenty cards at sixty moves a second is not
    // a render's job, and nothing else on the table changes with them.
    for (const card of drag.cards) {
      const el = cardElement(root, card);
      if (!el) continue;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.zIndex = DRAG_Z_INDEX;
    }

    // The screen hears only about a change of spot (issue #119): a finger
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
    // Let go all but where it began: the platform's own line between a tap
    // and a drag sits a little above this table's, and a mouse sends a click
    // however far it travelled, so this press is one the browser still thinks
    // is a tap. The click goes through and the screen puts back what the tap
    // path was holding — the press finishes as the tap it always was. A press
    // that really travelled is a drag whose click means nothing, wherever it
    // was let go: over a column, over nothing, or off the table (§3).
    const rx = event.clientX - drag.startX;
    const ry = event.clientY - drag.startY;
    const tapFollows = rx * rx + ry * ry < TAP_SLOP_PX * TAP_SLOP_PX;
    suppressClickRef.current = !tapFollows;

    const root = tableRef.current;
    if (root) {
      releaseCards(root, drag.cards);
      // Should the drop move the cards, the replay must start where the
      // finger let go of them, not where they lay before the press — that is
      // where the player last saw them. Read now rather than reusing the
      // reading taken at the press: a rotation or a resize during the drag
      // would have made that one a place the card never was (§12).
      layoutRef.current = readLayout(root, board);
    }
    const previous = layoutRef.current;
    const landed = onDragEnd(drag.source, drag.target, tapFollows);
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
   * the cards go back and the board is as it was (issue #119).
   */
  const onTablePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    if (tableRef.current) returnCards(tableRef.current, drag, reducedMotion);
    onDragEnd(drag.source, null, false);
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

  /** Whether a card is in the run under the finger. */
  const isDragged = (check: DragSource): boolean =>
    drag !== null && drag.pile === check.pile && drag.index <= check.index;

  /** Whether a column is the one the drag is over, and letting go there moves. */
  const isDropTarget = (pile: number): boolean => drop !== null && dropLegal && drop.pile === pile;

  const deals = dealsLeft(board);

  return (
    <div
      ref={tableRef}
      className="sp-table"
      role="group"
      aria-label={t('spiderTableLabel')}
      onPointerMove={onTablePointerMove}
      onPointerUp={onTablePointerUp}
      onPointerCancel={onTablePointerCancel}
    >
      <div className="sp-top-row" data-top-row="">
        {/* The stock: five deals of ten, and the count is what a player plans
            around, so it is the count — not the card total — on show (§3). */}
        <button
          type="button"
          className={`sp-card sp-slot sp-stock ${deals > 0 ? 'sp-card-back' : 'sp-slot-empty'} ${
            hint?.stock ? 'sp-hinted' : ''
          }`}
          aria-label={deals > 0 ? t('spiderStockLabel', { n: deals }) : t('spiderStockEmpty')}
          onClick={(event) => onTap(event, onStockTap)}
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
          const isDrop = isDropTarget(pileIndex);
          const hintRunStart = hint?.from?.pile === pileIndex ? hint.from.index : null;
          const hintLanding = hint?.to === pileIndex;
          return (
            <div
              key={pileIndex}
              className="sp-pile"
              data-pile={pileIndex}
              role="group"
              aria-label={t('spiderColumnLabel', { n: pileIndex + 1 })}
            >
              {pile.down.length === 0 && pile.up.length === 0 ? (
                <button
                  type="button"
                  className={`sp-card sp-slot sp-slot-empty ${isDestination ? 'sp-destination' : ''} ${
                    hintLanding ? 'sp-hinted' : ''
                  } ${isDrop ? 'sp-drop-target' : ''}`}
                  aria-label={t('spiderColumnEmpty', { n: pileIndex + 1 })}
                  onClick={(event) => onTap(event, () => onColumnTap(pileIndex, null))}
                />
              ) : (
                <>
                  {pile.down.map((card, i) => (
                    // No data-card on a face-down card: its identity is not the
                    // page's to give away. Not draggable, and — touch-action
                    // being set only on face-up cards — still a scroll handle
                    // on a short screen (§3), as in Klondike.
                    <div
                      key={`down-${card}`}
                      className={`sp-card sp-card-back ${i > 0 ? 'sp-overlap-down' : ''}`}
                      role="img"
                      aria-label={t('spiderCardFaceDown')}
                    />
                  ))}
                  {pile.up.map((card, i) => {
                    const source: DragSource = { pile: pileIndex, index: i };
                    const held =
                      selection !== null && selection.pile === pileIndex && selection.index <= i;
                    const overlapped = pile.down.length > 0 || i > 0;
                    // Hinted cards mirror a selection's reach: the run from its
                    // start up, plus the one card the run would land on.
                    const hinted =
                      (hintRunStart !== null && hintRunStart <= i) ||
                      (hintLanding && i === pile.up.length - 1);
                    const top = i === pile.up.length - 1;
                    return (
                      <button
                        key={`card-${card}`}
                        type="button"
                        data-card={card}
                        className={[
                          'sp-card',
                          'sp-draggable',
                          isRed(card, suitCount) ? 'sp-card-red' : 'sp-card-black',
                          overlapped ? 'sp-overlap' : '',
                          held ? 'sp-selected' : '',
                          isDragged(source) ? 'sp-dragging' : '',
                          top && isDestination ? 'sp-destination' : '',
                          top && isDrop ? 'sp-drop-target' : '',
                          hinted ? 'sp-hinted' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-label={cardLabel(t, card, suitCount)}
                        onPointerDown={(event) => onCardPointerDown(event, source)}
                        onClick={(event) => onTap(event, () => onColumnTap(pileIndex, i))}
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
