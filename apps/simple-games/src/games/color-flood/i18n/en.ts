// English source.
export const en = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'Choose a colour',
  colorFloodChoose: 'Choose a board',
  colorFloodBest: 'Fewest moves',
  colorFloodBoard: 'Board',
  colorFloodClear: 'One colour!',
  colorFloodClearBody: 'The whole board is connected.',
  colorFloodRule1: 'Start at the top-left square and choose a colour that touches your region.',
  colorFloodRule2: 'The region changes colour and absorbs all connected squares of that colour.',
  colorFloodRule3:
    'Cover the board in fewer moves. There is no move limit, and Undo is always available.',
  colorFloodCell: 'Row {row}, column {col}: {symbol}',
  colorFloodColour: 'Colour {number}: {symbol}',
  colorFloodStatus: 'Connected: {count} / {total}',
} as const;
export type ColorFloodMessages = Record<keyof typeof en, string>;
