import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { suitOf, type Card } from '../../game';
import { moveCard, sameOrder } from '../../game/handOrder';
import { CardFace, CardBack, cardClass, rankText, isJoker, SUITS } from './CardFace';
export function useTableNames(you: number, names?: readonly string[]) {
  const { t } = useSettings();
  return (seat: number) =>
    names?.[seat] ??
    (seat === you ? t('indianRummyYou') : t('indianRummyCpu', { n: seat > you ? seat : seat + 1 }));
}
export function useCardLabel() {
  const { t } = useSettings();
  return (card: Card) =>
    isJoker(card)
      ? t('indianRummyJoker')
      : t('indianRummyCard', { rank: rankText(card), suit: SUITS[suitOf(card)]! });
}
export function Face({ card }: { card: Card }) {
  const label = useCardLabel();
  return (
    <span className={cardClass(card)} role="img" aria-label={label(card)}>
      <CardFace card={card} />
    </span>
  );
}
export function Back() {
  return (
    <span className="ir-card" aria-hidden="true">
      <CardBack />
    </span>
  );
}
export function Seats({
  you,
  turn,
  over,
  counts,
  names,
  detail,
}: {
  you: number;
  turn: number;
  over: boolean;
  counts: readonly number[];
  names?: readonly string[];
  detail?: (seat: number) => ReactNode;
}) {
  const { t } = useSettings(),
    name = useTableNames(you, names);
  return (
    <div className="ir-seats">
      {counts.map((n, seat) => (
        <div
          key={seat}
          className={`ir-seat ${!over && turn === seat ? 'is-active' : ''}`}
          aria-current={!over && turn === seat ? 'true' : undefined}
        >
          {seat !== you && n > 0 ? (
            <span className="ir-seat-back" aria-hidden="true">
              <CardBack />
            </span>
          ) : null}
          <strong>{name(seat)}</strong>
          <span>{t('indianRummyCards', { n })}</span>
          {detail?.(seat)}
        </div>
      ))}
    </div>
  );
}
export function Status({
  you,
  turn,
  over,
  names,
  children,
}: {
  you: number;
  turn: number;
  over: boolean;
  names?: readonly string[];
  children?: ReactNode;
}) {
  const { t } = useSettings(),
    name = useTableNames(you, names);
  return (
    <p className={`ir-status ${!over && you === turn ? 'is-yours' : ''}`} role="status">
      {children ??
        (over
          ? t('indianRummyLost')
          : you === turn
            ? t('indianRummyYourTurn')
            : t('indianRummyTurn', { name: name(turn) }))}
    </p>
  );
}
/**
 * How far a press must travel before it carries the card rather than taps it.
 * The tremor in an ordinary tap must never move a card; the same distance as
 * Solitaire's and Block Puzzle's drags.
 */
const DRAG_THRESHOLD_PX = 8;
/**
 * A release this close to the press is still the tap the browser thinks it is
 * (platforms draw their own line a little above the threshold, and a mouse
 * clicks however far it went), so its click selects the card as a tap would.
 * Under half a card's width: a card that changed places travelled farther.
 */
const TAP_SLOP_PX = 24;
/** Room the lifted card may overhang the hand's box above and below. */
const LIFT_ROOM_PX = 12;
const SHIFT_MS = 140;
const SETTLE_MS = 160;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const LIFT = 'scale(1.06)';
interface Point {
  x: number;
  y: number;
}
/**
 * The card under the finger. Not state: it changes with every pointer event,
 * the card follows by an inline transform, and React hears only of a change of
 * place.
 */
interface Drag {
  readonly pointerId: number;
  readonly card: Card;
  readonly startX: number;
  readonly startY: number;
  /** True once the press has travelled past the threshold: a drag, not a tap. */
  moved: boolean;
  /**
   * True once the press has been further from where it started than a tap's
   * slop: its release is never a tap, even back on the place it left.
   */
  far: boolean;
  /**
   * The middle of each place in the hand, relative to the hand's own box and
   * read once when the drag starts. Relative, so the screen scrolling under a
   * drag (a wheel on a desktop) moves the places with the hand.
   */
  slots: Point[];
  /** Where the card's middle may go, in the same frame: inside the hand. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /**
   * From the finger to the card's middle as it was seen at the press, settling
   * or sliding included: the player aims with the card, which stays under the
   * finger where it was taken.
   */
  grabX: number;
  grabY: number;
  /** Where the card's middle is now. */
  at: Point;
}
function nearestSlot(slots: readonly Point[], at: Point): number {
  let best = 0,
    distance = Infinity;
  slots.forEach((slot, i) => {
    const d = (slot.x - at.x) ** 2 + (slot.y - at.y) ** 2;
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const cardElement = (root: HTMLElement, card: Card) =>
  root.querySelector<HTMLElement>(`[data-card="${card}"]`);
/**
 * Plays a card from `offset` back to where it lies. Below the supported floor
 * there may be no Web Animations: the card is simply there, as under Reduced
 * Motion. A card moved twice in quick succession keeps only the second travel.
 */
function travel(el: HTMLElement, offset: Point, duration: number) {
  if (typeof el.animate !== 'function' || typeof el.getAnimations !== 'function') return;
  for (const running of el.getAnimations()) running.cancel();
  const base = getComputedStyle(el).transform,
    rest = base && base !== 'none' ? base : 'translate(0px, 0px)';
  el.style.zIndex = '3';
  const animation = el.animate(
    [{ transform: `translate(${offset.x}px, ${offset.y}px) ${rest}` }, { transform: rest }],
    { duration, easing: EASE },
  );
  animation.onfinish = () => {
    el.style.zIndex = '';
  };
}
/**
 * Ends every slide and settle still running in the hand, so the places read
 * next are where the cards stand, not where an animation shows them on the way.
 */
function stillHand(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-card]')) {
    if (typeof el.getAnimations !== 'function') continue;
    for (const running of el.getAnimations())
      try {
        running.finish();
      } catch {
        running.cancel();
      }
    el.style.zIndex = '';
  }
}
const sameCards = (a: readonly Card[], b: readonly Card[]) =>
  a.length === b.length && a.every((card) => b.includes(card));
export function Hand({
  cards,
  enabled = [],
  selected,
  onChoose,
  onArrange,
}: {
  cards: readonly Card[];
  enabled?: readonly Card[];
  selected?: Card | null;
  onChoose?: (card: Card) => void;
  /**
   * The player's own hand: cards move by dragging, or by Shift + ←/→ from the
   * keyboard (docs/INDIAN_RUMMY_RULES.md, "Hand arrangement"). Every card can
   * then be pressed on every turn — only selecting one waits for `enabled`.
   */
  onArrange?: (order: Card[]) => void;
}) {
  const { t } = useSettings(),
    label = useCardLabel(),
    reducedMotion = useReducedMotion(),
    hintId = useId(),
    ref = useRef<HTMLDivElement>(null),
    hadFocus = useRef(false);
  const arrangeable = onArrange !== undefined && onChoose !== undefined;
  /**
   * The order a drag is showing before it is let go. The cards keep their DOM
   * order meanwhile and take their places by CSS `order`: moving the pressed
   * card's node would end its pointer capture mid-drag. A hand that changed
   * under the drag is shown as it is.
   */
  const [preview, setPreview] = useState<Card[] | null>(null);
  const [lifted, setLifted] = useState<Card | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const shown = preview && sameCards(preview, cards) ? preview : cards;
  const dragRef = useRef<Drag | null>(null),
    /** The order the drag means, ahead of the render that shows it. */
    orderRef = useRef<readonly Card[]>(shown),
    /** The order on screen, as of the last render. */
    shownRef = useRef<readonly Card[]>(shown),
    /** Where each card stood on screen, for the neighbours' slide. */
    placesRef = useRef(new Map<Card, number>()),
    /** The places of the drag in flight or just let go: how far a slide is. */
    slotsRef = useRef<Point[] | null>(null),
    /** The card just let go, which travels on its own and is not slid. */
    settlingRef = useRef<Card | null>(null),
    focusRef = useRef<Card | null>(null),
    /**
     * True while the next click is the one a finished drag leaves behind.
     * Cleared by the next press anywhere, so it can never swallow a later tap.
     */
    suppressClickRef = useRef(false);
  shownRef.current = shown;
  const latest = useRef({ cards, onArrange, reducedMotion });
  latest.current = { cards, onArrange, reducedMotion };
  const signature = cards.join(','),
    shownKey = shown.join(','),
    active = enabled.join(',');

  /** Ends a drag: the card goes down where it is shown, or back where it was. */
  const finish = (drag: Drag, keep: boolean) => {
    dragRef.current = null;
    const { cards: committed, onArrange: arrange, reducedMotion: still } = latest.current;
    const final = keep ? orderRef.current : committed;
    const root = ref.current,
      el = root && cardElement(root, drag.card),
      slot = drag.slots[final.indexOf(drag.card)];
    if (el) {
      el.style.transform = '';
      if (!still && slot) {
        settlingRef.current = drag.card;
        travel(el, { x: drag.at.x - slot.x, y: drag.at.y - slot.y }, SETTLE_MS);
      }
      if (document.activeElement === el) focusRef.current = drag.card;
    }
    slotsRef.current = drag.slots;
    orderRef.current = final;
    setLifted(null);
    setPreview(null);
    if (keep && !sameOrder(final, committed)) arrange?.([...final]);
  };
  /** A drag whose release the hand will never hear: the card goes back. */
  const abandon = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    finish(drag, false);
  };
  const abandonRef = useRef(abandon);
  abandonRef.current = abandon;

  useEffect(() => {
    if (!arrangeable) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      // The same pointer pressing again: its last release never reached the
      // hand (capture refused, a context menu), so that drag is over.
      const stale = dragRef.current;
      if (stale && stale.pointerId === event.pointerId) abandonRef.current();
      suppressClickRef.current = false;
    };
    // Alt-Tab, a call, a system gesture: a drag cannot outlive the window's focus.
    const onBlur = () => abandonRef.current();
    // Capture phase, so it runs before the card has recorded the new press.
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [arrangeable]);

  // A hand whose cards changed under a drag ends it; the drop's own change
  // never gets here, because the drag is gone before the hand hears of it.
  const cardSet = [...cards].sort((a, b) => a - b).join(',');
  useLayoutEffect(() => {
    if (dragRef.current) abandonRef.current();
  }, [cardSet]);

  // After the cards stand in their new places and before paint: the carried
  // card is put back under the finger, and the neighbours slide over from
  // where they were rather than jumping.
  useLayoutEffect(() => {
    const root = ref.current,
      order = shownRef.current;
    if (!root) return;
    const before = placesRef.current,
      now = new Map(order.map((card, i) => [card, i]));
    placesRef.current = now;
    const drag = dragRef.current,
      slots = slotsRef.current;
    if (slots && slots.length === order.length && !latest.current.reducedMotion)
      for (const [card, to] of now) {
        const from = before.get(card);
        if (from === undefined || from === to) continue;
        if (card === drag?.card || card === settlingRef.current) continue;
        const el = cardElement(root, card);
        if (el)
          travel(
            el,
            { x: slots[from]!.x - slots[to]!.x, y: slots[from]!.y - slots[to]!.y },
            SHIFT_MS,
          );
      }
    settlingRef.current = null;
    if (!drag) slotsRef.current = null;
    if (drag?.moved) {
      const el = cardElement(root, drag.card),
        slot = drag.slots[order.indexOf(drag.card)];
      if (el && slot)
        el.style.transform = `translate(${drag.at.x - slot.x}px, ${drag.at.y - slot.y}px) ${LIFT}`;
    }
    const focus = focusRef.current;
    focusRef.current = null;
    if (focus !== null && document.activeElement !== cardElement(root, focus))
      cardElement(root, focus)?.focus();
  }, [signature, shownKey]);

  useLayoutEffect(() => {
    if (
      hadFocus.current &&
      (document.activeElement === document.body || !document.activeElement?.isConnected)
    )
      ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [signature, active]);

  const onCardPointerDown = (event: PointerEvent<HTMLButtonElement>, card: Card) => {
    // One drag at a time, and only the main button: a right button or a pen's
    // barrel (held as the tip lands it arrives in `buttons`) carries nothing.
    if (!arrangeable || dragRef.current) return;
    if (event.button !== 0 || (event.buttons & 2) !== 0) return;
    settlingRef.current = null;
    slotsRef.current = null;
    const seen = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      card,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      far: false,
      slots: [],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      grabX: seen.left + seen.width / 2 - event.clientX,
      grabY: seen.top + seen.height / 2 - event.clientY,
      at: { x: 0, y: 0 },
    };
    // Keeps the moves coming after the finger leaves the card. An improvement,
    // never a precondition: it throws when the pointer is already gone.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The moves that stay over the hand arrive anyway.
    }
  };
  const onHandPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current,
      root = ref.current;
    if (!drag || drag.pointerId !== event.pointerId || !root) return;
    // A mouse moving with its button up let go somewhere the hand never heard.
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      abandon();
      return;
    }
    const dx = event.clientX - drag.startX,
      dy = event.clientY - drag.startY,
      travelled = dx * dx + dy * dy;
    if (travelled >= TAP_SLOP_PX * TAP_SLOP_PX) drag.far = true;
    if (!drag.moved) {
      if (travelled < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      // Past the threshold: measured now, once, with every card standing in
      // its place — a card still sliding, or the one picked up again as it
      // settles, would otherwise lend its slot where the animation shows it.
      stillHand(root);
      const frame = root.getBoundingClientRect(),
        order = shownRef.current,
        rects = order.map((card) => cardElement(root, card)?.getBoundingClientRect());
      const home = rects[order.indexOf(drag.card)];
      // Nothing laid out (a hidden screen) means nowhere to drop: a tap after all.
      if (!home || home.width === 0 || frame.width === 0 || rects.some((r) => !r)) {
        dragRef.current = null;
        return;
      }
      drag.slots = rects.map((r) => ({
        x: r!.left + r!.width / 2 - frame.left,
        y: r!.top + r!.height / 2 - frame.top,
      }));
      // The card stays inside the hand: a card carried past the scrolling
      // panel's edge would grow it a scrollbar and reflow the hand underneath.
      const halfW = home.width / 2,
        halfH = home.height / 2;
      drag.bounds = {
        minX: halfW,
        maxX: Math.max(halfW, frame.width - halfW),
        minY: halfH - LIFT_ROOM_PX,
        maxY: Math.max(halfH - LIFT_ROOM_PX, frame.height - halfH + LIFT_ROOM_PX),
      };
      drag.moved = true;
      slotsRef.current = drag.slots;
      orderRef.current = order;
      setLifted(drag.card);
      setPreview([...order]);
    }
    const box = root.getBoundingClientRect();
    drag.at = {
      x: clamp(event.clientX - box.left + drag.grabX, drag.bounds.minX, drag.bounds.maxX),
      y: clamp(event.clientY - box.top + drag.grabY, drag.bounds.minY, drag.bounds.maxY),
    };
    const target = nearestSlot(drag.slots, drag.at);
    if (target !== orderRef.current.indexOf(drag.card)) {
      orderRef.current = moveCard(orderRef.current, drag.card, target);
      setPreview([...orderRef.current]);
    }
    // Placed against the order on screen now; the render a new place brings
    // places it again before it is painted.
    const el = cardElement(root, drag.card),
      slot = drag.slots[shownRef.current.indexOf(drag.card)];
    if (el && slot)
      el.style.transform = `translate(${drag.at.x - slot.x}px, ${drag.at.y - slot.y}px) ${LIFT}`;
  };
  const onHandPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      dragRef.current = null;
      return;
    }
    // A press that stayed within a tap's reach all along, and let go there, is
    // a tap that wobbled; one that went further is a drag wherever it ends.
    const rx = event.clientX - drag.startX,
      ry = event.clientY - drag.startY,
      tapFollows = !drag.far && rx * rx + ry * ry < TAP_SLOP_PX * TAP_SLOP_PX;
    suppressClickRef.current = !tapFollows || !sameOrder(orderRef.current, cards);
    finish(drag, true);
  };
  // The browser took the pointer away (a palm, a system gesture): nothing moves.
  const onHandPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    finish(drag, false);
  };
  const onCardClick = (event: MouseEvent<HTMLButtonElement>, card: Card) => {
    // `detail` counts the clicks of a press: a keyboard activation has none,
    // so it is never the click a drag left behind.
    if (event.detail > 0 && suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragRef.current?.moved || !enabled.includes(card)) return;
    onChoose?.(card);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      onArrange &&
      onChoose &&
      event.shiftKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      !dragRef.current?.moved
    ) {
      const card = Number((document.activeElement as HTMLElement | null)?.dataset.card);
      const from = cards.indexOf(card);
      if (from < 0) return;
      event.preventDefault();
      const to = from + (event.key === 'ArrowLeft' ? -1 : 1);
      if (to < 0 || to >= cards.length) return;
      settlingRef.current = null;
      slotsRef.current = null;
      focusRef.current = card;
      onArrange(moveCard(cards, card, to));
      setAnnouncement(t('indianRummyMoved', { card: label(card), n: to + 1, total: cards.length }));
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
      return;
    const buttons = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement),
      offset =
        event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowUp'
              ? -7
              : 7;
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (((Math.max(0, current) + offset) % buttons.length) + buttons.length) % buttons.length;
    buttons[index]?.focus();
    event.preventDefault();
  };
  return (
    <div
      className={`ir-hand${arrangeable ? ' is-arrangeable' : ''}`}
      style={
        {
          '--ir-hand-columns': Math.max(1, Math.min(7, cards.length)),
          '--ir-hand-compact-columns': Math.max(1, Math.min(6, cards.length)),
        } as CSSProperties
      }
      ref={ref}
      aria-label={t('indianRummyHand')}
      onKeyDown={keyDown}
      onPointerMove={arrangeable ? onHandPointerMove : undefined}
      onPointerUp={arrangeable ? onHandPointerUp : undefined}
      onPointerCancel={arrangeable ? onHandPointerCancel : undefined}
      onFocusCapture={() => {
        hadFocus.current = true;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          hadFocus.current = false;
      }}
    >
      {cards.map((card) => {
        if (!onChoose) return <Face card={card} key={card} />;
        const legal = enabled.includes(card),
          place = preview && shown === preview ? preview.indexOf(card) : -1;
        return (
          <button
            type="button"
            key={card}
            data-card={card}
            className={`${cardClass(card)} ${legal ? 'is-legal' : ''} ${selected === card ? 'is-selected' : ''} ${lifted === card ? 'is-lifted' : ''}`}
            style={place >= 0 ? { order: place } : undefined}
            disabled={arrangeable ? undefined : !legal}
            aria-disabled={arrangeable && !legal ? true : undefined}
            aria-describedby={arrangeable ? hintId : undefined}
            aria-label={label(card)}
            aria-pressed={selected === undefined ? undefined : selected === card}
            onPointerDown={arrangeable ? (event) => onCardPointerDown(event, card) : undefined}
            onClick={(event) => onCardClick(event, card)}
          >
            <CardFace card={card} />
          </button>
        );
      })}
      {arrangeable ? (
        <>
          <span id={hintId} hidden>
            {t('indianRummyArrangeKeys')}
          </span>
          <span className="visually-hidden" aria-live="polite">
            {announcement}
          </span>
        </>
      ) : null}
    </div>
  );
}
