/**
 * The Bridges board (docs/BRIDGES_RULES.md §4, §5, §13).
 *
 * The islands are the only things to press. Each is a round button 1.3 cells
 * across — wider than a cell, which the layout allows because no two islands
 * are ever side by side, and diagonal neighbours sit √2 cells apart (§1). The
 * disc drawn inside is smaller. Water and the thin bridge lines answer
 * nothing except "clear the selection": one water cell can lie on two
 * possible bridges, so a line is never the target (§4).
 *
 * What an island shows never rests on colour alone (§5): short of its number
 * it is an outline, on it a filled disc, past it a double ring. The selected
 * island wears a thick ring; the islands it can be joined to wear a dashed
 * one, with a dashed line from the selection to each that has no bridge yet.
 * The hint lays a band along the pair it means and marks the island whose
 * count gives it away, when there is one (§9) — and the islands it marks say
 * so in their spoken names, since a mark alone reaches only the eye.
 *
 * Input (§4). A tap is a click, so the keyboard (Enter / Space on a focused
 * island) and a screen reader's activation reach exactly what a finger does.
 * A press can also be dragged from one island and let go on another, which is
 * the same as "select, then tap" — a shortcut, never the only way. Moves are
 * measured against the field's own rectangle rather than handled per island,
 * because a captured pointer stops visiting the elements it passes over. A
 * press that left its island is a drag, and the click its release leaves
 * behind is spent, so a drag never also taps the island it began on. A
 * cancelled pointer — the OS taking the finger away — drops the drag whole:
 * it decided nothing.
 *
 * Arrow keys move the focus from island to island (`islandToward`); only one
 * island is in the tab order at a time, so Tab leaves the board in one step.
 */
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  candidatesFor,
  colOf,
  factsOf,
  islandTotal,
  rowOf,
  type BridgesSession,
  type Hint,
} from '../../game';
import { ARROW_DIRECTIONS, isPartner, islandToward } from '../tapLogic';
import { BridgeLines, WaterDots, centerOf } from './BridgeStrokes';

/** The hit circle's radius, in cells: 1.3 cells across (§13). */
export const HIT_RADIUS = 0.65;

/** One press in progress. A ref, not state: only the preview it raises is drawn. */
interface Drag {
  readonly pointerId: number;
  /** The island the press began on. */
  readonly origin: number;
  /** The field's rectangle, measured once (the islands refuse to pan). */
  readonly rect: DOMRect;
  /** True once the finger has left the origin's circle: a drag, no longer a tap. */
  started: boolean;
}

/** What a drag in progress shows: its origin's partners, and the island under the finger. */
interface DragPreview {
  readonly origin: number;
  readonly over: number | null;
}

export interface BridgesBoardHandle {
  /** Moves the keyboard focus onto the board's current island. */
  focusIsland: () => void;
}

export interface BridgesBoardProps {
  session: BridgesSession;
  /** The selected island's ordinal, or null (§4). */
  selected: number | null;
  /** The last hint: an edge over the answer, or a step with its reason (§9). */
  hint: Hint | null;
  /** True the instant the board is solved, for the one-shot wash (§13). */
  solved: boolean;
  /** A tap (or Enter / Space) on an island. What it means is the screen's (ui/tapLogic.ts). */
  onTapIsland: (island: number) => void;
  /** A press dragged from one island and let go on another (§4). */
  onDragConnect: (from: number, to: number) => void;
  /** A tap on the water: clears the selection (§4). */
  onTapWater: () => void;
}

export const BridgesBoard = memo(
  forwardRef<BridgesBoardHandle, BridgesBoardProps>(function BridgesBoard(
    { session, selected, hint, solved, onTapIsland, onDragConnect, onTapWater },
    ref,
  ) {
    const { t } = useSettings();
    const { width, height, islands, graph, bridges } = session;
    const playing = session.status === 'playing';

    const fieldRef = useRef<HTMLDivElement | null>(null);
    const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const dragRef = useRef<Drag | null>(null);
    /**
     * The island a drag began on, so the click that may follow it does not tap
     * it. Cleared on every press, so a press whose click never came (a cancel)
     * cannot swallow the next one.
     */
    const handledRef = useRef<number | null>(null);
    const [preview, setPreview] = useState<DragPreview | null>(null);
    /** The one island in the tab order (roving tabindex). */
    const [focusIsland, setFocusIsland] = useState<number>(() => selected ?? 0);
    const rovingIsland = Math.min(Math.max(0, focusIsland), islands.length - 1);

    useImperativeHandle(
      ref,
      () => ({
        focusIsland: () => buttonsRef.current[rovingIsland]?.focus(),
      }),
      [rovingIsland],
    );

    /** The island whose hit circle holds a point, or null for water. */
    const islandAt = useCallback(
      (rect: DOMRect, x: number, y: number): number | null => {
        if (rect.width === 0 || rect.height === 0) return null;
        const cell = rect.width / width;
        const cx = (x - rect.left) / cell;
        const cy = (y - rect.top) / cell;
        for (let ordinal = 0; ordinal < islands.length; ordinal++) {
          const center = centerOf(islands[ordinal]!.index, width);
          if (Math.hypot(center.x - cx, center.y - cy) < HIT_RADIUS) return ordinal;
        }
        return null;
      },
      [islands, width],
    );

    const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, island: number) => {
      handledRef.current = null;
      // The primary button only: nothing else means anything here (§4).
      if (event.button !== 0) return;
      const field = fieldRef.current;
      if (field === null) return;
      dragRef.current = {
        pointerId: event.pointerId,
        origin: island,
        rect: field.getBoundingClientRect(),
        started: false,
      };
      // Capture keeps the moves coming to this button — and so, by bubbling,
      // to the field — after the finger has left the island. An improvement,
      // never a precondition: it throws if the pointer is already gone.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The drag still works from the events we do get.
      }
    }, []);

    /** Follows a press. Bound to the field: capture retargets moves to the origin island. */
    const onFieldPointerMove = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        // A field with no layout yet can say nothing honest about where an island is.
        if (drag.rect.width === 0 || drag.rect.height === 0) return;
        const over = islandAt(drag.rect, event.clientX, event.clientY);
        if (!drag.started) {
          if (over === drag.origin) return;
          // Left the origin's circle: the press is a drag, and the click its
          // release leaves behind must not tap the origin.
          drag.started = true;
          handledRef.current = drag.origin;
        }
        setPreview((current) =>
          current !== null && current.origin === drag.origin && current.over === over
            ? current
            : { origin: drag.origin, over },
        );
      },
      [islandAt],
    );

    /** The release decides: a drag let go on another island joins the two (§4). */
    const onFieldPointerUp = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setPreview(null);
        if (!drag.started) return;
        const over = islandAt(drag.rect, event.clientX, event.clientY);
        if (over !== null && over !== drag.origin) onDragConnect(drag.origin, over);
      },
      [islandAt, onDragConnect],
    );

    /**
     * The platform took the finger (§4): no release and no click are coming.
     * The drag is dropped whole, and nothing is left armed behind it.
     */
    const onFieldPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setPreview(null);
    }, []);

    const onIslandClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>, island: number) => {
        // Not the water's click as well.
        event.stopPropagation();
        // `detail` is the click count of the press that made this click: a
        // keyboard activation has none, and so is never the click a drag left.
        if (event.detail > 0 && handledRef.current === island) {
          handledRef.current = null;
          return;
        }
        onTapIsland(island);
      },
      [onTapIsland],
    );

    /** A tap that reached the field and not an island is a tap on the water. */
    const onFieldClick = useCallback(() => {
      onTapWater();
    }, [onTapWater]);

    /** Arrows walk the islands; a held Enter does not build bridge after bridge (§4). */
    const onFieldKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        const from = Number((event.target as HTMLElement).dataset?.island);
        if (!Number.isInteger(from)) return;
        if (event.key === 'Enter' && event.repeat) {
          event.preventDefault();
          return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const direction = ARROW_DIRECTIONS[event.key];
        if (direction === undefined) return;
        event.preventDefault();
        const next = islandToward(session, from, direction);
        if (next === null) return;
        setFocusIsland(next);
        buttonsRef.current[next]?.focus();
      },
      [session],
    );

    const facts = factsOf(session);
    const occupied = useMemo(() => new Set(islands.map((island) => island.index)), [islands]);

    // The selection a drag stands in for while it lasts (§4).
    const source = playing ? (preview?.origin ?? selected) : null;
    const partners = source === null ? [] : candidatesFor(session, source);
    const partnerIslands = new Set(partners.map((partner) => partner.island));
    const target =
      preview !== null && preview.over !== null && isPartner(session, preview.origin, preview.over)
        ? preview.over
        : null;

    // What the hint points at (§9).
    const hintEdge = hint === null ? null : graph.edges[hint.edge];
    const hintPair = new Set<number>(hintEdge ? [hintEdge.a, hintEdge.b] : []);
    const reasonIsland = hint?.kind === 'step' && hint.island >= 0 ? hint.island : null;
    const hintWrong = hint?.kind === 'wrong';

    const position = (ordinal: number) => {
      const index = islands[ordinal]!.index;
      return { row: rowOf(index, width) + 1, col: colOf(index, width) + 1 };
    };

    const labelOf = (ordinal: number): string => {
      const island = islands[ordinal]!;
      const count = islandTotal(graph, bridges, ordinal);
      const state = facts.states[ordinal];
      const base = { ...position(ordinal), value: island.value, count };
      const plain =
        state === 'complete'
          ? t('bridgesIslandComplete', base)
          : state === 'over'
            ? t('bridgesIslandOver', base)
            : t('bridgesIslandOpen', base);
      // The hint's marks are drawn; its islands say so too (§9, §13), and
      // keep saying it while a selection is made beside them.
      const name =
        ordinal === reasonIsland
          ? t('bridgesIslandHintRing', { island: plain })
          : hintPair.has(ordinal)
            ? t('bridgesIslandHinted', { island: plain })
            : plain;
      if (ordinal === source) return t('bridgesIslandSelected', { island: name });
      const partner = partners.find((p) => p.island === ordinal);
      if (partner !== undefined) {
        return t('bridgesIslandPartner', { island: name, bridges: bridges[partner.edge] ?? 0 });
      }
      return name;
    };

    return (
      <div
        className={`bg-board${solved ? ' bg-board-solved' : ''}`}
        role="group"
        aria-label={t('bridgesBoardLabel', { width, height, islands: islands.length })}
        style={{ '--bg-cols': width, '--bg-rows': height } as CSSProperties}
      >
        <div
          className="bg-field"
          ref={fieldRef}
          onPointerMove={onFieldPointerMove}
          onPointerUp={onFieldPointerUp}
          onPointerCancel={onFieldPointerCancel}
          onClick={onFieldClick}
          onKeyDown={onFieldKeyDown}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg
            className="bg-lines"
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            focusable="false"
          >
            <WaterDots width={width} height={height} occupied={occupied} />
            {hintEdge ? (
              <line
                className={`bg-hint-band${hintWrong ? ' bg-hint-band-wrong' : ''}`}
                x1={centerOf(islands[hintEdge.a]!.index, width).x}
                y1={centerOf(islands[hintEdge.a]!.index, width).y}
                x2={centerOf(islands[hintEdge.b]!.index, width).x}
                y2={centerOf(islands[hintEdge.b]!.index, width).y}
              />
            ) : null}
            {source !== null
              ? partners
                  .filter((partner) => (bridges[partner.edge] ?? 0) === 0)
                  .map((partner) => {
                    const from = centerOf(islands[source]!.index, width);
                    const to = centerOf(islands[partner.island]!.index, width);
                    return (
                      <line
                        key={partner.edge}
                        className={`bg-candidate${partner.island === target ? ' bg-candidate-target' : ''}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                      />
                    );
                  })
              : null}
            {graph.edges.map((edge) => (
              <BridgeLines
                key={edge.id}
                from={centerOf(islands[edge.a]!.index, width)}
                to={centerOf(islands[edge.b]!.index, width)}
                count={bridges[edge.id] ?? 0}
              />
            ))}
          </svg>

          {islands.map((island, ordinal) => {
            const index = island.index;
            const classes = [
              'bg-island',
              `bg-island-${facts.states[ordinal]}`,
              ordinal === source ? 'bg-island-selected' : '',
              partnerIslands.has(ordinal) ? 'bg-island-partner' : '',
              ordinal === target ? 'bg-island-target' : '',
              hintPair.has(ordinal) ? (hintWrong ? 'bg-island-wrong' : 'bg-island-hint') : '',
              ordinal === reasonIsland ? 'bg-island-reason' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={index}
                ref={(element) => {
                  buttonsRef.current[ordinal] = element;
                }}
                type="button"
                className={classes}
                data-island={ordinal}
                tabIndex={ordinal === rovingIsland ? 0 : -1}
                style={
                  {
                    '--bg-r': rowOf(index, width),
                    '--bg-c': colOf(index, width),
                  } as CSSProperties
                }
                aria-label={labelOf(ordinal)}
                onPointerDown={(event) => onPointerDown(event, ordinal)}
                onClick={(event) => onIslandClick(event, ordinal)}
                onFocus={() => setFocusIsland(ordinal)}
              >
                <span className="bg-ring" aria-hidden="true" />
                <span className="bg-disc" aria-hidden="true">
                  {island.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }),
);
