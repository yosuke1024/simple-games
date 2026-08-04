/**
 * Solitaire's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for solitaire's.
 */
export const en = {
  solitaireName: 'Solitaire',
  solNewDeal: 'New deal',
  solDrawSetting: 'Draw setting',
  solDrawOne: 'Draw 1',
  solDrawThree: 'Draw 3',
  solDrawNote: 'Applies from the next deal.',
  solTableLabel: 'Solitaire table',
  solStockLabel: 'Stock, {n} cards — tap to draw',
  solStockEmpty: 'Stock empty — tap to turn the waste over',
  solCardLabel: '{rank} of {suit}',
  solCardFaceDown: 'Face down',
  solSuit_spades: 'spades',
  solSuit_hearts: 'hearts',
  solSuit_diamonds: 'diamonds',
  solSuit_clubs: 'clubs',
  solFoundationCard: 'Foundation, {card}',
  solFoundationEmpty: 'Foundation, {suit}, empty',
  solPileLabel: 'Column {n}',
  solPileEmpty: 'Column {n}, empty — a king can move here',
  solAutoFinish: 'Finish the game',
  solHintNone: 'No move found — undo or start over.',
  solHintsUsed: 'Hints',
  solWonTitle: 'You won!',
  solWonBody: 'All four suits are complete.',
  solNewBestMoves: 'Your fewest moves yet.',
  solNewBestTime: 'Your fastest yet.',
  solBestMoves: 'Fewest moves',
  solDealsPlayed: 'Deals played',
  solGamesWon: 'Games won',
  solWinRate: 'Win rate',
  solDailiesWon: 'Daily deals won',
  solDailyBacklogHint: 'Every earlier day stays open. Not every deal can be won.',
  solStep1Title: 'Down by one, colors alternate',
  solStep1Body: 'Stack cards downward, red on black on red. Tap a card, then tap where it goes.',
  solStep2Title: 'Free the hidden cards',
  solStep2Body:
    'Moves that turn a card face up open the game. The stock can be turned over any number of times.',
  solStep3Title: 'Aces build to kings',
  solStep3Body: 'Send each suit to its foundation from ace to king. Complete all four to win.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SolitaireMessages = Record<keyof typeof en, string>;
