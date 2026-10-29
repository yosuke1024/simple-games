import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { applyAction, encodeMove, topDisk, type Session } from '../../game';
const sameBoard = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((location, disk) => location === b[disk]);
/**
 * The disk a move or an Undo just carried to a new peg, so that disk alone
 * settles onto it (docs/HANOI_TOWERS_RULES.md "Visual presentation"). A restart
 * or a new board moves many disks at once and settles none.
 */
function carriedDisk(before: readonly number[], after: readonly number[]): number | null {
  if (before.length !== after.length) return null;
  const moved = after.flatMap((location, disk) => (before[disk] === location ? [] : [disk]));
  return moved.length === 1 ? moved[0]! : null;
}
export function Tower({
  board,
  peg,
  selected = false,
  arrived = null,
}: {
  board: readonly number[];
  peg: number;
  selected?: boolean;
  arrived?: number | null;
}) {
  const disks = board.flatMap((location, disk) => (location === peg ? [disk] : [])).reverse();
  const topmost = disks[disks.length - 1];
  return (
    <svg viewBox="0 0 100 190" aria-hidden="true" className="ht-tower">
      <ellipse cx="50" cy="176" rx="43" ry="5" className="ht-base-shadow" />
      <rect x="7" y="168" width="86" height="8" rx="4" className="ht-base" />
      <path d="M12 169h76" className="ht-wood-light" />
      <path d="M12 174h76" className="ht-base-shade" />
      <path d="M50 40v126" className="ht-wood" />
      <path d="M48.5 42v123" className="ht-wood-light" />
      <path d="M51.7 42v123" className="ht-wood-shade" />
      {disks.map((disk, level) => {
        const width = 34 + disk * 12;
        const y = 148 - level * 22;
        // The lift is a CSS translate of the whole group, not a different y, so
        // it can ease in and out and take the disk's shadow with it.
        const lifted = selected && disk === topmost;
        return (
          <g
            key={disk}
            className={
              lifted
                ? 'ht-lifted-disk'
                : arrived === disk
                  ? 'ht-disk-group ht-arrived'
                  : 'ht-disk-group'
            }
          >
            <rect
              x={(100 - width) / 2}
              y={y + 3}
              width={width}
              height="19"
              rx="5"
              className="ht-disk-shadow"
            />
            <rect
              x={(100 - width) / 2}
              y={y}
              width={width}
              height="19"
              rx="5"
              className={`ht-disk ht-disk-${disk}`}
            />
            <path
              d={`M${(100 - width) / 2 + 5} ${y + 3}h${width - 10}`}
              className="ht-disk-light"
            />
            <path
              d={`M${(100 - width) / 2 + 5} ${y + 16}h${width - 10}`}
              className="ht-disk-shade"
            />
            <text x="50" y={y + 13}>
              {disk + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export function Board({
  session,
  selected,
  onPeg,
}: {
  session: Session;
  selected: number | null;
  onPeg: (peg: number) => void;
}) {
  const { t } = useSettings();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Which disk just arrived, derived while rendering from the previous board
  // (React's "adjust state when a prop changes" form: no effect, no timer, and
  // nothing to release on unmount). A change of selection ends it, so cancelling
  // a lift is not mistaken for an arrival. Boards are compared by value: the
  // session may hand over a fresh array on every render.
  const [seen, setSeen] = useState({ board: session.board, selected });
  const [arrived, setArrived] = useState<number | null>(null);
  if (!sameBoard(seen.board, session.board)) {
    setSeen({ board: session.board, selected });
    setArrived(carriedDisk(seen.board, session.board));
  } else if (seen.selected !== selected) {
    setSeen({ board: seen.board, selected });
    setArrived(null);
  }
  return (
    <div className="ht-board" role="group" aria-label={t('hanoiTowersBoard')}>
      {[0, 1, 2].map((peg) => {
        const top = topDisk(session.board, peg);
        const valid =
          selected !== null && applyAction(session.board, encodeMove(selected, peg)) !== null;
        return (
          <button
            key={peg}
            ref={(node) => {
              refs.current[peg] = node;
            }}
            type="button"
            className={`ht-peg ${selected === peg ? 'ht-selected' : ''} ${valid ? 'ht-valid' : ''}`}
            aria-pressed={selected === peg}
            aria-label={
              top < 0
                ? t('hanoiTowersEmpty', { peg: peg + 1 })
                : t('hanoiTowersPeg', { peg: peg + 1, disk: top + 1 })
            }
            onClick={() => onPeg(peg)}
            onKeyDown={(event) => {
              if (event.repeat && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                return;
              }
              if (event.altKey || event.ctrlKey || event.metaKey) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                refs.current[(peg + (event.key === 'ArrowRight' ? 1 : 2)) % 3]?.focus();
              }
            }}
          >
            <span className="ht-peg-number" aria-hidden="true">
              {peg + 1}
              {peg === 2 ? (
                <svg viewBox="0 0 16 16" className="ht-goal-mark">
                  <path d="M4 14V2h8l-2 3 2 3H4" />
                </svg>
              ) : null}
            </span>
            <Tower board={session.board} peg={peg} selected={selected === peg} arrived={arrived} />
            <span className="ht-destination" aria-hidden="true">
              {valid ? '↓' : selected === peg ? '↑' : '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
