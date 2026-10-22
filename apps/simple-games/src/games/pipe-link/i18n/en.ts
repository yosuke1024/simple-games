/**
 * Pipe Link's own strings (issue #38 pattern): bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts. The shell's
 * en.ts stays the source of truth for shared keys, this file for this game's.
 * Provenance (docs/PIPE_LINK_RULES.md §11): this English is the source.
 *
 * The board itself carries no words: pipes, light, the source and the hint
 * are all shapes (§1, §10). Everything here is chrome — and the spoken names
 * of the tiles, which a screen reader needs where a sighted player reads the
 * board. A tile's pipes are one whole phrase per type and orientation
 * (`pipeLinkPipes_*`, fourteen of them) rather than direction words joined at
 * run time (§11).
 */
export const en = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Choose a board',
  pipeLinkDifficulty_easy: 'Easy',
  pipeLinkDifficulty_medium: 'Medium',
  pipeLinkDifficulty_hard: 'Hard',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'Replace the board in progress?',
  pipeLinkConfirmSwitchBody: 'Your {current} board will be replaced by a new {next} board.',
  pipeLinkBoardLabel: 'Pipe Link board, {width} by {height}',
  /** One tile (§10). `{pipes}` is one of the pipeLinkPipes_* phrases, `{light}` lit or not lit. */
  pipeLinkTile: 'Row {row}, column {col}: {pipes}, {light}',
  /** The same, for the tile the water comes from. */
  pipeLinkTileSource: 'Row {row}, column {col}, the source: {pipes}, {light}',
  /** `{tile}` is one of the two labels above; `{pipes}` the way the hint says to turn it (§6). */
  pipeLinkTileHinted: '{tile}. Hint: turn it to {pipes}',
  pipeLinkLit: 'lit',
  pipeLinkUnlit: 'not lit',
  /** An end: one pipe, a cap in the middle. */
  pipeLinkPipes_end_0: 'end, open up',
  pipeLinkPipes_end_1: 'end, open right',
  pipeLinkPipes_end_2: 'end, open down',
  pipeLinkPipes_end_3: 'end, open left',
  /** A straight: two opposite pipes. */
  pipeLinkPipes_straight_0: 'straight, up and down',
  pipeLinkPipes_straight_1: 'straight, left and right',
  /** A bend (the elbow): two pipes at a right angle. */
  pipeLinkPipes_elbow_0: 'bend, up and right',
  pipeLinkPipes_elbow_1: 'bend, right and down',
  pipeLinkPipes_elbow_2: 'bend, down and left',
  pipeLinkPipes_elbow_3: 'bend, left and up',
  /** A T: three pipes. */
  pipeLinkPipes_tee_0: 'T, up, right and down',
  pipeLinkPipes_tee_1: 'T, right, down and left',
  pipeLinkPipes_tee_2: 'T, down, left and up',
  pipeLinkPipes_tee_3: 'T, left, up and right',
  /** Read after each turn and undo, hidden from sight (§10). */
  pipeLinkAnnounce: 'Row {row}, column {col}: {pipes}. {lit} of {total} tiles lit.',
  /** The line under the board while a hint shows (§6). Never names a technique. */
  pipeLinkHintNote: 'Turn the tile in the dotted ring until its pipes match the faint ones.',
  /** Read with the line above, hidden from sight: where the mark is. */
  pipeLinkHintWhere: 'Marked: row {row}, column {col}. Turn it to {pipes}.',
  /** The result card's title: a fact, not praise (§11). */
  pipeLinkSolvedTitle: 'Every tile is lit',
  pipeLinkSolvedBody: 'Water reaches all {tiles} tiles.',
  pipeLinkBoardSize: 'Board',
  pipeLinkHintsUsed: 'Hints used',
  pipeLinkNewBestTime: 'Your fastest yet.',
  pipeLinkNewBoard: 'New board',
  pipeLinkSolvedCount: 'Boards solved',
  pipeLinkDailySection: 'Daily',
  pipeLinkDailiesCleared: 'Days cleared',
  pipeLinkAllModes: 'All modes',
  pipeLinkStep1Title: 'Tap to turn',
  pipeLinkStep1Body: 'Tap a tile to turn it a quarter turn clockwise.',
  pipeLinkStep2Title: 'Water flows',
  pipeLinkStep2Body: 'Pipes joined to the source fill with water; the others stay hollow.',
  pipeLinkStep3Title: 'Fill every pipe',
  pipeLinkStep3Body: 'When every pipe is full, the board is complete.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type PipeLinkMessages = Record<keyof typeof en, string>;
