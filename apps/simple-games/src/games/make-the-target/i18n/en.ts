/**
 * Make the Target's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's catalog stays the source of truth for shared keys (Undo, Retry same
 * board, Home, Time, Fastest clear, …), this file for this game's.
 * Provenance (docs/MAKE_THE_TARGET_RULES.md §13): this English is the source.
 *
 * The board itself carries no words (§1): numbers are ASCII digits and the
 * operators are the signs + − × ÷. Everything here is chrome — the panel and
 * cards around the board, Quick Rules, the statistics — and the spoken names
 * a screen reader needs where a sighted player reads the signs (§12).
 * Sentences take their values through `{var}`, never by concatenation.
 */
export const en = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Choose a difficulty',
  makeTheTargetDifficulty_easy: 'Easy',
  makeTheTargetDifficulty_medium: 'Medium',
  makeTheTargetDifficulty_hard: 'Hard',
  /** How many numbers each difficulty deals (§7), under its button on the home. */
  makeTheTargetTierNote_easy: '4 numbers',
  makeTheTargetTierNote_medium: '4 or 5 numbers',
  makeTheTargetTierNote_hard: '5 numbers',
  makeTheTargetConfirmSwitchTitle: 'Replace the problem in progress?',
  makeTheTargetConfirmSwitchBody:
    'Your {current} problem will be replaced by a new {next} problem.',
  /** The board's name for a screen reader, and the label of the count on the result card. */
  makeTheTargetNumbersLabel: 'Numbers',
  /** The target, read aloud (§12). */
  makeTheTargetTargetSpoken: 'Target {target}',
  makeTheTargetTargetLabel: 'Target',
  makeTheTargetOperatorsLabel: 'Operators',
  /** The operator buttons' names (§12). */
  makeTheTargetOp_add: 'Add',
  makeTheTargetOp_subtract: 'Subtract',
  makeTheTargetOp_multiply: 'Multiply',
  makeTheTargetOp_divide: 'Divide',
  /**
   * One expression line read aloud, a whole sentence per operator so each
   * language can build its own (§12, §13): the left term first — "7 minus 3
   * equals 4" takes 3 from 7, "8 divided by 2 equals 4" divides 8.
   */
  makeTheTargetSpokenLine_add: '{left} plus {right} equals {result}',
  makeTheTargetSpokenLine_subtract: '{left} minus {right} equals {result}',
  makeTheTargetSpokenLine_multiply: '{left} times {right} equals {result}',
  makeTheTargetSpokenLine_divide: '{left} divided by {right} equals {result}',
  /** Read when Undo takes a move back; `{line}` is a spoken line as above. */
  makeTheTargetSpokenUndo: 'Taken back: {line}',
  /** The list of moves under the board (§4). */
  makeTheTargetStepsLabel: 'Moves so far',
  /** The `missed` panel (§4): a fact, not a failure. At most two lines in every language. */
  makeTheTargetMissed: 'That makes {value}, not {target}.',
  /** Read once when a move ends on the panel: the move's spoken line, then the panel's fact. */
  makeTheTargetSpokenMissed: '{line}. That makes {value}, not {target}.',
  makeTheTargetShowSolution: 'Show a solution',
  makeTheTargetRevealTitle: 'Show a solution?',
  makeTheTargetRevealBody: 'This problem ends here and is not counted as solved.',
  makeTheTargetRevealConfirm: 'Show',
  /** The result card's heading: the fact, never praise (§9). */
  makeTheTargetSolvedTitle: 'Target made.',
  /** The card after a solution was shown (§5). One way among others — never "the" solution. */
  makeTheTargetRevealedTitle: 'One way to make {target}',
  makeTheTargetSolutionLabel: 'A solution',
  makeTheTargetNewBoard: 'New problem',
  makeTheTargetNewBestTime: 'Your fastest yet.',
  makeTheTargetSolvedCount: 'Problems solved',
  makeTheTargetDailySection: 'Daily',
  makeTheTargetDailiesCleared: 'Days cleared',
  makeTheTargetAllModes: 'All modes',
  /** Quick Rules (§11): three steps, one sentence each. */
  makeTheTargetStep1Title: 'Combine two',
  makeTheTargetStep1Body:
    'Tap a number, then + − × or ÷, then another number — the first one you tap is on the left.',
  makeTheTargetStep2Title: 'A new number',
  makeTheTargetStep2Body:
    'The two are used up, and the answer — always a whole number above zero — takes their place.',
  makeTheTargetStep3Title: 'Match the target',
  makeTheTargetStep3Body:
    'Use every number. When the last one equals the target, the puzzle is solved.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MakeTheTargetMessages = Record<keyof typeof en, string>;
