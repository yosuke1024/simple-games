/** English source; all other locales are AI drafts, not human reviewed. */
export const en = {
  threePeaksName: 'Three Peaks',
  threePeaksStep1Title: 'Clear the peaks',
  threePeaksStep1Body:
    'Remove exposed cards one rank above or below the waste to clear all three peaks.',
  threePeaksStep2Title: 'Ace connects both ends',
  threePeaksStep2Body: 'K–A–2 works in either direction. Suits do not matter.',
  threePeaksStep3Title: 'Draw or undo',
  threePeaksStep3Body:
    'Draw a new waste card when needed. Use the stock once. Undo can reverse any move, even after the game ends.',
  threePeaksDraw: 'Draw',
  threePeaksStock: 'Stock',
  threePeaksWaste: 'Waste',
  threePeaksDrawCount: 'Draw a card; {count} left',
  threePeaksCardsLeft: 'Cards left',
  threePeaksWon: 'All peaks cleared!',
  threePeaksStuck: 'No moves left',
  threePeaksStuckBody: 'The stock is empty and no exposed card matches. Undo to try another path.',
  threePeaksUndoHint: 'Undo is unlimited, including draws and finished games.',
  threePeaksWins: 'Wins',
  threePeaksBest: 'Fewest cards left',
  threePeaksBoard: 'Three peaks tableau',
  threePeaksCovered: 'Card {position}, face down',
  threePeaksCardLabel: 'Card {position}: {rank} {suit}, {state}',
  threePeaksCanMove: 'can move',
  threePeaksCannotMove: 'cannot move',
  threePeaksSpades: 'spades',
  threePeaksHearts: 'hearts',
  threePeaksDiamonds: 'diamonds',
  threePeaksClubs: 'clubs',
  threePeaksKeyboard: 'Arrow keys: focus cards · D: draw · Ctrl/Cmd+Z: undo',
} as const;
export type ThreePeaksMessages = Record<keyof typeof en, string>;
