/**
 * The board's paint (docs/BLOCK_PUZZLE_RULES.md §12): a filled cell wears its
 * tone, a cleared cell fades in the tone it had, and the piece in hand wears
 * none — it is the accent, drawn by its own classes. The tone is a class that
 * only sets a variable, so these tests pin which cells carry one; what the
 * colours are is ui/contrast.test.ts's business.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { emptyBoard, emptyTones, indexAt, LEGACY_TONE, type Board, type Tones } from '../../game';
import { BlockBoard } from './BlockBoard';

const NONE: readonly number[] = [];
const noop = () => undefined;

function renderBoard(
  board: Board,
  tones: Tones,
  marks: { hand?: readonly number[]; clearing?: readonly number[] } = {},
): HTMLElement[] {
  const { container } = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BlockBoard
        board={board}
        tones={tones}
        hand={marks.hand ?? NONE}
        handFits
        willClear={NONE}
        clearing={marks.clearing ?? NONE}
        clearFrom={marks.clearing ? { row: 0, col: 0 } : null}
        onCellTap={noop}
        onCellHover={noop}
        onLeave={noop}
        boardRef={noop}
      />
    </SettingsProvider>,
  );
  return Array.from(container.querySelectorAll<HTMLElement>('.bp-cell'));
}

const toneClasses = (cell: HTMLElement) =>
  Array.from(cell.classList).filter((name) => name.startsWith('bp-tone-'));

afterEach(cleanup);

describe('BlockBoard paint (§12)', () => {
  it('gives each filled cell its own tone, and an empty one none', () => {
    const board = [...emptyBoard()];
    const tones = [...emptyTones()];
    board[indexAt(0, 0)] = true;
    tones[indexAt(0, 0)] = 3;
    board[indexAt(0, 1)] = true;
    tones[indexAt(0, 1)] = 5;
    // Old paint under an empty cell is not shown.
    tones[indexAt(0, 2)] = 4;

    const cells = renderBoard(board, tones);
    expect(cells).toHaveLength(64);
    expect(toneClasses(cells[indexAt(0, 0)]!)).toEqual(['bp-tone-3']);
    expect(toneClasses(cells[indexAt(0, 1)]!)).toEqual(['bp-tone-5']);
    expect(toneClasses(cells[indexAt(0, 2)]!)).toEqual([]);
    expect(cells.filter((cell) => toneClasses(cell).length > 0)).toHaveLength(2);
  });

  it('draws a filled cell with no paint in the accent', () => {
    const board = [...emptyBoard()];
    board[5] = true;
    const cells = renderBoard(board, emptyTones());
    expect(toneClasses(cells[5]!)).toEqual([`bp-tone-${LEGACY_TONE}`]);
  });

  it('fades a cleared cell in the tone it had', () => {
    const tones = [...emptyTones()];
    tones[indexAt(0, 3)] = 2;
    const cells = renderBoard(emptyBoard(), tones, { clearing: [indexAt(0, 3)] });
    const leaving = cells[indexAt(0, 3)]!;
    expect(leaving).toHaveClass('bp-cell-clearing');
    expect(leaving).not.toHaveClass('bp-cell-filled');
    expect(toneClasses(leaving)).toEqual(['bp-tone-2']);
  });

  it('paints the piece in hand with no tone over an empty cell', () => {
    const tones = [...emptyTones()];
    tones[indexAt(1, 1)] = 3;
    const cells = renderBoard(emptyBoard(), tones, { hand: [indexAt(1, 1)] });
    expect(cells[indexAt(1, 1)]).toHaveClass('bp-cell-ghost');
    expect(toneClasses(cells[indexAt(1, 1)]!)).toEqual([]);
  });
});
