/** A final public position, not an analysis, move history or saved session. */
import type { ShareBoardPreview } from '@/services/share/board';
import type { GomokuSession } from '../game/session';
import { SIZE, BLACK, WHITE } from '../game/types';

/** Fixed light board colours, matching gomoku.css. */
const WOOD = '#d9b884';
const LINE = '#9c7d51';

export function shareBoardOf(session: GomokuSession): ShareBoardPreview | null {
  if (session.status === 'playing' || session.board.length !== SIZE * SIZE) return null;
  const winning = new Set(session.winningLine ?? []);
  return {
    gameId: 'gomoku',
    columns: SIZE,
    rows: SIZE,
    layout: 'intersections',
    background: WOOD,
    gridColor: LINE,
    cells: session.board.map((piece, index) =>
      piece === BLACK || piece === WHITE
        ? { piece: piece === BLACK ? 'dark' : 'light', marked: winning.has(index) }
        : {},
    ),
  };
}
