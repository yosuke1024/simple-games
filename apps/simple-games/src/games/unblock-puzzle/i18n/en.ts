/**
 * Unblock Puzzle's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's en.ts stays the source of truth for shared keys (Undo, Hint,
 * Moves, Time, …), this file for this game's. Provenance: `source`
 * (docs/UNBLOCK_PUZZLE_RULES.md §15).
 *
 * The board itself carries no words: blocks, the target's arrow and the exit
 * are CSS and inline SVG, and numbers are ASCII digits (§1, §14). Everything
 * here is chrome — and the spoken names of the blocks, which a screen reader
 * needs where a sighted player sees the board. Each spoken name is one whole
 * template per kind, never assembled from pieces (docs/I18N_POLICY.md
 * 「文言設計」).
 */
export const en = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Choose a board',
  unblockPuzzleDifficulty_easy: 'Easy',
  unblockPuzzleDifficulty_medium: 'Medium',
  unblockPuzzleDifficulty_hard: 'Hard',
  /** Under a difficulty on the home: the fewest moves its boards take (§7). */
  unblockPuzzleRange: '{min}–{max} moves',
  /** The same, for the difficulty with no ceiling. */
  unblockPuzzleRangeOpen: '{min}+ moves',
  unblockPuzzleConfirmSwitchTitle: 'Replace the board in progress?',
  unblockPuzzleConfirmSwitchBody: 'Your {current} board will be replaced by a new {next} board.',
  unblockPuzzleBoardLabel: 'Board, {cols} by {rows}. The exit is at the right end of row {row}.',
  /** A block's spoken name (§14): where it is, and the free cells on either side. */
  unblockPuzzleBlockTarget:
    'Target block, row {row}, columns {from} to {to}. Free cells: {left} left, {right} right.',
  unblockPuzzleBlockH:
    'Horizontal block, row {row}, columns {from} to {to}. Free cells: {left} left, {right} right.',
  unblockPuzzleBlockV:
    'Vertical block, column {col}, rows {from} to {to}. Free cells: {up} up, {down} down.',
  /** The top bar while playing: the moves so far and the board's fewest (§4). */
  unblockPuzzleMovesStatus: 'Moves {moves} · fewest {min}',
  unblockPuzzleMoveLeft: 'Move left',
  unblockPuzzleMoveRight: 'Move right',
  unblockPuzzleMoveUp: 'Move up',
  unblockPuzzleMoveDown: 'Move down',
  /** Between the arrow buttons while no block is selected (§5). */
  unblockPuzzleSelectPrompt: 'Tap a block to move it',
  unblockPuzzleHintTarget: 'Hint: slide the target block to columns {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Hint: slide the block in row {row}, columns {from}–{to}, to columns {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Hint: slide the block in column {col}, rows {from}–{to}, to rows {toFrom}–{toTo}.',
  /** Between the arrow buttons while a hint is marked on the board (§6). */
  unblockPuzzleHintShown: 'Slide the marked block to the dashed outline.',
  /** The search stopped or found no way out: no move is shown, and none is guessed (§6). */
  unblockPuzzleHintNone: 'No move was found from here.',
  unblockPuzzleSolvedTitle: 'Cleared!',
  unblockPuzzleSolvedBody: 'The target block is out.',
  unblockPuzzleSolvedOptimal: 'Out in the fewest possible moves.',
  /** On the result card, beside the moves: the board's fewest (§10). */
  unblockPuzzleFewestLabel: 'Fewest possible',
  /**
   * Each move's distance from where it began to where it ended, summed (§4).
   * Not "cells slid": two right and one back is one, not three (§16).
   */
  unblockPuzzleNetCellsLabel: 'Net cells moved',
  unblockPuzzleHintsUsed: 'Hints used',
  unblockPuzzleNewBestTime: 'Your fastest {difficulty} clear yet.',
  unblockPuzzleNewBestDailyMoves: 'Your fewest moves on today’s board yet.',
  unblockPuzzleNewBoard: 'New board',
  unblockPuzzleSolvedCount: 'Boards cleared',
  unblockPuzzleOptimalCount: 'Cleared in fewest moves',
  unblockPuzzleOverallSection: 'Overall',
  unblockPuzzleDailiesCleared: 'Daily Challenges cleared',
  unblockPuzzleStep1Title: 'Slide along the line',
  unblockPuzzleStep1Body:
    'Each block slides only along its own line: side to side, or up and down.',
  unblockPuzzleStep2Title: 'Free the target',
  unblockPuzzleStep2Body:
    'Slide the target block out through the exit on the right to clear the board.',
  unblockPuzzleStep3Title: 'One slide, one move',
  unblockPuzzleStep3Body:
    'A slide counts as one move however far it goes, and Undo and Hint are always there.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type UnblockPuzzleMessages = Record<keyof typeof en, string>;
