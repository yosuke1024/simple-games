/**
 * 2048's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for 2048's.
 *
 * The prefix is `merge` rather than `2048` because an identifier cannot begin
 * with a digit (docs/GAME_2048_RULES.md, header). `mergeName` is the literal
 * '2048' in every locale: a game's title is a proper noun and is never
 * translated (docs/I18N_POLICY.md).
 */
export const en = {
  mergeName: '2048',
  mergeBoardLabel: '2048 board, 4 by 4',
  mergeCell: 'Row {row}, column {col}: {value}',
  mergeCellEmpty: 'Row {row}, column {col}: empty',
  mergeBestScore: 'Best score',
  mergeBestTile: 'Largest tile',
  mergeReachedCount: 'Times you reached 2048',
  mergeReachedTitle: 'You reached 2048!',
  mergeReachedBody: 'Keep going — the board is still open.',
  mergeKeepGoing: 'Keep Going',
  mergeOverTitle: 'No moves left',
  mergeOverBody: 'Every square is full and nothing else can merge.',
  mergeNewBestScore: 'Your best score yet.',
  mergeStep1Title: 'Swipe to slide',
  mergeStep1Body: 'Every tile slides that way at once, and two of the same number become one.',
  mergeStep2Title: 'A new tile appears',
  mergeStep2Body: 'One tile is added after every move that changes the board.',
  mergeStep3Title: 'Stuck? Take it back',
  mergeStep3Body: 'Undo is free and unlimited, and it never rerolls the tile you just got.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type Game2048Messages = Record<keyof typeof en, string>;
