import { useId } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { WIDTH, HEIGHT, cells, landingPiece, type Kind, type Session } from '../../game';
export function PiecePreview({ kind }: { kind: Kind }) {
  const shape = cells({ kind, x: 0, y: 0, rotation: 0 });
  const left = Math.min(...shape.map(([x]) => x));
  const top = Math.min(...shape.map(([, y]) => y));
  const width = (Math.max(...shape.map(([x]) => x)) - left + 1) * 20;
  const height = (Math.max(...shape.map(([, y]) => y)) - top + 1) * 20;
  return (
    <svg className="fb-preview" viewBox="0 0 100 80" role="img" aria-label={kind}>
      {shape.map(([x, y]) => (
        <rect
          key={`${x},${y}`}
          x={(100 - width) / 2 + (x - left) * 20 + 1}
          y={(80 - height) / 2 + (y - top) * 20 + 1}
          width="18"
          height="18"
          rx="3"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
export function Board({ session }: { session: Session }) {
  const { t } = useSettings();
  const wellId = useId();
  const blockId = useId();
  const active = session.status === 'over' ? [] : cells(session.active);
  const ghost = session.status === 'over' ? [] : cells(landingPiece(session));
  return (
    <svg
      className="fb-board"
      viewBox={`0 0 ${WIDTH * 20} ${HEIGHT * 20}`}
      role="img"
      aria-label={t('fallingBlocksBoard', {
        piece: session.active.kind,
        column: Math.min(...cells(session.active).map(([x]) => x)) + 1,
        row: Math.min(...cells(session.active).map(([, y]) => y)) + 1,
      })}
    >
      <defs>
        <linearGradient id={wellId} x2="0" y2="1">
          <stop stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--paper)" />
        </linearGradient>
        <linearGradient id={blockId} x2="0" y2="1">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".78" />
        </linearGradient>
      </defs>
      <rect
        className="fb-board-bg"
        width={WIDTH * 20}
        height={HEIGHT * 20}
        rx="5"
        fill={`url(#${wellId})`}
      />
      {Array.from({ length: WIDTH * HEIGHT }, (_, i) => (
        <rect
          className="fb-grid-cell"
          key={i}
          x={(i % WIDTH) * 20 + 1}
          y={Math.floor(i / WIDTH) * 20 + 1}
          width="18"
          height="18"
          rx="2"
        />
      ))}
      {session.board.map((value, i) =>
        value ? (
          <g key={i}>
            <rect
              className="fb-fixed"
              x={(i % WIDTH) * 20 + 1}
              y={Math.floor(i / WIDTH) * 20 + 1}
              width="18"
              height="18"
              rx="3"
            />
            <path
              className="fb-fixed-mark"
              d={`M${(i % WIDTH) * 20 + 7} ${Math.floor(i / WIDTH) * 20 + 10}h6`}
            />
          </g>
        ) : null,
      )}
      {ghost.map(([x, y]) => (
        <rect
          className="fb-ghost"
          key={`${x},${y}`}
          x={x * 20 + 2}
          y={y * 20 + 2}
          width="16"
          height="16"
          rx="3"
        />
      ))}
      {active.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <rect
            className="fb-active"
            x={x * 20 + 1}
            y={y * 20 + 1}
            width="18"
            height="18"
            rx="3"
            fill={`url(#${blockId})`}
          />
          <path className="fb-block-edge" d={`M${x * 20 + 4} ${y * 20 + 4}h12`} />
        </g>
      ))}
    </svg>
  );
}
