/**
 * Number Match's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for number-match's.
 */
export const en = {
  numberMatchName: 'Number Match',
  best: 'Best',
  newBest: 'New best!',
  scoreMatches: 'Matches',
  scoreRows: 'Row bonus',
  scoreClearBonus: 'Clear bonus',
  scoreNoHint: 'No-hint bonus',
  bestScores: 'Best Scores',
  totalBest: 'Total of level bests',
  addNumbers: 'Add',
  boardLabel: 'Game board',
  cellLabel: '{value}, row {row}, column {col}',
  cellLabelStone: 'Stone, row {row}, column {col}',
  cellLabelWild: 'Wild, row {row}, column {col}',
  hintNoneToast: 'No pairs available — try Add.',
  wildIntroToast: 'The ✦ tile pairs with any number.',
  stoneIntroToast: 'Stones cannot be matched, and block the way.',
  clearTitle: 'Board cleared!',
  clearBody: 'You removed every number.',
  gameOverTitle: 'No more moves',
  gameOverBody: 'The board reached its limit.',
  step1Title: 'Equal, or adds up to 10',
  step1Body: 'Match two numbers that are the same, or that add up to 10.',
  step2Title: 'Pick two that connect',
  step2Body:
    'Across, down, diagonally — or from the end of one row to the start of the next. Cleared cells are no obstacle, but a number still on the board blocks the way.',
  step3Title: 'Clear the board to win',
  step3Body: 'Stuck? Tap Add to append the remaining numbers. Undo and hints are always free.',
  gameOverCount: 'Game overs',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type NumberMatchMessages = Record<keyof typeof en, string>;
