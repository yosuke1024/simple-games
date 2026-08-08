/**
 * Hearts' own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Hearts'.
 *
 * `heartsName` is the literal 'Hearts' in every locale: a game's title is a
 * proper noun and is never translated (docs/I18N_POLICY.md). The three
 * opponents are `CPU 1` / `CPU 2` / `CPU 3` in every locale too, for a
 * different reason — they are seats round a table, and a digit is the one
 * label every reader of the fourteen languages recognises in the same place.
 *
 * One family of strings here carries the game's only piece of help (the plan's
 * 助けの形): a card the rules will not take right now is announced as blocked
 * rather than merely drawn dim, so following suit is audible as well as
 * visible. It is worded as a fact about the card — never as advice about which
 * one to play.
 */
export const en = {
  heartsName: 'Hearts',

  // ---------- home ----------
  heartsChooseOpponent: 'Choose your opponents',
  heartsDifficulty_easy: 'Easy',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Hard',
  heartsRecordNote: 'Won {wins} · Lost {losses} · Drawn {draws}',
  heartsConfirmSwitchTitle: 'Replace the match in progress?',
  heartsConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',

  // ---------- the table ----------
  heartsTableLabel: 'Hearts table',
  heartsHandLabel: 'Your hand',
  heartsTrickLabel: 'The trick',
  heartsTrayLabel: 'Cards you are passing',
  heartsYou: 'You',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'You: {hand} points this hand, {total} in the match',
  heartsSeatLabel: 'CPU {n}: {cards} cards, {hand} points this hand, {total} in the match',
  heartsTookLastTrick: 'Took the last trick',
  heartsCardLabel: '{rank} of {suit}',
  heartsSuit_spades: 'spades',
  heartsSuit_hearts: 'hearts',
  heartsSuit_diamonds: 'diamonds',
  heartsSuit_clubs: 'clubs',
  heartsCardBlocked: '{card}, not allowed now',
  heartsCardChosen: '{card}, chosen to pass',
  heartsTrickCard: '{card}, {seat}',

  // ---------- the pass ----------
  heartsPassPrompt: 'Choose three cards to pass',
  heartsPassLeft: 'Passing left',
  heartsPassAcross: 'Passing across',
  heartsPassRight: 'Passing right',
  heartsPassConfirm: 'Pass these three',
  heartsPassWaiting: 'Waiting for the other seats…',

  // ---------- the tricks ----------
  heartsPlayPrompt: 'Tap a card, then tap it again to play it',
  heartsCpuTurn: 'CPU {n} is playing…',
  heartsTrickYou: 'You took the trick',
  heartsTrickCpu: 'CPU {n} took the trick',

  // ---------- the hand, scored ----------
  heartsHandTitle: 'Hand scored',
  heartsMoonTitle: 'Shot the moon',
  heartsMoonYou: 'You took all twenty-six, so the other three seats take 26 each.',
  heartsMoonCpu: 'CPU {n} took all twenty-six, so everybody else takes 26.',
  heartsThisHand: 'This hand',
  heartsMatchTotal: 'Match',
  heartsNextHand: 'Next hand',

  // ---------- the match, decided ----------
  heartsWinTitle: 'You win!',
  heartsWinBody: 'The fewest points when somebody passed a hundred.',
  heartsLoseTitle: 'The CPU wins',
  heartsLoseBody: 'Another seat finished on fewer points. The next match is free.',
  heartsDrawTitle: 'A draw',
  heartsDrawBody: 'You finished level with another seat on the lowest score.',
  heartsFinalScores: 'Final scores',

  // ---------- statistics ----------
  heartsWins: 'Wins',
  heartsLosses: 'Losses',
  heartsDraws: 'Draws',

  // ---------- Quick Rules: three steps, one sentence each ----------
  heartsStep1Title: 'Pass three',
  heartsStep1Body:
    'Before most hands you pick three cards out and pass them on — left, then right, then across, then a hand where nobody passes.',
  heartsStep2Title: 'Follow the suit',
  heartsStep2Body:
    'Whoever leads sets the suit and you follow it while you hold it, and the highest card of that suit takes the trick.',
  heartsStep3Title: 'Fewest points wins',
  heartsStep3Body:
    'Every heart you take in costs a point and the queen of spades costs thirteen, so when somebody passes a hundred the fewest points wins.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type HeartsMessages = Record<keyof typeof en, string>;
