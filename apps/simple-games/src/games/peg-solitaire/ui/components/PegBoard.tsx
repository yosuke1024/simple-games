/**
 * The playing board (docs/PEG_SOLITAIRE_RULES.md §4, §5, §13).
 *
 * Every hole is a button, so the whole game is playable by tapping alone:
 * tap a peg to pick it up (the holes it can land in get a dot), tap a dotted
 * hole to jump. Dragging and the keyboard are other doors to the same two
 * taps, never the only way to do anything:
 *
 * - Drag: press a peg, carry it, let go over a dotted hole. Less than 8px of
 *   travel is a tap, not a drag. Let go anywhere else and the peg is back in
 *   its hole, still picked up. A `pointercancel` (the notification shade, a
 *   call) is a cancel, never a drop. The press is held on the peg's own
 *   button with pointer capture, so a finger that leaves the board keeps
 *   carrying it; the release and the cancel are heard on the board, where
 *   the captured events arrive (docs/ARCHITECTURE.md「指を取り上げられたときの
 *   契約」, src/test/pointerContractWiring.test.ts).
 * - Keyboard: the board is one tab stop (roving tabindex). The arrow keys
 *   move the focus from hole to hole (ui/layout.ts `stepFocus`), and Enter or
 *   Space presses the focused hole like a tap. A held Enter does not repeat
 *   the press.
 *
 * Nothing here decides a rule. Which holes take a dot comes from the session
 * (game/engine.ts `jumpsFrom`), and a drop or a tap is handed to the screen,
 * which asks the rules.
 */
import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { geometryOf, type Jump, type PegSolitaireSession } from '../../game';
import { holeAt, isArrowKey, layoutOf, stepFocus } from '../layout';
import { HoleFace, holeStyle, Plate } from './BoardParts';

/** How far a press must travel before it is a drag rather than a tap (§4). */
export const DRAG_THRESHOLD_PX = 8;

export interface PegBoardProps {
  session: PegSolitaireSession;
  /** The picked-up peg, or null. */
  selected: number | null;
  /** The holes the picked-up peg can land in — the dots (§5). */
  landings: readonly number[];
  /**
   * The jump that made this board, when it should be seen travelling (a tap
   * or a key, with motion allowed). A dropped peg is already where it lands,
   * and an undone board is placed, not replayed.
   */
  arriving: { readonly jump: Jump; readonly key: number } | null;
  onHoleTap: (index: number) => void;
  /** A drag has begun from the peg at `from`: it is picked up. */
  onDragStart: (from: number) => void;
  /** A drag let go over hole `to`. The screen decides whether it is a jump. */
  onDrop: (from: number, to: number) => void;
  /** The board element, for the screen to bring the keyboard focus here. */
  boardRef?: (element: HTMLDivElement | null) => void;
}

/** The live values of one press. A ref, not state: only `held` is drawn. */
interface Press {
  readonly pointerId: number;
  readonly from: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
  dx: number;
  dy: number;
  /** The hole under the finger, or −1. */
  over: number;
}

export const PegBoard = memo(function PegBoard({
  session,
  selected,
  landings,
  arriving,
  onHoleTap,
  onDragStart,
  onDrop,
  boardRef,
}: PegBoardProps) {
  const { t } = useSettings();
  const { problem, pegs } = session;
  const geometry = geometryOf(problem.kind);
  const layout = layoutOf(geometry);

  /** The one hole in the tab order: where the keyboard focus lives. */
  const [cursor, setCursor] = useState(problem.target);
  /** The peg being carried and the hole under it, while a drag is on. */
  const [held, setHeld] = useState<{ from: number; over: number } | null>(null);

  const elementRef = useRef<HTMLDivElement | null>(null);
  const pressRef = useRef<Press | null>(null);
  /**
   * Set when a drag has just ended, so the click its release leaves behind is
   * not taken as a tap as well. Read only for a click that came from a press
   * (`detail > 0`) — a keyboard activation has none — and dropped at the next
   * press, so a drag let go between holes cannot eat a later tap.
   */
  const spentClickRef = useRef(false);
  const floatRef = useRef<HTMLSpanElement | null>(null);

  const setElement = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      boardRef?.(element);
    },
    [boardRef],
  );

  /** The hole under a viewport point, or −1 (between holes, off the board). */
  const holeUnder = useCallback(
    (clientX: number, clientY: number): number => {
      const element = elementRef.current;
      if (!element) return -1;
      const rect = element.getBoundingClientRect();
      // A board with no layout yet (a first frame, a hidden tab) can answer
      // nothing honest about where a hole is.
      if (rect.width === 0 || rect.height === 0) return -1;
      const x = ((clientX - rect.left) / rect.width) * layout.width;
      const y = ((clientY - rect.top) / rect.height) * layout.height;
      return holeAt(layout, x, y);
    },
    [layout],
  );

  const placeFloat = useCallback((element: HTMLSpanElement | null) => {
    floatRef.current = element;
    const press = pressRef.current;
    if (element && press) element.style.transform = `translate(${press.dx}px, ${press.dy}px)`;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      spentClickRef.current = false;
      // One press at a time — the newest. A release can go missing entirely,
      // and a press that outlived the next one would be worse than one that
      // is replaced by it.
      pressRef.current = null;
      setHeld(null);
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (session.status !== 'playing') return;
      const button = (event.target as Element).closest<HTMLElement>('[data-hole]');
      if (!button) return;
      const from = Number(button.dataset.hole);
      if (!pegs[from]) return;
      pressRef.current = {
        pointerId: event.pointerId,
        from,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        dx: 0,
        dy: 0,
        over: from,
      };
      // Capture is an improvement (a finger that leaves the board keeps
      // carrying the peg), never a precondition — it throws if the pointer
      // is already gone, and losing the drag to that would be absurd.
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // The drag still works from the events that do arrive.
      }
    },
    [pegs, session.status],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      press.dx = event.clientX - press.startX;
      press.dy = event.clientY - press.startY;
      if (!press.moved) {
        if (press.dx * press.dx + press.dy * press.dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          return;
        }
        press.moved = true;
        onDragStart(press.from);
      }
      // The carried peg follows the finger without a render per event; only
      // a different hole underneath is worth one.
      if (floatRef.current) {
        floatRef.current.style.transform = `translate(${press.dx}px, ${press.dy}px)`;
      }
      const over = holeUnder(event.clientX, event.clientY);
      if (held === null || over !== press.over) {
        press.over = over;
        setHeld({ from: press.from, over });
      }
    },
    [held, holeUnder, onDragStart],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      pressRef.current = null;
      setHeld(null);
      // Never moved: this was a tap, and the click that follows plays it.
      if (!press.moved) return;
      spentClickRef.current = true;
      const to = holeUnder(event.clientX, event.clientY);
      if (to >= 0 && to !== press.from) onDrop(press.from, to);
    },
    [holeUnder, onDrop],
  );

  /**
   * The platform took the finger away — the notification shade, a call, a
   * palm. No release is coming, so the press is dropped and nothing jumps:
   * the peg is back in its hole (§4).
   */
  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    pressRef.current = null;
    setHeld(null);
    if (press.moved) spentClickRef.current = true;
  }, []);

  const onHoleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      if (event.detail > 0 && spentClickRef.current) {
        spentClickRef.current = false;
        return;
      }
      onHoleTap(index);
    },
    [onHoleTap],
  );

  /** The focus follows a click or a Tab, so the arrows start from there. */
  const onFocus = useCallback((event: { target: EventTarget }) => {
    const hole = (event.target as HTMLElement).dataset?.hole;
    if (hole !== undefined) setCursor(Number(hole));
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const hole = (event.target as HTMLElement).dataset?.hole;
      if (hole === undefined) return;
      if ((event.key === 'Enter' || event.key === ' ') && event.repeat) {
        // A held key presses once (§4).
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || !isArrowKey(event.key)) return;
      event.preventDefault();
      const next = stepFocus(geometry, Number(hole), event.key);
      setCursor(next);
      elementRef.current?.querySelector<HTMLButtonElement>(`[data-hole="${next}"]`)?.focus();
    },
    [geometry],
  );

  // A board of another size cannot keep a focus index it does not have.
  const focusIndex = cursor < geometry.holes.length ? cursor : problem.target;
  const landingSet = new Set(landings);
  const arrival =
    arriving && session.jumps[session.jumps.length - 1] === arriving.jump ? arriving : null;
  const centers = layout.centers;

  const label = (index: number): string => {
    const peg = pegs[index] === true;
    const ring = index === problem.target;
    const landing = landingSet.has(index);
    const content = peg
      ? t(ring ? 'pegSolitaireContentPegRing' : 'pegSolitaireContentPeg')
      : landing
        ? t(ring ? 'pegSolitaireContentLandingRing' : 'pegSolitaireContentLanding')
        : t(ring ? 'pegSolitaireContentEmptyRing' : 'pegSolitaireContentEmpty');
    const hole = geometry.holes[index]!;
    return geometry.kind === 'english'
      ? t('pegSolitaireHoleGrid', { row: hole.row + 1, col: hole.col + 1, content })
      : t('pegSolitaireHoleRow', { row: hole.row + 1, place: hole.col + 1, content });
  };

  return (
    <div
      ref={setElement}
      className={`pg-board pg-board-${problem.kind}${held ? ' pg-board-dragging' : ''}`}
      style={{ '--pg-aspect': layout.width / layout.height } as CSSProperties}
      role="group"
      aria-label={t(`pegSolitaireBoardLabel_${problem.kind}`)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <Plate layout={layout} shapes={[{ points: layout.outline, closed: true }]} />
      {centers.map((center, index) => {
        const peg = pegs[index] === true;
        const isSelected = peg && selected === index;
        const lifted = held !== null && held.from === index;
        const hover = held !== null && held.over === index && landingSet.has(index);
        const arrivesHere = arrival !== null && arrival.jump.to === index && peg;
        const vanishesHere = arrival !== null && arrival.jump.over === index && !peg;
        let pegStyle: CSSProperties | undefined;
        if (arrivesHere) {
          const from = centers[arrival.jump.from]!;
          pegStyle = {
            '--pg-dx': `${(from.x - center.x) * 100}%`,
            '--pg-dy': `${(from.y - center.y) * 100}%`,
          } as CSSProperties;
        }
        const classes = [
          'pg-hole',
          peg ? 'pg-hole-peg' : 'pg-hole-empty',
          isSelected ? 'pg-hole-selected' : '',
          lifted ? 'pg-hole-lifted' : '',
          hover ? 'pg-hole-hover' : '',
          // The holes are siblings stacked in DOM order, so a peg sliding in
          // from a later hole (every jump up or to the left) would pass under
          // the pits it crosses. The hole it lands in is lifted while it
          // carries the slide (and until the board changes again).
          arrivesHere ? 'pg-hole-arriving' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={index}
            type="button"
            className={classes}
            style={holeStyle(layout, center)}
            data-hole={index}
            tabIndex={index === focusIndex ? 0 : -1}
            aria-label={label(index)}
            aria-pressed={peg ? isSelected : undefined}
            onClick={(event) => onHoleClick(event, index)}
          >
            <HoleFace
              peg={peg}
              ring={index === problem.target}
              dot={landingSet.has(index)}
              pegClassName={arrivesHere ? 'pg-peg-arrive' : undefined}
              pegStyle={pegStyle}
              pegKey={arrivesHere ? `arrive-${arrival.key}` : undefined}
            >
              {vanishesHere ? (
                <span
                  key={`vanish-${arrival.key}`}
                  className="pg-layer pg-peg pg-peg-vanish"
                  aria-hidden="true"
                />
              ) : null}
            </HoleFace>
          </button>
        );
      })}
      {held !== null ? (
        <span
          ref={placeFloat}
          className="pg-float"
          style={holeStyle(layout, centers[held.from]!)}
          aria-hidden="true"
        >
          <span className="pg-layer pg-peg pg-peg-held" />
        </span>
      ) : null}
    </div>
  );
});
