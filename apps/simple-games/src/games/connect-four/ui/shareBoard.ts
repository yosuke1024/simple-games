/** Only the visible final position travels with a result share (§1, §3, §10). */
import { seriesColors } from '@simple-games/brand';
import { titleAccentOf } from '@/app/titleAccent';
import type { ShareBoardPreview } from '@/services/share/board';
import type { ConnectFourSession } from '../game/session';
import { COLS, ROWS, PLAYER, CPU } from '../game/types';

/** Fixed light game-content colours, matching connect-four.css. */
const FRAME = '#3d5a80';
const CPU_DISC = '#1f6f6b';

export function shareBoardOf(session: ConnectFourSession): ShareBoardPreview | null {
  if (session.status === 'playing' || session.board.length !== COLS * ROWS) return null;
  const winning = new Set(session.winningLine ?? []);
  return {
    gameId: 'connect-four',
    columns: COLS,
    rows: ROWS,
    background: FRAME,
    cells: session.board.map((piece, index) => ({
      fill: seriesColors.paper,
      shape: 'circle',
      ...(piece === PLAYER || piece === CPU
        ? {
            piece: 'accent' as const,
            ink: piece === PLAYER ? titleAccentOf('connect-four').light : CPU_DISC,
            marked: winning.has(index),
          }
        : {}),
    })),
  };
}
