/**
 * Quick Math's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts.
 *
 * **The questions are not here and never will be.** They are drawn from digits
 * and the signs `+ − × ÷ = ?`, which mean the same thing in all fourteen
 * locales (docs/QUICK_MATH_RULES.md §1). A worded question would need fourteen
 * translations, and its word order differs by language, which is exactly what
 * the rule against building sentences by concatenation exists for
 * (docs/I18N_POLICY.md).
 *
 * Nothing here claims an effect on the person playing. The genre's usual
 * sales pitch is absent on purpose, and CI greps for every phrase of it
 * (.github/scripts/check-principles.sh §7, docs/SCHULTE_TABLE_RULES.md §14-2).
 */
export const en = {
  qmathName: 'Quick Math',

  // Keypad
  qmathKeypadLabel: 'Number keypad',
  qmathBackspace: 'Delete last digit',

  // Finish
  qmathDoneTitle: 'Set complete',
  qmathDoneBody: 'You answered every question.',
  qmathMisses: 'Wrong answers',
  qmathNewBestTime: 'Your fastest yet.',
  qmathConfirmRestartBody: 'This set starts over from the first question.',

  // Lists & statistics
  qmathDailyBacklogHint: 'Every past day stays open.',
  qmathLevelsDone: 'Levels finished',
  qmathDailiesDone: 'Dailies finished',
  qmathTotalMisses: 'Wrong answers in total',
  qmathBandAddSub: 'Adding and subtracting',
  qmathBandMultiply: 'Times tables',
  qmathBandDivide: 'Dividing',
  qmathBandMissing: 'Missing number',
  qmathBandMixed: 'Mixed',

  // Quick Rules
  qmathStep1Title: 'Answer with the keypad',
  qmathStep1Body: 'Tap the digits of the answer. There is no time limit.',
  qmathStep2Title: 'It checks itself',
  qmathStep2Body: 'The answer is judged once you have typed enough digits.',
  qmathStep3Title: 'Ten questions to a level',
  qmathStep3Body: 'A wrong answer costs nothing — the same question comes back.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type QuickMathMessages = Record<keyof typeof en, string>;
