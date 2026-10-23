// English source.
export const en = {
  lightGridName: 'Light Grid',
  lightGridChoose: 'Choose a board',
  lightGridBest: 'Fewest moves',
  lightGridBoard: 'Board',
  lightGridClear: 'All lights out!',
  lightGridClearBody: 'Every light is off.',
  lightGridRule1: 'Tap a cell to switch it and its neighbours above, below, left and right.',
  lightGridRule2: 'Switch off every light; there is no time limit.',
  lightGridRule3: 'Undo any move, or tap Hint to see where to play next.',
  lightGridCell: 'Row {row}, column {col}: {state}',
  lightGridOn: 'on',
  lightGridOff: 'off',
  lightGridHintNote: 'Tap row {row}, column {col}.',
  lightGridHintEffect: 'The outlined neighbours also switch.',
  lightGridHintAffected: 'also switches after the suggested tap',
  lightGridStatus: 'Lights on: {count}',
} as const;
export type LightGridMessages = Record<keyof typeof en, string>;
