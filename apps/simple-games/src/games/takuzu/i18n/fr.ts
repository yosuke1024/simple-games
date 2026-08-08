import type { TakuzuMessages } from './en';

export const fr: TakuzuMessages = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Grille de Takuzu, {size} par {size}',
  takuzuCellEmpty: 'Vide, ligne {row}, colonne {col}',
  takuzuCellZero: '0, ligne {row}, colonne {col}',
  takuzuCellOne: '1, ligne {row}, colonne {col}',
  takuzuCellFixed: '{digit} initial, ligne {row}, colonne {col}',
  takuzuRuleBroken: 'enfreint une règle',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'La ligne surlignée détermine la case marquée.',
  takuzuHintBroken: 'La ligne surlignée enfreint une règle.',
  takuzuHintNone: 'Aucun coup sûr pour le moment.',
  takuzuSolvedTitle: 'Résolu !',
  takuzuSolvedBody: 'Toutes les lignes et colonnes sont valides.',
  takuzuHintsUsed: 'Indices utilisés',
  takuzuNewBestTime: 'Votre meilleur temps.',
  takuzuLevelsSolved: 'Niveaux résolus',
  takuzuDailiesSolved: 'Défis quotidiens résolus',
  takuzuDailyBacklogHint: 'Les jours précédents restent ouverts.',
  takuzuStep1Title: 'Jamais trois à la suite',
  takuzuStep1Body:
    'Appuyez sur une case pour alterner 0, 1 et vide. Le même chiffre ne peut pas se suivre trois fois.',
  takuzuStep2Title: 'Moitié-moitié',
  takuzuStep2Body: 'Chaque ligne et chaque colonne compte autant de 0 que de 1.',
  takuzuStep3Title: 'Aucune ligne en double',
  takuzuStep3Body: 'Deux lignes ne peuvent pas être identiques, ni deux colonnes.',
};
