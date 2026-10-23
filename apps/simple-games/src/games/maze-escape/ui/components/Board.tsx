import { useRef } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { destinations, type Direction, type Session } from '../../game';
export function MazeDrawing({ session, hint = null }: { session: Session; hint?: number | null }) {
  const { size, board, position } = session;
  const lines: string[] = [];
  for (let i = 0; i < board.length; i++) {
    const x = i % size,
      y = Math.floor(i / size),
      cell = board[i]!;
    if (!(cell & 1)) lines.push(`M${x} ${y}h1`);
    if (!(cell & 8)) lines.push(`M${x} ${y}v1`);
    if (x === size - 1 && !(cell & 2)) lines.push(`M${x + 1} ${y}v1`);
    if (y === size - 1 && !(cell & 4)) lines.push(`M${x} ${y + 1}h1`);
  }
  return (
    <svg className="me-maze" viewBox={`-.15 -.15 ${size + 0.3} ${size + 0.3}`} aria-hidden="true">
      <rect x="0" y="0" width={size} height={size} className="me-floor" />
      {[...new Set([0, ...session.history])].map((cell) => (
        <circle
          key={cell}
          cx={(cell % size) + 0.5}
          cy={Math.floor(cell / size) + 0.5}
          r=".065"
          className="me-trail"
        />
      ))}
      <circle cx=".5" cy=".5" r=".3" className="me-start" />
      <path d={`M${size - 0.72} ${size - 0.2}v-.6h.46l-.13 .17.13 .17h-.46`} className="me-goal" />
      <path d={lines.join('')} className="me-walls" />
      {hint !== null ? (
        <rect
          x={(hint % size) + 0.24}
          y={Math.floor(hint / size) + 0.24}
          width=".52"
          height=".52"
          rx=".08"
          className="me-hint"
        />
      ) : null}
      <circle
        cx={(position % size) + 0.5}
        cy={Math.floor(position / size) + 0.5}
        r=".23"
        className="me-player"
      />
      <circle
        cx={(position % size) + 0.5}
        cy={Math.floor(position / size) + 0.5}
        r=".075"
        className="me-player-center"
      />
    </svg>
  );
}
export function Board({
  session,
  hint,
  onPlay,
  onDirection,
}: {
  session: Session;
  hint: number | null;
  onPlay: (target: number) => void;
  onDirection: (direction: Direction) => void;
}) {
  const { t } = useSettings();
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const available = destinations(session.board, session.size, session.position);
  return (
    <div
      className="me-board"
      role="group"
      aria-label={t('mazeEscapeBoard')}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
      }}
      onPointerUp={(event) => {
        const start = pointerRef.current;
        pointerRef.current = null;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x,
          dy = event.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) {
          onDirection(
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
          );
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.floor(
          ((event.clientX - rect.left) / rect.width) * (session.size + 0.3) - 0.15,
        );
        const y = Math.floor(
          ((event.clientY - rect.top) / rect.height) * (session.size + 0.3) - 0.15,
        );
        if (
          x >= 0 &&
          x < session.size &&
          y >= 0 &&
          y < session.size &&
          available.includes(y * session.size + x)
        )
          onPlay(y * session.size + x);
      }}
    >
      <MazeDrawing session={session} hint={hint} />
    </div>
  );
}
