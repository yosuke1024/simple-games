import { useRef } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { applyAction, encodeMove, topDisk, type Session } from '../../game';
export function Tower({
  board,
  peg,
  selected = false,
}: {
  board: readonly number[];
  peg: number;
  selected?: boolean;
}) {
  const disks = board.flatMap((location, disk) => (location === peg ? [disk] : [])).reverse();
  return (
    <svg viewBox="0 0 100 190" aria-hidden="true" className="ht-tower">
      <ellipse cx="50" cy="176" rx="43" ry="5" className="ht-base-shadow" />
      <rect x="7" y="168" width="86" height="8" rx="4" className="ht-base" />
      <path d="M12 169h76" className="ht-wood-light" />
      <path d="M50 40v126" className="ht-wood" />
      <path d="M48.5 42v123" className="ht-wood-light" />
      {disks.map((disk, level) => {
        const width = 34 + disk * 12;
        const y = 148 - level * 22 - (selected && disk === disks.at(-1) ? 12 : 0);
        return (
          <g key={disk} className={selected && disk === disks.at(-1) ? 'ht-lifted-disk' : ''}>
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
            <Tower board={session.board} peg={peg} selected={selected === peg} />
            <span className="ht-destination" aria-hidden="true">
              {valid ? '↓' : selected === peg ? '↑' : '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
