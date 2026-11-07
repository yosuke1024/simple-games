import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSession, type Game2048Session } from '../game';
import { shareBoardOf } from './shareBoard';

const boardStyles = readFileSync(resolve('src/games/2048/ui/game-2048.css'), 'utf8');

describe('2048 share board', () => {
  it('keeps every final tile in its actual position, including values beyond 2048', () => {
    const board = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
    const session: Game2048Session = {
      ...createSession('private-seed'),
      board: Object.freeze(board),
      status: 'over',
    };
    const preview = shareBoardOf(session)!;

    expect(preview.gameId).toBe('2048');
    expect([preview.columns, preview.rows]).toEqual([4, 4]);
    expect(preview.cells.map((cell) => cell.text)).toEqual(board.map(String));
    // Keep the exported card's palette aligned with the real light board.
    for (const [index, cell] of preview.cells.entries()) {
      const shade = Math.min(board[index]!, 2048);
      expect(boardStyles).toContain(`--tm-t${shade}: ${cell.fill};`);
      expect(boardStyles).toContain(`--tm-t${shade}-ink: ${cell.ink};`);
    }
    expect(JSON.stringify(preview)).not.toContain(session.seed);
  });

  it('uses the visible board for the existing 2048 announcement and leaves empty cells empty', () => {
    const session: Game2048Session = {
      ...createSession('announcement'),
      board: [2048, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      reached2048: true,
    };
    const preview = shareBoardOf(session)!;

    expect(preview.cells.map((cell) => cell.text ?? '')).toEqual([
      '2048',
      '2',
      '',
      '',
      '4',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(preview.cells[2]?.piece).toBeUndefined();
  });

  it('does not offer an ordinary game in progress as a result board', () => {
    expect(shareBoardOf(createSession('still-playing'))).toBeNull();
  });
});
