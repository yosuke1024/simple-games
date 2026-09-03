/**
 * Futoshiki's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for futoshiki's.
 *
 * The board itself carries no words. Its digits are ASCII `1`-`7` and its
 * signs are ASCII `<` and `>`, identical in every locale
 * (docs/FUTOSHIKI_RULES.md §1, docs/I18N_POLICY.md) — so everything here is
 * chrome, plus the words a screen reader hears where a sighted player sees a
 * sign.
 *
 * TWO RULES THIS CATALOG IS HELD TO
 *
 * A sign is described in WORDS, never by naming the character (§13). "Less
 * than" tells a listener nothing about which of two squares is the small one,
 * which is the only thing the sign says.
 *
 * The hint strings never name an axis. `findHint` can settle a square from a
 * row, from a column, or from the signs around it, so any locale that wrote
 * "row" here would be wrong a third of the time — the exact bug four of
 * Takuzu's locales shipped with.
 */
export const en = {
  futoshikiName: 'Futoshiki',
  /**
   * Free Play's tiers (docs/FUTOSHIKI_RULES.md §9「フリープレイ」). This
   * game has no tiers of its own — a tier here names a representative
   * level's parameters — so the three words are the usual three.
   */
  futoshikiTier_easy: 'Easy',
  futoshikiTier_medium: 'Medium',
  futoshikiTier_hard: 'Hard',
  futoshikiBoardLabel: 'Futoshiki board, {size} by {size}',
  futoshikiCellEmpty: 'Empty, row {row}, column {col}',
  futoshikiCellEntry: '{value}, row {row}, column {col}',
  futoshikiCellGiven: '{value}, given, row {row}, column {col}',
  /** Appended to a cell's label while it takes part in breaking a rule (§5). */
  futoshikiRuleBroken: 'Breaks a rule',
  /**
   * One sign, in words. Read on the sign itself and again on each of the two
   * squares it touches, so a listener meets it whichever way they arrive (§13).
   * The smaller side is always the first position named.
   */
  futoshikiSignAcross: 'Row {row}: column {small} is smaller than column {large}',
  futoshikiSignDown: 'Column {col}: row {small} is smaller than row {large}',
  futoshikiSizeLabel: '{n}×{n}',
  futoshikiPadLabel: 'Number pad',
  futoshikiPadKey: '{value}, {n} left',
  futoshikiPadNoteKey: 'Note {value}',
  futoshikiErase: 'Erase',
  futoshikiNotes: 'Notes',
  futoshikiMistakes: 'Mistakes',
  futoshikiHintsUsed: 'Hints used',
  futoshikiHintPlacement: 'The highlighted squares leave one digit for the marked one.',
  futoshikiHintElimination: 'The highlighted squares rule digits out of the marked ones.',
  futoshikiHintBrokenSign: 'These two squares break the sign between them.',
  futoshikiHintBrokenLine: 'The highlighted squares repeat a digit.',
  futoshikiHintNone: 'Nothing can be worked out yet.',
  futoshikiSolvedTitle: 'Solved!',
  futoshikiSolvedBody: 'Every row, every column and every sign holds.',
  futoshikiNewBestTime: 'Your fastest yet.',
  futoshikiLevelsSolved: 'Levels solved',
  futoshikiDailiesSolved: 'Dailies solved',
  futoshikiDailyBacklogHint: 'Every earlier day stays open.',
  futoshikiHighlightMistakes: 'Show mistakes',
  futoshikiHighlightMistakesNote:
    'Marks a digit that does not match the solution. Broken rules are always marked.',
  futoshikiStep1Title: 'Each digit once',
  futoshikiStep1Body: 'Every row and every column holds each digit exactly once.',
  futoshikiStep2Title: 'Follow the signs',
  futoshikiStep2Body: 'A sign between two squares points at the smaller one.',
  futoshikiStep3Title: 'Notes and hints',
  futoshikiStep3Body: 'Pencil in candidates when unsure. Stuck? Take a hint.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type FutoshikiMessages = Record<keyof typeof en, string>;
