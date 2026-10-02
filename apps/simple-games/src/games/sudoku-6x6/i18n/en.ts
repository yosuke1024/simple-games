/**
 * Sudoku 6×6's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's en.ts stays the source of truth for shared keys, this file for
 * this game's.
 *
 * The board itself carries no words: its digits are ASCII 1–6 in every locale
 * (docs/SUDOKU_6X6_RULES.md §1). Hints are plain sentences and never name a
 * technique (§5). The difficulty names are referenced statically
 * (ui/difficultyKey.ts), never assembled at runtime.
 */
export const en = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Choose a board',
  sudoku6x6Difficulty_easy: 'Easy',
  sudoku6x6Difficulty_medium: 'Medium',
  sudoku6x6Difficulty_hard: 'Hard',
  sudoku6x6ConfirmSwitchTitle: 'Replace the board in progress?',
  sudoku6x6ConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  sudoku6x6GridLabel: 'Sudoku 6×6 grid',
  sudoku6x6PadLabel: 'Number pad',
  sudoku6x6PadKey: '{value}, {n} left',
  sudoku6x6PadNoteKey: 'Note {value}',
  sudoku6x6CellEmpty: 'Empty, row {row}, column {col}',
  sudoku6x6CellGiven: '{value}, given, row {row}, column {col}',
  sudoku6x6CellEntry: '{value}, row {row}, column {col}',
  sudoku6x6Erase: 'Erase',
  sudoku6x6Notes: 'Notes',
  sudoku6x6HintOnlyDigit: 'Only one digit fits this cell.',
  sudoku6x6HintOnlyCell: 'This is the only place {value} can go here.',
  sudoku6x6HintLockedLine: 'In this box, {value} only fits on the highlighted line.',
  sudoku6x6HintLockedBox: 'On this line, {value} only fits inside the highlighted box.',
  sudoku6x6HintRuledOut: 'These cells rule the digits out elsewhere in the unit.',
  sudoku6x6HintNone: 'Nothing can be worked out yet.',
  sudoku6x6SolvedTitle: 'Solved!',
  sudoku6x6SolvedBody: 'Every row, column and box holds 1-6.',
  sudoku6x6Mistakes: 'Mistakes',
  sudoku6x6HintsUsed: 'Hints used',
  sudoku6x6NewBestTime: 'Your fastest yet.',
  sudoku6x6NewBoard: 'New board',
  sudoku6x6DailySection: 'Daily',
  sudoku6x6DailiesSolved: 'Days solved',
  sudoku6x6HighlightMistakes: 'Show mistakes',
  sudoku6x6HighlightMistakesNote:
    'Marks a wrong digit as soon as it is placed. Repeated digits are always marked.',
  sudoku6x6Step1Title: '1-6, once each',
  sudoku6x6Step1Body: 'Every row, column and 2×3 box holds 1 to 6 exactly once.',
  sudoku6x6Step2Title: 'Fill and note',
  sudoku6x6Step2Body: 'Pick a cell and tap a number. Turn on Notes to pencil in candidates.',
  sudoku6x6Step3Title: 'Stuck? Take a hint',
  sudoku6x6Step3Body: 'A hint shows the next cell you can be sure of, and why.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type Sudoku6x6Messages = Record<keyof typeof en, string>;
