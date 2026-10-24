/**
 * The tiles (docs/MAKE_THE_TARGET_RULES.md §1, §3, §12): one fixed place per
 * slot, in one row — a number is a `<button>`, a used-up slot an empty place
 * that keeps its width, so nothing slides when two tiles merge.
 *
 * Taps only (§3): the board takes no `onPointerDown`, so there is no press for
 * a cancelled pointer to leave behind (src/test/pointerContractWiring.test.ts).
 *
 * Keyboard: one tab stop for the whole board (a roving `tabindex`). ← ↑ move
 * to the previous number, → ↓ to the next, Home / End to the first and the
 * last — always in slot order, as one line, whatever the layout (§3). Enter
 * and Space press the focused tile, as a tap does: that is the button's own
 * click. The board handles the arrows itself and marks them handled, so the
 * game screen's window-level keys never see them twice.
 *
 * The tile a merge put its answer in arrives with a short slide from the
 * slot it came from (§12) — the state has already changed, nothing waits for
 * it, and under Reduced Motion it is not drawn at all (make-the-target.css).
 */
import { useCallback, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Slots } from '../../game';

/** The last merge, for its arrival: the answer's slot, where the left term was, and a counter. */
export interface Arrival {
  readonly slot: number;
  readonly from: number;
  readonly key: number;
}

export interface MakeTheTargetBoardProps {
  slots: Slots;
  selectedTile: number | null;
  /** True while the tiles cannot be pressed (`missed`, `solved`, `revealed` — §3). */
  locked: boolean;
  arrival: Arrival | null;
  label: string;
  onTile: (slot: number) => void;
  boardRef?: (element: HTMLDivElement | null) => void;
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End']);

/** The numbered slots, in slot order. */
const numbered = (slots: Slots): number[] =>
  slots.flatMap((value, slot) => (value === null ? [] : [slot]));

/**
 * The slot that holds the tab stop: the one last focused or pressed while it
 * still holds a number, else the nearest number after it, else before it.
 */
function tabStop(slots: Slots, wanted: number): number | null {
  const list = numbered(slots);
  if (list.length === 0) return null;
  if (list.includes(wanted)) return wanted;
  return list.find((slot) => slot > wanted) ?? list[list.length - 1]!;
}

/** Shrinks the type as the digits grow, so six digits still fit a tile (§12). */
const digitsOf = (value: number): number => Math.min(7, String(value).length);

export function MakeTheTargetBoard({
  slots,
  selectedTile,
  locked,
  arrival,
  label,
  onTile,
  boardRef,
}: MakeTheTargetBoardProps) {
  const [focusSlot, setFocusSlot] = useState(0);
  const stop = tabStop(slots, focusSlot);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!NAV_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      const current = Number(target.dataset.slot);
      const list = numbered(slots);
      if (list.length === 0 || !Number.isInteger(current)) return;
      event.preventDefault();
      const at = list.indexOf(current);
      let next: number;
      switch (event.key) {
        case 'Home':
          next = list[0]!;
          break;
        case 'End':
          next = list[list.length - 1]!;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = list[Math.max(0, at - 1)]!;
          break;
        default:
          next = list[Math.min(list.length - 1, at + 1)]!;
      }
      setFocusSlot(next);
      event.currentTarget
        .querySelector<HTMLButtonElement>(`button[data-slot="${next}"]`)
        ?.focus({ preventScroll: true });
    },
    [slots],
  );

  return (
    <div
      ref={boardRef}
      className="tg-board"
      role="group"
      aria-label={label}
      style={{ '--tg-n': slots.length } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {slots.map((value, slot) => {
        if (value === null) return <span key={slot} className="tg-slot-empty" aria-hidden="true" />;
        const selected = selectedTile === slot;
        const arriving = arrival !== null && arrival.slot === slot;
        const className = [
          'tg-tile',
          selected ? 'tg-tile-selected' : '',
          arriving ? `tg-tile-arrive tg-tile-arrive-${arrival.key % 2}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={slot}
            type="button"
            className={className}
            data-slot={slot}
            data-digits={digitsOf(value)}
            style={arriving ? ({ '--tg-from': arrival.from - slot } as CSSProperties) : undefined}
            aria-pressed={selected}
            disabled={locked}
            tabIndex={slot === stop ? 0 : -1}
            onFocus={() => setFocusSlot(slot)}
            onClick={() => {
              setFocusSlot(slot);
              onTile(slot);
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
