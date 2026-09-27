/**
 * Mancala's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Mancala's.
 *
 * `mancalaName` is the literal 'Mancala' in every locale, since a game's
 * title is a proper noun and is never translated (docs/I18N_POLICY.md).
 * Counts on the board are ASCII digits drawn by the board itself; the
 * strings here only name them for screen readers, as "seeds: n" so no
 * language needs a plural form for it.
 */
export const en = {
  mancalaName: 'Mancala',
  mancalaChooseOpponent: 'Choose your opponent',
  mancalaDifficulty_easy: 'Easy',
  mancalaDifficulty_normal: 'Normal',
  mancalaDifficulty_hard: 'Hard',
  mancalaChooseSideLabel: 'Who sows first',
  mancalaGoFirst: 'You first',
  mancalaGoSecond: 'CPU first',
  mancalaRecordNote: 'Won {wins} · Lost {losses}',
  mancalaBoardLabel: 'Mancala board, six pits a side and a store at each end',
  mancalaPitYou: 'Your pit {n}, seeds: {count}',
  mancalaPitCpu: 'CPU pit {n}, seeds: {count}',
  mancalaStoreYou: 'Your store, seeds: {count}',
  mancalaStoreCpu: 'CPU store, seeds: {count}',
  mancalaYou: 'You',
  mancalaCpu: 'CPU',
  mancalaYourTurn: 'Your turn',
  mancalaCpuTurn: 'CPU is thinking…',
  mancalaExtraTurn: 'Another turn!',
  mancalaCaptureYou: 'You took {n}',
  mancalaCaptureCpu: 'CPU took {n}',
  mancalaWinTitle: 'You win!',
  mancalaWinBody: 'Your store holds more seeds.',
  mancalaLoseTitle: 'The CPU wins',
  mancalaLoseBody: 'The CPU’s store holds more seeds.',
  mancalaDrawTitle: 'A draw',
  mancalaDrawBody: 'Both stores hold 24 seeds.',
  mancalaWins: 'Wins',
  mancalaLosses: 'Losses',
  mancalaDraws: 'Draws',
  mancalaStep1Title: 'Your pits, your store',
  mancalaStep1Body:
    'The bottom row of pits is yours, and so is the store on the right. When one side’s pits are all empty the game ends, and the fuller store wins.',
  mancalaStep2Title: 'Tap a pit to sow',
  mancalaStep2Body:
    'Its seeds drop one by one into the pits after it, counter-clockwise — into your store too, but never into the CPU’s.',
  mancalaStep3Title: 'End in your store, go again',
  mancalaStep3Body: 'When your last seed lands in your own store, you move again.',
  mancalaStep4Title: 'End in an empty pit, take',
  mancalaStep4Body:
    'When your last seed lands in an empty pit on your side, it and every seed across from it go to your store.',
  mancalaConfirmSwitchTitle: 'Replace the match in progress?',
  mancalaConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MancalaMessages = Record<keyof typeof en, string>;
