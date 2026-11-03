// English source.
export const en = {
  marbleWeaveName: 'Marble Weave',
  marbleWeaveMode_easy: 'Easy',
  marbleWeaveMode_normal: 'Normal',
  marbleWeaveMode_hard: 'Hard',
  marbleWeaveBest: 'Highest score',
  marbleWeaveFinished: 'Games finished',
  marbleWeaveLost: 'Board complete',
  marbleWeaveField: 'Marble board',
  marbleWeaveEmpty: 'Empty',
  marbleWeaveCell: 'Row {row}, column {col}: {color}',
  marbleWeaveNext: 'Next',
  marbleWeaveTarget: 'Line of {n}',
  marbleWeaveSelect: 'Choose a marble to move.',
  marbleWeaveDestination: 'Choose a dotted square. Paths cannot cross marbles.',
  marbleWeaveBlocked: 'No clear path. Choose another square or marble.',
  marbleWeaveMoving: 'Following the open path…',
  marbleWeaveColor1: 'Red circle',
  marbleWeaveColor2: 'Blue diamond',
  marbleWeaveColor3: 'Green cross',
  marbleWeaveColor4: 'Gold triangle',
  marbleWeaveColor5: 'Purple star',
  marbleWeaveColor6: 'Teal square',
  marbleWeaveColor7: 'Pink flower',
  marbleWeaveStep1Title: 'Find an open path',
  marbleWeaveStep1Body:
    'Choose a marble, then a dotted square. It moves through empty squares, never diagonally.',
  marbleWeaveStep2Title: 'Make a color line',
  marbleWeaveStep2Body:
    'Line up 4 of one color in Easy, or 5 in Normal and Hard. Rows, columns and diagonals all count.',
  marbleWeaveStep3Title: 'Leave room to move',
  marbleWeaveStep3Body:
    'A move without a line adds the 3 preview marbles. Undo takes back the whole move, including new marbles.',
} as const;
export type MarbleWeaveMessages = Record<keyof typeof en, string>;
