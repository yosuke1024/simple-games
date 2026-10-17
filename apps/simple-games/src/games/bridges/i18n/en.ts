/**
 * Bridges' own strings (issue #38 pattern): bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts. The shell's
 * en.ts stays the source of truth for shared keys, this file for this game's.
 * Provenance (docs/BRIDGES_RULES.md §14): this English is the source.
 *
 * The board itself carries no words. Numbers are ASCII digits and every state
 * is a shape (§1, §5), so everything here is chrome — and the spoken names of
 * the islands, which a screen reader needs where a sighted player reads the
 * board. Counts that change a sentence's grammar (no / one / two bridges) are
 * whole sentences of their own rather than a number dropped into one.
 */
export const en = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Choose a board',
  bridgesDifficulty_easy: 'Easy',
  bridgesDifficulty_medium: 'Medium',
  bridgesDifficulty_hard: 'Hard',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Replace the board in progress?',
  bridgesConfirmSwitchBody: 'Your {current} board will be replaced by a new {next} board.',
  bridgesBoardLabel: 'Bridges board, {width} by {height}, {islands} islands',
  /** An island short of its number (§5). */
  bridgesIslandOpen: 'Island {value}, row {row}, column {col}: {count} of {value} bridges',
  /** An island exactly on its number. */
  bridgesIslandComplete: 'Island {value}, row {row}, column {col}: complete',
  /** An island past its number — allowed while playing, shown as a rule broken (§4). */
  bridgesIslandOver: 'Island {value}, row {row}, column {col}: {count} bridges, too many',
  /** `{island}` is one of the three labels above. */
  bridgesIslandSelected: '{island}. Selected',
  /** `{island}` is one of the three labels above; `{bridges}` is 0, 1 or 2. */
  bridgesIslandPartner: '{island}. Can link to the selected island: {bridges} of 2 bridges',
  /** `{island}` is one of the three island labels; the hint marks this island's pair (§9). */
  bridgesIslandHinted: '{island}. Highlighted by the hint',
  /** The same, for the pair's island whose count gives the hint away (§9, step 2a). */
  bridgesIslandHintRing: '{island}. Highlighted by the hint, in the dotted ring',
  bridgesAnnounceNone: 'No bridge between row {row1}, column {col1} and row {row2}, column {col2}',
  bridgesAnnounceOne: 'One bridge between row {row1}, column {col1} and row {row2}, column {col2}',
  bridgesAnnounceTwo: 'Two bridges between row {row1}, column {col1} and row {row2}, column {col2}',
  /** Every number met, more than one group (§3, §5). `{groups}` is 2 or more. */
  bridgesSplitNote:
    'Every number is met, but the islands form {groups} groups. Join them into one.',
  bridgesHintWrong: 'Too many bridges between the highlighted islands.',
  bridgesHintOne: 'The highlighted pair needs at least one bridge.',
  bridgesHintTwo: 'The highlighted pair needs two bridges.',
  bridgesHintOneAt:
    'Count the island in the dotted ring: the highlighted pair needs at least one bridge.',
  bridgesHintTwoAt: 'Count the island in the dotted ring: the highlighted pair needs two bridges.',
  bridgesHintNone: 'No certain step found from here.',
  /** Read after a hint, hidden from sight: where its marks are (§9, §13). */
  bridgesHintWhere: 'Highlighted: row {row1}, column {col1} and row {row2}, column {col2}.',
  /** The same, when the hint also rings one of the pair's islands (§9, step 2a). */
  bridgesHintWhereRing:
    'Highlighted: row {row1}, column {col1} and row {row2}, column {col2}. Dotted ring: row {row}, column {col}.',
  bridgesSolvedTitle: 'All connected!',
  bridgesSolvedBody: 'Every island is joined into one network.',
  bridgesHintsUsed: 'Hints used',
  bridgesNewBestTime: 'Your fastest yet.',
  bridgesNewBoard: 'New board',
  bridgesSolvedCount: 'Boards solved',
  bridgesDailySection: 'Daily',
  bridgesDailiesCleared: 'Days cleared',
  bridgesAllModes: 'All modes',
  bridgesStep1Title: 'Numbers are bridges',
  bridgesStep1Body: 'Each island takes exactly as many bridges as its number.',
  bridgesStep2Title: 'Straight, two at most',
  bridgesStep2Body:
    'Bridges run straight across or down, never cross, and at most two join the same pair.',
  bridgesStep3Title: 'Join them all',
  bridgesStep3Body:
    'Tap an island, then a ringed partner to add a bridge (again for two, again for none), until every island is linked.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BridgesMessages = Record<keyof typeof en, string>;
