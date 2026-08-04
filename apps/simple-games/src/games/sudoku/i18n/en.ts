/**
 * Sudoku's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for sudoku's.
 */
export const en = {
  sudokuName: 'Sudoku',
  sudokuGridLabel: 'Sudoku grid',
  sudokuPadLabel: 'Number pad',
  sudokuPadKey: '{value}, {n} left',
  sudokuPadNoteKey: 'Note {value}',
  sudokuCellEmpty: 'Empty, row {row}, column {col}',
  sudokuCellGiven: '{value}, given, row {row}, column {col}',
  sudokuCellEntry: '{value}, row {row}, column {col}',
  sudokuErase: 'Erase',
  sudokuNotes: 'Notes',
  sudokuMistakes: 'Mistakes',
  sudokuTier_easy: 'Easy',
  sudokuTier_medium: 'Medium',
  sudokuTier_hard: 'Hard',
  sudokuSolvedTitle: 'Solved!',
  sudokuSolvedBody: 'Every row, column and box holds 1-9.',
  sudokuNewBestTime: 'Your fastest yet.',
  sudokuLevelsSolved: 'Levels solved',
  sudokuDailiesSolved: 'Dailies solved',
  sudokuAverageTime: 'Average clear',
  sudokuHighlightMistakes: 'Show mistakes',
  sudokuHighlightMistakesNote:
    'Marks a digit that does not match the solution. Duplicates are always marked.',
  sudokuHintNone: 'Nothing can be worked out yet.',
  sudokuHintOnlyDigit: 'Only one digit fits this cell.',
  sudokuHintOnlyCell: 'This is the only place {value} can go here.',
  sudokuHintLockedLine: 'In this box, {value} only fits on the highlighted line.',
  sudokuHintLockedBox: 'On this line, {value} only fits inside the highlighted box.',
  sudokuHintRuledOut: 'These cells rule the digits out elsewhere in the unit.',
  sudokuStep1Title: '1-9, once each',
  sudokuStep1Body: 'Every row, column and 3x3 box holds 1 to 9 exactly once.',
  sudokuStep2Title: 'Note what might fit',
  sudokuStep2Body: 'Tap Notes to pencil in candidates while you narrow a cell down.',
  sudokuStep3Title: 'Stuck? Take a hint',
  sudokuStep3Body: 'A hint shows which cell is decided and why. Hints and undo are always free.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SudokuMessages = Record<keyof typeof en, string>;
