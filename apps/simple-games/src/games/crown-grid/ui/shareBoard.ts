/**
 * The visible, completed board for an optional share. Read the player's marks,
 * never the hidden solution. Today's common puzzle stays an illustration so
 * sharing a time does not also reveal its answer to somebody still playing.
 */
import { seriesColors } from '@simple-games/brand';
import type { ShareBoardPreview } from '@/services/share/board';
import { CROSS, CROWN, type CrownGridSession } from '../game';

/** Matches the fixed light palette in crown-grid.css (pinned by the test). */
export const CROWN_GRID_LIGHT_REGIONS = [
  '#f3d6cf',
  '#f7e3c3',
  '#f1efb6',
  '#d3ebc7',
  '#c8e8e2',
  '#cfdff6',
  '#ddd5f3',
  '#f0d2e5',
  '#e2ded2',
] as const;

export function shareBoardOf(session: CrownGridSession): ShareBoardPreview | null {
  if (session.status !== 'solved' || session.mode !== 'difficulty') return null;
  return {
    gameId: 'crown-grid',
    columns: session.size,
    rows: session.size,
    background: seriesColors.ink,
    gridColor: seriesColors.line,
    cells: session.marks.map((mark, index) => ({
      fill: CROWN_GRID_LIGHT_REGIONS[session.regions[index]!] ?? seriesColors.surface,
      ink: seriesColors.ink,
      region: session.regions[index],
      ...(mark === CROWN ? { piece: 'crown' as const } : {}),
      ...(mark === CROSS ? { piece: 'cross' as const } : {}),
    })),
  };
}
