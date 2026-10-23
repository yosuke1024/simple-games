import { useSettings } from '@/state/SettingsContext';
import { WIDTH, HEIGHT, cells, landingPiece, type Kind, type Session } from '../../game';
export function PiecePreview({ kind }: { kind: Kind }) {
  return (
    <svg className="fb-preview" viewBox="0 0 100 80" role="img" aria-label={kind}>
      {cells({ kind, x: 0, y: 0, rotation: 0 }).map(([x, y]) => (
        <rect
          key={`${x},${y}`}
          x={10 + x * 20}
          y={10 + y * 20}
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
      <rect className="fb-board-bg" width={WIDTH * 20} height={HEIGHT * 20} rx="5" />
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
        <rect
          className="fb-active"
          key={`${x},${y}`}
          x={x * 20 + 1}
          y={y * 20 + 1}
          width="18"
          height="18"
          rx="3"
        />
      ))}
    </svg>
  );
}
