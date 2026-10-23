// English source.
export const en = {
  mazeEscapeName: 'Maze Escape',
  mazeEscapeChoose: 'Choose a maze',
  mazeEscapeBest: 'Fewest moves',
  mazeEscapeBoard: 'Maze',
  mazeEscapeClear: 'You found the way!',
  mazeEscapeClearBody: 'You reached the flag.',
  mazeEscapeRule1: 'Move the dot from the top left to the flag at the bottom right.',
  mazeEscapeRule2: 'Tap an adjacent passage, swipe, or use the arrows to move through the maze.',
  mazeEscapeRule3: 'Undo any step or ask for the next step with Hint; there is no time limit.',
  mazeEscapeGoal: 'Reach the flag ⚑',
  mazeEscapePosition: 'Row {row}, column {col}',
  mazeEscapeHintNote: 'Next step: row {row}, column {col}.',
  mazeEscapeControls: 'Movement',
  mazeEscapeUp: 'Move up',
  mazeEscapeLeft: 'Move left',
  mazeEscapeDown: 'Move down',
  mazeEscapeRight: 'Move right',
} as const;
export type MazeEscapeMessages = Record<keyof typeof en, string>;
