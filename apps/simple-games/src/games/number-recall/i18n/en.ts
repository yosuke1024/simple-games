/**
 * Number Recall's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts.
 *
 * The board itself needs no strings — it is ASCII digits, identical in all
 * fourteen locales (docs/I18N_POLICY.md). Everything here is chrome.
 *
 * Nothing here claims an effect on the person playing. The genre's usual
 * sales pitch is absent on purpose, and CI greps for every phrase of it
 * (.github/scripts/check-principles.sh §7, docs/SCHULTE_TABLE_RULES.md §14-2).
 * This is the title where that temptation is strongest — a game about
 * remembering things is one word away from promising a better memory — and it
 * is also where the promise would be least supportable.
 */
export const en = {
  recallName: 'Number Recall',

  // Board
  recallBoardLabel: 'Tile grid',
  recallTileUp: '{value}, row {row}, column {col}',
  // No number in this one: it is the thing being asked for.
  recallTileDown: 'Face down, row {row}, column {col}',
  recallMemorise: 'Take your time. Tap 1 when you are ready.',
  recallNext: 'Next',

  // End of a round
  recallDoneTitle: 'All remembered',
  recallDoneBody: 'You found every tile in order.',
  recallMissTitle: 'That was not the one',
  recallMissBody: 'The tile you needed is ringed. Try a new layout.',
  recallTiles: 'Tiles',
  recallNewBestTime: 'Your fastest yet.',
  recallNewLayout: 'New layout',

  // Lists & statistics
  recallDailyBacklogHint: 'Every past day stays open.',
  recallSizeLabel: '{n}x{n}',
  recallLevelsDone: 'Levels finished',
  recallDailiesDone: 'Dailies finished',
  recallFirstTry: 'Finished first try',

  // Quick Rules
  recallStep1Title: 'Look for as long as you like',
  recallStep1Body: 'The numbers are showing, and nothing is counting down.',
  recallStep2Title: 'Tap 1 and the rest turn over',
  recallStep2Body: 'From there, tap 2, 3 and on from memory.',
  recallStep3Title: 'A wrong tile ends the round',
  recallStep3Body: 'You are shown the answer, then a new layout at the same level.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type RecallMessages = Record<keyof typeof en, string>;
