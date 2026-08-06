import type { BlockPuzzleMessages } from './en';

export const de: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Blockfeld, 8 mal 8',
  blockCellFilled: 'Zeile {row}, Spalte {col}: belegt',
  blockCellEmpty: 'Zeile {row}, Spalte {col}: leer',
  blockTrayLabel: 'Teile',
  blockPieceLabel: 'Teil {n}, {cells} Felder',
  blockPieceUsed: 'Teil {n}, bereits gesetzt',
  blockPieceSelected: 'Teil {n} ausgewählt',
  blockBestScore: 'Bester Punktestand',
  blockLines: 'Gelöschte Linien',
  blockOverTitle: 'Kein Platz mehr',
  blockOverBody: 'Kein Teil passt noch aufs Feld.',
  blockNewBestScore: 'Dein bisher bester Punktestand.',
  blockStep1Title: 'Ein Teil hineinziehen',
  blockStep1Body: 'Zieh eines der drei Teile aufs Feld. Teile drehen sich nie.',
  blockStep2Title: 'Zeile oder Spalte füllen',
  blockStep2Body:
    'Eine volle Linie verschwindet und leuchtet auf, während du den Stein noch hältst.',
  blockStep3Title: 'Spiel, bis nichts mehr passt',
  blockStep3Body: 'Rückgängig ist gratis und unbegrenzt, ein Fehlgriff kostet also nichts.',
};
