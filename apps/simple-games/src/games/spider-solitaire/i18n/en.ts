/**
 * Spider Solitaire's own strings (issue #38): bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts. The shell's en.ts
 * stays the source of truth for shared keys, this file for Spider Solitaire's.
 */
export const en = {
  spiderName: 'Spider Solitaire',
  spiderNewDeal: 'New deal',
  spiderTableLabel: 'Spider Solitaire table',
  spiderCardLabel: '{rank} of {suit}',
  spiderSuit_spades: 'spades',
  spiderSuit_hearts: 'hearts',
  spiderSuit_diamonds: 'diamonds',
  spiderSuit_clubs: 'clubs',
  spiderCardFaceDown: 'Face down',
  spiderStockLabel: 'Stock, {n} deals left — tap to deal a row',
  spiderStockEmpty: 'Stock empty',
  spiderStockBlocked: 'Fill every empty column before dealing.',
  spiderRunsLabel: 'Completed runs',
  spiderRunCard: 'Completed run, {suit}',
  spiderRunEmpty: 'Run not finished yet',
  spiderColumnLabel: 'Column {n}',
  spiderColumnEmpty: 'Column {n}, empty — any card can move here',
  spiderDifficulty: 'Suits',
  spiderOneSuit: '1 suit',
  spiderTwoSuits: '2 suits',
  spiderFourSuits: '4 suits',
  spiderDifficultyNote: 'Applies from the next deal.',
  spiderHintNone: 'No move found — undo, or deal a row.',
  spiderHintsUsed: 'Hints',
  spiderStuckTitle: 'No moves left',
  spiderStuckBody: 'The stock is spent and nothing fits. Undo a move, or take a new deal.',
  spiderWonTitle: 'You won!',
  spiderWonBody: 'All eight runs are complete.',
  spiderNewBestMoves: 'Your fewest moves yet.',
  spiderNewBestTime: 'Your fastest yet.',
  spiderBestMoves: 'Fewest moves',
  spiderDealsPlayed: 'Deals played',
  spiderGamesWon: 'Games won',
  spiderWinRate: 'Win rate',
  spiderDailiesWon: 'Daily deals won',
  spiderDailyBacklogHint: 'Every earlier day stays open. Not every deal can be won.',
  spiderStep1Title: 'Stack down by rank',
  spiderStep1Body:
    'Any suit can sit on a card one rank higher. Tap a card, then tap where it goes.',
  spiderStep2Title: 'One suit travels together',
  spiderStep2Body:
    'Cards of the same suit in order move as one. Build a king down to an ace and the run leaves the table.',
  spiderStep3Title: 'Deal when you are stuck',
  spiderStep3Body: 'The stock deals one card to every column — but only when no column is empty.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SpiderMessages = Record<keyof typeof en, string>;
