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
import type { HeartsMessages } from './en';
export const fr: HeartsMessages = {
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
    'Before most hands you choose three cards and pass them on — left, then right, then across, then a hand where nobody passes.',
  heartsStep2Title: 'Follow the suit',
  heartsStep2Body:
    'Follow the suit that was led whenever you can; every heart costs a point and the queen of spades costs thirteen.',
  heartsStep3Title: 'Fewest points wins',
  heartsStep3Body:
    'The highest card of the suit led takes the trick and everything in it, and when somebody passes a hundred the fewest points wins.',
};
