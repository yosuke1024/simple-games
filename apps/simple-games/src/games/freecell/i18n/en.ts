/**
 * FreeCell's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for FreeCell's.
 */
export const en = {
  freecellName: 'FreeCell',
  fcNewDeal: 'New deal',
  fcTableLabel: 'FreeCell table',
  fcCardLabel: '{rank} of {suit}',
  fcSuit_spades: 'spades',
  fcSuit_hearts: 'hearts',
  fcSuit_diamonds: 'diamonds',
  fcSuit_clubs: 'clubs',
  fcCellLabel: 'Free cell {n}, {card}',
  fcCellEmpty: 'Free cell {n}, empty',
  fcCellsLabel: 'Free cells',
  fcFoundationCard: 'Foundation, {card}',
  fcFoundationEmpty: 'Foundation, {suit}, empty',
  fcColumnLabel: 'Column {n}',
  fcColumnEmpty: 'Column {n}, empty — any card can move here',
  fcAutoFinish: 'Finish the game',
  fcStuckTitle: 'No moves left',
  fcStuckBody: 'Every cell is full and nothing fits. Undo a move, or take a new deal.',
  fcWonTitle: 'You won!',
  fcWonBody: 'All four suits are complete.',
  fcNewBestMoves: 'Your fewest moves yet.',
  fcNewBestTime: 'Your fastest yet.',
  fcBestMoves: 'Fewest moves',
  fcDealsPlayed: 'Deals played',
  fcGamesWon: 'Games won',
  fcWinRate: 'Win rate',
  fcDailiesWon: 'Daily deals won',
  fcDailyBacklogHint: 'Every earlier day stays open. Take your time.',
  fcStep1Title: 'Down by one, colors alternate',
  fcStep1Body: 'Stack cards downward, red on black on red. Tap a card, then tap where it goes.',
  fcStep2Title: 'Four cells, one card each',
  fcStep2Body:
    'Park a card in a free cell to dig underneath it. The more cells stand empty, the more cards you can carry at once.',
  fcStep3Title: 'Aces build to kings',
  fcStep3Body: 'Send each suit to its foundation from ace to king. Complete all four to win.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type FreeCellMessages = Record<keyof typeof en, string>;
