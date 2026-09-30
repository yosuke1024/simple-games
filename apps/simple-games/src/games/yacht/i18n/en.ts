/**
 * Yacht's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Yacht's.
 *
 * `yachtName` is the literal 'Yacht' in every locale, since a game's title is
 * a proper noun and is never translated (docs/I18N_POLICY.md). The box names
 * are the one part of the board a locale translates (docs/YACHT_RULES.md §1);
 * they are read through `ui/categoryKey.ts`, never assembled at runtime.
 */
export const en = {
  yachtName: 'Yacht',
  yachtResumeNote: 'Turn {turn} of {count} · You {total} · CPU {cpuTotal}',
  yachtRecordNote: 'Won {wins} · Lost {losses} · Best {best}',
  yachtBestNote: 'Best {score}',
  yachtTurnLine: 'Turn {turn} / {count}',
  yachtScoreLine: 'You {total} · CPU {cpuTotal}',
  yachtCpuTurn: 'CPU’s turn…',
  yachtYou: 'You',
  yachtCpu: 'CPU',
  yachtTotal: 'Total',
  yachtCategory_ones: 'Ones',
  yachtCategory_twos: 'Twos',
  yachtCategory_threes: 'Threes',
  yachtCategory_fours: 'Fours',
  yachtCategory_fives: 'Fives',
  yachtCategory_sixes: 'Sixes',
  yachtCategory_fullHouse: 'Full House',
  yachtCategory_fourOfAKind: 'Four of a Kind',
  yachtCategory_littleStraight: 'Little Straight',
  yachtCategory_bigStraight: 'Big Straight',
  yachtCategory_choice: 'Choice',
  yachtCategory_yacht: 'Yacht',
  yachtRoll: 'Roll',
  yachtRollsLeft: 'Rolls left: {n}',
  yachtDiceLabel: 'Dice',
  yachtDieLabel: 'Die {n}: {face}',
  yachtDieHeldLabel: 'Die {n}: {face}, held',
  yachtDieUnrolledLabel: 'Die {n}: not rolled yet',
  yachtSheetLabel: 'Score sheet',
  yachtBoxOpen: '{name}: open',
  yachtBoxPreview: '{name}: {points} if taken now',
  yachtBoxScored: '{name}: scored {points}',
  yachtBoxCpuPart_open: 'CPU: open',
  yachtBoxCpuPart_scored: 'CPU: {points}',
  yachtBest: 'Best',
  yachtWinTitle: 'You win!',
  yachtWinBody: 'Your sheet adds up to more.',
  yachtLoseTitle: 'The CPU wins',
  yachtLoseBody: 'The CPU’s sheet adds up to more this time.',
  yachtDrawTitle: 'A draw',
  yachtDrawBody: 'Both sheets add up the same.',
  yachtNewBest: 'New best score',
  yachtWins: 'Wins',
  yachtLosses: 'Losses',
  yachtDraws: 'Draws',
  yachtBestScore: 'Best score',
  yachtAverage: 'Average score',
  yachtStep1Title: 'Roll and keep',
  yachtStep1Body:
    'Roll the five dice, then tap the ones you want to keep. Tap again to let one go.',
  yachtStep2Title: 'Three rolls a turn',
  yachtStep2Body: 'Roll the others again. You get up to three rolls each turn.',
  yachtStep3Title: 'Fill one box',
  yachtStep3Body:
    'Pick an empty box to score your dice and end the turn. After twelve turns each, the higher sheet wins.',
  yachtConfirmReplaceTitle: 'Replace the game in progress?',
  yachtConfirmReplaceBody: 'Your game at turn {turn} of {count} will be replaced by a new one.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type YachtMessages = Record<keyof typeof en, string>;
