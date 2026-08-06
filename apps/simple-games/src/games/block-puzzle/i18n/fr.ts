import type { BlockPuzzleMessages } from './en';

export const fr: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Plateau de blocs, 8 sur 8',
  blockCellFilled: 'Ligne {row}, colonne {col} : occupée',
  blockCellEmpty: 'Ligne {row}, colonne {col} : vide',
  blockTrayLabel: 'Pièces',
  blockPieceLabel: 'Pièce {n}, {cells} cases',
  blockPieceUsed: 'Pièce {n}, déjà posée',
  blockPieceSelected: 'Pièce {n} sélectionnée',
  blockBestScore: 'Meilleur score',
  blockLines: 'Lignes effacées',
  blockOverTitle: 'Plus de place',
  blockOverBody: 'Aucune pièce ne rentre sur le plateau.',
  blockNewBestScore: 'Ton meilleur score à ce jour.',
  blockStep1Title: 'Fais glisser une pièce',
  blockStep1Body: "Amène l'une des trois pièces sur le plateau. Elles ne tournent jamais.",
  blockStep2Title: 'Remplis une ligne ou une colonne',
  blockStep2Body:
    "Une ligne pleine s'efface, et elle s'illumine pendant que tu tiens encore la pièce.",
  blockStep3Title: 'Joue tant que ça rentre',
  blockStep3Body: 'Annuler est gratuit et illimité : une pièce mal posée ne coûte rien.',
};
