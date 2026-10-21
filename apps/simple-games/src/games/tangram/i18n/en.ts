/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * English is the source (docs/TANGRAM_RULES.md §11). Every string is whole —
 * a `{var}` slot, never words joined in code — and the shell's shared keys
 * (`resume`, `howToPlay`, `statistics`, `undo`, `tryAgain`, `timeLabel`, …)
 * are used rather than repeated here. The figures have no names (§11): a
 * figure is its tier and its number. Nothing here promises anything about
 * cost, being offline, ads, purchases or deleting data.
 */
export const en = {
  tangramName: 'Tangram',

  // Tiers and figures (§2, §6). A figure is "Easy 3", never a name.
  tangramTier_easy: 'Easy',
  tangramTier_medium: 'Medium',
  tangramTier_hard: 'Hard',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Daily, {date}',
  tangramSilhouetteLabel: 'Silhouette: {figure}',

  // Home (§6): replacing a figure in progress is the one question asked.
  tangramConfirmReplaceTitle: 'Replace the figure in progress?',
  tangramConfirmReplaceBody: '{current} will be replaced by {next}.',

  // The pieces, read out (§10): kind, turn, side, where, fixed.
  tangramPiece_L1: 'Large triangle 1',
  tangramPiece_L2: 'Large triangle 2',
  tangramPiece_M: 'Medium triangle',
  tangramPiece_P: 'Parallelogram',
  tangramPiece_SQ: 'Square',
  tangramPiece_S1: 'Small triangle 1',
  tangramPiece_S2: 'Small triangle 2',
  tangramPieceInTray: '{piece}, turned {angle}°, in the tray',
  tangramPieceInTrayFlipped: '{piece}, turned {angle}°, flipped, in the tray',
  tangramPieceOnBoard: '{piece}, turned {angle}°, on the board',
  tangramPieceOnBoardFlipped: '{piece}, turned {angle}°, flipped, on the board',
  tangramPieceFixed: '{piece}, turned {angle}°, fixed in place',
  tangramPieceFixedFlipped: '{piece}, turned {angle}°, flipped, fixed in place',

  // The buttons under the board (§4).
  tangramRotate: 'Rotate',
  tangramFlip: 'Flip',

  // While a piece is lifted with the keyboard (§10): whether it fits, and on what.
  tangramLifted:
    '{piece} lifted. Arrow keys move it, Enter places it, Escape returns it to the tray.',
  tangramFitsOutlineVertex: 'Fits, on a corner of the silhouette',
  tangramFitsOutlineEdge: 'Fits, on an edge of the silhouette',
  tangramFitsPieceVertex: 'Fits, on a corner of another piece',
  tangramFitsPieceEdge: 'Fits, on an edge of another piece',
  tangramNoFit: 'Does not fit here',

  // Quick Rules (§9): three steps, one sentence each. Step 1 is interim, like §4.
  tangramStep1Title: 'Drag and turn',
  tangramStep1Body:
    'Drag a piece onto the silhouette to place it, and tap it to turn it (the Flip button turns the parallelogram over).',
  tangramStep2Title: 'Inside, never on top',
  tangramStep2Body: 'A piece fits only inside the silhouette, and never on another piece.',
  tangramStep3Title: 'Fill it',
  tangramStep3Body: 'When all seven pieces fill the silhouette exactly, the figure is complete.',

  // The result card (§7): the fact, not praise.
  tangramResultTitle: 'Figure complete',
  tangramNextFigure: 'Next figure',
  tangramTierLabel: 'Tier',
  tangramFigureLabel: 'Figure',

  // Statistics (§7): counts, never "n of N".
  tangramStatStarted: 'Figures started',
  tangramStatCompleted: 'Figures completed',
  tangramStatDifferent: 'Different figures completed',
  tangramStatDays: 'Days completed',
  tangramStatsAll: 'All play',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type TangramMessages = Record<keyof typeof en, string>;
