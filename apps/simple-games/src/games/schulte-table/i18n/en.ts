/**
 * Schulte Table's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts.
 *
 * The board itself needs no strings — it is ASCII digits, identical in all
 * fourteen locales (docs/I18N_POLICY.md). Everything here is chrome.
 *
 * Nothing here claims an effect on the person playing. The genre's usual
 * sales pitch is absent on purpose, and CI greps for every phrase of it
 * (.github/scripts/check-principles.sh §7, docs/SCHULTE_TABLE_RULES.md §14-2).
 * Say what the player does; promise nothing about what it does to them.
 */
export const en = {
  schulteName: 'Schulte Table',

  // Board
  schulteBoardLabel: 'Number grid',
  schulteCell: '{value}, row {row}, column {col}',
  schulteCellDone: '{value}, row {row}, column {col}, already tapped',
  schulteFind: 'Find',

  // Finish
  schulteDoneTitle: 'All found',
  schulteDoneBody: 'You tapped every number in order.',
  schulteMisses: 'Wrong taps',
  schulteNewBestTime: 'Your fastest yet.',
  schulteConfirmRestartBody: 'This round starts over from the first number.',

  // Lists & statistics
  schulteDailyBacklogHint: 'Every past day stays open.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Levels finished',
  schulteDailiesDone: 'Dailies finished',
  schulteTotalMisses: 'Wrong taps in total',

  // Quick Rules
  schulteStep1Title: 'Tap 1, then 2, then 3',
  schulteStep1Body: 'The numbers are scattered. Tap them in order.',
  schulteStep2Title: 'The number to find is above the grid',
  schulteStep2Body: 'A wrong tap costs nothing — the grid simply waits.',
  schulteStep3Title: 'Finish the grid',
  schulteStep3Body: 'Your time is recorded. There is no time limit.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SchulteMessages = Record<keyof typeof en, string>;
