/**
 * The play area: the board with its silhouette, the tray under it, and the
 * seven pieces (docs/TANGRAM_RULES.md §4, §10). Interim (Phase 0 not run):
 * the input follows the rules document's §4, which starts from the Phase 0
 * prototype (apps/simple-games/prototypes/phase0/tangram-board.html).
 *
 * Every piece is one `<button>`, in the tray or on the board — the same
 * element all the way, so a drag keeps its pointer capture and a placed piece
 * keeps the keyboard focus. The button's own box is not pressable
 * (`pointer-events: none`); only the polygon drawn inside it is, so what a
 * finger can press is the piece's shape and never its bounding box (§10): a
 * press just outside a tilted triangle reaches the piece or the board below.
 *
 * - A tap turns the piece 45° clockwise (the click the press leaves). A
 *   press that travels more than TAP_SLOP_PX is a drag: the piece is drawn
 *   where it would snap — filled when it can be placed, an outline at the
 *   finger when it cannot — and letting go places it in the pose last drawn
 *   (§4): the one React has committed to the screen, never one computed by a
 *   move whose render has not happened yet. A tray piece floats TRAY_LIFT_PX
 *   above the finger; a board piece keeps where the finger held it.
 * - One finger: the press remembers its `pointerId`, and another finger (a
 *   pointer that is not the primary one) does nothing. A new primary pointer
 *   while a press is on record means the old release went missing: the old
 *   press is abandoned — no operation — and the new one goes ahead. So is a
 *   press whose pointer capture is lost (`lostpointercapture` before any
 *   release). A `pointercancel` (the notification shade, a call) sends a
 *   carried piece back to the tray — one operation for a board piece, nothing
 *   for a tray piece (docs/ARCHITECTURE.md「指を取り上げられたときの契約」).
 * - The click a drag leaves behind is marked spent and eaten — only a click
 *   that came from a press (`detail > 0`); a keyboard activation never is.
 *   The mark is dropped at the next press.
 * - The page going hidden abandons the press (§8「手にある駒」): nothing is
 *   recorded, and a release or a cancel that arrives afterwards is ignored.
 *
 * Nothing here decides a rule. Snaps come from game/snap.ts, and a drop is
 * handed to the screen, which asks the session.
 */
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  atForCentroid,
  isFixed,
  KEYBOARD_TOLERANCE,
  orientedShape,
  PIECE_IDS,
  poseVertices,
  ptToFloat,
  snapPose,
  type FloatPoint,
  type Orientation,
  type PieceId,
  type Placement,
  type SnapOutcome,
  type TangramSession,
} from '../../game';
import {
  boardPixels,
  boundsOf,
  DEFAULT_PLAY_SIZE,
  playLayout,
  pointerTolerance,
  TAP_SLOP_PX,
  toUnits,
  TRAY_LIFT_PX,
  trayPixels,
  type PlayLayout,
} from '../layout';
import { pieceLabel } from '../labels';

/** A piece lifted by the keyboard (the screen owns it; this draws it). */
export interface Lift {
  readonly id: PieceId;
  readonly source: 'tray' | 'board';
  readonly o: Orientation;
  /** The provisional point: the carried piece's vertex average, in units (§4). */
  readonly point: FloatPoint;
  readonly outcome: SnapOutcome;
}

/** A turn or a flip just made, for the look of it (never with Reduced Motion). */
export interface PieceAnimation {
  readonly id: PieceId;
  readonly kind: 'turn' | 'flip';
  readonly key: number;
}

export interface TangramBoardProps {
  session: TangramSession;
  label: string;
  selected: PieceId | null;
  lift: Lift | null;
  animation: PieceAnimation | null;
  onSelect: (id: PieceId) => void;
  /** A tap: the piece turns 45° clockwise. */
  onTap: (id: PieceId) => void;
  /** A drag let go where a pose was drawn. */
  onDrop: (id: PieceId, placement: Placement) => void;
  /** A board piece let go with no room, or its drag cancelled: back to the tray. */
  onReturn: (id: PieceId) => void;
  /** A press began (true) or ended (false): the screen holds its buttons and keys meanwhile. */
  onHoldChange: (held: boolean) => void;
}

/** The live values of one press. A ref, not state: only `carry` is drawn. */
interface Press {
  readonly pointerId: number;
  readonly id: PieceId;
  readonly source: 'tray' | 'board';
  readonly o: Orientation;
  readonly startX: number;
  readonly startY: number;
  /** For a board piece: the piece's `at` minus the finger, in units, at the press. */
  readonly grab: FloatPoint;
  dragging: boolean;
}

/** What a drag shows: the wish (float `at`) and what it snaps to. */
interface Carry {
  /** The press that drew it: a drop reads only its own press's drawing. */
  readonly press: Press;
  readonly id: PieceId;
  readonly source: 'tray' | 'board';
  readonly o: Orientation;
  readonly at: FloatPoint;
  readonly outcome: SnapOutcome;
}

const pointsAttr = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * Which of the one wood's two boards a piece is cut from (tangram.css, §10).
 * The Quick Rules pictures read it too (TangramFigure), so a piece is the same
 * wood on the board and in the picture.
 */
export const shadeOf = (id: PieceId): 'a' | 'b' =>
  id === 'L1' || id === 'L2' || id === 'SQ' ? 'a' : 'b';

/**
 * The grain's frame for one piece. Its points arrive already turned —
 * poseVertices / trayPixels bake Rʳ(Fᶠ(v)) in — so the grain is turned by
 * hand the same way: its origin on vertex 0 (every local shape's origin,
 * game/pieces.ts), then 45° × r, clockwise with y down like R. The grain runs
 * along local x, which F (x → −x) leaves where it was, so a flip needs nothing.
 */
const grainFrame = (points: readonly (readonly [number, number])[], o: Orientation): string =>
  `translate(${points[0]![0].toFixed(2)} ${points[0]![1].toFixed(2)}) rotate(${o.r * 45})`;

/** The grain tile, 48 × 28 px: lines along x as [y, width], sparse and uneven on purpose. */
const GRAIN_LINES: readonly (readonly [number, number])[] = [
  [3.5, 0.8],
  [8.5, 1.2],
  [13, 0.6],
  [19, 1],
  [24.5, 0.7],
];

/**
 * The grain's one tile, drawn once in the board's own <svg>; each piece's
 * pattern inherits it by `href` and adds only its frame. Each line leaves and
 * comes back at the same height and slope, so the tile repeats without a
 * seam. Its props never change, so it never re-renders.
 */
const GrainTile = memo(function GrainTile({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="48" height="28" patternUnits="userSpaceOnUse">
        {GRAIN_LINES.map(([y, width]) => (
          <path
            key={y}
            className="tn-grain-line"
            strokeWidth={width}
            d={`M0 ${y} C16 ${y - 0.8} 32 ${y + 0.8} 48 ${y}`}
          />
        ))}
      </pattern>
    </defs>
  );
});

/** The play area's size, measured (with a fallback where nothing can be measured). */
function usePlaySize(element: HTMLDivElement | null): { width: number; height: number } {
  const [size, setSize] = useState<{ width: number; height: number }>(DEFAULT_PLAY_SIZE);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // A first frame, a hidden tab, jsdom: nothing honest to measure.
      const next = width > 0 && height > 0 ? { width, height } : DEFAULT_PLAY_SIZE;
      setSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [element]);
  return size;
}

/** The carried piece's polygon in play-area pixels: the snapped pose, or the raw wish. */
function carriedPixels(
  layout: PlayLayout,
  id: PieceId,
  o: Orientation,
  at: FloatPoint,
  outcome: SnapOutcome,
): [number, number][] {
  if (outcome.placement) return boardPixels(layout, poseVertices(id, outcome.placement));
  return orientedShape(id, o).map((v) => {
    const [x, y] = ptToFloat(v);
    return [layout.originX + (at[0] + x) * layout.ppu, layout.originY + (at[1] + y) * layout.ppu];
  });
}

export const TangramBoard = memo(function TangramBoard({
  session,
  label,
  selected,
  lift,
  animation,
  onSelect,
  onTap,
  onDrop,
  onReturn,
  onHoldChange,
}: TangramBoardProps) {
  const { t } = useSettings();
  // The grain's ids: one tile, and a pattern per piece that turns it (§10).
  const grainId = useId();
  const tileId = `${grainId}tile`;
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const size = usePlaySize(element);
  const { figure } = session;
  const layout = playLayout(size.width, size.height, figure.outline);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const pressRef = useRef<Press | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  /**
   * What is on screen: `carry` once React has committed it. The drop decides
   * from this — never from the release point, and never from a move computed
   * in the same frame whose render has not happened yet (§4).
   */
  const drawnRef = useRef<Carry | null>(null);
  useLayoutEffect(() => {
    drawnRef.current = carry;
  }, [carry]);
  /**
   * Set when a drag (or a cancel, or an abandoned press) has just ended, so
   * the click its release leaves behind is not taken as a tap as well. Read
   * only for a click that came from a press (`detail > 0`), and dropped at the
   * next press.
   */
  const spentClickRef = useRef(false);

  /** Ends the press on record, whatever ends it. */
  const endPress = useCallback(() => {
    pressRef.current = null;
    setCarry(null);
    onHoldChange(false);
  }, [onHoldChange]);

  /**
   * Drops the press on record with nothing recorded: the page went hidden, its
   * capture was lost, or a new primary pointer came while its release never
   * did. A release or a cancel that still arrives for it is ignored, and the
   * click it may leave is eaten.
   */
  const abandonPress = useCallback(() => {
    if (pressRef.current === null) return;
    spentClickRef.current = true;
    endPress();
  }, [endPress]);

  const unitsAt = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = element?.getBoundingClientRect();
      return toUnits(layoutRef.current, clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0));
    },
    [element],
  );

  /** The wish (float `at`) for a press with the finger at (clientX, clientY). */
  const wishAt = useCallback(
    (press: Press, clientX: number, clientY: number): FloatPoint => {
      if (press.source === 'board') {
        const [ux, uy] = unitsAt(clientX, clientY);
        return [ux + press.grab[0], uy + press.grab[1]];
      }
      // From the tray, the piece's vertex average rides TRAY_LIFT_PX above the finger.
      const point = unitsAt(clientX, clientY - TRAY_LIFT_PX);
      return atForCentroid(press.id, press.o, point);
    },
    [unitsAt],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, id: PieceId) => {
      const current = pressRef.current;
      if (current !== null) {
        // One finger: a second finger does nothing, on any piece (§4). A new
        // primary pointer means the recorded press lost its release somewhere
        // nobody heard (UnblockBoard's shape): that press is abandoned with
        // nothing recorded, and this one replaces it.
        if (event.isPrimary === false && current.pointerId !== event.pointerId) return;
        abandonPress();
      }
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      spentClickRef.current = false;
      if (session.status !== 'playing' || lift !== null) return;
      onSelect(id);
      if (isFixed(session, id)) return;
      const placed = session.board[id];
      const source = placed ? 'board' : 'tray';
      const o = placed ? { r: placed.r, f: placed.f } : session.tray[id];
      let grab: FloatPoint = [0, 0];
      if (placed) {
        const [ux, uy] = unitsAt(event.clientX, event.clientY);
        const [ax, ay] = ptToFloat(placed.at);
        grab = [ax - ux, ay - uy];
      }
      pressRef.current = {
        pointerId: event.pointerId,
        id,
        source,
        o,
        startX: event.clientX,
        startY: event.clientY,
        grab,
        dragging: false,
      };
      onHoldChange(true);
      // Capture is an improvement (a finger that leaves the board keeps
      // carrying the piece), never a precondition — it throws when the
      // pointer is already gone, and jsdom has none.
      const target = event.target as Element;
      try {
        if (typeof target.setPointerCapture === 'function')
          target.setPointerCapture(event.pointerId);
      } catch {
        // The drag still works from the events that do arrive.
      }
    },
    [abandonPress, lift, onHoldChange, onSelect, session, unitsAt],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (!press.dragging) {
        const dx = event.clientX - press.startX;
        const dy = event.clientY - press.startY;
        if (dx * dx + dy * dy <= TAP_SLOP_PX * TAP_SLOP_PX) return;
        press.dragging = true;
      }
      const at = wishAt(press, event.clientX, event.clientY);
      const outcome = snapPose(figure.outline, session.board, {
        id: press.id,
        orientation: press.o,
        at,
        tolerance: pointerTolerance(layoutRef.current.ppu, KEYBOARD_TOLERANCE),
      });
      setCarry({ press, id: press.id, source: press.source, o: press.o, at, outcome });
    },
    [figure.outline, session.board, wishAt],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      const drawn = drawnRef.current?.press === press ? drawnRef.current : null;
      endPress();
      // Never moved: this was a tap, and the click that follows plays it.
      if (!press.dragging) return;
      spentClickRef.current = true;
      if (drawn?.outcome.placement) onDrop(press.id, drawn.outcome.placement);
      else if (press.source === 'board') onReturn(press.id);
    },
    [endPress, onDrop, onReturn],
  );

  /**
   * The platform took the finger away. No release is coming: a carried piece
   * goes back to the tray — one operation from the board, nothing from the
   * tray (§4) — and nothing is placed.
   */
  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      endPress();
      if (!press.dragging) return;
      spentClickRef.current = true;
      if (press.source === 'board') onReturn(press.id);
    },
    [endPress, onReturn],
  );

  /**
   * The capture went before any release did (the browser took it back, the
   * element lost it): no release is coming to this element, so the press is
   * abandoned rather than left on record to block every later one. After a
   * release the press is already gone and this does nothing.
   */
  const onLostPointerCapture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (pressRef.current?.pointerId === event.pointerId) abandonPress();
    },
    [abandonPress],
  );

  const onPieceClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, id: PieceId) => {
      if (event.detail > 0 && spentClickRef.current) {
        spentClickRef.current = false;
        return;
      }
      if (pressRef.current !== null || lift !== null || session.status !== 'playing') return;
      onSelect(id);
      onTap(id);
    },
    [lift, onSelect, onTap, session.status],
  );

  /** Space activates a button on its release: the screen's keydown already answered it. */
  const onPieceKeyUp = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ') event.preventDefault();
  }, []);

  // The page going hidden abandons the press (§8「手にある駒」): no operation,
  // and whatever the finger does afterwards is ignored.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') abandonPress();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [abandonPress]);

  const outlinePx = boardPixels(layout, figure.outline);
  const guides =
    figure.tier === 'easy'
      ? PIECE_IDS.map((id) => boardPixels(layout, poseVertices(id, figure.solution[id])))
      : [];
  const held = carry ?? (lift ? { ...lift, at: atForCentroid(lift.id, lift.o, lift.point) } : null);
  const heldPx = held ? carriedPixels(layout, held.id, held.o, held.at, held.outcome) : null;
  const finished = session.status !== 'playing';

  return (
    <div ref={setElement} className="tn-play">
      <div
        className="tn-board"
        style={{
          left: layout.board.x,
          top: layout.board.y,
          width: layout.board.w,
          height: layout.board.h,
        }}
      >
        <svg
          className="tn-board-svg"
          viewBox={`${layout.board.x} ${layout.board.y} ${layout.board.w} ${layout.board.h}`}
          role="img"
          aria-label={label}
        >
          <GrainTile id={tileId} />
          <polygon
            className={`tn-silhouette${finished ? ' tn-silhouette-done' : ''}`}
            points={pointsAttr(outlinePx)}
          />
          {guides.map((points, index) => (
            <polygon key={index} className="tn-guide" points={pointsAttr(points)} />
          ))}
        </svg>
      </div>
      <div
        className="tn-tray"
        style={{
          left: layout.tray.x,
          top: layout.tray.y,
          width: layout.tray.w,
          height: layout.tray.h,
        }}
        aria-hidden="true"
      />

      {PIECE_IDS.map((id) => {
        const placed = session.board[id];
        const fixed = isFixed(session, id);
        const o = placed ? { r: placed.r, f: placed.f } : session.tray[id];
        const points = placed
          ? boardPixels(layout, poseVertices(id, placed))
          : trayPixels(layout, id, o);
        const box = boundsOf(points);
        const lifted = held !== null && held.id === id;
        const animate = animation !== null && animation.id === id ? animation : null;
        let animStyle: CSSProperties | undefined;
        if (animate) {
          // About the pivot on the board; about the cell's centre in the tray (§10).
          const [px, py] = placed ? boardPixels(layout, [placed.pv])[0]! : layout.cells[id];
          const axis = o.r * 45;
          animStyle = {
            transformOrigin: `${(px - box.x).toFixed(2)}px ${(py - box.y).toFixed(2)}px`,
            ['--tn-axis' as string]: `${axis}deg`,
          } as CSSProperties;
        }
        const pts = pointsAttr(points);
        const patternId = `${grainId}${id}`;
        const classes = [
          'tn-piece',
          placed ? 'tn-piece-placed' : 'tn-piece-tray',
          `tn-shade-${shadeOf(id)}`,
          fixed ? 'tn-piece-fixed' : '',
          selected === id ? 'tn-piece-selected' : '',
          lifted ? 'tn-piece-lifted' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={id}
            type="button"
            className={classes}
            data-piece={id}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            aria-label={pieceLabel(t, id, o, placed !== undefined, fixed)}
            aria-pressed={selected === id}
            onPointerDown={(event) => onPointerDown(event, id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onLostPointerCapture}
            onClick={(event) => onPieceClick(event, id)}
            onKeyUp={onPieceKeyUp}
            onFocus={() => onSelect(id)}
          >
            <svg
              key={animate ? `anim-${animate.key}` : 'still'}
              className={animate ? `tn-piece-svg tn-anim-${animate.kind}` : 'tn-piece-svg'}
              style={animStyle}
              viewBox={`${box.x} ${box.y} ${Math.max(box.w, 0.01)} ${Math.max(box.h, 0.01)}`}
              aria-hidden="true"
            >
              {/* Bottom to top (tangram.css): the opaque face, the grain in the
                  piece's own frame, the pressable edge, the focus ring. */}
              <defs>
                <pattern
                  id={patternId}
                  href={`#${tileId}`}
                  patternTransform={grainFrame(points, o)}
                />
              </defs>
              <polygon className="tn-face" points={pts} />
              <polygon className="tn-grain" fill={`url(#${patternId})`} points={pts} />
              <polygon className="tn-shape" points={pts} />
              <polygon className="tn-ring" points={pts} />
            </svg>
          </button>
        );
      })}

      {heldPx && held ? (
        <svg
          className="tn-carry"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          <polygon
            className={`${held.outcome.placement ? 'tn-carry-fits' : 'tn-carry-open'} tn-shade-${shadeOf(held.id)}`}
            points={pointsAttr(heldPx)}
          />
        </svg>
      ) : null}
    </div>
  );
});
