import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seriesColors } from '@simple-games/brand';
import { createDifficultySession, CROSS, CROWN, type CrownGridSession } from '../game';
import { CROWN_GRID_LIGHT_REGIONS, shareBoardOf } from './shareBoard';

function solvedSession(): CrownGridSession {
  const session = createDifficultySession('easy', 'crown-grid-share-preview');
  const crowns = new Set(session.solution.map((column, row) => row * session.size + column));
  return {
    ...session,
    status: 'solved',
    marks: session.marks.map((_, index) => (crowns.has(index) ? CROWN : CROSS)),
  };
}

describe('Crown Grid share board', () => {
  it('repeats the visible marks and regions of the completed difficulty board', () => {
    const session = solvedSession();
    const preview = shareBoardOf(session);
    expect(preview?.gameId).toBe('crown-grid');
    expect(preview?.columns).toBe(session.size);
    expect(preview?.rows).toBe(session.size);
    expect(preview?.cells).toHaveLength(session.size * session.size);
    session.marks.forEach((mark, index) => {
      expect(preview?.cells[index]?.piece).toBe(mark === CROWN ? 'crown' : 'cross');
      expect(preview?.cells[index]?.fill).toBe(CROWN_GRID_LIGHT_REGIONS[session.regions[index]!]);
      expect(preview?.cells[index]?.ink).toBe(seriesColors.ink);
      // Boundaries remain readable without relying on colour alone.
      expect(preview?.cells[index]).toHaveProperty('region', session.regions[index]);
    });
    expect(session.marks.every((mark) => mark === CROWN || mark === CROSS)).toBe(true);
  });

  it('never reads the hidden solution or sends seed, counters or a daily date', () => {
    const session = solvedSession();
    const visible = shareBoardOf(session);
    Object.defineProperty(session, 'solution', {
      get() {
        throw new Error('A share must not read the hidden answer');
      },
    });
    expect(shareBoardOf(session)).toEqual(visible);
    expect(visible).not.toHaveProperty('solution');
    expect(visible).not.toHaveProperty('seed');
    expect(visible).not.toHaveProperty('elapsedSeconds');
    expect(visible).not.toHaveProperty('dailyDate');
  });

  it('leaves daily answers and unfinished games out of the image', () => {
    const session = solvedSession();
    expect(shareBoardOf({ ...session, mode: 'daily', dailyDate: '2026-11-07' })).toBeNull();
    expect(shareBoardOf({ ...session, status: 'playing' })).toBeNull();
  });

  it('leaves empty player cells empty instead of filling the answer for them', () => {
    const session = solvedSession();
    const empty = session.marks.findIndex((mark) => mark === CROSS);
    const marks = [...session.marks];
    marks[empty] = 0;
    const preview = shareBoardOf({ ...session, marks });
    expect(preview?.cells[empty]?.piece).toBeUndefined();
  });

  it('keeps the preview light tints identical to the board stylesheet', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/games/crown-grid/ui/crown-grid.css'),
      'utf8',
    );
    const block = /\.cg-board\s*\{([^}]+)\}/.exec(css)?.[1] ?? '';
    CROWN_GRID_LIGHT_REGIONS.forEach((colour, index) => {
      expect(block).toContain(`--cg-r${index}: ${colour};`);
    });
  });
});
