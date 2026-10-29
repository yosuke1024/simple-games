import { useId } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { WIDTH, HEIGHT, cells, landingPiece, type Kind, type Session } from '../../game';

/**
 * One block, built the same way wherever it is drawn (docs/FALLING_BLOCKS_RULES.md §6):
 * a foot (the shadow it casts on the floor, a little below the body), the body,
 * and a light along its top edge. A settled block, the piece in hand and the
 * next piece differ only in the class on the body (and the settled one's mark),
 * so a piece that lands does not turn into a different object. `x` / `y` are the
 * cell's top-left corner in board units: 20 per cell, an 18 block and a 2 gap.
 */
function Block({
  x,
  y,
  body,
  fill,
  mark = false,
}: {
  x: number;
  y: number;
  body: string;
  fill?: string;
  mark?: boolean;
}) {
  return (
    <g>
      <rect className="fb-foot" x={x + 1} y={y + 2.2} width="18" height="18" rx="3" />
      <rect className={body} x={x + 1} y={y + 1} width="18" height="18" rx="3" fill={fill} />
      <path className="fb-block-edge" d={`M${x + 4} ${y + 4}h12`} />
      {mark ? <path className="fb-fixed-mark" d={`M${x + 7} ${y + 10}h6`} /> : null}
    </g>
  );
}

export function PiecePreview({ kind }: { kind: Kind }) {
  const shape = cells({ kind, x: 0, y: 0, rotation: 0 });
  const left = Math.min(...shape.map(([x]) => x));
  const top = Math.min(...shape.map(([, y]) => y));
  const width = (Math.max(...shape.map(([x]) => x)) - left + 1) * 20;
  const height = (Math.max(...shape.map(([, y]) => y)) - top + 1) * 20;
  return (
    <svg className="fb-preview" viewBox="0 0 100 80" role="img" aria-label={kind}>
      {shape.map(([x, y]) => (
        <Block
          key={`${x},${y}`}
          x={(100 - width) / 2 + (x - left) * 20}
          y={(80 - height) / 2 + (y - top) * 20}
          body="fb-preview-block"
        />
      ))}
    </svg>
  );
}

export function Board({ session }: { session: Session }) {
  const { t } = useSettings();
  const rimId = useId();
  const gridId = useId();
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
        {/* The well's top wall: a shade that fades out over the first row, so the floor reads as sunk. */}
        <linearGradient id={rimId} x2="0" y2="1">
          <stop className="fb-rim-top" />
          <stop className="fb-rim-bottom" offset="1" />
        </linearGradient>
        {/* One 20-unit tile for the whole floor: the empty cells, in the same places as before. */}
        <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect className="fb-grid-cell" x="1" y="1" width="18" height="18" rx="2" />
        </pattern>
        {/* The piece in hand fades only to .88: a settled block is a flat .7 of the accent, so a
            lower end would leave the two nearly the same colour in their lower halves (§6). */}
        <linearGradient id={blockId} x2="0" y2="1">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".88" />
        </linearGradient>
      </defs>
      <rect className="fb-board-bg" width={WIDTH * 20} height={HEIGHT * 20} rx="5" />
      <rect width={WIDTH * 20} height={HEIGHT * 20} rx="5" fill={`url(#${gridId})`} />
      <rect width={WIDTH * 20} height="16" rx="5" fill={`url(#${rimId})`} />
      {session.board.map((value, i) =>
        value ? (
          <Block key={i} x={(i % WIDTH) * 20} y={Math.floor(i / WIDTH) * 20} body="fb-fixed" mark />
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
        <Block key={`${x},${y}`} x={x * 20} y={y * 20} body="fb-active" fill={`url(#${blockId})`} />
      ))}
    </svg>
  );
}
