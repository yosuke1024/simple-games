/**
 * Block Puzzle's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. The shell's en.ts
 * stays the source of truth for shared keys, this file for block-puzzle's.
 */
export const en = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Block board, 8 by 8',
  blockCellFilled: 'Row {row}, column {col}: filled',
  blockCellEmpty: 'Row {row}, column {col}: empty',
  blockTrayLabel: 'Pieces',
  blockPieceLabel: 'Piece {n}, {cells} squares',
  blockPieceUsed: 'Piece {n}, already placed',
  blockPieceSelected: 'Piece {n} selected',
  blockBestScore: 'Best score',
  blockLines: 'Lines cleared',
  blockOverTitle: 'No room left',
  blockOverBody: 'None of the pieces fit on the board.',
  blockNewBestScore: 'Your best score yet.',
  blockStep1Title: 'Drag a piece in',
  blockStep1Body: 'Move any of the three pieces onto the board. They never rotate.',
  blockStep2Title: 'Fill a row or column',
  blockStep2Body: 'A full line clears, and clearing several at once is worth more.',
  blockStep3Title: 'Play until nothing fits',
  blockStep3Body: 'Undo is free and unlimited, so a bad placement costs nothing.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BlockPuzzleMessages = Record<keyof typeof en, string>;
