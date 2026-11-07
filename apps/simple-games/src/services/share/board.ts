/**
 * A picture of visible board cells, supplied by the game that owns them.
 * No session, seed, hidden answer, DOM capture, storage or game-engine import
 * crosses this boundary. The result share draws these facts only on a click.
 */
import { seriesColors } from '@simple-games/brand';
import type { GameId } from '../../app/registry';

export interface ShareBoardCell {
  text?: string;
  /** Cell background; `ink` colours its text or piece. */
  fill?: string;
  ink?: string;
  piece?: 'dark' | 'light' | 'accent' | 'flag' | 'mine' | 'cross' | 'crown';
  marked?: boolean;
  shape?: 'circle';
  /** Region identity, used only to preserve visible boundary lines. */
  region?: number;
}

export interface ShareBoardPreview {
  gameId: GameId;
  columns: number;
  rows: number;
  cells: readonly ShareBoardCell[];
  layout?: 'cells' | 'intersections';
  background?: string;
  gridColor?: string;
}

/** A wrong game's image or malformed dimensions must never enter a share. */
export function isShareBoardPreview(
  board: ShareBoardPreview | null | undefined,
  gameId: GameId,
): board is ShareBoardPreview {
  return Boolean(
    board &&
    board.gameId === gameId &&
    Number.isInteger(board.columns) &&
    Number.isInteger(board.rows) &&
    board.columns >= 1 &&
    board.columns <= 32 &&
    board.rows >= 1 &&
    board.rows <= 32 &&
    board.cells.length === board.columns * board.rows,
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Synchronous Canvas 2D: safe inside the browser's share-button gesture. */
export function drawShareBoard(
  ctx: CanvasRenderingContext2D,
  board: ShareBoardPreview,
  box: { x: number; y: number; width: number; height: number },
  accent: string,
): void {
  const step = Math.min((box.width - 24) / board.columns, (box.height - 24) / board.rows);
  const width = step * board.columns;
  const height = step * board.rows;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  const intersections = board.layout === 'intersections';
  const gap = intersections ? 0 : Math.min(4, step * 0.07);

  ctx.save();
  ctx.fillStyle = board.background ?? seriesColors.paper;
  roundedRect(ctx, x - 8, y - 8, width + 16, height + 16, 12);
  ctx.fill();
  if (!intersections && board.gridColor) {
    ctx.fillStyle = board.gridColor;
    ctx.fillRect(x, y, width, height);
  }
  ctx.strokeStyle = board.gridColor ?? seriesColors.line;
  ctx.lineWidth = Math.max(1, step * 0.018);
  if (intersections) {
    ctx.beginPath();
    for (let col = 0; col < board.columns; col++) {
      const cx = x + (col + 0.5) * step;
      ctx.moveTo(cx, y + step / 2);
      ctx.lineTo(cx, y + height - step / 2);
    }
    for (let row = 0; row < board.rows; row++) {
      const cy = y + (row + 0.5) * step;
      ctx.moveTo(x + step / 2, cy);
      ctx.lineTo(x + width - step / 2, cy);
    }
    ctx.stroke();
  }

  board.cells.forEach((cell, index) => {
    const left = x + (index % board.columns) * step;
    const top = y + Math.floor(index / board.columns) * step;
    const cx = left + step / 2;
    const cy = top + step / 2;
    const size = step - gap;
    if (!intersections) {
      ctx.fillStyle = cell.fill ?? seriesColors.surface;
      if (cell.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
      } else {
        roundedRect(ctx, left + gap / 2, top + gap / 2, size, size, size * 0.1);
      }
      ctx.fill();
    }

    const piece = cell.piece;
    const ink =
      cell.ink ??
      (piece === 'light' ? seriesColors.surface : piece === 'dark' ? seriesColors.ink : accent);
    ctx.fillStyle = ink;
    ctx.strokeStyle = piece === 'light' ? seriesColors.inkSoft : ink;
    ctx.lineWidth = Math.max(1, step * 0.025);
    if (piece === 'dark' || piece === 'light' || piece === 'accent') {
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (piece === 'flag') {
      ctx.beginPath();
      ctx.moveTo(cx - step * 0.12, cy + step * 0.26);
      ctx.lineTo(cx - step * 0.12, cy - step * 0.27);
      ctx.lineTo(cx + step * 0.24, cy - step * 0.12);
      ctx.lineTo(cx - step * 0.12, cy + step * 0.02);
      ctx.fill();
      ctx.stroke();
    } else if (piece === 'mine') {
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      for (let ray = 0; ray < 8; ray++) {
        const angle = (ray * Math.PI) / 4;
        ctx.moveTo(cx + Math.cos(angle) * step * 0.14, cy + Math.sin(angle) * step * 0.14);
        ctx.lineTo(cx + Math.cos(angle) * step * 0.3, cy + Math.sin(angle) * step * 0.3);
      }
      ctx.stroke();
    } else if (piece === 'cross') {
      ctx.beginPath();
      ctx.moveTo(cx - step * 0.15, cy - step * 0.15);
      ctx.lineTo(cx + step * 0.15, cy + step * 0.15);
      ctx.moveTo(cx + step * 0.15, cy - step * 0.15);
      ctx.lineTo(cx - step * 0.15, cy + step * 0.15);
      ctx.stroke();
    } else if (piece === 'crown') {
      ctx.beginPath();
      ctx.moveTo(cx - step * 0.29, cy - step * 0.2);
      ctx.lineTo(cx - step * 0.15, cy - step * 0.02);
      ctx.lineTo(cx, cy - step * 0.3);
      ctx.lineTo(cx + step * 0.15, cy - step * 0.02);
      ctx.lineTo(cx + step * 0.29, cy - step * 0.2);
      ctx.lineTo(cx + step * 0.22, cy + step * 0.19);
      ctx.lineTo(cx - step * 0.22, cy + step * 0.19);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - step * 0.22, cy + step * 0.24, step * 0.44, step * 0.045);
    }

    if (cell.text) {
      let px = Math.floor(step * 0.46);
      ctx.fillStyle = cell.ink ?? seriesColors.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${px}px Nunito, ui-rounded, system-ui, sans-serif`;
      while (px > 8 && ctx.measureText(cell.text).width > step * 0.83) {
        ctx.font = `800 ${--px}px Nunito, ui-rounded, system-ui, sans-serif`;
      }
      ctx.fillText(cell.text, cx, cy + step * 0.035, step * 0.83);
    }
    if (cell.marked) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, step * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.43, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!intersections && cell.region !== undefined) {
      const col = index % board.columns;
      const row = Math.floor(index / board.columns);
      ctx.strokeStyle = seriesColors.inkSoft;
      ctx.lineWidth = Math.max(2, step * 0.045);
      ctx.beginPath();
      if (col === 0 || board.cells[index - 1]?.region !== cell.region) {
        ctx.moveTo(left, top);
        ctx.lineTo(left, top + step);
      }
      if (row === 0 || board.cells[index - board.columns]?.region !== cell.region) {
        ctx.moveTo(left, top);
        ctx.lineTo(left + step, top);
      }
      if (col === board.columns - 1) {
        ctx.moveTo(left + step, top);
        ctx.lineTo(left + step, top + step);
      }
      if (row === board.rows - 1) {
        ctx.moveTo(left, top + step);
        ctx.lineTo(left + step, top + step);
      }
      ctx.stroke();
    }
  });
  ctx.restore();
}
