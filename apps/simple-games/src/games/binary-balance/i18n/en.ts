/**
 * Binary Balance's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * The board itself carries no words. Its two marks are language-independent
 * SVG shapes (a circle and a square) and its links are the symbols `=` and
 * `×`, identical in every locale (docs/BINARY_BALANCE_RULES.md §1), so
 * everything here is chrome and read-aloud text. The difficulty names are
 * referenced statically (ui/difficultyKey.ts), never assembled at runtime.
 *
 * The hint sentences never name a technique (§8). `{mark}` is the mark a hint
 * proves and `{other}` the one it rules out, both from the two mark names.
 */
export const en = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Choose a board',
  binaryBalanceDifficulty_easy: 'Easy',
  binaryBalanceDifficulty_medium: 'Medium',
  binaryBalanceDifficulty_hard: 'Hard',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Replace the board in progress?',
  binaryBalanceConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  binaryBalanceBoardLabel: 'Binary Balance board, {size} by {size}',
  binaryBalanceCellEmpty: 'Empty, row {row}, column {col}',
  binaryBalanceCellCircle: 'Circle, row {row}, column {col}',
  binaryBalanceCellSquare: 'Square, row {row}, column {col}',
  binaryBalanceCellFixedCircle: 'Fixed circle, row {row}, column {col}',
  binaryBalanceCellFixedSquare: 'Fixed square, row {row}, column {col}',
  binaryBalanceLinkSameRight: 'same as the cell to the right',
  binaryBalanceLinkDiffRight: 'different from the cell to the right',
  binaryBalanceLinkSameBelow: 'same as the cell below',
  binaryBalanceLinkDiffBelow: 'different from the cell below',
  /** Appended to a cell's label while it takes part in a broken rule (§9). */
  binaryBalanceRuleBroken: 'breaks a rule',
  binaryBalanceMarkCircle: 'a circle',
  binaryBalanceMarkSquare: 'a square',
  binaryBalanceHintViolation: 'The highlighted cells break a rule.',
  binaryBalanceHintWrong: 'The outlined mark cannot be right.',
  binaryBalanceHintPairGap:
    'The tinted pair would make three in a row, so the outlined cell is {mark}.',
  binaryBalanceHintLineCount:
    'The highlighted line already holds its half of the tinted mark, so the outlined cell is {mark}.',
  binaryBalanceHintLinkSame:
    'An = joins the outlined cell to the tinted one, so it is {mark} as well.',
  binaryBalanceHintLinkDiff:
    'A × joins the outlined cell to the tinted one, so it takes the other mark: {mark}.',
  binaryBalanceHintLineCompletion:
    'Every way to finish the highlighted line puts {mark} in the outlined cell.',
  binaryBalanceHintHypothesis:
    'If the outlined cell were {other}, the moves that follow would break a rule, so it is {mark}.',
  binaryBalanceHintNone: 'No certain move found right now.',
  binaryBalanceSolvedTitle: 'Solved!',
  binaryBalanceSolvedBody: 'Every line is balanced, and every link holds.',
  binaryBalanceHintsUsed: 'Hints used',
  binaryBalanceNewBestTime: 'Your fastest yet.',
  binaryBalanceNewBoard: 'New board',
  binaryBalanceDailySection: 'Daily',
  binaryBalanceDailiesSolved: 'Days solved',
  binaryBalanceDailyBacklogHint: 'Every earlier day stays open.',
  binaryBalanceStep1Title: 'Never three in a row',
  binaryBalanceStep1Body:
    'Tap to cycle empty, circle, square. The same mark never runs three in a row.',
  binaryBalanceStep2Title: 'Half and half',
  binaryBalanceStep2Body: 'Every row and every column holds as many circles as squares.',
  binaryBalanceStep3Title: 'Follow the links',
  binaryBalanceStep3Body:
    'Cells joined by = are the same; cells joined by × are different. Stuck? Ask for a hint.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BinaryBalanceMessages = Record<keyof typeof en, string>;
