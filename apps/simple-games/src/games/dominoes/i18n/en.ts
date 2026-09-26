/**
 * Dominoes's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Dominoes's.
 *
 * `dominoesName` is the literal 'Dominoes' in every locale: a game's title is
 * a proper noun and is never translated (docs/I18N_POLICY.md). Pip values are
 * ASCII digits on the tiles themselves; only the words around them live here.
 *
 * Nothing here promises anything about money, data, or being offline — the
 * one destructive confirmation (replacing a game in progress) reuses the
 * shell's reviewed `confirmNewGameTitle` / `confirmNewGameBody`.
 */
export const en = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: 'Won {wins} · Lost {losses}',

  // The table
  dominoesTileLabel: 'Tile {a}–{b}',
  dominoesLineLabel: 'Line of play: {count} tiles, left end {left}, right end {right}',
  dominoesHandLabel: 'Your tiles',
  dominoesPlayLeft: 'Play on the left end ({value})',
  dominoesPlayRight: 'Play on the right end ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Boneyard',
  dominoesCpuTiles: 'CPU holds {count} tiles',
  dominoesBoneyardTiles: 'Boneyard: {count} tiles',
  dominoesDraw: 'Draw',
  dominoesPass: 'Pass',

  // The one status line
  dominoesYourTurn: 'Your turn',
  dominoesCpuTurn: 'CPU is thinking…',
  dominoesCpuDrew: 'The CPU drew a tile',
  dominoesCpuPassed: 'The CPU passed. Your turn',
  dominoesMustDraw: 'No tile fits. Draw from the boneyard',
  dominoesNoTileFits: 'No tile fits and the boneyard is empty. Pass',
  dominoesChooseEnd: 'Choose an end for this tile',
  dominoesOpenedYou: 'You opened with {tile}',
  dominoesOpenedCpu: 'The CPU opened with {tile}. Your turn',

  // The result
  dominoesWinTitle: 'You win!',
  dominoesWinBodyOut: 'You played your last tile.',
  dominoesWinBodyBlocked: 'Nobody could play, and your pips are fewer.',
  dominoesLoseTitle: 'The CPU wins',
  dominoesLoseBodyOut: 'The CPU played its last tile.',
  dominoesLoseBodyBlocked: 'Nobody could play, and the CPU’s pips are fewer.',
  dominoesDrawTitle: 'A draw',
  dominoesDrawBody: 'Nobody could play, and the pips are level.',
  dominoesScoreYou: 'You score {points}',
  dominoesScoreCpu: 'The CPU scores {points}',
  dominoesPipsLeft: 'Pips left: you {you}, CPU {cpu}',

  // Statistics
  dominoesWins: 'Wins',
  dominoesLosses: 'Losses',
  dominoesDraws: 'Draws',

  // Quick Rules
  dominoesStep1Title: 'Match an end',
  dominoesStep1Body: 'Play a tile whose number matches either open end of the line.',
  dominoesStep2Title: 'Stuck? Draw',
  dominoesStep2Body:
    'If no tile fits, draw from the boneyard until one does. Pass only when it is empty.',
  dominoesStep3Title: 'Go out first',
  dominoesStep3Body: 'Play your last tile to win. The pips left in the other hand are your score.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type DominoesMessages = Record<keyof typeof en, string>;
