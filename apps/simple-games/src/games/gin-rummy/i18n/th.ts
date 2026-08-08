/*
 * PLACEHOLDER — this catalog is still the English text, word for word.
 *
 * The file exists so the fourteen-locale shape holds and the i18n tests can
 * see this game at all: every locale must carry every key as a non-empty
 * string with the same placeholders (src/i18n/i18n.test.ts). English standing
 * in for a missing translation is what the runtime already falls back to, so
 * this is the fallback written down rather than a claim that it was
 * translated. Replacing it is the next commit on this game, and
 * docs/I18N_POLICY.md governs how.
 */
import type { GinRummyMessages } from './en';
export const th: GinRummyMessages = {
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
};
