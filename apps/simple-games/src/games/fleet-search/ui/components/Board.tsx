import { useRef } from 'react';
import { Vessel } from './Vessel';
import { useSettings } from '@/state/SettingsContext';
import { knowledge, type Session } from '../../game';
export const coordinate = (c: number) =>
  `${String.fromCharCode(65 + (c % 8))}${Math.floor(c / 8) + 1}`;
export function Board({
  session,
  own = false,
  mini = false,
  reveal = false,
  selected = null,
  preview = [],
  invalid = false,
  onSelect,
}: {
  session: Session;
  own?: boolean;
  mini?: boolean;
  reveal?: boolean;
  selected?: number | null;
  preview?: number[];
  invalid?: boolean;
  onSelect?: (cell: number) => void;
}) {
  const { t } = useSettings(),
    refs = useRef<(HTMLButtonElement | null)[]>([]),
    view = knowledge(session, own ? 1 : 0),
    shots = session.shots[own ? 1 : 0],
    fleet = session.fleets[own ? 0 : 1];
  const state = (cell: number) =>
    view.sunk.some((ship) => ship.includes(cell))
      ? 'Sunk'
      : shots.includes(cell)
        ? fleet.some((ship) => ship.includes(cell))
          ? 'Hit'
          : 'Miss'
        : view.blocked.includes(cell)
          ? 'Miss'
          : (own || reveal) && fleet.some((ship) => ship.includes(cell))
            ? 'Ship'
            : 'Unknown';
  const label = t(own ? 'fleetSearchOwn' : 'fleetSearchEnemy');
  return (
    <div
      className={`fs-chart ${mini ? 'fs-mini' : ''}`}
      role={mini ? 'img' : 'group'}
      aria-label={label}
    >
      {!mini ? (
        <>
          <div className="fs-axis fs-axis-top" aria-hidden="true">
            {'ABCDEFGH'.split('').map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="fs-axis fs-axis-left" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </>
      ) : null}
      <div className="fs-grid" aria-hidden={mini || undefined}>
        <svg className="fs-vessels" viewBox="0 0 80 80" aria-hidden="true">
          {(own || reveal ? fleet : view.sunk).map((ship, index) => {
            const cell = ship[0]!,
              vertical = ship[1]! - cell === 8;
            return (
              <g
                key={index}
                transform={`translate(${(cell % 8) * 10 + (vertical ? 10 : 0)} ${Math.floor(cell / 8) * 10}) rotate(${vertical ? 90 : 0})`}
              >
                <Vessel length={ship.length} />
              </g>
            );
          })}
        </svg>
        {Array.from({ length: 64 }, (_, cell) => {
          const kind = state(cell),
            ship = ((own || reveal) && fleet.some((s) => s.includes(cell))) || kind === 'Sunk',
            content = kind === 'Hit' || kind === 'Sunk' ? '×' : kind === 'Miss' ? '·' : '';
          const className = `fs-cell fs-${kind.toLowerCase()} ${ship ? 'fs-ship' : ''} ${selected === cell ? 'fs-selected' : ''} ${preview.includes(cell) ? `fs-preview ${invalid ? 'fs-invalid' : ''}` : ''}`;
          if (mini)
            return (
              <span key={cell} className={className}>
                {content}
              </span>
            );
          return (
            <button
              type="button"
              key={cell}
              ref={(el) => {
                refs.current[cell] = el;
              }}
              className={className}
              aria-label={`${coordinate(cell)} · ${t(`fleetSearch${kind}`)}`}
              aria-pressed={selected === cell}
              tabIndex={cell === (selected ?? 0) ? 0 : -1}
              onClick={() => onSelect?.(cell)}
              onKeyDown={(e) => {
                let next: number;
                const row = Math.floor(cell / 8),
                  col = cell % 8;
                if (e.key === 'ArrowRight') next = row * 8 + Math.min(7, col + 1);
                else if (e.key === 'ArrowLeft') next = row * 8 + Math.max(0, col - 1);
                else if (e.key === 'ArrowDown') next = Math.min(7, row + 1) * 8 + col;
                else if (e.key === 'ArrowUp') next = Math.max(0, row - 1) * 8 + col;
                else return;
                e.preventDefault();
                refs.current[next]?.focus();
              }}
            >
              <span className="fs-shot-mark">{content}</span>
              {selected === cell ? <span className="fs-crosshair" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
