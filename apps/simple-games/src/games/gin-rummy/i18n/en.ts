/**
 * Gin Rummy's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Gin Rummy's.
 *
 * `ginName` is the literal 'Gin Rummy' in every locale: a game's title is a
 * proper noun and is never translated (docs/I18N_POLICY.md).
 *
 * Two families of strings here carry the game's help (docs/GIN_RUMMY_RULES.md
 * §7): the deadwood readout, and the meld / deadwood suffix every card in the
 * hand is announced with. They are what a screen reader hears instead of
 * the arrangement a sighted player sees, so they are worded as facts about the
 * card, never as advice about the move.
 */
export const en = {
  ginName: 'Gin Rummy',

  // ---------- home ----------
  ginChooseOpponent: 'Choose your opponent',
  ginDifficulty_easy: 'Easy',
  ginDifficulty_normal: 'Normal',
  ginDifficulty_hard: 'Hard',
  ginRecordNote: 'Won {wins} · Lost {losses}',
  ginConfirmSwitchTitle: 'Replace the match in progress?',
  ginConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',

  // ---------- the table ----------
  ginTableLabel: 'Gin Rummy table',
  ginHandLabel: 'Your hand',
  ginOpponentLabel: 'CPU holds {n} cards',
  ginStockLabel: 'Stock, {n} cards',
  ginDiscardLabel: 'Discard pile, {card} on top',
  ginDiscardEmpty: 'Discard pile, empty',
  ginCardLabel: '{rank} of {suit}',
  ginSuit_spades: 'spades',
  ginSuit_hearts: 'hearts',
  ginSuit_diamonds: 'diamonds',
  ginSuit_clubs: 'clubs',
  ginCardInMeld: '{card}, meld {n}',
  ginCardDeadwood: '{card}, deadwood',
  ginDeadwood: 'Deadwood',
  ginYou: 'You',
  ginCpu: 'CPU',

  // ---------- prompts and what just happened ----------
  ginUpcardPrompt: 'Take the upcard, or pass',
  ginDrawPrompt: 'Draw from the stock or the pile',
  ginDiscardPrompt: 'Tap a card, then tap it again to put it down',
  ginKnockPrompt: 'Tap the card to knock with, then tap it again',
  ginCpuTurn: 'CPU is thinking…',
  ginCpuPassed: 'The CPU passed the upcard',
  ginCpuDrewStock: 'The CPU drew from the stock',
  ginCpuTookDiscard: 'The CPU took the {card}',
  ginCpuDiscarded: 'The CPU put down the {card}',
  ginTake: 'Take',
  ginPass: 'Pass',
  ginKnock: 'Knock',

  // ---------- the hand, settled ----------
  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Knock',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Dead hand',
  ginHandDeadBody: 'Two cards left in the stock. Nobody scores, and the same dealer deals again.',
  ginHandYouTook: 'You take {points}',
  ginHandCpuTook: 'The CPU takes {points}',
  ginYourMelds: 'Your melds',
  ginCpuMelds: 'CPU melds',
  ginLaidOff: 'Laid off',
  ginNextHand: 'Next hand',

  // ---------- the match, decided ----------
  ginWinTitle: 'You win!',
  ginWinBody: 'A hundred points before the CPU got there.',
  ginLoseTitle: 'The CPU wins',
  ginLoseBody: 'The CPU passed a hundred first. The next match is free.',

  // ---------- statistics ----------
  ginWins: 'Wins',
  ginLosses: 'Losses',

  // ---------- Quick Rules: three steps, one sentence each ----------
  ginStep1Title: 'Draw one, throw one',
  ginStep1Body: 'Take the face-down stock or the top of the pile, then put another card down.',
  ginStep2Title: 'Sets and runs',
  ginStep2Body:
    'Three of a rank, or three in a row in one suit — the rest is deadwood, counted for you.',
  ginStep3Title: 'Knock at ten or less',
  ginStep3Body: 'Once your deadwood is ten or under, the Knock button appears and ends the hand.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type GinRummyMessages = Record<keyof typeof en, string>;
